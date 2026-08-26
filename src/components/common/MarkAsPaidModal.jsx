import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, CreditCard, Upload, Loader2, FileText, AlertCircle } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../ui/toast';
import DocumentUploader from '../shared/DocumentUploader';

export default function MarkAsPaidModal({ open, onClose, item, type = 'AdvancePayment', onSuccess }) {
  const { showToast } = useToast();
  const [utrNumber, setUtrNumber] = useState('');
  const [paymentMode, setPaymentMode] = useState('NEFT');
  const [disbursementDate, setDisbursementDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (open) {
      setUtrNumber('');
      setPaymentMode(item?.mode || item?.paymentMode || 'NEFT');
      setDisbursementDate(new Date().toISOString().split('T')[0]);
      setRemarks('');
      setUploadedDocs([]);
      setErrorMsg('');
    }
  }, [open, item]);

  if (!open || !item) return null;

  const referenceId = item.reference || item.id || item.advanceId || item.invoicePaymentId || item.dutyId || item.logisticsPaymentId;
  const vendorName = item.vendorName || item.customAgentName || 'Vendor';
  const rawAmt = item.amount ?? item.netPayable ?? item.dutyAmount ?? item.totalAmount ?? 0;
  const currency = item.currency || 'INR';

  const formatAmount = (val, curr) => {
    const num = typeof val === 'number' ? val : parseFloat(String(val || '').replace(/[^0-9.-]+/g, '')) || 0;
    if (curr === 'USD') return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getEndpoint = () => {
    if (type === 'AdvancePayment' || String(referenceId).startsWith('ADV')) return `/api/p2p/advances/${referenceId}/payout`;
    if (type === 'InvoicePayment' || String(referenceId).startsWith('INV')) return `/api/p2p/invoices/${referenceId}/payout`;
    if (type === 'CustomDuty' || String(referenceId).startsWith('DUTY')) return `/api/p2p/custom-duties/${referenceId}/payout`;
    if (type === 'LogisticsPayment' || String(referenceId).startsWith('LOG')) return `/api/p2p/logistics-payments/${referenceId}/payout`;
    return `/api/p2p/advances/${referenceId}/payout`;
  };

  const getDocumentableType = () => {
    if (type === 'InvoicePayment' || String(referenceId).startsWith('INV')) return 'InvoicePayment';
    if (type === 'CustomDuty' || String(referenceId).startsWith('DUTY')) return 'CustomDutyPayment';
    if (type === 'LogisticsPayment' || String(referenceId).startsWith('LOG')) return 'LogisticsPayment';
    return 'AdvancePayment';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!utrNumber.trim()) {
      setErrorMsg('Bank UTR / Payment Reference Number is required.');
      return;
    }
    if (!remarks.trim()) {
      setErrorMsg('Payment remarks / treasury notes are required.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');

      const body = {
        utrNumber: utrNumber.trim(),
        paymentMode,
        disbursementDate,
        remarks: remarks.trim(),
        paymentRemarks: remarks.trim(),
        proofDocuments: uploadedDocs.map(d => ({
          documentId: d.documentId,
          fileName: d.fileName,
          fileUrl: d.fileUrl
        }))
      };

      const res = await apiFetch(getEndpoint(), {
        method: 'POST',
        body: JSON.stringify(body)
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to record payment disbursement.');
      }

      showToast({
        title: 'Payment Recorded',
        description: json.message || `${referenceId} marked as paid successfully.`,
        type: 'success'
      });

      if (onSuccess) onSuccess(json.data || json);
      onClose();
    } catch (err) {
      console.error('Error submitting payout:', err);
      setErrorMsg(err.message || 'Failed to process payment disbursement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Record Bank Disbursement</h3>
              <p className="text-xs text-slate-500 font-medium">Mark {referenceId} as Paid & Post to Settlement Ledger</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-left">
          {/* Summary Box */}
          <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3.5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">Reference ID & Beneficiary</p>
              <p className="text-sm font-extrabold text-slate-900 font-mono mt-0.5">{referenceId}</p>
              <p className="text-xs text-slate-600 font-semibold">{vendorName}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">Disbursement Amount</p>
              <p className="text-lg font-extrabold text-emerald-800 font-mono mt-0.5">{formatAmount(rawAmt, currency)}</p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-700 font-bold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Bank UTR */}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                Bank UTR / Transaction Ref No. <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
                placeholder="e.g. UTR992810482910"
                required
                className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900"
              />
            </div>

            {/* Payment Mode */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Payment Mode
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 bg-white"
              >
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="IMPS">IMPS</option>
                <option value="Wire Transfer">Wire Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="ICEGATE Treasury">ICEGATE Treasury</option>
              </select>
            </div>

            {/* Disbursement Date */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Disbursement Date
              </label>
              <input
                type="date"
                value={disbursementDate}
                onChange={(e) => setDisbursementDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900"
              />
            </div>
          </div>

          {/* Remarks */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              Payment Remarks / Treasury Note <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter bank advice comments, payment approval notes, or treasury remarks..."
              required
              className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-slate-900"
            />
          </div>

          {/* Upload Proof Document Section */}
          <div className="space-y-1 pt-1">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Bank Advice / Payment Proof Upload</span>
              <span className="text-[10px] text-slate-400 font-normal">Optional attached bank receipt</span>
            </label>
            <DocumentUploader
              documentableType={getDocumentableType()}
              documentableId={referenceId}
              documentType="bank_advice"
              filterDocumentType="bank_advice"
              onUploadComplete={(docs) => setUploadedDocs(prev => [...prev, ...docs])}
              onDocumentsChange={(docs) => setUploadedDocs(docs)}
              multiple={false}
            />
          </div>

          {/* Submit Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Recording Disbursement...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm & Mark as Paid
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
