import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { downloadDocumentFile } from '../../utils/downloadHelper';
import { 
  ChevronLeft, 
  Save, 
  X, 
  Upload, 
  FileText, 
  Loader2,
  AlertCircle,
  Download,
  Paperclip
} from 'lucide-react';

export default function EditAdvancePaymentView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [poNumber, setPoNumber] = useState('');
  const [vendorCode, setVendorCode] = useState('');
  const [poValue, setPoValue] = useState(0);

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [reason, setReason] = useState('');
  const [updateRemark, setUpdateRemark] = useState('');
  const [withGst, setWithGst] = useState(false);
  const [advanceStatus, setAdvanceStatus] = useState('');
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    fetchAdvanceForEdit();
  }, [id]);

  const fetchAdvanceForEdit = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/p2p/advances/${id}`);
      if (res.ok) {
        const json = await res.json();
        const found = json.data;
        if (found) {
          setPoNumber(found.sapPoNumber || found.poId || '');
          setVendorCode(found.vendorId || found.vendorName || '');
          setPoValue(Number(found.poValue || found.totalPoAmount || 0));
          setAmount(found.amount?.toString() || '');
          setCurrency(found.currency || 'INR');
          setReason(found.remarks || '');
          setWithGst(found.gstBreakup?.totalGst > 0);
          setAdvanceStatus(found.status || '');
          const docs = found.supportingDocuments || found.documents || [];
          if (Array.isArray(docs)) setDocuments(docs);
        }
      }
    } catch (e) {
      console.error('Error fetching advance for edit:', e);
      showToast({ title: 'Error', description: 'Failed to load advance payment details.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      return showToast({ title: 'Validation Error', description: 'Enter a valid requested amount.', type: 'error' });
    }
    setSaving(true);
    try {
      const res = await apiFetch(`/api/p2p/advances/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          amount: Number(amount),
          currency,
          remarks: reason,
          updateRemark: updateRemark.trim() || 'Advance payment details updated and resubmitted for approval.',
          resubmit: true
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to update advance payment.');
      }
      showToast({
        title: 'Resent for Approval',
        description: `Changes saved for advance ${id}. Request has been resubmitted for approval.`,
        type: 'success'
      });
      navigate(`/admin/advance-payments/${id}`);
    } catch (e) {
      showToast({
        title: 'Update Failed',
        description: e.message,
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-2">
        <Loader2 className="w-8 h-8 animate-spin text-[#0d7676]" />
        <p className="text-xs font-semibold text-slate-600">Loading advance payment details...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 font-sans text-slate-800 pb-10 text-left">
      
      {/* 1. Breadcrumbs & Title Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
          <Link to="/admin/advance-payments" className="hover:text-slate-900 transition-colors">
            Advance Payments
          </Link>
          <span>/</span>
          <Link to={`/admin/advance-payments/${id}`} className="hover:text-slate-900 transition-colors font-mono">
            {id}
          </Link>
          <span>/</span>
          <span className="font-bold text-slate-800">Edit</span>
        </div>
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Edit Advance Payment</h1>
        <p className="text-xs text-slate-400 font-mono mt-0.5">{id}</p>
      </div>

      {/* 2. Main Two-Column Layout */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full items-start">
        
        {/* LEFT COLUMN (8 Cols / ~65% width) */}
        <div className="lg:col-span-8 space-y-4 w-full">
          
          {/* Card 1: Purchase Order Info Box */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Purchase Order</h3>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 grid grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">PO NUMBER</p>
                <p className="font-mono font-bold text-slate-900 mt-0.5">{poNumber || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">VENDOR CODE / NAME</p>
                <p className="font-mono font-bold text-slate-900 mt-0.5">{vendorCode || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">PO VALUE</p>
                <p className="font-mono font-bold text-slate-900 mt-0.5">{currency} {poValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>

          {/* Card 2: Payment Details */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Payment Details</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Requested Amount <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-xl outline-none font-mono font-bold text-slate-900 focus:ring-2 focus:ring-teal-500/20"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Currency <span className="text-rose-500">*</span></label>
                <SearchableSelect
                  options={[
                    { label: 'INR — Indian Rupee', value: 'INR' },
                    { label: 'USD — US Dollar', value: 'USD' },
                    { label: 'EUR — Euro', value: 'EUR' }
                  ]}
                  value={currency}
                  onChange={(val) => setCurrency(val)}
                  size="sm"
                  searchable={false}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reason / Remarks <span className="text-rose-500">*</span></label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows="3"
                className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl outline-none font-medium bg-white focus:ring-2 focus:ring-teal-500/20"
                required
              ></textarea>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Update Remark (Reason for editing)</label>
              <input
                type="text"
                value={updateRemark}
                onChange={(e) => setUpdateRemark(e.target.value)}
                placeholder="Explain what was changed before resubmitting for approval..."
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl outline-none font-medium bg-white focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>

          {/* Card 3: GST */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">GST</h3>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={withGst}
                onChange={(e) => setWithGst(e.target.checked)}
                className="rounded border-slate-300 text-[#0d7676] focus:ring-teal-500 w-4 h-4"
              />
              This payment includes GST
            </label>
          </div>

          {/* Card 4: Documents */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Supporting Documents</h3>
            
            {documents.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">EXISTING DOCUMENTS</p>
                {documents.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div className="flex items-center gap-2.5 truncate max-w-[75%]">
                      <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="font-bold text-slate-800 truncate">{doc.name || doc.fileName || doc.title || `Document ${idx + 1}`}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadDocumentFile(doc.url || doc.path, doc.name || `Advance-Doc-${idx + 1}`)}
                      className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition"
                      title="Download file"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No supporting documents attached.</p>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN (4 Cols / ~35% width) */}
        <div className="lg:col-span-4 space-y-4 w-full">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SUMMARY</p>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Reference</span>
                <span className="font-mono font-bold text-slate-900">{id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Current Status</span>
                <span className="font-bold text-amber-700 capitalize">{advanceStatus || 'Draft'}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2">
                <span className="text-slate-500 font-medium">Amount</span>
                <span className="font-mono font-extrabold text-slate-900">{currency} {Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 font-medium">
              ⚡ Saving changes will automatically reset status to Pending and resubmit this advance payment request for approval.
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 rounded-xl bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Resubmitting...' : 'Save & Resubmit for Approval'}
              </button>

              <button
                type="button"
                onClick={() => navigate(`/admin/advance-payments/${id}`)}
                className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

      </form>

    </div>
  );
}
