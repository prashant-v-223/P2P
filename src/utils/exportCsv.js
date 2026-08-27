import { formatCurrencyINR } from './currencyHelper';

/**
 * Utility to format Date into YYYY-MM-DD
 */
function formatDate(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toISOString().split('T')[0];
}

/**
 * Triggers browser file download for CSV data
 */
export function downloadCsvBlob(filename, csvContent) {
  const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const timestamp = new Date().toISOString().split('T')[0];
  const finalFilename = filename.includes('.csv') 
    ? filename.replace('.csv', `_${timestamp}.csv`) 
    : `${filename}_${timestamp}.csv`;
  link.download = finalFilename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}

/**
 * General purpose CSV Exporter
 */
export function exportCsv(filename, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [
    headers.map(escape).join(','), 
    ...rows.map((row) => headers.map((key) => escape(row[key])).join(','))
  ].join('\r\n');
  return downloadCsvBlob(filename, csv);
}

/**
 * Purchase Orders CSV Exporter
 */
export function exportPurchaseOrdersCsv(pos) {
  if (!Array.isArray(pos) || pos.length === 0) return false;

  const formattedRows = pos.map((po, index) => {
    const netValue = Number(po.netValue || po.poValue || 0);
    const advancePaid = Number(po.advancePaidAmount || po.paidAdvanceTotal || 0);
    const advanceLimit = Number(po.advanceLimitAmount || (netValue * (Number(po.maxAdvancePercentage || 100) / 100)));
    const remainingBalance = Math.max(0, advanceLimit - advancePaid);

    return {
      'S.No': index + 1,
      'PO Number': po.poNumber || po.id || '',
      'Vendor / Supplier Name': po.supplierName || po.vendorName || '',
      'SAP Supplier Code': po.supplierCode || po.sapCode || '',
      'PO Date': formatDate(po.documentDate || po.createdAt),
      'Net PO Value (INR)': netValue ? `₹${netValue.toLocaleString('en-IN')}` : '₹0',
      'Currency': po.currency || 'INR',
      'Advance Limit (%)': `${po.maxAdvancePercentage || 100}%`,
      'Advance Limit Value (INR)': advanceLimit ? `₹${advanceLimit.toLocaleString('en-IN')}` : '₹0',
      'Advance Paid to Date (INR)': advancePaid ? `₹${advancePaid.toLocaleString('en-IN')}` : '₹0',
      'Remaining Advance Balance (INR)': remainingBalance ? `₹${remainingBalance.toLocaleString('en-IN')}` : '₹0',
      'Status': po.status || 'Active'
    };
  });

  return exportCsv('Purchase_Orders', formattedRows);
}

/**
 * Advance Payments CSV Exporter
 */
export function exportAdvancePaymentsCsv(advances) {
  if (!Array.isArray(advances) || advances.length === 0) return false;

  const formattedRows = advances.map((adv, index) => {
    const inrAmt = Number(adv.amountInr || adv.amount || 0);
    const origAmt = Number(adv.amountOriginal || adv.amount || 0);
    const curr = adv.currency || 'INR';

    return {
      'S.No': index + 1,
      'Reference ID': adv.referenceNumber || adv.id || '',
      'Linked PO Number': adv.poNumber || adv.poId || '',
      'Vendor / Company Name': adv.vendorName || adv.vendor || '',
      'Requested By': adv.requesterName || adv.requestedBy || '',
      'Department': adv.department || 'Procurement',
      'Advance Amount (INR)': inrAmt ? `₹${inrAmt.toLocaleString('en-IN')}` : '₹0',
      'Original Currency': curr,
      'Original Amount': curr !== 'INR' ? `${curr} ${origAmt.toLocaleString('en-US')}` : `₹${inrAmt.toLocaleString('en-IN')}`,
      'Reason for Advance': adv.reasonForAdvance || adv.reason || '',
      'Approval Status': adv.status || 'Pending',
      'Payment Release Status': adv.paidStatus || (adv.isPaid ? 'Paid' : 'Unpaid'),
      'Requested Date': formatDate(adv.requestedDate || adv.createdAt)
    };
  });

  return exportCsv('Advance_Payments', formattedRows);
}

/**
 * Invoice Payments CSV Exporter
 */
export function exportInvoicePaymentsCsv(invoices) {
  if (!Array.isArray(invoices) || invoices.length === 0) return false;

  const formattedRows = invoices.map((inv, index) => {
    const inrAmt = Number(inv.amountInr || inv.amount || 0);
    const origAmt = Number(inv.amountOriginal || inv.amount || 0);
    const curr = inv.currency || 'INR';

    return {
      'S.No': index + 1,
      'Payment ID': inv.invoicePaymentId || inv.id || '',
      'Invoice Number': inv.invoiceNumber || '',
      'Linked PO Number': inv.poNumber || inv.poId || '',
      'Vendor Name': inv.vendorName || '',
      'Invoice Amount (INR)': inrAmt ? `₹${inrAmt.toLocaleString('en-IN')}` : '₹0',
      'Original Currency': curr,
      'Original Amount': curr !== 'INR' ? `${curr} ${origAmt.toLocaleString('en-US')}` : `₹${inrAmt.toLocaleString('en-IN')}`,
      '3-Way Match Status': inv.threeWayMatchStatus || inv.matchStatus || 'Pending',
      'Approval Status': inv.status || 'Pending',
      'Payment Release Status': inv.paidStatus || (inv.isPaid ? 'Paid' : 'Unpaid'),
      'Invoice Date': formatDate(inv.invoiceDate),
      'Due Date': formatDate(inv.dueDate),
      'Created Date': formatDate(inv.createdAt)
    };
  });

  return exportCsv('Invoice_Payments', formattedRows);
}
