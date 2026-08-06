// CreateLogisticsPaymentWizard.jsx - Exact Visual Replica of p2p.rayzon.one/admin/logistics-payments/create
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import { Building2, FileText, Paperclip, Send, ChevronLeft } from 'lucide-react';

export default function CreateLogisticsPaymentWizard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useSelector((state) => state.auth);

  const [providers, setProviders] = useState([]);
  const [blEntries, setBlEntries] = useState([]);

  const [providerId, setProviderId] = useState('');
  const [providerName, setProviderName] = useState('');
  const [blId, setBlId] = useState('');
  const [sourceLocation, setSourceLocation] = useState('');
  const [destinationLocation, setDestinationLocation] = useState('');

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [paymentMode, setPaymentMode] = useState('NEFT');
  const [hsnCode, setHsnCode] = useState('');
  const [remarks, setRemarks] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [pRes, bRes] = await Promise.all([
          apiFetch('/api/p2p/vendors'),
          apiFetch('/api/p2p/bl-invoices')
        ]);
        if (pRes.ok) {
          const json = await pRes.json();
          setProviders(json.vendors || []);
        }
        if (bRes.ok) {
          const json = await bRes.json();
          setBlEntries(json.invoices || []);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadData();
  }, []);

  const handleProviderChange = (e) => {
    const val = e.target.value;
    setProviderId(val);
    const target = providers.find(p => p.id === val || p.vendorId === val);
    if (target) {
      setProviderName(target.companyName || target.name);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!invoiceNumber || !amount || Number(amount) <= 0) {
      showToast({ title: 'Validation Error', description: 'Please enter Invoice Number and Amount.', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/p2p/bl-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blNumber: blId || 'BL-LOGISTICS',
          category: 'freight',
          typeDisplay: 'Freight Invoice',
          source: 'Vendor',
          invoiceNumber,
          vendorName: providerName || 'Logistics Provider',
          amount: Number(amount),
          currency,
          remarks: `${remarks} ${sourceLocation ? `[${sourceLocation} -> ${destinationLocation}]` : ''}`,
          documents: files.map(f => ({ name: f.name, size: f.size }))
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast({ title: 'Success', description: 'Logistics Payment invoice submitted for approval.', type: 'success' });
        navigate('/p2p/logistics-payments');
      } else {
        throw new Error(json.error || 'Submission failed');
      }
    } catch (err) {
      showToast({ title: 'Submission Failed', description: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] py-6 px-4 font-sans text-slate-800 antialiased text-left pb-24">
      
      {/* Top Header Navigation */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between">
        <button
          onClick={() => navigate('/p2p/logistics-payments')}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <ChevronLeft className="w-4 h-4" /> Rayzon P2P
        </button>
      </div>

      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* CARD 1: PROVIDER & ROUTE */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-bold text-slate-900">Provider & Route</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Logistics Provider <span className="text-rose-500">*</span>
              </label>
              <select
                value={providerId}
                onChange={handleProviderChange}
                className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#0d7676] outline-none"
              >
                <option value="">Select logistics provider...</option>
                {providers.map((p, idx) => (
                  <option key={idx} value={p.id || p.vendorId}>
                    {p.companyName || p.name}
                  </option>
                ))}
                {providers.length === 0 && (
                  <option value="dhl">Fast Forward Logistics India Privat</option>
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">BL Entry</label>
              <select
                value={blId}
                onChange={(e) => setBlId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#0d7676] outline-none"
              >
                <option value="">Optional link with BL entry</option>
                {blEntries.map((b, idx) => (
                  <option key={idx} value={b.blNumber || b.id}>
                    {b.blNumber} — {b.vendorName || 'Logistics Vendor'}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Source Location <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={sourceLocation}
                  onChange={(e) => setSourceLocation(e.target.value)}
                  placeholder="Plant / warehouse / port"
                  className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#0d7676] outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Destination Location <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={destinationLocation}
                  onChange={(e) => setDestinationLocation(e.target.value)}
                  placeholder="Plant / branch / delivery point"
                  className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#0d7676] outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: INVOICE & PAYMENT DETAILS */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <FileText className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-bold text-slate-900">Invoice & Payment Details</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Invoice Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Enter transporter invoice number"
                className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#0d7676] outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Invoice Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#0d7676] outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Payment Due Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#0d7676] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Amount <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter invoice amount"
                  className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#0d7676] outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Currency <span className="text-rose-500">*</span>
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#0d7676] outline-none"
                >
                  <option value="INR">🇮🇳 INR (Indian Rupee)</option>
                  <option value="USD">🇺🇸 USD (US Dollar)</option>
                  <option value="EUR">🇪🇺 EUR (Euro)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Payment Mode <span className="text-rose-500">*</span>
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#0d7676] outline-none"
              >
                <option value="NEFT">NEFT / RTGS</option>
                <option value="Wire">Wire Transfer</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">HSN / SAC Code</label>
              <input
                type="text"
                value={hsnCode}
                onChange={(e) => setHsnCode(e.target.value)}
                placeholder="Select house base..."
                className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#0d7676] outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Remarks</label>
              <textarea
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add transport remarks, loading details, or billing notes"
                className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#0d7676] outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* CARD 3: SUPPORTING DOCUMENTS */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Paperclip className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-bold text-slate-900">Supporting Documents</h2>
          </div>

          <div className="relative border-2 border-dashed border-slate-200/90 rounded-2xl p-6 text-center bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <Paperclip className="w-5 h-5 text-slate-400" />
              <p className="text-xs font-semibold text-slate-600">Upload invoice and supporting logistics documents.</p>
              <p className="text-[11px] text-slate-400">PDF, JPG, PNG — max 10MB each</p>
            </div>
          </div>

          {files.length > 0 && (
            <div className="space-y-1 pt-1">
              {files.map((f, i) => (
                <p key={i} className="text-xs text-teal-700 font-medium truncate">✓ Attached: {f.name}</p>
              ))}
            </div>
          )}
        </div>

        {/* BOTTOM ACTION BUTTONS */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/p2p/logistics-payments')}
            className="px-5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition border border-transparent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0d7676] hover:bg-[#0f766e] text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {submitting ? 'Submitting...' : 'Submit for Approval'}
          </button>
        </div>

      </div>
    </div>
  );
}
