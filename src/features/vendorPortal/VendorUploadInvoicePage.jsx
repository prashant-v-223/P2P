import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useVendor } from './vendorContext';
import { useToast } from '../../components/ui/toast';
import { CloudUpload, FileText, CheckCircle2, AlertCircle, X } from 'lucide-react';

const generateUniqueInvoiceNumber = () => {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `INV-${year}-${rand}`;
};

export default function VendorUploadInvoicePage() {
  const { purchaseOrders, addInvoice } = useVendor();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const initialPO = location.state?.selectedPO || '';

  const [poNumber, setPoNumber] = useState(initialPO);
  const [invoiceNumber, setInvoiceNumber] = useState(generateUniqueInvoiceNumber());
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [currency, setCurrency] = useState('INR');
  const [dueDays, setDueDays] = useState(30);
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [grnNo, setGrnNo] = useState('');
  const [remarks, setRemarks] = useState('');

  // GST & Adjustments
  const [invoiceType, setInvoiceType] = useState('With GST');
  const [cgstAmount, setCgstAmount] = useState('0');
  const [sgstAmount, setSgstAmount] = useState('0');
  const [igstAmount, setIgstAmount] = useState('0');
  const [tdsPercentage, setTdsPercentage] = useState('0%');
  const [advanceAdjust, setAdvanceAdjust] = useState('0');

  // File state
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const calculateDueDate = () => {
    const d = new Date(invoiceDate || Date.now());
    d.setDate(d.getDate() + Number(dueDays || 30));
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handlePoChange = (e) => {
    const selectedId = e.target.value;
    setPoNumber(selectedId);
    setErrorMsg('');
    const foundPo = purchaseOrders.find(p => p.id === selectedId);
    if (foundPo) {
      if (foundPo.currency) setCurrency(foundPo.currency);
      if (foundPo.paymentTerms) {
        const match = String(foundPo.paymentTerms).match(/\d+/);
        if (match) setDueDays(Number(match[0]));
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setErrorMsg('');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setErrorMsg('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // PROPER CUSTOM TOAST VALIDATIONS (No default browser popups)
    if (!poNumber) {
      const msg = 'Please select a Purchase Order to continue.';
      setErrorMsg(msg);
      showToast({ title: 'Purchase Order Required', description: msg, type: 'error' });
      return;
    }
    if (!invoiceNumber.trim()) {
      const msg = 'Invoice Number is required.';
      setErrorMsg(msg);
      showToast({ title: 'Invoice Number Required', description: msg, type: 'error' });
      return;
    }
    if (!invoiceDate) {
      const msg = 'Invoice Date is required.';
      setErrorMsg(msg);
      showToast({ title: 'Invoice Date Required', description: msg, type: 'error' });
      return;
    }
    if (!currency) {
      const msg = 'Currency is required.';
      setErrorMsg(msg);
      showToast({ title: 'Currency Required', description: msg, type: 'error' });
      return;
    }
    if (!dueDays && dueDays !== 0) {
      const msg = 'Net Days is required.';
      setErrorMsg(msg);
      showToast({ title: 'Net Days Required', description: msg, type: 'error' });
      return;
    }
    if (!invoiceAmount || Number(invoiceAmount) <= 0) {
      const msg = 'Please enter a valid positive invoice amount.';
      setErrorMsg(msg);
      showToast({ title: 'Invoice Amount Required', description: msg, type: 'error' });
      return;
    }
    if (!grnNo.trim()) {
      const msg = 'GRN / Delivery Note No is required.';
      setErrorMsg(msg);
      showToast({ title: 'GRN / Delivery Note Required', description: msg, type: 'error' });
      return;
    }
    if (!invoiceType) {
      const msg = 'Invoice Type is required.';
      setErrorMsg(msg);
      showToast({ title: 'Invoice Type Required', description: msg, type: 'error' });
      return;
    }
    if (!selectedFile) {
      const msg = 'Invoice document file is required. Please drag & drop or upload your invoice file (PDF, JPG, PNG).';
      setErrorMsg(msg);
      showToast({ title: 'Invoice File Required', description: msg, type: 'error' });
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      addInvoice({
        poNumber,
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        currency,
        dueDays,
        paymentDueDate: calculateDueDate(),
        invoiceAmount,
        grnNo: grnNo.trim(),
        remarks: remarks.trim(),
        invoiceType,
        cgstAmount,
        sgstAmount,
        igstAmount,
        tdsPercentage,
        advanceAdjust,
        fileName: selectedFile ? selectedFile.name : 'Invoice-Document.pdf'
      });
      setIsSubmitting(false);
      showToast({ title: 'Invoice Uploaded', description: `Invoice ${invoiceNumber} submitted for 3-Way Match validation.`, type: 'success' });
      setShowSuccessModal(true);
    }, 500);
  };

  return (
    <div className="space-y-6 font-sans max-w-4xl mx-auto pb-12 antialiased text-left">
      {/* Page Title & Subtitle */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Upload Invoice</h1>
        <p className="text-xs text-slate-500 font-medium mt-1">
          Submit your invoice against an open Purchase Order. Both domestic and Import POs are supported.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4.5 h-4.5 text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg('')} className="text-rose-400 hover:text-rose-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* Section 1: Select Purchase Order */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
            SELECT PURCHASE ORDER
          </h2>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Purchase Order <span className="text-rose-500">*</span>
            </label>
            <select
              value={poNumber}
              onChange={handlePoChange}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white transition-all"
            >
              <option value="">Type PO number to search...</option>
              {purchaseOrders.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.id} — {po.amount} ({po.date}) — {po.status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Section 2: Invoice Details */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
            INVOICE DETAILS
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Invoice Number */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Invoice Number <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setInvoiceNumber(generateUniqueInvoiceNumber())}
                  className="text-[11px] font-bold text-[#0d7676] hover:underline cursor-pointer"
                >
                  ⚡ Auto-Generate
                </button>
              </div>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => {
                  setInvoiceNumber(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="e.g. INV-2026-891204"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              />
            </div>

            {/* Invoice Date */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Invoice Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => {
                  setInvoiceDate(e.target.value);
                  setErrorMsg('');
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              />
            </div>

            {/* Currency */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Currency <span className="text-rose-500">*</span>
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            {/* Payment Due Date */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Payment Due Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                readOnly
                value={calculateDueDate()}
                className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium cursor-not-allowed"
              />
              <p className="text-[10px] text-[#0d7676] font-semibold">
                Auto-calculated from today's date when you submit the invoice
              </p>
            </div>

            {/* Net Days */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Net Days <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                value={dueDays}
                onChange={(e) => setDueDays(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              />
            </div>

            {/* Invoice Amount */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Invoice Amount ({currency}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={invoiceAmount}
                onChange={(e) => {
                  setInvoiceAmount(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white font-mono font-bold"
              />
            </div>

            {/* GRN / Delivery Note No */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                GRN / Delivery Note No <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={grnNo}
                onChange={(e) => {
                  setGrnNo(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="e.g. GRN-001"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              />
            </div>

            {/* Remarks */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">Remarks</label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Any additional information..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white resize-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: GST, TDS & ADJUSTMENTS */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
            GST, TDS & ADJUSTMENTS
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Invoice Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={invoiceType}
                onChange={(e) => setInvoiceType(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              >
                <option value="With GST">With GST</option>
                <option value="Without GST">Without GST</option>
                <option value="SEZ Export">SEZ Export</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                CGST Amount <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={cgstAmount}
                onChange={(e) => setCgstAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                SGST Amount <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={sgstAmount}
                onChange={(e) => setSgstAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                IGST Amount <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={igstAmount}
                onChange={(e) => setIgstAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                TDS % (on base amount) <span className="text-rose-500">*</span>
              </label>
              <select
                value={tdsPercentage}
                onChange={(e) => setTdsPercentage(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              >
                <option value="0%">0%</option>
                <option value="1%">1%</option>
                <option value="2%">2%</option>
                <option value="10%">10%</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Advance to Adjust <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={advanceAdjust}
                onChange={(e) => setAdvanceAdjust(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white font-mono"
              />
            </div>
          </div>
        </div>

        {/* Section 4: INVOICE FILE * */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
            INVOICE FILE <span className="text-rose-500">*</span>
          </h2>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-slate-200 hover:border-[#0d7676] rounded-2xl p-8 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <input
              type="file"
              id="invoice-file"
              onChange={handleFileChange}
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
            />
            <label htmlFor="invoice-file" className="cursor-pointer block space-y-2">
              <div className="w-12 h-12 bg-teal-50 text-[#0d7676] rounded-full flex items-center justify-center mx-auto border border-teal-100">
                <CloudUpload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700">
                  Drag & drop your invoice here <span className="text-rose-500">*</span>
                </p>
                <p className="text-[11px] text-[#0d7676] font-semibold mt-0.5 underline">
                  or click to browse
                </p>
              </div>
              <p className="text-[10px] text-slate-400">PDF, JPG, PNG ... max 10MB</p>
            </label>

            {selectedFile && (
              <div className="mt-4 p-3 bg-white border border-teal-200 rounded-xl inline-flex items-center gap-3 text-xs shadow-2xs">
                <FileText className="w-4 h-4 text-[#0d7676]" />
                <span className="font-bold text-slate-800">{selectedFile.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="text-slate-400 hover:text-rose-500 ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-[#0d7676] hover:bg-[#0f766e] text-white font-extrabold text-xs rounded-xl shadow-2xs transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'SUBMITTING...' : 'SUBMIT INVOICE'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/vendor/invoices')}
            className="px-5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-all"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Invoice Submitted Successfully!</h3>
              <p className="text-xs text-slate-500 mt-1">
                Your invoice <strong className="text-slate-800 font-mono">{invoiceNumber}</strong> has been uploaded and routed for 3-Way Match validation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowSuccessModal(false);
                navigate('/vendor/invoices');
              }}
              className="w-full py-2.5 bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold text-xs rounded-xl shadow-2xs transition-all"
            >
              View Invoices List
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
