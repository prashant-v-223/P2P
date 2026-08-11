import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { connectDB } from './index.js';
import { Vendor } from '../models/Vendor.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { AdvancePayment } from '../models/AdvancePayment.js';
import { InvoicePayment } from '../models/InvoicePayment.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { Permission } from '../models/Permission.js';
import { ensureAllWorkflows } from '../modules/workflows/workflowDefaults.js';
import { Workflow } from '../models/Workflow.js';
import { RfqHeader, RfqQuote, RfqBlEntry } from '../models/RfqLogistics.js';
import { Approval } from '../models/Approval.js';
import { CustomAgent } from '../models/CustomAgent.js';
import { BlInvoice } from '../models/BlInvoice.js';
import { ExchangeRate } from '../models/ExchangeRate.js';
import { Document } from '../models/Document.js';

if (typeof process.loadEnvFile === 'function') process.loadEnvFile();
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const includeSystem = args.includes('--include-system');
const replace = args.includes('--replace');
const finalizeReplace = args.includes('--finalize-replace');
const canonicalSqlConfig = replace || finalizeReplace;
const syncCustomAgents = replace || args.includes('--sync-custom-agents');
const confirmReplace = args.find((arg) => arg.startsWith('--confirm-replace='))?.split('=')[1];
const adminPassword = args.find((arg) => arg.startsWith('--admin-password='))?.slice('--admin-password='.length);
const fileArg = args.find((arg) => !arg.startsWith('--'));

if (!fileArg) {
  console.error('Usage: npm run import:legacy -- <dump.sql> [--apply] [--include-system]');
  process.exit(1);
}

const dumpPath = path.resolve(fileArg);
const source = fs.readFileSync(dumpPath, 'utf8');
const sourceHash = crypto.createHash('sha256').update(source).digest('hex');
const SYSTEM_TABLES = new Set([
  'failed_jobs', 'jobs', 'migrations', 'password_reset_tokens', 'personal_access_tokens', 'sessions'
]);
const SECRET_COLUMNS = new Set([
  'password', 'remember_token', 'two_factor_secret', 'two_factor_recovery_codes', 'token'
]);

const decodeSqlString = (value) => value
  .replace(/\\0/g, '\0').replace(/\\n/g, '\n').replace(/\\r/g, '\r')
  .replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');

const convertValue = (raw) => {
  const value = raw.trim();
  if (/^null$/i.test(value)) return null;
  if (value.startsWith("'") && value.endsWith("'")) return decodeSqlString(value.slice(1, -1));
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
};

const parseTuples = (text) => {
  const rows = [];
  let row = null;
  let field = '';
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      field += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === "'") quoted = false;
      continue;
    }
    if (char === "'") { quoted = true; field += char; continue; }
    if (char === '(' && row === null) { row = []; field = ''; continue; }
    if (row === null) continue;
    if (char === ',') { row.push(convertValue(field)); field = ''; continue; }
    if (char === ')') { row.push(convertValue(field)); rows.push(row); row = null; field = ''; continue; }
    field += char;
  }
  return rows;
};

function* insertStatements(sql) {
  const header = /INSERT INTO `([^`]+)`\s*\(([^)]+)\) VALUES\s*/g;
  let match;
  while ((match = header.exec(sql))) {
    let quoted = false;
    let escaped = false;
    let end = header.lastIndex;
    for (; end < sql.length; end += 1) {
      const char = sql[end];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === "'") quoted = false;
      } else if (char === "'") quoted = true;
      else if (char === ';') break;
    }
    const columns = [...match[2].matchAll(/`([^`]+)`/g)].map((item) => item[1]);
    yield { table: match[1], columns, values: sql.slice(header.lastIndex, end) };
    header.lastIndex = end + 1;
  }
}

const tables = new Map();
for (const statement of insertStatements(source)) {
  if (!includeSystem && SYSTEM_TABLES.has(statement.table)) continue;
  const list = tables.get(statement.table) || [];
  for (const values of parseTuples(statement.values)) {
    if (values.length !== statement.columns.length) {
      throw new Error(`Column mismatch in ${statement.table}: expected ${statement.columns.length}, got ${values.length}`);
    }
    const row = Object.fromEntries(statement.columns.map((column, index) => [
      column,
      SECRET_COLUMNS.has(column) ? '[REDACTED]' : values[index]
    ]));
    list.push(row);
  }
  tables.set(statement.table, list);
}

console.log(`Legacy dump: ${dumpPath}`);
console.log(`SHA-256: ${sourceHash}`);
console.table([...tables].map(([table, rows]) => ({ table, rows: rows.length })));
if (!apply) {
  console.log('Dry run complete. No database changes made. Add --apply to import.');
  process.exit(0);
}

const connected = await connectDB({ seed: false, ensureWorkflows: false });
if (!connected) throw new Error('MongoDB connection is required; import was not started.');

if (replace) {
  const databaseName = mongoose.connection.name;
  if (confirmReplace !== databaseName) throw new Error(`Replacement requires --confirm-replace=${databaseName}`);
  if (!adminPassword || adminPassword.length < 12) throw new Error('Replacement requires --admin-password with at least 12 characters.');
  const backupName = `${databaseName}_backup_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
  const backupDb = mongoose.connection.client.db(backupName);
  const collections = await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray();
  console.log(`[BACKUP] Copying ${collections.length} collections to ${backupName}...`);
  for (const { name } of collections) {
    const target = backupDb.collection(name);
    let batch = [];
    for await (const document of mongoose.connection.db.collection(name).find({})) {
      batch.push(document);
      if (batch.length === 1000) { await target.insertMany(batch, { ordered: false }); batch = []; }
    }
    if (batch.length) await target.insertMany(batch, { ordered: false });
  }
  await backupDb.collection('_replacement_metadata').insertOne({ sourceDatabase: databaseName, sourceHash, createdAt: new Date() });
  console.log(`[BACKUP] Complete: ${backupName}`);
  for (const { name } of collections) await mongoose.connection.db.collection(name).drop();
  console.log(`[REPLACE] Cleared ${collections.length} source collections after successful backup.`);
}

const id = (prefix, value) => `${prefix}-${value}`;
const str = (value, fallback = '') => value == null ? fallback : String(value);
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const date = (value) => {
  if (!value) return undefined;
  const parsed = new Date(`${value}${String(value).length === 10 ? 'T00:00:00.000Z' : 'Z'}`);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed;
};
const activeRow = (row) => !row.deleted_at;
const byId = (table) => new Map((tables.get(table) || []).map((row) => [str(row.id), row]));
const users = byId('users');
const roles = byId('roles');
const vendors = byId('vendor_users');
const pos = byId('purchase_orders');
const providers = byId('logistics_providers');
const blEntries = byId('rfq_bl_entries');
const blInvoices = byId('rfq_bl_invoices');
const summary = { staged: 0, permissions: 0, users: 0, roles: 0, customAgents: 0, vendors: 0, purchaseOrders: 0, advances: 0, invoices: 0, rfqs: 0, rfqQuotes: 0, blEntries: 0, blInvoices: 0, documents: 0, exchangeRates: 0, approvals: 0 };
const permissionOps = [];
const roleOps = [];
const userOps = [];
const vendorOps = [];
const purchaseOrderOps = [];
const advanceOps = [];
const invoiceOps = [];
const workflowOps = [];
const rfqOps = [];
const rfqQuoteOps = [];
const blEntryOps = [];
const approvalOps = [];
const customAgentOps = [];
const blAgentRepairOps = [];
const blDocumentRepairOps = [];
const blInvoiceOps = [];
const exchangeRateOps = [];
const documentOps = [];
const sqlUsdRate = num((tables.get('exchange_rates') || []).find((row) => str(row.currency_code || row.currency).toUpperCase() === 'USD')?.rate_to_inr, 95.3487);
const rfqHeaders = tables.get('rfq_headers') || [];
const rfqHeaderById = new Map(rfqHeaders.map((row) => [str(row.id), row]));
const rfqQuoteRows = tables.get('rfq_quotes') || [];
const effectiveRfqRate = (rfq) => {
  const historicalRate = num(rfq?.allocation_exchange_rate);
  return historicalRate > 0 ? historicalRate : sqlUsdRate;
};
const calculatedQuoteTotal = (row, rfq) => num(row.total_price)
  || Math.round((num(row.ocean_freight_usd || row.unit_price) * effectiveRfqRate(rfq)
    + num(row.shipping_line_charges_inr) + num(row.other_charges_inr)) * 100) / 100;
const calculatedQuoteRank = new Map();
const quoteRowsByRfq = new Map();
for (const row of rfqQuoteRows) {
  const rows = quoteRowsByRfq.get(str(row.rfq_id)) || [];
  rows.push(row);
  quoteRowsByRfq.set(str(row.rfq_id), rows);
}
for (const [rfqId, rows] of quoteRowsByRfq) {
  const rfq = rfqHeaderById.get(rfqId);
  [...rows].sort((left, right) => calculatedQuoteTotal(left, rfq) - calculatedQuoteTotal(right, rfq))
    .forEach((row, index) => calculatedQuoteRank.set(str(row.id), `L${index + 1}`));
}

const userRoleByUserId = new Map((tables.get('model_has_roles') || [])
  .filter((row) => String(row.model_type || '').endsWith('\\User'))
  .map((row) => [str(row.model_id), str(roles.get(str(row.role_id))?.name, 'procurement')]));
const disabledPasswordHash = await User.hashPassword(crypto.randomBytes(48).toString('base64url'));
const adminPasswordHash = replace ? await User.hashPassword(adminPassword) : disabledPasswordHash;
const disabledAgentPasswordHash = await CustomAgent.hashPassword(crypto.randomBytes(48).toString('base64url'));
const permissionById = byId('permissions');
const permissionKeysByRoleId = new Map();
for (const row of (tables.get('role_has_permissions') || [])) {
  const key = str(permissionById.get(str(row.permission_id))?.name);
  if (!key) continue;
  const list = permissionKeysByRoleId.get(str(row.role_id)) || [];
  list.push(key);
  permissionKeysByRoleId.set(str(row.role_id), list);
}
const permissionObject = (keys) => keys.reduce((result, key) => {
  const separator = key.lastIndexOf('.');
  if (separator < 1) return result;
  const module = key.slice(0, separator);
  const action = key.slice(separator + 1);
  result[module] = [...new Set([...(result[module] || []), action])];
  return result;
}, {});
const rfqInvitesById = new Map();
for (const row of (tables.get('rfq_vendors') || [])) {
  const vendor = vendors.get(str(row.vendor_user_id));
  if (!vendor) continue;
  const list = rfqInvitesById.get(str(row.rfq_id)) || [];
  list.push({ vendorId: id('legacy-vendor', row.vendor_user_id), companyName: str(vendor.company_name), sapVendorCode: str(vendor.sap_vendor_code), legacyStatus: str(row.status) });
  rfqInvitesById.set(str(row.rfq_id), list);
}
const rfqAllocationsById = new Map();
for (const row of (tables.get('rfq_award_allocations') || [])) {
  const vendor = vendors.get(str(row.vendor_user_id));
  const list = rfqAllocationsById.get(str(row.rfq_id)) || [];
  list.push({
    vendorId: id('legacy-vendor', row.vendor_user_id), vendorName: str(vendor?.company_name, 'Legacy vendor'),
    quoteId: row.rfq_quote_id ? id('legacy-quote', row.rfq_quote_id) : '', containers: num(row.awarded_containers),
    ratePerContainerInr: num(row.rate_per_container_inr), totalAmountInr: num(row.total_amount_inr), remarks: str(row.remarks), approved: true
  });
  rfqAllocationsById.set(str(row.rfq_id), list);
}
const workflowStepsById = new Map();
for (const row of (tables.get('approval_workflow_steps') || [])) {
  const list = workflowStepsById.get(str(row.workflow_id)) || [];
  list.push({
    step: num(row.step_number), title: str(row.step_name), roleKey: str(row.approver_role), roleName: str(row.approver_role),
    approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: num(row.escalation_hours, 48)
  });
  workflowStepsById.set(str(row.workflow_id), list);
}
const approvalActionsByInstanceId = new Map();
for (const row of (tables.get('approval_actions') || [])) {
  const actionUser = users.get(str(row.actioned_by));
  const list = approvalActionsByInstanceId.get(str(row.instance_id)) || [];
  list.push({
    action: str(row.action), step: num(row.step_number, 1), statusAtAction: str(row.action), role: userRoleByUserId.get(str(row.actioned_by)) || '',
    actionedBy: str(actionUser?.name, id('legacy-user', row.actioned_by)), actionedAt: date(row.actioned_at) || new Date(), remarks: str(row.comments),
    idempotencyKey: id('legacy-action', row.id)
  });
  approvalActionsByInstanceId.set(str(row.instance_id), list);
}

const blDocumentsByEntryId = new Map();
for (const row of (tables.get('rfq_bl_documents') || [])) {
  const list = blDocumentsByEntryId.get(str(row.bl_entry_id)) || [];
  list.push({
    docType: str(row.document_label || row.document_type || 'Other'),
    fileUrl: str(row.file_path),
    fileName: str(row.original_filename),
    uploadedBy: `${str(row.uploaded_by_type, 'legacy')} (Legacy SQL)`,
    uploadedAt: date(row.created_at) || new Date(),
    stage: str(row.stage)
  });
  blDocumentsByEntryId.set(str(row.bl_entry_id), list);
}

const blInvoiceDocumentsByInvoiceId = new Map();
for (const row of (tables.get('rfq_bl_invoice_documents') || [])) {
  const list = blInvoiceDocumentsByInvoiceId.get(str(row.bl_invoice_id)) || [];
  list.push({
    documentType: str(row.document_type), label: str(row.document_label), filePath: str(row.file_path),
    originalFilename: str(row.original_filename), uploadedAt: date(row.created_at) || new Date()
  });
  blInvoiceDocumentsByInvoiceId.set(str(row.bl_invoice_id), list);
}

for (const [table, rows] of tables) {
  const collection = mongoose.connection.db.collection(`legacy_mysql_${table}`);
  if (rows.length) {
    const operations = rows.map((row) => ({
      updateOne: {
        filter: { sourceHash, legacyId: str(row.id || crypto.createHash('sha1').update(JSON.stringify(row)).digest('hex')) },
        update: { $setOnInsert: { sourceHash, sourceTable: table, legacyId: str(row.id || ''), importedAt: new Date(), data: row } },
        upsert: true
      }
    }));
    const result = await collection.bulkWrite(operations, { ordered: false });
    summary.staged += result.upsertedCount + result.modifiedCount;
  }
}

for (const row of (tables.get('permissions') || [])) {
  const key = str(row.name).toLowerCase();
  const separator = key.lastIndexOf('.');
  permissionOps.push({ updateOne: {
    filter: { key },
    update: { $setOnInsert: {
      id: id('legacy-permission', row.id), key, name: key, module: key.slice(0, separator), action: key.slice(separator + 1),
      description: 'Imported from the legacy SQL permission registry.', type: 'System', status: 'Active'
    } },
    upsert: true
  } });
  summary.permissions += 1;
}

for (const row of (tables.get('roles') || [])) {
  roleOps.push({ updateOne: {
    filter: { roleName: str(row.name) },
    update: { $setOnInsert: {
      id: id('legacy-role', row.id), roleName: str(row.name), description: 'Imported legacy role; permissions remain managed by the current permission matrix.',
      type: 'Custom', status: 'Active', permissions: permissionObject(permissionKeysByRoleId.get(str(row.id)) || []), legacyMysqlId: row.id, legacyImportedAt: new Date()
    } },
    upsert: true
  } });
  summary.roles += 1;
}

const workflowCategory = (module) => ({
  advance_payment: 'Advance Payment', invoice_payment: 'Invoice Payment', custom_duty: 'Custom Duty',
  bl_invoice_payment: 'BL Freight Invoice', logistics_payment: 'Logistics Payment', rfq: 'RFQ Vendor Award'
}[module] || str(module));
for (const row of (tables.get('approval_workflows') || [])) {
  workflowOps.push({ updateOne: {
    filter: { id: id('legacy-workflow', row.id) },
    update: { $setOnInsert: {
      id: id('legacy-workflow', row.id), definitionKey: `legacy_${str(row.module)}_${row.id}`, version: 1,
      category: workflowCategory(row.module), name: str(row.name), minAmount: num(row.min_amount), maxAmount: row.max_amount == null ? null : num(row.max_amount),
      description: str(row.description), status: num(row.is_active) ? 'Active' : 'Inactive', priority: 100,
      conditions: {}, effectiveFrom: date(row.created_at) || new Date(), createdBy: 'legacy-sql-import',
      steps: (workflowStepsById.get(str(row.id)) || []).sort((a, b) => a.step - b.step)
    } },
    upsert: true
  } });
}

for (const row of (tables.get('users') || [])) {
  const role = userRoleByUserId.get(str(row.id)) || 'procurement';
  userOps.push({ updateOne: {
    filter: { email: str(row.email).toLowerCase() },
    update: { $setOnInsert: {
      id: id('legacy-user', row.id), name: str(row.name), email: str(row.email).toLowerCase(), passwordHash: role === 'admin' ? adminPasswordHash : disabledPasswordHash,
      role, department: str(row.department, role.includes('finance') || ['cfo', 'accounts'].includes(role) ? 'Finance' : 'Procurement'),
      status: str(row.status).toLowerCase() === 'active' ? 'Active' : 'Inactive', avatar: str(row.name).split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
      hierarchyLevel: ['admin', 'md'].includes(role) ? 0 : role === 'cfo' ? 1 : ['finance', 'procurement_head', 'exim-manager'].includes(role) ? 2 : 3,
      canSeeAllRequests: ['admin', 'md'].includes(role), isManager: ['admin', 'md', 'cfo', 'finance', 'procurement_head', 'exim-manager'].includes(role),
      legacyMysqlId: row.id, legacyImportedAt: new Date(), passwordResetRequired: true
    } },
    upsert: true
  } });
  summary.users += 1;
}

for (const row of (tables.get('custom_agent_users') || []).filter(activeRow)) {
  const assignedBls = (tables.get('rfq_bl_entries') || []).filter((bl) => activeRow(bl) && str(bl.assigned_agent_id) === str(row.id));
  customAgentOps.push({ updateOne: {
    filter: { agentId: id('legacy-agent', row.id) },
    update: { $setOnInsert: {
      agentId: id('legacy-agent', row.id), agencyName: str(row.company_name || row.name, 'Legacy Customs Agent'),
      licenceNumber: str(row.cha_license, `LEGACY-PENDING-${row.id}`), portLocation: 'Not specified', contactPerson: str(row.name),
      phone: str(row.phone, 'Not provided'), email: str(row.email).toLowerCase(), iecCode: str(row.iec_code),
      paymentTerms: str(row.payment_term_days, '30'), passwordHash: disabledAgentPasswordHash,
      status: str(row.status).toLowerCase() === 'active' ? 'Active' : 'Inactive', portalAccessEnabled: false,
      assignedBlCount: assignedBls.length, clearedBlCount: assignedBls.filter((bl) => str(bl.status) === 'custom_cleared').length,
      legacyMysqlId: row.id, legacyImportedAt: new Date(), passwordResetRequired: true
    } }, upsert: true, timestamps: false
  } });
  summary.customAgents += 1;
}

for (const row of (tables.get('vendor_users') || []).filter(activeRow)) {
  vendorOps.push({ updateOne: { filter: { sapVendorCode: str(row.sap_vendor_code) }, update: { $setOnInsert: {
    id: id('legacy-vendor', row.id), supplierId: str(row.sap_vendor_code), sapVendorCode: str(row.sap_vendor_code),
    companyName: str(row.company_name), contactPerson: str(row.contact_person), phone: str(row.phone), email: str(row.email),
    vendorType: str(row.vendor_type, 'domestic').toUpperCase(), paymentTerms: row.payment_term_days == null ? '30 Days' : `${row.payment_term_days} Days`,
    status: str(row.status).toLowerCase() === 'active' ? 'Active' : 'Inactive', gstin: str(row.gstin), pan: str(row.pan),
    bankName: str(row.bank_name), branch: str(row.bank_branch), accountNumber: str(row.bank_account), ifscCode: str(row.ifsc_code),
    legacyMysqlId: row.id, legacyImportedAt: new Date(), portalAccessEnabled: false
  } }, upsert: true } });
  summary.vendors += 1;
}

for (const row of (tables.get('purchase_orders') || [])) {
  purchaseOrderOps.push({ updateOne: { filter: { poNumber: str(row.sap_po_number) }, update: { $setOnInsert: {
    poNumber: str(row.sap_po_number), sapPoNumber: str(row.sap_po_number), supplierId: str(row.sap_vendor_code), supplierName: str(row.vendor_name),
    companyCode: str(row.company_code, '1000'), currency: str(row.currency, 'INR'), totalAmount: num(row.total_amount),
    advancePaid: num(row.advance_paid), advanceCommitted: num(row.advance_committed), amountLocked: Boolean(num(row.amount_locked)),
    previousTotalAmount: num(row.previous_total_amount, undefined), documentDate: date(row.po_date), status: str(row.status, 'open'),
    sapPayload: row.sap_raw_data, sapUpdatedAt: date(row.synced_at), lastSyncedAt: date(row.synced_at) || date(row.updated_at) || new Date(),
    legacyMysqlId: row.id, legacyImportedAt: new Date()
  } }, upsert: true } });
  summary.purchaseOrders += 1;
}

for (const row of (tables.get('advance_payments') || [])) {
  const po = pos.get(str(row.purchase_order_id));
  const vendor = vendors.get(str(row.vendor_user_id));
  const requester = users.get(str(row.requested_by));
  advanceOps.push({ updateOne: { filter: { advanceId: str(row.reference_number) }, update: { $setOnInsert: {
    advanceId: str(row.reference_number), poId: str(po?.sap_po_number || row.purchase_order_id), sapPoNumber: str(po?.sap_po_number || row.purchase_order_id),
    vendorId: str(row.sap_vendor_code), vendorName: str(vendor?.company_name || po?.vendor_name || row.sap_vendor_code), amount: num(row.requested_amount),
    currency: str(row.currency, 'INR'), percentageOfPo: num(row.percentage_of_po), gstBreakup: { cgst: num(row.cgst_amount), sgst: num(row.sgst_amount), igst: num(row.igst_amount), totalGst: num(row.total_gst_amount) },
    paymentMode: str(row.payment_mode, 'NEFT'), remarks: str(row.reason), status: str(row.status, 'draft'), utrNumber: str(row.utr_number), paidAt: date(row.paid_at),
    adjustedAmount: num(row.adjusted_amount), adjustmentInvoiceId: str(row.adjustment_invoice_id), createdBy: str(requester?.name, 'Legacy import'),
    createdByType: row.vendor_user_id ? 'vendor' : 'user', createdByVendorId: row.vendor_user_id ? id('legacy-vendor', row.vendor_user_id) : '',
    requestedBy: str(requester?.name || vendor?.company_name, 'Legacy import'), requestedById: row.vendor_user_id ? id('legacy-vendor', row.vendor_user_id) : id('legacy-user', row.requested_by),
    userId: row.vendor_user_id ? id('legacy-vendor', row.vendor_user_id) : id('legacy-user', row.requested_by), isDeleted: false,
    legacyDeletedAt: date(row.deleted_at), legacyMysqlId: row.id, legacyImportedAt: new Date()
  } }, upsert: true } });
  summary.advances += 1;
}

for (const row of (tables.get('invoice_payments') || []).filter(activeRow)) {
  const po = pos.get(str(row.purchase_order_id));
  const vendor = vendors.get(str(row.vendor_user_id));
  const requester = users.get(str(row.requested_by));
  const vendorCreated = Boolean(row.vendor_user_id);
  invoiceOps.push({ updateOne: { filter: { invoicePaymentId: str(row.reference_number) }, update: { $setOnInsert: {
    invoicePaymentId: str(row.reference_number), poId: str(po?.sap_po_number || row.purchase_order_id), sapPoNumber: str(po?.sap_po_number || row.purchase_order_id),
    vendorId: str(row.sap_vendor_code), vendorName: str(vendor?.company_name || po?.vendor_name || row.sap_vendor_code), invoiceNumber: str(row.invoice_number),
    asnNumber: str(row.asn_number), invoiceDate: date(row.invoice_date), grossAmount: num(row.invoice_amount), currency: str(row.currency, 'INR'),
    gstAmount: num(row.cgst_amount) + num(row.sgst_amount) + num(row.igst_amount), tdsAmount: num(row.tds_amount), tdsPercentage: num(row.tds_percent),
    advanceAdjusted: num(row.advance_adjusted), netPayable: num(row.net_payable), grnNumber: str(row.grn_number), remarks: str(row.remarks),
    threeWayMatch: { status: str(row.three_way_match, 'pending') }, status: str(row.status, 'draft'), utrNumber: str(row.utr_number), paidAt: date(row.paid_at),
    createdBy: str(vendorCreated ? vendor?.company_name : requester?.name, 'Legacy import'), createdByType: vendorCreated ? 'vendor' : 'user',
    createdByVendorId: vendorCreated ? id('legacy-vendor', row.vendor_user_id) : '', requestedBy: str(vendorCreated ? vendor?.company_name : requester?.name, 'Legacy import'),
    requestedById: vendorCreated ? id('legacy-vendor', row.vendor_user_id) : id('legacy-user', row.requested_by),
    userId: vendorCreated ? id('legacy-vendor', row.vendor_user_id) : id('legacy-user', row.requested_by), legacyMysqlId: row.id, legacyImportedAt: new Date()
  } }, upsert: true } });
  summary.invoices += 1;
}

for (const row of rfqHeaders.filter(activeRow)) {
  const po = pos.get(str(row.purchase_order_id));
  const invitations = rfqInvitesById.get(str(row.id)) || [];
  const allocations = rfqAllocationsById.get(str(row.id)) || [];
  const awardedVendor = vendors.get(str(row.awarded_vendor_id));
  const totalQuantity = Math.max(0, num(row.num_containers));
  const allocatedQuantity = allocations.reduce((total, allocation) => total + num(allocation.containers), 0) || num(row.awarded_containers);
  rfqOps.push({ updateOne: {
    filter: { rfqNumber: str(row.rfq_number) },
    update: { $set: {
      rfqId: str(row.rfq_number), rfqNumber: str(row.rfq_number), title: str(row.title), description: str(row.description),
      poId: str(po?.sap_po_number || row.purchase_order_id), sapPoNumber: str(po?.sap_po_number),
      cargoDetails: { shippingTerms: str(row.shipping_terms), cargoType: str(row.cargo_type), containerType: str(row.container_type),
        containerCount: totalQuantity, portOfOrigin: str(row.port_of_loading), portOfDestination: str(row.port_of_discharge),
        weightPerContainer: str(row.weight_per_container), estimatedReadinessDate: date(row.estimated_readiness_date) },
      invitedVendors: invitations, closingDate: date(row.closing_date), status: str(row.status, 'draft'),
      awardedVendorId: row.awarded_vendor_id ? id('legacy-vendor', row.awarded_vendor_id) : '', awardedVendorName: str(awardedVendor?.company_name),
      totalQuantity, allocatedQuantity, pendingAllocation: Math.max(0, totalQuantity - allocatedQuantity), awardAllocations: allocations,
      createdBy: str(users.get(str(row.created_by))?.name, id('legacy-user', row.created_by)),
      createdById: id('legacy-user', row.created_by), allocationExchangeRate: effectiveRfqRate(row),
      sourceCreatedAt: date(row.created_at), sourceUpdatedAt: date(row.updated_at),
      createdAt: date(row.created_at), updatedAt: date(row.updated_at), legacyMysqlId: row.id, legacyImportedAt: new Date()
    } }, upsert: true, timestamps: false
  } });
  summary.rfqs += 1;
}

for (const row of rfqQuoteRows) {
  const rfq = rfqHeaderById.get(str(row.rfq_id));
  if (!rfq) continue;
  const vendor = vendors.get(str(row.vendor_user_id));
  const oceanFreightUsd = num(row.ocean_freight_usd || row.unit_price);
  const exchangeRate = effectiveRfqRate(rfq);
  const totalInr = calculatedQuoteTotal(row, rfq);
  rfqQuoteOps.push({ updateOne: {
    filter: { quoteId: id('legacy-quote', row.id) },
    update: { $set: {
      quoteId: id('legacy-quote', row.id), rfqId: str(rfq.rfq_number), vendorId: id('legacy-vendor', row.vendor_user_id),
      vendorName: str(vendor?.company_name, 'Legacy vendor'), shippingLine: str(row.shipping_line_name),
      route: str(row.vessel_route), vesselRoute: str(row.vessel_route), exchangeRate,
      oceanFreightUsd, stChargesInr: num(row.shipping_line_charges_inr), otherChargesInr: num(row.other_charges_inr), totalInr,
      freightAmount: num(row.total_price || row.ocean_freight_usd || row.unit_price), transitDays: num(String(row.transit_time || row.delivery_days || '').match(/\d+/)?.[0]),
      rank: str(row.rank, calculatedQuoteRank.get(str(row.id)) || 'N/A'), status: (rfqAllocationsById.get(str(row.rfq_id)) || []).some((allocation) => allocation.quoteId === id('legacy-quote', row.id)) ? 'awarded' : 'submitted',
      remarks: str(row.remarks), freeDays: str(row.free_days), cutoffDate: date(row.cutoff_date),
      etd: date(row.vessel_etd), eta: date(row.vessel_eta), vesselEtd: date(row.vessel_etd), vesselEta: date(row.vessel_eta),
      rateValidity: str(row.rate_validity), createdAt: date(row.created_at), updatedAt: date(row.updated_at),
      legacyMysqlId: row.id, legacyImportedAt: new Date()
    } }, upsert: true, timestamps: false
  } });
  summary.rfqQuotes += 1;
}

const documentEntityConfig = {
  InvoicePayment: { table: 'invoice_payments', targetType: 'InvoicePayment', targetId: (row) => str(row.reference_number) },
  AdvancePayment: { table: 'advance_payments', targetType: 'AdvancePayment', targetId: (row) => str(row.reference_number) },
  RfqHeader: { table: 'rfq_headers', targetType: 'RfqHeader', targetId: (row) => str(row.rfq_number) },
  PurchaseOrder: { table: 'purchase_orders', targetType: 'PurchaseOrder', targetId: (row) => str(row.sap_po_number) }
};
const normalizedDocumentType = (sourceType, targetType) => {
  const value = str(sourceType).toLowerCase();
  if (targetType === 'RfqHeader') return 'rfq_document';
  if (targetType === 'AdvancePayment') return 'advance_request';
  if (targetType === 'PurchaseOrder') return 'po_copy';
  if (targetType === 'InvoicePayment') return value === 'vendor_invoice' ? 'vendor_invoice' : 'vendor_invoice';
  return 'other';
};
for (const row of (tables.get('documents') || []).filter(activeRow)) {
  const sourceModel = str(row.documentable_type).split('\\').pop();
  const config = documentEntityConfig[sourceModel];
  if (!config) continue;
  const entity = (tables.get(config.table) || []).find((item) => str(item.id) === str(row.documentable_id));
  if (!entity || !activeRow(entity)) continue;
  const documentableId = config.targetId(entity);
  if (!documentableId) continue;
  const uploader = users.get(str(row.uploaded_by));
  documentOps.push({ updateOne: {
    filter: { documentId: id('legacy-document', row.id) },
    update: { $set: {
      documentId: id('legacy-document', row.id), title: str(row.original_name, row.document_type),
      documentType: normalizedDocumentType(row.document_type, config.targetType),
      fileUrl: str(row.storage_path), fileName: str(row.original_name), fileSize: num(row.file_size),
      mimeType: str(row.mime_type, 'application/octet-stream'), documentableType: config.targetType,
      documentableId, storageType: 's3', uploadedBy: str(uploader?.name, 'Legacy SQL import'),
      metadata: { sourceType: str(row.document_type), legacyMysqlId: str(row.id), notes: str(row.notes) },
      sourceCreatedAt: date(row.created_at), sourceUpdatedAt: date(row.updated_at), legacyImportedAt: new Date()
    } }, upsert: true
  } });
  summary.documents += 1;
}

for (const row of (tables.get('rfq_bl_entries') || []).filter(activeRow)) {
  const rfq = (tables.get('rfq_headers') || []).find((header) => str(header.id) === str(row.rfq_id));
  if (!rfq) continue;
  const vendor = vendors.get(str(row.vendor_user_id));
  const assignedAgent = (tables.get('custom_agent_users') || []).find((agent) => str(agent.id) === str(row.assigned_agent_id));
  blEntryOps.push({ updateOne: {
    filter: { blNumber: str(row.bl_number) },
    update: { $setOnInsert: {
      blId: id('legacy-bl', row.id), blNumber: str(row.bl_number), rfqId: str(rfq.rfq_number), rfqNumber: str(rfq.rfq_number),
      vendorId: id('legacy-vendor', row.vendor_user_id), vendorName: str(vendor?.company_name), containerCount: num(row.num_containers),
      autoAsnNumber: str(row.asn_number), status: str(row.status, 'submitted'), customAgentId: row.assigned_agent_id ? id('legacy-agent', row.assigned_agent_id) : '',
      customAgentName: str(assignedAgent?.company_name || assignedAgent?.name),
      remarks: str(row.remarks), boeNumber: str(row.boe_number), legacyMysqlId: row.id, legacyImportedAt: new Date()
    } }, upsert: true
  } });
  if (row.assigned_agent_id) {
    blAgentRepairOps.push({ updateOne: {
      filter: { blNumber: str(row.bl_number) },
      update: { $set: { customAgentId: id('legacy-agent', row.assigned_agent_id), customAgentName: str(assignedAgent?.company_name || assignedAgent?.name) } }
    } });
  }
  blDocumentRepairOps.push({ updateOne: {
    filter: { blNumber: str(row.bl_number) },
    update: { $set: { documents: blDocumentsByEntryId.get(str(row.id)) || [] } }
  } });
  summary.blEntries += 1;
}

const blInvoiceTypeNames = {
  freight_invoice: 'Freight Invoice', destination_charges: 'Destination Charges (Shipping Line)',
  detention_invoice: 'Detention Invoice', damage_charges: 'Damage Charges', port_storage: 'Port Storage',
  agency_charges: 'Agency Charges', receipted_charges: 'Receipted Charges', cfs_charges: 'CFS Charges'
};
const blInvoiceStatuses = { draft: 'Draft', pending: 'Pending EXIM Approval', approved: 'Approved', rejected: 'Rejected', paid: 'Paid' };
for (const row of (tables.get('rfq_bl_invoices') || []).filter(activeRow)) {
  const bl = blEntries.get(str(row.bl_entry_id));
  if (!bl) continue;
  const submittedByAgent = str(row.submitted_by_type) === 'agent';
  const party = submittedByAgent
    ? (tables.get('custom_agent_users') || []).find((agent) => str(agent.id) === str(row.agent_user_id))
    : vendors.get(str(row.vendor_user_id));
  const partyName = str(party?.company_name || party?.name, submittedByAgent ? 'Legacy customs agent' : 'Legacy vendor');
  const documents = blInvoiceDocumentsByInvoiceId.get(str(row.id)) || [];
  blInvoiceOps.push({ updateOne: {
    filter: { referenceNumber: str(row.reference_number) },
    update: { $setOnInsert: {
      referenceNumber: str(row.reference_number), blId: id('legacy-bl', row.bl_entry_id), blNumber: str(bl.bl_number),
      invoiceNumber: str(row.invoice_number), vendorId: id(submittedByAgent ? 'legacy-agent' : 'legacy-vendor', submittedByAgent ? row.agent_user_id : row.vendor_user_id),
      vendorName: partyName, category: str(row.invoice_type), typeDisplay: blInvoiceTypeNames[row.invoice_type] || str(row.invoice_type),
      source: submittedByAgent ? 'Agent' : 'Vendor', amount: num(row.amount), totalAmount: num(row.amount), currency: str(row.currency, 'INR'),
      remarks: str(row.description), invoiceFile: str(row.payment_proof_path || documents[0]?.filePath), invoiceDate: date(row.invoice_date),
      paymentDueDate: date(row.payment_due_date), utrNumber: str(row.utr_number), paidAt: date(row.paid_at), financeNotes: str(row.finance_notes),
      documents, status: blInvoiceStatuses[row.status] || str(row.status), submittedAt: date(row.created_at) || new Date(), createdBy: partyName,
      legacyMysqlId: row.id, legacyImportedAt: new Date()
    } }, upsert: true
  } });
  summary.blInvoices += 1;
}

const currencyNames = { USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', CNY: 'Chinese Yuan' };
for (const row of (tables.get('exchange_rates') || [])) {
  const currency = str(row.currency).toUpperCase();
  const updater = users.get(str(row.updated_by));
  exchangeRateOps.push({ updateOne: {
    filter: { currency },
    update: { $setOnInsert: { currency, name: currencyNames[currency] || currency, rate: num(row.rate_to_inr), lastUpdatedBy: str(updater?.name, 'Legacy SQL import'), legacyMysqlId: row.id } },
    upsert: true
  } });
  summary.exchangeRates += 1;
}

for (const row of (tables.get('approval_instances') || [])) {
  const typeKey = str(row.approvable_type).split('\\').pop();
  const workflow = (tables.get('approval_workflows') || []).find((item) => str(item.id) === str(row.workflow_id));
  const steps = (workflowStepsById.get(str(row.workflow_id)) || []).map((step) => ({ ...step, statusKey: `Pending ${step.title}` }));
  const activeStep = steps.find((step) => step.step === num(row.current_step)) || steps[0];
  const assignedUser = users.get(str(row.assigned_approver_id));
  let entity;
  let type = typeKey.replace(/([a-z])([A-Z])/g, '$1 $2');
  let reference = id('legacy-approval', row.id);
  let vendorName = 'Legacy record';
  let amount = 0;
  let poReference = '';
  let requestedById = '';
  let requestedByName = '';
  let transactionSnapshot = { legacyApprovableType: row.approvable_type, legacyApprovableId: row.approvable_id };
  if (typeKey === 'InvoicePayment') {
    entity = (tables.get('invoice_payments') || []).find((item) => str(item.id) === str(row.approvable_id));
    const po = pos.get(str(entity?.purchase_order_id));
    const vendor = vendors.get(str(entity?.vendor_user_id));
    reference = str(entity?.reference_number, reference); vendorName = str(vendor?.company_name || po?.vendor_name, 'Legacy vendor');
    amount = num(entity?.net_payable || entity?.invoice_amount); poReference = str(po?.sap_po_number); requestedById = id('legacy-user', entity?.requested_by);
    requestedByName = str(users.get(str(entity?.requested_by))?.name || vendor?.company_name);
    transactionSnapshot = { ...transactionSnapshot, invoicePaymentId: reference, invoiceNumber: entity?.invoice_number };
  } else if (typeKey === 'AdvancePayment') {
    entity = (tables.get('advance_payments') || []).find((item) => str(item.id) === str(row.approvable_id));
    const po = pos.get(str(entity?.purchase_order_id));
    reference = str(entity?.reference_number, reference); vendorName = str(po?.vendor_name, 'Legacy vendor'); amount = num(entity?.requested_amount);
    poReference = str(po?.sap_po_number); requestedById = id('legacy-user', entity?.requested_by); transactionSnapshot = { ...transactionSnapshot, advanceId: reference };
    requestedByName = str(users.get(str(entity?.requested_by))?.name);
  } else if (typeKey === 'RfqHeader') {
    entity = (tables.get('rfq_headers') || []).find((item) => str(item.id) === str(row.approvable_id));
    const vendor = vendors.get(str(entity?.awarded_vendor_id));
    reference = str(entity?.rfq_number, reference); vendorName = str(vendor?.company_name, 'RFQ vendors'); amount = num(entity?.pending_award_total_inr);
    requestedById = id('legacy-user', entity?.created_by); transactionSnapshot = { ...transactionSnapshot, rfqId: reference, rfqNumber: reference };
    requestedByName = str(users.get(str(entity?.created_by))?.name);
  } else if (typeKey === 'RfqBlInvoice') {
    entity = blInvoices.get(str(row.approvable_id));
    const submittedByAgent = str(entity?.submitted_by_type) === 'agent';
    const party = submittedByAgent
      ? (tables.get('custom_agent_users') || []).find((agent) => str(agent.id) === str(entity?.agent_user_id))
      : vendors.get(str(entity?.vendor_user_id));
    type = 'BL Freight Invoice';
    reference = str(entity?.reference_number, reference);
    vendorName = str(party?.company_name || party?.name, submittedByAgent ? 'Legacy customs agent' : 'Legacy vendor');
    amount = num(entity?.amount);
    requestedById = id(submittedByAgent ? 'legacy-agent' : 'legacy-vendor', submittedByAgent ? entity?.agent_user_id : entity?.vendor_user_id);
    requestedByName = vendorName;
    transactionSnapshot = {
      ...transactionSnapshot, blInvoiceId: reference, invoiceNumber: entity?.invoice_number,
      blId: id('legacy-bl', entity?.bl_entry_id), source: submittedByAgent ? 'Agent' : 'Vendor'
    };
  }
  const canonicalStatus = str(row.status) === 'approved' ? 'Approved & Dispatched'
    : str(row.status) === 'rejected' ? 'Rejected'
      : str(row.status) === 'returned' ? 'Returned for changes'
        : str(row.status) === 'cancelled' ? 'Cancelled'
          : (activeStep?.statusKey || 'Pending Approval');
  const legacyApprovalId = id('legacy-approval', row.id);
  approvalOps.push({ updateOne: {
    filter: { $or: [{ legacyMysqlId: num(row.id) }, { id: reference }, { id: legacyApprovalId }] },
    update: { $set: {
      id: reference, type, vendorName, amountOriginal: str(amount), amountINR: str(amount), currency: 'INR',
      requestedBy: str(requestedByName, 'Legacy requester'), requestedById,
      currentSlab: str(workflow?.name), poReference, workflowId: id('legacy-workflow', row.workflow_id), workflowVersion: 1,
      workflowSnapshot: workflow || {}, transactionSnapshot, assignedApprover: row.assigned_approver_id ? id('legacy-user', row.assigned_approver_id) : null,
      assignedApproverName: str(assignedUser?.name), assignedApproverRole: activeStep?.roleKey || null,
      workflowSteps: JSON.stringify(steps), currentStep: num(row.current_step, 1), totalSteps: num(row.total_steps, steps.length || 1),
      status: canonicalStatus, submittedAt: date(row.started_at || row.created_at) || new Date(), completedAt: date(row.completed_at),
      actionHistory: (approvalActionsByInstanceId.get(str(row.id)) || []).sort((a, b) => a.actionedAt - b.actionedAt),
      legacyMysqlId: row.id, legacyImportedAt: new Date()
    } }, upsert: true
  } });
  summary.approvals += 1;
}

if (canonicalSqlConfig) {
  await Promise.all([Permission.deleteMany({}), Role.deleteMany({}), Workflow.deleteMany({})]);
}
if (syncCustomAgents) await CustomAgent.deleteMany({});
if (permissionOps.length) await Permission.bulkWrite(permissionOps, { ordered: false });
if (roleOps.length) await Role.bulkWrite(roleOps, { ordered: false });
if (workflowOps.length) await Workflow.bulkWrite(workflowOps, { ordered: false });
if (customAgentOps.length) await CustomAgent.bulkWrite(customAgentOps, { ordered: false });
if (userOps.length) await User.bulkWrite(userOps, { ordered: false });
if (vendorOps.length) await Vendor.bulkWrite(vendorOps, { ordered: false });
if (purchaseOrderOps.length) await PurchaseOrder.bulkWrite(purchaseOrderOps, { ordered: false });
if (advanceOps.length) await AdvancePayment.bulkWrite(advanceOps, { ordered: false });
if (invoiceOps.length) await InvoicePayment.bulkWrite(invoiceOps, { ordered: false });
if (rfqOps.length) await RfqHeader.bulkWrite(rfqOps, { ordered: false });
if (rfqQuoteOps.length) await RfqQuote.bulkWrite(rfqQuoteOps, { ordered: false });
if (documentOps.length) await Document.bulkWrite(documentOps, { ordered: false });
if (blEntryOps.length) await RfqBlEntry.bulkWrite(blEntryOps, { ordered: false });
if (blAgentRepairOps.length) await RfqBlEntry.bulkWrite(blAgentRepairOps, { ordered: false });
if (blDocumentRepairOps.length) await RfqBlEntry.bulkWrite(blDocumentRepairOps, { ordered: false });
if (blInvoiceOps.length) await BlInvoice.bulkWrite(blInvoiceOps, { ordered: false });
if (exchangeRateOps.length) await ExchangeRate.bulkWrite(exchangeRateOps, { ordered: false });
if (approvalOps.length) await Approval.bulkWrite(approvalOps, { ordered: false });
if (args.includes('--ensure-default-workflows')) await ensureAllWorkflows();
await Promise.all([User, Role, Permission, Workflow, CustomAgent, Vendor, PurchaseOrder, AdvancePayment, InvoicePayment, RfqHeader, RfqQuote, RfqBlEntry, BlInvoice, ExchangeRate, Approval].map((model) => model.syncIndexes()));

await mongoose.connection.db.collection('legacy_import_runs').updateOne(
  { sourceHash },
  { $set: { sourceHash, sourceFile: path.basename(dumpPath), completedAt: new Date(), summary } },
  { upsert: true }
);
console.table(summary);
console.log('Import complete. Source passwords/tokens were not copied and existing records were upserted, not deleted.');
await mongoose.disconnect();
