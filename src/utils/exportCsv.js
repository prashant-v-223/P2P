import XLSX from 'xlsx-js-style';

/**
 * Utility to format Date into YYYY-MM-DD
 */
export function formatDate(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toISOString().split('T')[0];
}

/**
 * Fallback: Triggers browser file download for CSV data with UTF-8 BOM
 */
export function downloadCsvBlob(filename, csvContent) {
  const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' });
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
 * General purpose CSV Exporter (with UTF-8 and quotes escaping)
 */
export function exportCsv(filename, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const escape = (value) => {
    if (value === null || value === undefined) return '""';
    const str = String(value);
    return `"${str.replace(/"/g, '""')}"`;
  };
  const csv = [
    headers.map(escape).join(','), 
    ...rows.map((row) => headers.map((key) => escape(row[key])).join(','))
  ].join('\r\n');
  return downloadCsvBlob(filename, csv);
}

/**
 * Advanced Excel / CSV Exporter with:
 * - Table format with stylized Brand Teal header (#0D7676)
 * - Auto-calculated Column Widths (max content width + padding)
 * - Row heights and zebra striping (#F8FAFC)
 * - Numeric and Currency cell formatting (preserves numbers, keeps codes as text)
 * - Border lines and alignment
 */
export function exportAdvancedTableExcel({
  sheetName = 'Report',
  fileName = 'Report',
  headers = [],
  rows = [], // array of objects matching headers
  columnTypes = {} // key -> 'text' | 'number' | 'currency' | 'date' | 'badge' | 'center'
}) {
  try {
    const wb = XLSX.utils.book_new();

    // 1. Prepare data matrix (Headers + rows)
    const headerKeys = headers.map(h => typeof h === 'string' ? h : h.key);
    const headerLabels = headers.map(h => typeof h === 'string' ? h : h.label);

    const aoaData = [headerLabels];

    rows.forEach((row) => {
      const rowArr = headerKeys.map((key) => {
        const val = row[key];
        if (val === undefined || val === null) return '';
        return val;
      });
      aoaData.push(rowArr);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoaData);

    // 2. Set Row Heights (Header: 26pt, Data rows: 20pt)
    ws['!rows'] = [{ hpt: 26 }, ...rows.map(() => ({ hpt: 20 }))];

    // 3. Compute Auto Column Widths (Fully responsive to longest content)
    const colWidths = headerLabels.map((label, cIdx) => {
      const key = headerKeys[cIdx];
      let maxLen = String(label || '').length;

      rows.forEach(row => {
        const cellVal = row[key];
        if (cellVal !== undefined && cellVal !== null) {
          const s = String(cellVal);
          if (s.length > maxLen) maxLen = s.length;
        }
      });

      // Minimum width 12, plus 4 padding chars for clean spacing
      return { wch: Math.min(65, Math.max(12, maxLen + 4)) };
    });
    ws['!cols'] = colWidths;

    // 4. Style Cells: Header styling
    const headerStyle = {
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '0D7676' } }, // Rayzon Teal Brand Color
      alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: '094A4A' } },
        bottom: { style: 'medium', color: { rgb: '063333' } },
        left: { style: 'thin', color: { rgb: '094A4A' } },
        right: { style: 'thin', color: { rgb: '094A4A' } }
      }
    };

    const borderStyle = {
      top: { style: 'thin', color: { rgb: 'E2E8F0' } },
      bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
      left: { style: 'thin', color: { rgb: 'E2E8F0' } },
      right: { style: 'thin', color: { rgb: 'E2E8F0' } }
    };

    const range = XLSX.utils.decode_range(ws['!ref']);

    // Style Header Cells
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: C });
      if (ws[cellRef]) {
        ws[cellRef].s = headerStyle;
      }
    }

    // Style Data Cells
    for (let R = 1; R <= range.e.r; ++R) {
      const isEven = R % 2 === 0;
      const bgRgb = isEven ? 'F8FAFC' : 'FFFFFF'; // subtle alternating zebra striping

      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellRef]) continue;

        const key = headerKeys[C];
        const type = columnTypes[key] || 'text';
        let val = ws[cellRef].v;

        let horizontalAlign = 'left';
        let numFmt = undefined;

        if (type === 'currency' || type === 'number') {
          horizontalAlign = 'right';
          if (typeof val === 'number' || (!isNaN(val) && val !== '' && val !== null)) {
            ws[cellRef].t = 'n';
            ws[cellRef].v = Number(val);
            numFmt = type === 'currency' ? '#,##,##0' : '#,##0';
          }
        } else if (type === 'center' || type === 'date' || type === 'badge' || key === 'S.No') {
          horizontalAlign = 'center';
          if (type === 'text') {
            ws[cellRef].t = 's';
            ws[cellRef].v = String(val);
          }
        } else {
          // Explicit text for PO Numbers, SAP PO, Codes so Excel never converts to 4.1E+09
          ws[cellRef].t = 's';
          ws[cellRef].v = String(val ?? '');
          ws[cellRef].z = '@';
        }

        // Status Badge highlight colors
        let cellBg = bgRgb;
        let fontColor = '1E293B';
        let isBold = false;

        const valStr = String(val || '').toLowerCase();
        if (type === 'badge' || key.toLowerCase().includes('status')) {
          isBold = true;
          horizontalAlign = 'center';
          if (valStr.includes('approved') || valStr.includes('paid') || valStr.includes('matched')) {
            cellBg = 'DCFCE7'; // Soft Green
            fontColor = '166534';
          } else if (valStr.includes('reject') || valStr.includes('overdue') || valStr.includes('mismatch')) {
            cellBg = 'FFE4E6'; // Soft Rose
            fontColor = '9F1239';
          } else if (valStr.includes('pending') || valStr.includes('today') || valStr.includes('urgent')) {
            cellBg = 'FEF3C7'; // Soft Amber
            fontColor = '92400E';
          } else if (valStr.includes('open') || valStr.includes('draft')) {
            cellBg = 'E0F2FE'; // Soft Sky Blue
            fontColor = '075985';
          }
        }

        ws[cellRef].s = {
          font: { name: 'Calibri', sz: 10, color: { rgb: fontColor }, bold: isBold },
          fill: { fgColor: { rgb: cellBg } },
          alignment: { vertical: 'center', horizontal: horizontalAlign, wrapText: false },
          border: borderStyle,
          numFmt: numFmt
        };
      }
    }

    // 5. Append sheet and trigger download (.xlsx with full styles, fonts, auto-col widths)
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

    const timestamp = new Date().toISOString().split('T')[0];
    const cleanFileName = fileName.replace(/\.(csv|xlsx)$/i, '');
    const fullFileName = `${cleanFileName}_${timestamp}.xlsx`;

    XLSX.writeFile(wb, fullFileName);
    return true;
  } catch (err) {
    console.error('Error generating styled Excel file, falling back to CSV:', err);
    return exportCsv(fileName, rows);
  }
}

/**
 * Purchase Orders Exporter (Beautiful Table, auto-widths, colors, text-preserved PO numbers)
 */
export function exportPurchaseOrdersCsv(pos) {
  if (!Array.isArray(pos) || pos.length === 0) return false;

  const formattedRows = pos.map((po, index) => {
    const poNum = String(po.poNumber || po.sapPoNumber || po.id || '');
    const sapPo = String(po.sapPoNumber || poNum);
    const netValue = Number(po.totalAmount || po.netValue || po.poValue || 0);
    const advancePaid = Number(po.paidAdvanceAmount || po.advancePaid || po.advancePaidAmount || po.paidAdvanceTotal || po.paidAmount || 0);
    const advanceLimit = Number(po.advanceLimitAmount || (netValue * (Number(po.maxAdvancePercentage || 100) / 100)));
    const remainingBalance = Math.max(0, advanceLimit - advancePaid);
    const committedInvoices = Number(po.invoicedAmount || po.committedInvoiceTotal || 0);
    const inferredType = (poNum.startsWith('PO-43') || poNum.startsWith('60') || sapPo.startsWith('43') || sapPo.startsWith('60')) ? 'Import' : 'Domestic';
    const poStatus = po.status === 'open' ? 'Open' : (po.status ? (po.status.charAt(0).toUpperCase() + po.status.slice(1)) : 'Open');

    return {
      'S.No': index + 1,
      'PO Number': poNum,
      'SAP PO Number': sapPo,
      'Vendor / Supplier Name': po.supplierName || po.vendorName || '',
      'SAP Supplier Code': String(po.supplierId || po.supplierCode || po.sapCode || po.vendorCode || ''),
      'PO Date': formatDate(po.documentDate || po.createdAt || po.poDate),
      'Payment Due Date': formatDate(po.dueDate || po.deliveryDate || po.paymentDueDate),
      'PO Type': po.type || inferredType,
      'Currency': po.currency || 'INR',
      'Net PO Value (INR)': netValue,
      'Advance Limit (%)': Number(po.maxAdvancePercentage || 100),
      'Advance Limit (INR)': advanceLimit,
      'Advance Paid (INR)': advancePaid,
      'Remaining Advance Balance (INR)': remainingBalance,
      'Committed Invoices (INR)': committedInvoices,
      'Status': poStatus
    };
  });

  return exportAdvancedTableExcel({
    sheetName: 'Purchase Orders',
    fileName: 'Purchase_Orders',
    headers: [
      { key: 'S.No', label: 'S.No' },
      { key: 'PO Number', label: 'PO Number' },
      { key: 'SAP PO Number', label: 'SAP PO Number' },
      { key: 'Vendor / Supplier Name', label: 'Vendor / Supplier Name' },
      { key: 'SAP Supplier Code', label: 'SAP Supplier Code' },
      { key: 'PO Date', label: 'PO Date' },
      { key: 'Payment Due Date', label: 'Payment Due Date' },
      { key: 'PO Type', label: 'PO Type' },
      { key: 'Currency', label: 'Currency' },
      { key: 'Net PO Value (INR)', label: 'Net PO Value (INR)' },
      { key: 'Advance Limit (%)', label: 'Advance Limit (%)' },
      { key: 'Advance Limit (INR)', label: 'Advance Limit (INR)' },
      { key: 'Advance Paid (INR)', label: 'Advance Paid (INR)' },
      { key: 'Remaining Advance Balance (INR)', label: 'Remaining Advance Balance (INR)' },
      { key: 'Committed Invoices (INR)', label: 'Committed Invoices (INR)' },
      { key: 'Status', label: 'Status' }
    ],
    rows: formattedRows,
    columnTypes: {
      'S.No': 'center',
      'PO Number': 'text',
      'SAP PO Number': 'text',
      'SAP Supplier Code': 'text',
      'PO Date': 'date',
      'Payment Due Date': 'date',
      'PO Type': 'center',
      'Currency': 'center',
      'Net PO Value (INR)': 'currency',
      'Advance Limit (%)': 'number',
      'Advance Limit (INR)': 'currency',
      'Advance Paid (INR)': 'currency',
      'Remaining Advance Balance (INR)': 'currency',
      'Committed Invoices (INR)': 'currency',
      'Status': 'badge'
    }
  });
}

/**
 * Advance Payments Exporter (Beautiful Table, auto-widths, colors, text-preserved IDs)
 */
export function exportAdvancePaymentsCsv(advances) {
  if (!Array.isArray(advances) || advances.length === 0) return false;

  const formattedRows = advances.map((adv, index) => {
    const inrAmt = Number(adv.amountInr || adv.amount || 0);
    const origAmt = Number(adv.amountOriginal || adv.amount || 0);
    const adjustedAmt = Number(adv.adjustedAmount || adv.advanceAdjusted || 0);
    const balanceAmt = Math.max(0, inrAmt - adjustedAmt);
    const curr = adv.currency || 'INR';
    const rawStatus = typeof adv.status === 'object' ? (adv.status?.label || adv.status?.status || 'Draft') : (adv.status || 'Draft');

    return {
      'S.No': index + 1,
      'Reference ID': String(adv.reference || adv.referenceNumber || adv.advanceId || adv.id || ''),
      'Linked SAP PO': String(adv.poNumber || adv.poId || adv.sapPoNumber || ''),
      'Vendor Name': adv.vendorName || adv.vendor || '',
      'Requested By': adv.requestedByName || adv.requesterName || adv.requestedBy || adv.createdBy || '',
      'Department': adv.department || 'Procurement',
      'Original Currency': curr,
      'Original Amount': origAmt,
      'Advance Amount (INR)': inrAmt,
      'PO Percentage (%)': adv.pctOfPo || (adv.percentageOfPo ? `${adv.percentageOfPo}%` : '—'),
      'Adjusted Amount (INR)': adjustedAmt,
      'Remaining Balance (INR)': balanceAmt,
      'Payment Mode': adv.mode || adv.paymentMode || 'NEFT',
      'Approval Status': rawStatus,
      'Current Approver / Step': adv.assignedApproverRole || adv.assignedApproverName || (adv.currentStep ? `Step ${adv.currentStep}` : '—'),
      'Payment Release Status': adv.paidStatus || (adv.isPaid || String(rawStatus).toLowerCase() === 'paid' ? 'Paid' : 'Unpaid'),
      'UTR Number': String(adv.utrNumber || adv.utr || '—'),
      'Payment Date': formatDate(adv.paymentDate || adv.paidAt),
      'Submission Date': formatDate(adv.submittedDate || adv.requestedDate || adv.createdAt)
    };
  });

  return exportAdvancedTableExcel({
    sheetName: 'Advance Payments',
    fileName: 'Advance_Payments',
    headers: [
      { key: 'S.No', label: 'S.No' },
      { key: 'Reference ID', label: 'Reference ID' },
      { key: 'Linked SAP PO', label: 'Linked SAP PO' },
      { key: 'Vendor Name', label: 'Vendor Name' },
      { key: 'Requested By', label: 'Requested By' },
      { key: 'Department', label: 'Department' },
      { key: 'Original Currency', label: 'Currency' },
      { key: 'Original Amount', label: 'Original Amount' },
      { key: 'Advance Amount (INR)', label: 'Advance Amount (INR)' },
      { key: 'PO Percentage (%)', label: 'PO %' },
      { key: 'Adjusted Amount (INR)', label: 'Adjusted Amount (INR)' },
      { key: 'Remaining Balance (INR)', label: 'Remaining Balance (INR)' },
      { key: 'Payment Mode', label: 'Payment Mode' },
      { key: 'Approval Status', label: 'Approval Status' },
      { key: 'Current Approver / Step', label: 'Current Approver / Step' },
      { key: 'Payment Release Status', label: 'Release Status' },
      { key: 'UTR Number', label: 'UTR Number' },
      { key: 'Payment Date', label: 'Payment Date' },
      { key: 'Submission Date', label: 'Submission Date' }
    ],
    rows: formattedRows,
    columnTypes: {
      'S.No': 'center',
      'Reference ID': 'text',
      'Linked SAP PO': 'text',
      'Original Currency': 'center',
      'Original Amount': 'number',
      'Advance Amount (INR)': 'currency',
      'PO Percentage (%)': 'center',
      'Adjusted Amount (INR)': 'currency',
      'Remaining Balance (INR)': 'currency',
      'Payment Mode': 'center',
      'Approval Status': 'badge',
      'Payment Release Status': 'badge',
      'UTR Number': 'text',
      'Payment Date': 'date',
      'Submission Date': 'date'
    }
  });
}

/**
 * Invoice Payments Exporter (Beautiful Table, auto-widths, colors, text-preserved numbers)
 */
export function exportInvoicePaymentsCsv(invoices) {
  if (!Array.isArray(invoices) || invoices.length === 0) return false;

  const formattedRows = invoices.map((inv, index) => {
    const grossAmt = Number(inv.grossAmount || inv.amountInr || inv.amount || 0);
    const gstAmt = Number(inv.gstAmount || 0);
    const tdsAmt = Number(inv.tdsAmount || 0);
    const advAdj = Number(inv.advanceAdjusted || 0);
    const netPayable = Number(inv.netPayable || Math.max(0, grossAmt + gstAmt - tdsAmt - advAdj));
    const origAmt = Number(inv.amountOriginal || inv.amount || 0);
    const curr = inv.currency || 'INR';

    return {
      'S.No': index + 1,
      'Payment ID': String(inv.invoicePaymentId || inv.id || ''),
      'Invoice Number': String(inv.invoiceNumber || ''),
      'ASN Number': String(inv.asnNumber || '—'),
      'Linked SAP PO': String(inv.poNumber || inv.sapPoNumber || inv.poId || ''),
      'Vendor Name': inv.vendorName || '',
      'Currency': curr,
      'Gross Amount (INR)': grossAmt,
      'GST Amount (INR)': gstAmt,
      'TDS Deductions (INR)': tdsAmt,
      'Advance Adjusted (INR)': advAdj,
      'Net Payable (INR)': netPayable,
      'Original Amount': origAmt,
      '3-Way Match Status': inv.threeWayMatchStatus || inv.matchStatus || 'Pending',
      'Approval Status': inv.status || 'Pending',
      'Current Approver / Step': inv.assignedApproverRole || (inv.currentStep ? `Step ${inv.currentStep}` : '—'),
      'Payment Release Status': inv.paidStatus || (inv.isPaid || String(inv.status).toLowerCase() === 'paid' ? 'Paid' : 'Unpaid'),
      'UTR Number': String(inv.utrNumber || inv.utr || '—'),
      'Invoice Date': formatDate(inv.invoiceDate),
      'Due Date': formatDate(inv.paymentDueDate || inv.dueDate),
      'Payment Date': formatDate(inv.paymentDate || inv.paidAt),
      'Created Date': formatDate(inv.createdAt)
    };
  });

  return exportAdvancedTableExcel({
    sheetName: 'Invoice Payments',
    fileName: 'Invoice_Payments',
    headers: [
      { key: 'S.No', label: 'S.No' },
      { key: 'Payment ID', label: 'Payment ID' },
      { key: 'Invoice Number', label: 'Invoice Number' },
      { key: 'ASN Number', label: 'ASN Number' },
      { key: 'Linked SAP PO', label: 'Linked SAP PO' },
      { key: 'Vendor Name', label: 'Vendor Name' },
      { key: 'Currency', label: 'Currency' },
      { key: 'Gross Amount (INR)', label: 'Gross Amount (INR)' },
      { key: 'GST Amount (INR)', label: 'GST Amount (INR)' },
      { key: 'TDS Deductions (INR)', label: 'TDS Deductions (INR)' },
      { key: 'Advance Adjusted (INR)', label: 'Advance Adjusted (INR)' },
      { key: 'Net Payable (INR)', label: 'Net Payable (INR)' },
      { key: 'Original Amount', label: 'Original Amount' },
      { key: '3-Way Match Status', label: '3-Way Match Status' },
      { key: 'Approval Status', label: 'Approval Status' },
      { key: 'Current Approver / Step', label: 'Current Approver / Step' },
      { key: 'Payment Release Status', label: 'Release Status' },
      { key: 'UTR Number', label: 'UTR Number' },
      { key: 'Invoice Date', label: 'Invoice Date' },
      { key: 'Due Date', label: 'Due Date' },
      { key: 'Payment Date', label: 'Payment Date' },
      { key: 'Created Date', label: 'Created Date' }
    ],
    rows: formattedRows,
    columnTypes: {
      'S.No': 'center',
      'Payment ID': 'text',
      'Invoice Number': 'text',
      'ASN Number': 'text',
      'Linked SAP PO': 'text',
      'Currency': 'center',
      'Gross Amount (INR)': 'currency',
      'GST Amount (INR)': 'currency',
      'TDS Deductions (INR)': 'currency',
      'Advance Adjusted (INR)': 'currency',
      'Net Payable (INR)': 'currency',
      'Original Amount': 'number',
      '3-Way Match Status': 'badge',
      'Approval Status': 'badge',
      'Payment Release Status': 'badge',
      'UTR Number': 'text',
      'Invoice Date': 'date',
      'Due Date': 'date',
      'Payment Date': 'date',
      'Created Date': 'date'
    }
  });
}

/**
 * Upcoming Payments / Hierarchy Report Exporter (Beautiful Table, auto-widths, colors)
 */
export function exportUpcomingPaymentsCsv(payments) {
  if (!Array.isArray(payments) || payments.length === 0) return false;

  const formattedRows = payments.map((item, index) => {
    const urgencyLabel =
      item.urgency === 'overdue' ? `Overdue (${Math.abs(item.daysRemaining)}d)` :
      item.urgency === 'today' ? 'Due Today' :
      item.daysRemaining === 1 ? 'Due Tomorrow' :
      item.daysRemaining ? `Due in ${item.daysRemaining} Days` : 'Upcoming';

    return {
      'S.No': index + 1,
      'Due Date': formatDate(item.dueDate),
      'Urgency Status': urgencyLabel,
      'Days Remaining': item.daysRemaining ?? '—',
      'Reference ID': String(item.referenceId || item.id || ''),
      'Payment Type': item.type || '',
      'Vendor Name': item.vendorName || '',
      'Linked SAP PO': String(item.poNumber || item.poRef || ''),
      'Requested By': item.requestedBy || '',
      'Original Currency': item.currency || 'INR',
      'Original Amount': Number(item.amount || 0),
      'Amount (INR)': Number(item.amountINR || item.amount || 0),
      'Net Payable (INR)': Number(item.netPayable || item.amountINR || item.amount || 0),
      'Finance / Approval Status': item.status || 'Pending',
      'Assigned Approver / Step': item.assignedApproverRole || item.currentStep || '—',
      'UTR Number': String(item.utrNumber || '—'),
      'Payment Date': formatDate(item.paidAt || item.paymentDate)
    };
  });

  return exportAdvancedTableExcel({
    sheetName: 'Upcoming Payments',
    fileName: 'Upcoming_Payments_Report',
    headers: [
      { key: 'S.No', label: 'S.No' },
      { key: 'Due Date', label: 'Due Date' },
      { key: 'Urgency Status', label: 'Urgency Status' },
      { key: 'Days Remaining', label: 'Days Remaining' },
      { key: 'Reference ID', label: 'Reference ID' },
      { key: 'Payment Type', label: 'Payment Type' },
      { key: 'Vendor Name', label: 'Vendor Name' },
      { key: 'Linked SAP PO', label: 'Linked SAP PO' },
      { key: 'Requested By', label: 'Requested By' },
      { key: 'Original Currency', label: 'Currency' },
      { key: 'Original Amount', label: 'Original Amount' },
      { key: 'Amount (INR)', label: 'Amount (INR)' },
      { key: 'Net Payable (INR)', label: 'Net Payable (INR)' },
      { key: 'Finance / Approval Status', label: 'Status' },
      { key: 'Assigned Approver / Step', label: 'Approver / Step' },
      { key: 'UTR Number', label: 'UTR Number' },
      { key: 'Payment Date', label: 'Payment Date' }
    ],
    rows: formattedRows,
    columnTypes: {
      'S.No': 'center',
      'Due Date': 'date',
      'Urgency Status': 'badge',
      'Days Remaining': 'center',
      'Reference ID': 'text',
      'Payment Type': 'center',
      'Linked SAP PO': 'text',
      'Original Currency': 'center',
      'Original Amount': 'number',
      'Amount (INR)': 'currency',
      'Net Payable (INR)': 'currency',
      'Finance / Approval Status': 'badge',
      'UTR Number': 'text',
      'Payment Date': 'date'
    }
  });
}

/**
 * Settlement Ledger Exporter (Beautiful Table, auto-widths, colors)
 */
export function exportSettlementLedgerCsv(ledger) {
  if (!Array.isArray(ledger) || ledger.length === 0) return false;

  const formattedRows = ledger.map((item, index) => ({
    'S.No': index + 1,
    'Payment ID': String(item.paymentId || ''),
    'Entity Type': item.entityType || item.payableType || 'Payment',
    'Beneficiary Vendor': item.vendorName || 'N/A',
    'Vendor Code': String(item.vendorId || item.vendorCode || 'N/A'),
    'Payment Mode': item.paymentMode || item.mode || 'NEFT',
    'Bank UTR Number': String(item.utrNumber || 'N/A'),
    'Gross Amount (INR)': Number(item.grossAmount || 0),
    'TDS Deductions (INR)': Number(item.tdsAmount || 0),
    'Net Paid (INR)': Number(item.netAmount || item.netPaid || 0),
    'Payment Date': formatDate(item.paymentDate || item.disbursementDate || item.createdAt)
  }));

  return exportAdvancedTableExcel({
    sheetName: 'Settlement Ledger',
    fileName: 'Settlement_Ledger',
    headers: [
      { key: 'S.No', label: 'S.No' },
      { key: 'Payment ID', label: 'Payment ID' },
      { key: 'Entity Type', label: 'Entity Type' },
      { key: 'Beneficiary Vendor', label: 'Beneficiary Vendor' },
      { key: 'Vendor Code', label: 'Vendor Code' },
      { key: 'Payment Mode', label: 'Payment Mode' },
      { key: 'Bank UTR Number', label: 'Bank UTR Number' },
      { key: 'Gross Amount (INR)', label: 'Gross Amount (INR)' },
      { key: 'TDS Deductions (INR)', label: 'TDS Deductions (INR)' },
      { key: 'Net Paid (INR)', label: 'Net Paid (INR)' },
      { key: 'Payment Date', label: 'Payment Date' }
    ],
    rows: formattedRows,
    columnTypes: {
      'S.No': 'center',
      'Payment ID': 'text',
      'Entity Type': 'center',
      'Vendor Code': 'text',
      'Payment Mode': 'center',
      'Bank UTR Number': 'text',
      'Gross Amount (INR)': 'currency',
      'TDS Deductions (INR)': 'currency',
      'Net Paid (INR)': 'currency',
      'Payment Date': 'date'
    }
  });
}

