import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useVendor } from './vendorContext';
import { CloudUpload, FileText, CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function VendorUploadInvoicePage() {
  const { purchaseOrders, addInvoice } = useVendor();
  const navigate = useNavigate();
  const location = useLocation();

  const initialPO = location.state?.selectedPO || '';

  const [poNumber, setPoNumber] = useState(initialPO);
  const [invoiceNumber, setInvoiceNumber] = useState('INV-2024-001');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [currency, setCurrency] = useState('INR');
  const [dueDays, setDueDays] = useState(30);
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [grnNo, setGrnNo] = useState('GRN-001');
  const [remarks, setRemarks] = useState('');

  // GST & Adjustments
  const [invoiceType, setInvoiceType] = useState('With GST');
  const [cgstAmount, setCgstAmount] = useState(0);
  const [sgstAmount, setSgstAmount] = useState(0);
  const [igstAmount, setIgstAmount] = useState(0);
  const [tdsPercentage, setTdsPercentage] = useState('0%');
  const [advanceAdjust, setAdvanceAdjust] = useState(0);

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
    if (!poNumber) {
      setErrorMsg('Please select a Purchase Order.');
      return;
    }
    if (!invoiceNumber) {
      setErrorMsg('Invoice Number is required.');
      return;
    }
    if (!invoiceAmount || Number(invoiceAmount) <= 0) {
      setErrorMsg('Please enter a valid invoice amount.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      addInvoice({
        poNumber,
        invoiceNumber,
        invoiceDate,
        currency,
        dueDays,
        paymentDueDate: calculateDueDate(),
        invoiceAmount,
        grnNo,
        remarks,
        invoiceType,
        cgstAmount,
        sgstAmount,
        igstAmount,
        tdsPercentage,
        advanceAdjust,
        fileName: selectedFile ? selectedFile.name : 'Invoice-Document.pdf'
      });
      setIsSubmitting(false);
      setShowSuccessModal(true);
    }, 500);
  };

  return (
    <div className="space-y-6 font-sans max-w-4xl mx-auto pb-12 antialiased">
      {/* Page Title & Subtitle */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Upload Invoice</h1>
        <p className="text-xs text-slate-500 font-medium mt-1">
          Submit your invoice against an open Purchase Order. Both domestic and Import POs are supported.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-400 hover:text-rose-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Select Purchase Order */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
            Select Purchase Order
          </h2>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Purchase Order <span className="text-rose-500">*</span>
            </label>
            <select
              value={poNumber}
              onChange={(e) => {
                setPoNumber(e.target.value);
                setErrorMsg('');
              }}
              required
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
            Invoice Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Invoice Number */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Invoice Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-2024-001"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              />
            </div>

            {/* Invoice Date */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Invoice Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
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
              <label className="block text-xs font-semibold text-slate-700">Payment Due Date</label>
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

            {/* Due Days */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Due Days <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
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
                required
                value={invoiceAmount}
                onChange={(e) => setInvoiceAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              />
            </div>

            {/* GRN / Delivery Note No */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                GRN / Delivery Note No <span className="text-slate-400 font-normal">(If available)</span>
              </label>
              <input
                type="text"
                value={grnNo}
                onChange={(e) => setGrnNo(e.target.value)}
                placeholder="GRN-001"
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

        {/* Section 3: GST, TDS & Adjustments */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
            GST, TDS & Adjustments
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Invoice Type</label>
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
              <label className="block text-xs font-semibold text-slate-700">CGST Amount</label>
              <input
                type="number"
                value={cgstAmount}
                onChange={(e) => setCgstAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">SGST Amount</label>
              <input
                type="number"
                value={sgstAmount}
                onChange={(e) => setSgstAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">IGST Amount</label>
              <input
                type="number"
                value={igstAmount}
                onChange={(e) => setIgstAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">TDS % (on base amount)</label>
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
              <label className="block text-xs font-semibold text-slate-700">Advance to Adjust</label>
              <input
                type="number"
                value={advanceAdjust}
                onChange={(e) => setAdvanceAdjust(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Invoice File */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
            Invoice File <span className="text-rose-500">*</span>
          </h2>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-slate-200 hover:border-teal-400 bg-slate-50/70 rounded-2xl p-8 text-center flex flex-col items-center justify-center transition cursor-pointer relative"
          >
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="w-12 h-12 rounded-full bg-white text-slate-400 flex items-center justify-center shadow-xs mb-3 border border-slate-200">
              <CloudUpload className="w-6 h-6 text-[#0d7676]" />
            </div>

            {selectedFile ? (
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-800 flex items-center justify-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  {selectedFile.name}
                </p>
                <p className="text-[11px] text-slate-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · Click to change file
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-800">
                  Drag & drop your invoice here
                </p>
                <p className="text-xs font-semibold text-[#0d7676]">or click to browse</p>
                <p className="text-[10px] font-medium text-slate-400 pt-1">
                  PDF, JPG, PNG — max 10 MB
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-start gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs hover:shadow transition"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Invoice'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/vendor/dashboard')}
            className="px-5 py-2.5 border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-50 transition"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-xl border border-slate-100">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Invoice Submitted!</h3>
              <p className="text-xs text-slate-500 mt-1">
                Your invoice has been logged under PO #{poNumber} and sent to the accounts team.
              </p>
            </div>
            <button
              onClick={() => navigate('/vendor/dashboard')}
              className="w-full py-2.5 bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold text-xs uppercase rounded-xl"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
