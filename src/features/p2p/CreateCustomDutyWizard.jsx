// CreateCustomDutyWizard.jsx - Exact Visual Replica of p2p.rayzon.one/admin/custom-duty/create
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import { User, FileText, Send, Paperclip, ExternalLink, ChevronLeft } from 'lucide-react';

export default function CreateCustomDutyWizard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useSelector((state) => state.auth);

  const [clearedBls, setClearedBls] = useState([]);
  const [selectedBlId, setSelectedBlId] = useState('');
  const [selectedBl, setSelectedBl] = useState(null);

  const [dutyAmount, setDutyAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadClearedBls() {
      try {
        const res = await apiFetch('/api/p2p/bl-invoices');
        if (res.ok) {
          const json = await res.json();
          const items = json.invoices || [];
          setClearedBls(items);
          if (items.length > 0) {
            setSelectedBlId(items[0].blNumber || items[0].id);
            setSelectedBl(items[0]);
          }
        }
      } catch (e) {
        console.error('Error loading cleared BLs:', e);
      }
    }
    loadClearedBls();
  }, []);

  const handleSelectBlChange = (e) => {
    const val = e.target.value;
    setSelectedBlId(val);
    const target = clearedBls.find(b => (b.blNumber || b.id) === val);
    if (target) {
      setSelectedBl(target);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!dutyAmount || Number(dutyAmount) <= 0) {
      showToast({ title: 'Validation Error', description: 'Please enter total custom duty amount.', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/p2p/custom-duties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blNumber: selectedBl?.blNumber || 'SHNSA2600305',
          boeNumber: selectedBl?.boeNumber || '9044792',
          dutyAmount: Number(dutyAmount),
          portCode: selectedBl?.portCode || 'INNHAV (Nhava Sheva)',
          customAgentName: selectedBl?.vendorName || 'Fast Forward Logistics India Privat',
          remarks,
          documents: files.map(f => ({ name: f.name, size: f.size }))
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast({ title: 'Success', description: 'Custom Duty payment submitted for approval.', type: 'success' });
        navigate('/p2p/custom-duty');
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
      
      {/* Top Header Link */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between">
        <button
          onClick={() => navigate('/p2p/custom-duty')}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <ChevronLeft className="w-4 h-4" /> Rayzon P2P
        </button>
      </div>

      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* CARD 1: SELECT BILL OF ENTRY (BOE) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-5">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-bold text-slate-900">Select Bill of Entry (BOE)</h2>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              BOE / BL Entry <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedBlId}
              onChange={handleSelectBlChange}
              className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#0d7676] outline-none"
            >
              {clearedBls.map((b, idx) => (
                <option key={idx} value={b.blNumber || b.id}>
                  {b.boeNumber || '9044792'} — BL: {b.blNumber || 'SHNSA2600305'} - {b.vendorName || 'Fast Forward Logistics India Privat'}
                </option>
              ))}
              {clearedBls.length === 0 && (
                <option value="SHNSA2600305">9044792 — BL: SHNSA2600305 - Fast Forward Logistics India Privat</option>
              )}
            </select>
          </div>

          {/* INNER ORANGE DETAIL CARD */}
          <div className="bg-[#fffcf7] border border-[#fdecd5] rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-4 gap-x-2 text-xs">
              <div>
                <p className="text-[11px] font-bold text-amber-800/80">BL Number</p>
                <p className="font-extrabold text-slate-900 mt-0.5">{selectedBl?.blNumber || 'SHNSA2600305'}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-amber-800/80">BOE Number</p>
                <p className="font-extrabold text-slate-900 mt-0.5">{selectedBl?.boeNumber || '9044792'}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-amber-800/80">Vendor</p>
                <p className="font-extrabold text-slate-900 mt-0.5 truncate">{selectedBl?.vendorName || 'Fast Forward Logistics India Privat'}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-amber-800/80">RFQ</p>
                <p className="font-extrabold text-slate-900 mt-0.5">{selectedBl?.rfqNumber || 'RFQ-2026-0001'}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-amber-800/80">Custom Cleared On</p>
                <p className="font-extrabold text-slate-900 mt-0.5">09 Jul 2026</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-amber-800/80">BL Status</p>
                <p className="font-extrabold text-slate-900 mt-0.5">Custom Cleared</p>
              </div>
            </div>

            <div className="border-t border-[#fdecd5] pt-3 space-y-2">
              <p className="text-[11px] font-bold text-amber-800/80">BOE Documents</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#fde3c2] text-xs text-slate-700">
                  <span className="flex items-center gap-2 truncate font-medium">
                    <Paperclip className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    9044792 RAYZON SOLAR CELL.pdf
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-amber-700 shrink-0 ml-2 cursor-pointer" />
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#fde3c2] text-xs text-slate-700">
                  <span className="flex items-center gap-2 truncate font-medium">
                    <Paperclip className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    Re_ [IDEAL clearance] KOSAMBA _ SHANGHAI to NHAVA SHEVA _ 3X40FT _ BL no _ SHNS...
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-amber-700 shrink-0 ml-2 cursor-pointer" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: PAYMENT DETAILS */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-5">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-bold text-slate-900">Payment Details</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Total Duty Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                value={dutyAmount}
                onChange={(e) => setDutyAmount(e.target.value)}
                placeholder="Enter total custom duty amount"
                className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#0d7676] outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Remarks</label>
              <textarea
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#0d7676] outline-none resize-none"
              />
            </div>

            {/* FILE DROPZONE BOX */}
            <div className="relative border-2 border-dashed border-slate-200/90 rounded-2xl p-6 text-center bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center gap-2">
                <Paperclip className="w-5 h-5 text-slate-400" />
                <p className="text-xs font-semibold text-slate-600">Upload supporting documents (challan, receipts, etc.)</p>
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
        </div>

        {/* BOTTOM ACTION BUTTONS */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/p2p/custom-duty')}
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
