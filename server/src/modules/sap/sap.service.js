import { sapConfig } from './sap.config.js';
import { PurchaseOrder } from '../../models/PurchaseOrder.js';
import { Supplier } from '../../models/Supplier.js';

const authHeader = () => `Basic ${Buffer.from(`${sapConfig.username}:${sapConfig.password}`).toString('base64')}`;
const rowsFromPayload = (payload) => payload?.value || payload?.d?.results || [];
const nextLinkFromPayload = (payload) => payload?.['@odata.nextLink'] || payload?.d?.__next || null;
const valueOf = (row, keys, fallback = '') => {
  const key = keys.find((candidate) => row?.[candidate] !== undefined && row?.[candidate] !== null);
  return key ? row[key] : fallback;
};

const cleanString = (value, fallback = '') => {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
};

// SAP OData v2 serializes dates as /Date(1741132800000)/. Mongoose cannot
// cast that representation itself, so normalize it before bulkWrite.
const parseSapDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const odataMatch = String(value).match(/^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/);
  const date = odataMatch ? new Date(Number(odataMatch[1])) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseSapNumber = (value) => {
  if (value === undefined || value === null || value === '') return 0;
  const number = Number(String(value).replaceAll(',', '').trim());
  return Number.isFinite(number) ? number : 0;
};

export const sapFetch = async (pathOrUrl) => {
  if (!sapConfig.username || !sapConfig.password) throw new Error('SAP credentials are not configured.');
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${sapConfig.baseUrl}${pathOrUrl}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json', Authorization: authHeader() },
    signal: AbortSignal.timeout(sapConfig.timeoutMs)
  });
  if (!response.ok) {
    let detail = '';
    try {
      const payload = await response.json();
      detail = payload?.error?.message?.value || payload?.error?.message || '';
    } catch {
      // The status code remains useful when SAP returns a non-JSON proxy page.
    }
    throw new Error(`SAP responded with HTTP ${response.status}${detail ? `: ${detail}` : '.'}`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('json')) throw new Error('SAP returned a non-JSON response.');
  return response.json();
};

export const fetchAllSapRows = async (endpoint, query = '') => {
  let nextUrl = `${endpoint}${query ? `?${query}` : ''}`;
  const rows = [];
  let page = 0;
  for (; nextUrl && page < sapConfig.maxPages; page += 1) {
    const payload = await sapFetch(nextUrl);
    const pageRows = rowsFromPayload(payload);
    if (!Array.isArray(pageRows)) throw new Error('SAP returned an invalid OData collection.');
    rows.push(...pageRows);
    nextUrl = nextLinkFromPayload(payload);
  }
  if (nextUrl) throw new Error(`SAP pagination exceeded the configured limit of ${sapConfig.maxPages} pages.`);
  return rows;
};

const mapPurchaseOrder = (row) => ({
  poNumber: cleanString(valueOf(row, ['PurchaseOrder', 'PurchaseOrderNumber', 'PONumber', 'EBELN'])),
  supplierId: cleanString(valueOf(row, ['Supplier', 'SupplierNumber', 'LIFNR'])),
  supplierName: cleanString(valueOf(row, ['BPSupplierName', 'SupplierName', 'VendorName', 'Name1'])),
  companyCode: cleanString(valueOf(row, ['CompanyCode', 'BUKRS'])),
  currency: cleanString(valueOf(row, ['DocumentCurrency', 'Currency', 'WAERS']), 'INR'),
  totalAmount: parseSapNumber(valueOf(row, ['NetAmount', 'PurchaseOrderNetAmount', 'TotalNetAmount', 'GrossAmount', 'Amount'])),
  documentDate: parseSapDate(valueOf(row, ['PurchaseOrderDate', 'DocumentDate', 'BEDAT'])),
  status: cleanString(valueOf(row, ['PurchasingProcessingStatus', 'Status']), 'Open'),
  sapUpdatedAt: parseSapDate(valueOf(row, ['LastChangeDateTime', 'ChangedAt'])),
  sapPayload: row,
  lastSyncedAt: new Date()
});

const mapSupplier = (row) => ({
  supplierId: cleanString(valueOf(row, ['Supplier', 'SupplierNumber', 'BusinessPartner', 'LIFNR'])),
  name: cleanString(valueOf(row, ['BPSupplierName', 'SupplierName', 'OrganizationBPName1', 'Name1']), 'Unnamed supplier'),
  city: cleanString(valueOf(row, ['BPAddrCityName', 'CityName', 'City'])),
  country: cleanString(valueOf(row, ['Country', 'CountryCode'])),
  taxNumber: cleanString(valueOf(row, ['TaxNumber3', 'TaxNumber1', 'TaxNumber'])),
  email: cleanString(valueOf(row, ['EmailAddress'])).toLowerCase(),
  address: cleanString(valueOf(row, ['BPAddrStreetName', 'StreetName'])),
  postalCode: cleanString(valueOf(row, ['PostalCode'])),
  region: cleanString(valueOf(row, ['Region'])),
  gstin: cleanString(valueOf(row, ['TaxNumber3'])),
  pan: cleanString(valueOf(row, ['BusinessPartnerPanNumber', 'TaxNumber2'])),
  status: valueOf(row, ['PostingIsBlocked']) === true ? 'Inactive' : 'Active',
  sapPayload: row,
  lastSyncedAt: new Date()
});

const persistRows = async (Model, rows, mapRow, key) => {
  const mapped = [];
  let failed = 0;
  for (const row of rows) {
    try {
      const item = mapRow(row);
      if (item[key]) mapped.push(item);
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  if (!mapped.length) return { fetched: rows.length, created: 0, updated: 0, failed: rows.length };
  const uniqueMapped = [...new Map(mapped.map((item) => [item[key], item])).values()];
  const operations = uniqueMapped.map((item) => ({
    updateOne: { filter: { [key]: item[key] }, update: { $set: item }, upsert: true }
  }));
  const result = await Model.bulkWrite(operations, { ordered: false });
  return {
    fetched: rows.length,
    created: result.upsertedCount || 0,
    updated: result.matchedCount || 0,
    failed
  };
};

export const syncPurchaseOrders = async (poNumbers = []) => {
  let rows;
  if (poNumbers.length) {
    const unique = [...new Set(poNumbers.map(String).map((item) => item.trim()).filter(Boolean))];
    const filters = unique.map((number) => `PurchaseOrder eq '${number.replaceAll("'", "''")}'`).join(' or ');
    rows = await fetchAllSapRows(sapConfig.endpoints.purchaseOrders, `$filter=${encodeURIComponent(filters)}`);
  } else {
    rows = await fetchAllSapRows(sapConfig.endpoints.purchaseOrders);
  }
  return persistRows(PurchaseOrder, rows, mapPurchaseOrder, 'poNumber');
};

export const syncSuppliers = async () => {
  const rows = await fetchAllSapRows(sapConfig.endpoints.suppliers);
  return persistRows(Supplier, rows, mapSupplier, 'supplierId');
};

export const testSapConnection = async () => {
  await sapFetch(`${sapConfig.endpoints.purchaseOrders}?$top=1`);
  return true;
};
