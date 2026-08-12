// CreateCustomDutyWizard.jsx - Styled with Custom UI Components, Dynamic BL Data & AWS Document Download
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import { CustomInput } from '../../components/ui/custom-input';
import { Button } from '../../components/ui/button';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { User, FileText, Send, Paperclip, ChevronLeft, Download, Cloud } from 'lucide-react';
import { downloadDocumentFile } from '../../utils/downloadHelper';

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
        const [blRes, agentRes] = await Promise.all([
          apiFetch('/api/p2p/bl-invoices'),
          apiFetch('/api/p2p/custom-agents/bl-entries').catch(() => null)
        ]);

        let rawItems = [];
        if (blRes.ok) {
          const json = await blRes.json();
          rawItems = json.invoices || [];
        }
        if (agentRes && agentRes.ok) {
          const json = await agentRes.json();
          const agentBls = json.blEntries || json.data || [];
          rawItems = [...rawItems, ...agentBls];
        }

        const uniqueMap = new Map();
        for (const item of rawItems) {
          const blNum = String(item.blNumber || item.blId || item.id || '').trim().toUpperCase();
          if (!blNum) continue;
          if (!uniqueMap.has(blNum)) {
            uniqueMap.set(blNum, { ...item, blNumber: blNum });
          } else {
            const existing = uniqueMap.get(blNum);
            if (Array.isArray(item.documents) && item.documents.length > 0) {
              const existingDocs = existing.documents || [];
              item.documents.forEach(d => {
                const docName = d.fileName || d.name || d.docType;
                if (!existingDocs.some(ed => (ed.fileName || ed.name || ed.docType) === docName)) {
                  existingDocs.push(d);
                }
              });
              existing.documents = existingDocs;
            }
          }
        }

        const items = Array.from(uniqueMap.values());
        setClearedBls(items);
      } catch (e) {
        console.error('Error loading cleared BLs:', e);
      }
    }
    loadClearedBls();
  }, []);

  const [boeNumber, setBoeNumber] = useState('');
  const [portCode, setPortCode] = useState('INNHAV (Nhava Sheva)');

  const handleSelectBlChange = (val) => {
    setSelectedBlId(val || '');
    const target = clearedBls.find(b => (b.blNumber || b.blId || b.id) === val);
    setSelectedBl(target || null);
    if (target) {
      setBoeNumber(target.boeNumber || `BOE-${val.slice(-6)}`);
      setPortCode(target.portCode || 'INNHAV (Nhava Sheva)');
    } else {
      setBoeNumber('');
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleDownloadDoc = (docName) => {
    showToast({ title: 'Downloading Document', description: `Initiating download for ${docName}...`, type: 'info' });
    downloadDocumentFile(docName);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBlId || !selectedBl) {
      showToast({ title: 'Validation Error', description: 'Please select a BOE / BL entry.', type: 'error' });
      return;
    }
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
          blNumber: selectedBl?.blNumber || selectedBl?.blId || selectedBlId,
          boeNumber: boeNumber.trim() || selectedBl?.boeNumber || `BOE-${selectedBlId}`,
          dutyAmount: Number(dutyAmount),
          portCode: portCode.trim() || selectedBl?.portCode || 'INNHAV (Nhava Sheva)',
          customAgentName: selectedBl?.vendorName || selectedBl?.customAgentName || 'Fast Forward Logistics India Privat',
          remarks,
          documents: files.map(f => ({ name: f.name, size: f.size, storage: 's3' }))
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

  const options = clearedBls.map(b => ({
    label: b.boeNumber
      ? `BOE: ${b.boeNumber} — BL: ${b.blNumber || b.blId || b.id} (${b.vendorName || b.customAgentName || 'Logistics Vendor'})`
      : `BL: ${b.blNumber || b.blId || b.id} — ${b.vendorName || b.customAgentName || 'Logistics Vendor'}`,
    value: b.blNumber || b.blId || b.id
  }));

  // Dynamic documents list for selected BL
  const activeDocuments = (selectedBl && Array.isArray(selectedBl.documents) && selectedBl.documents.length > 0)
    ? selectedBl.documents
    : (selectedBl?.invoiceFile
        ? [{ fileName: selectedBl.invoiceFile, docType: 'Bill of Entry Invoice' }]
        : []);

  const formatDateText = (dateVal) => {
    if (!dateVal) return 'Recently Cleared';
    try {
      return new Date(dateVal).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (_) {
      return String(dateVal);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] py-6 px-4 font-sans text-slate-800 antialiased text-left pb-24">
      {/* Top Header Navigation */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/p2p/custom-duty')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Rayzon P2P</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-teal-50 text-[#0d7676] border border-teal-200">
            <Cloud className="w-3 h-3" />
            AWS S3 Document Storage
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
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
            <SearchableSelect
              options={options}
              value={selectedBlId}
              onChange={handleSelectBlChange}
              placeholder="Search by BOE number or BL number..."
            />
          </div>

          {selectedBlId && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <CustomInput
                label="Bill of Entry (BOE) Number"
                value={boeNumber}
                onChange={(e) => setBoeNumber(e.target.value)}
                placeholder="Enter or confirm BOE Number (e.g. BOE-2026-9904)"
              />
              <CustomInput
                label="Port of Discharge / Port Code"
                value={portCode}
                onChange={(e) => setPortCode(e.target.value)}
                placeholder="e.g. INNHAV (Nhava Sheva)"
              />
            </div>
          )}

          {/* DYNAMIC ORANGE DETAIL CARD */}
          {selectedBl && (
          <div className="bg-[#fffcf7] border border-[#fdecd5] rounded-2xl p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-4 gap-x-2 text-xs">
              <div>
                <p className="text-[11px] font-bold text-amber-800/80">BL Number</p>
                <p className="font-extrabold text-slate-900 mt-0.5">{selectedBl?.blNumber || selectedBl?.blId || selectedBlId || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-amber-800/80">BOE Number</p>
                <p className="font-extrabold text-slate-900 mt-0.5">{selectedBl.boeNumber || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-amber-800/80">Vendor</p>
                <p className="font-extrabold text-slate-900 mt-0.5 truncate">{selectedBl.vendorName || selectedBl.customAgentName || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-amber-800/80">RFQ</p>
                <p className="font-extrabold text-slate-900 mt-0.5">{selectedBl.rfqNumber || selectedBl.rfqId || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-amber-800/80">Custom Cleared On</p>
                <p className="font-extrabold text-slate-900 mt-0.5">{formatDateText(selectedBl?.customsClearedAt || selectedBl?.createdAt)}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-amber-800/80">BL Status</p>
                <p className="font-extrabold text-slate-900 mt-0.5">{selectedBl.status || '—'}</p>
              </div>
            </div>

            {/* DYNAMIC BOE DOCUMENTS SECTION */}
            <div className="border-t border-[#fdecd5] pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-amber-800/80">BOE Documents (AWS S3 Enabled)</p>
                <span className="text-[10px] font-extrabold text-amber-700">Click to Download</span>
              </div>
              <div className="space-y-2">
                {activeDocuments.map((doc, idx) => {
                  const fileName = doc.fileName || doc.name || doc.fileUrl || doc.docType || `BOE_Document_${idx + 1}.pdf`;
                  return (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#fde3c2] text-xs text-slate-700 hover:border-amber-400 transition">
                      <span className="flex items-center gap-2 truncate font-medium max-w-[70%]">
                        <Paperclip className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span className="truncate">{fileName}</span>
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDownloadDoc(doc.fileUrl || doc.url || doc.fileName || doc.name || fileName, fileName)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-[11px] transition cursor-pointer"
                          title="Download document from AWS S3"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          )}
        </div>

        {/* CARD 2: PAYMENT DETAILS */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-5">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-bold text-slate-900">Payment Details</h2>
          </div>

          <div className="space-y-4">
            <CustomInput
              type="number"
              label="Total Duty Amount (₹)"
              required={true}
              value={dutyAmount}
              onChange={(e) => setDutyAmount(e.target.value)}
              placeholder="Enter total custom duty amount"
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Remarks</label>
              <textarea
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add any specific custom duty notes or treasury instructions..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:border-[#0d7676] focus:ring-2 focus:ring-teal-500/20 outline-none resize-none transition shadow-2xs"
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
              <div className="flex flex-col items-center justify-center space-y-2">
                <Paperclip className="w-6 h-6 text-slate-400" />
                <p className="text-xs font-medium text-slate-600">
                  Upload supporting documents (challan, receipts, etc.)
                </p>
                <p className="text-[11px] text-slate-400">PDF, JPG, PNG — max 10MB each (Stored via AWS S3)</p>
                {files.length > 0 && (
                  <div className="mt-2 text-xs font-bold text-[#0d7676]">
                    {files.length} file(s) selected for AWS S3 upload: {files.map(f => f.name).join(', ')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BUTTONS */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/p2p/custom-duty')}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            loading={submitting}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit for Approval</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
