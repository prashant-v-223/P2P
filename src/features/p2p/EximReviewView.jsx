import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Anchor, ArrowLeft, CheckCircle2, Download, Eye, FileText, Loader2,
  Search, Upload, UserPlus, X, XCircle, Clock, CornerUpLeft, ShieldCheck,
  Building2, Ship, AlertCircle
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { ServerPagination } from '../../components/ui/server-pagination';
import { downloadDocumentFile } from '../../utils/downloadHelper';

const statusLabel = (value) => ({
  submitted: 'Submitted',
  exim_review: 'EXIM Reviewed',
  assigned_to_agent: 'With Customs Agent',
  material_received: 'Material Received',
  custom_cleared: 'Customs Cleared',
  returned_for_correction: 'Returned for Correction',
  rejected: 'Rejected'
}[value] || String(value || '').replaceAll('_', ' '));

const statusClass = (value) => {
  const v = String(value || '').toLowerCase();
  if (v === 'custom_cleared') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (v === 'assigned_to_agent') return 'bg-cyan-50 text-cyan-700 border-cyan-200';
  if (v === 'rejected') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (v.includes('returned')) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-teal-50 text-[#0d7676] border-teal-200';
};

const dateText = (value, withTime = false) => value ? new Date(value).toLocaleString('en-IN', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }) : '—';

const friendlyDocumentType = (value) => ({
  bl_document: 'Bill of Lading',
  boe_document: 'Bill of Entry (BOE)'
}[String(value || '').toLowerCase()] || String(value || 'Document').replaceAll('_', ' '));
const friendlyStage = (value) => ({
  vendor_submission: 'Vendor Submission', custom_agent: 'Custom Agent', exim_review: 'EXIM Review'
}[String(value || '').toLowerCase()] || String(value || 'Vendor Submission').replaceAll('_', ' '));
const displayFileName = (doc) => doc.fileName || String(doc.fileUrl || '').split(/[\\/]/).pop() || 'Document';
const friendlyUploader = (doc) => {
  const value = String(doc.uploadedBy || '').toLowerCase();
  if (value.startsWith('custom_agent')) return 'Custom Agent';
  if (value.startsWith('vendor')) return 'Vendor';
  return doc.uploadedBy || 'Vendor';
};
const formatMoney = (amount, currency = 'INR') => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: String(currency || 'INR').toUpperCase(), maximumFractionDigits: 2
}).format(Number(amount) || 0);

function AssignModal({ entry, agents, onClose, onSaved }) {
  const { showToast } = useToast();
  const [agentId, setAgentId] = useState(entry.customAgentId || '');
  const [notes, setNotes] = useState(entry.eximNotes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Deduplicate agents by ID / Agency Name
  const uniqueAgentMap = new Map();
  (agents || []).forEach(agent => {
    const key = String(agent.agentId || agent._id || agent.agencyName || '').trim().toLowerCase();
    if (key && !uniqueAgentMap.has(key)) {
      uniqueAgentMap.set(key, agent);
    }
  });

  const agentOptions = Array.from(uniqueAgentMap.values()).map((agent) => ({
    label: `${agent.agencyName || 'Customs Agent'} — ${agent.contactPerson || agent.email || 'Clearance Manager'}`,
    value: agent.agentId || agent._id
  }));

  const assign = async () => {
    if (!agentId) return setError('Select an active customs agent.');
    setSaving(true); setError('');
    try {
      const response = await apiFetch(`/api/p2p/exim/bl-entries/${entry.blId}/assign`, { method: 'POST', body: JSON.stringify({ agentId, notes }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Agent assignment failed.');
      showToast({ type: 'success', title: 'Agent Assigned', description: `${entry.blNumber} is now available in the customs agent portal.` });
      onSaved(json.data);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b p-5">
          <div>
            <h2 className="text-base font-extrabold">Assign to Customs Agent</h2>
            <p className="mt-1 text-xs text-slate-500">Select the agent handling customs clearance for BL {entry.blNumber}.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-5">
          {error && <div className="rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div>}
          <label className="block text-xs font-bold">Select Agent *
            <div className="mt-1.5">
              <SearchableSelect
                options={agentOptions}
                value={agentId}
                onChange={(val) => setAgentId(val)}
                placeholder="Search and select agent..."
                size="md"
              />
            </div>
          </label>
          <label className="block text-xs font-bold">Notes for Agent
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="3" placeholder="Instructions for customs clearance..." className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 outline-none focus:border-teal-400" />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t p-4">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-xs font-bold">Cancel</button>
          <button onClick={assign} disabled={saving || !agentId} className="inline-flex items-center gap-1 rounded-lg bg-[#0d7676] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Assign Agent
          </button>
        </div>
      </div>
    </div>
  );
}

function EximList() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [resBl, resAgents] = await Promise.all([
        apiFetch('/api/p2p/exim/bl-entries'),
        apiFetch('/api/custom-agents')
      ]);
      const dataBl = await resBl.json();
      const dataAgents = await resAgents.json();

      if (resBl.ok) setEntries(dataBl.data || []);
      else setError(dataBl.error || 'Failed to load BL entries.');

      if (resAgents.ok) setAgents(dataAgents.agents || dataAgents.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => entries.filter((entry) => (!status || entry.status === status) && [entry.blNumber, entry.rfqNumber, entry.rfqId, entry.vendorName].some((value) => String(value || '').toLowerCase().includes(query.toLowerCase()))), [entries, query, status]);
  const paginated = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  return (
    <div className="space-y-5 pb-12">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold"><Anchor className="h-5 w-5 text-[#0d7676]" />EXIM — BL Entry Review & Workflow</h1>
        <p className="text-xs text-slate-500">Review submitted BL entries from vendors, verify documents, and process customs agent assignments.</p>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-2 border-b p-4">
          <label className="flex w-72 items-center gap-2 rounded-lg border bg-slate-50 px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search BL #, vendor, RFQ..." className="w-full bg-transparent py-2.5 text-xs outline-none" />
          </label>
          <div className="w-48">
            <SearchableSelect
              options={[
                { label: 'All Status', value: '' },
                { label: 'Submitted', value: 'submitted' },
                { label: 'EXIM Reviewed', value: 'exim_review' },
                { label: 'With Customs Agent', value: 'assigned_to_agent' },
                { label: 'Customs Cleared', value: 'custom_cleared' },
                { label: 'Returned', value: 'returned_for_correction' }
              ]}
              value={status}
              onChange={(val) => { setStatus(val); setPage(1); }}
              size="sm"
              searchable={false}
            />
          </div>
        </div>

        {loading ? (
          <div className="p-14 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-[#0d7676]" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="p-4">BL Number</th>
                  <th>RFQ</th>
                  <th>Vendor</th>
                  <th>Clearing Port</th>
                  <th>Containers</th>
                  <th>Docs</th>
                  <th>Agent</th>
                  <th>Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((entry) => (
                  <tr key={entry.blId} onClick={() => navigate(`/admin/exim/${entry.blId}`)} className="cursor-pointer hover:bg-slate-50 transition">
                    <td className="p-4 font-mono font-bold text-slate-900">{entry.blNumber}</td>
                    <td>{entry.rfqNumber || entry.rfqId}</td>
                    <td className="font-semibold text-slate-700">{entry.vendorName}</td>
                    <td>{entry.portOfClearing || '—'}</td>
                    <td>{entry.containerCount}</td>
                    <td><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold">{entry.documents?.length || 0}</span></td>
                    <td>{entry.customAgentName || <span className="text-slate-400 italic">Unassigned</span>}</td>
                    <td><span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${statusClass(entry.status)}`}>{statusLabel(entry.status)}</span></td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => navigate(`/admin/exim/${entry.blId}`)} className="inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50"><Eye className="h-3.5 w-3.5" />Review</button>
                        {entry.status !== 'custom_cleared' && (
                          <button onClick={() => setSelected(entry)} className="inline-flex items-center gap-1 rounded bg-[#0d7676] px-2.5 py-1 text-xs font-bold text-white hover:bg-teal-700"><UserPlus className="h-3.5 w-3.5" />Assign</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <div className="p-12 text-center text-xs text-slate-400">No BL entries found.</div>}
            <ServerPagination
              page={page}
              totalPages={Math.ceil(filtered.length / pageSize) || 1}
              total={filtered.length}
              pageSize={pageSize}
              itemLabel="BL entries"
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </div>
        )}
      </section>

      {selected && <AssignModal entry={selected} agents={agents} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); load(); }} />}
    </div>
  );
}

function EximDetail({ blId }) {
  const { showToast } = useToast();
  const [entry, setEntry] = useState(null);
  const [agents, setAgents] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [docType, setDocType] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`/api/p2p/exim/bl-entries/${blId}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'BL entry not found.');
      setEntry(json.data);
      setAgents(json.agents || json.dataAgents || []);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [blId]);

  const handleDownload = (doc) => {
    const fileTarget = doc.fileUrl || doc.fileName || doc.title || doc.name;
    if (!fileTarget) {
      showToast({ type: 'error', title: 'File Missing', description: 'Document file reference is missing.' });
      return;
    }
    downloadDocumentFile(fileTarget, doc.docType || 'EXIM Document');
  };

  const handleWorkflowAction = async (actionType) => {
    if ((actionType === 'reject' || actionType === 'return') && !remarks.trim()) {
      showToast({ type: 'error', title: 'Remarks required', description: `Provide remarks before ${actionType}ing this BL entry.` });
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiFetch(`/api/p2p/exim/bl-entries/${blId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionType, remarks: remarks.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${actionType} BL entry.`);
      showToast({ title: `BL Entry ${actionType}d`, description: `BL ${entry.blNumber} updated successfully.` });
      setRemarks('');
      await load();
    } catch (err) {
      showToast({ type: 'error', title: 'Action failed', description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const upload = async () => {
    if (!docType || !file) return setError('Select a document type and file.');
    setUploading(true); setError('');
    try {
      const response = await apiFetch(`/api/p2p/exim/bl-entries/${blId}/documents`, { method: 'POST', body: JSON.stringify({ documents: [{ docType, fileName: file.name }] }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      showToast({ type: 'success', title: 'Documents Uploaded', description: 'The EXIM review record was updated.' });
      setDocType(''); setFile(null); await load();
    } catch (e) { setError(e.message); } finally { setUploading(false); }
  };

  if (loading) return <div className="p-12 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-[#0d7676]" /></div>;
  if (!entry) return <div className="rounded-xl bg-rose-50 p-4 text-xs font-bold text-rose-700">{error}</div>;

  const currentStepIndex = entry.status === 'custom_cleared' ? 3 : entry.customAgentId ? 2 : entry.eximReviewedAt ? 1 : 0;

  return (
    <div className="space-y-5 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/admin/exim" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-[#0d7676]"><ArrowLeft className="h-4 w-4" />EXIM Review</Link>
          <div className="mt-2 flex items-center gap-2">
            <h1 className="text-xl font-extrabold">BL: {entry.blNumber}</h1>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold border ${statusClass(entry.status)}`}>{statusLabel(entry.status)}</span>
          </div>
          <p className="text-xs text-slate-500">{entry.rfqNumber || entry.rfqId} · {entry.vendorName || '—'} · {entry.containerCount} containers</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/admin/rfqs/${entry.rfq?.rfqNumber || entry.rfqId}`} className="rounded-lg px-3 py-2 text-xs font-bold text-[#0d5bd7]">View RFQ →</Link>
          {entry.status !== 'custom_cleared' && (
            <button onClick={() => setAssigning(true)} className="inline-flex items-center gap-1 rounded-lg bg-[#0d7676] px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 transition cursor-pointer">
              <UserPlus className="h-4 w-4" />
              {entry.customAgentId ? 'Reassign Agent' : 'Assign to Agent'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div>}

      {/* Visual Workflow Approval Stepper */}
      <section className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">BL Entry Lifecycle & Approval Workflow</h2>
        <div className="grid grid-cols-4 gap-2">
          <div className={`p-3 rounded-xl border text-center ${currentStepIndex >= 0 ? 'bg-teal-50 border-teal-200 text-teal-800' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            <p className="text-[10px] font-bold uppercase">Stage 1</p>
            <p className="text-xs font-extrabold mt-0.5">Submitted</p>
          </div>
          <div className={`p-3 rounded-xl border text-center ${currentStepIndex >= 1 ? 'bg-teal-50 border-teal-200 text-teal-800' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            <p className="text-[10px] font-bold uppercase">Stage 2</p>
            <p className="text-xs font-extrabold mt-0.5">EXIM Verified</p>
          </div>
          <div className={`p-3 rounded-xl border text-center ${currentStepIndex >= 2 ? 'bg-cyan-50 border-cyan-200 text-cyan-800' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            <p className="text-[10px] font-bold uppercase">Stage 3</p>
            <p className="text-xs font-extrabold mt-0.5">With Customs Agent</p>
          </div>
          <div className={`p-3 rounded-xl border text-center ${currentStepIndex >= 3 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            <p className="text-[10px] font-bold uppercase">Stage 4</p>
            <p className="text-xs font-extrabold mt-0.5">Customs Cleared</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border bg-white p-5 text-xs shadow-sm sm:grid-cols-3">
        <div><p className="text-slate-400">EXIM Reviewed</p><strong>{dateText(entry.eximReviewedAt, true)}</strong></div>
        <div><p className="text-slate-400">Assigned At</p><strong>{dateText(entry.assignedAt, true)}</strong></div>
        <div><p className="text-slate-400">Customs Cleared At</p><strong className={entry.customsClearedAt ? 'text-emerald-700' : 'text-slate-400'}>{dateText(entry.customsClearedAt, true)}</strong></div>
        {entry.boeNumber && <div><p className="text-slate-400">BOE Number</p><strong className="text-[#0d7676]">{entry.boeNumber}</strong></div>}
        {entry.customAgentName && <div><p className="text-slate-400">Assigned Agent</p><strong>{entry.customAgentName}</strong>{entry.customAgentAgencyName && <span className="ml-1 text-slate-400">{entry.customAgentAgencyName}</span>}</div>}
        {entry.eximNotes && <div className="sm:col-span-2"><p className="text-slate-400">EXIM Notes</p><strong>{entry.eximNotes}</strong></div>}
      </section>

      {entry.invoices?.length > 0 && (
        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="text-sm font-extrabold">Invoices ({entry.invoices.length})</h2>
            <div className="flex gap-3 text-xs font-semibold">
              <span className="text-emerald-700">{entry.invoices.filter((invoice) => String(invoice.status).toLowerCase() === 'paid').length} paid</span>
              <span className="text-amber-600">{entry.invoices.filter((invoice) => String(invoice.status).toLowerCase() !== 'paid').length} pending</span>
            </div>
          </div>
          {['Vendor', 'Agent'].map((source) => {
            const sourceInvoices = entry.invoices.filter((invoice) => String(invoice.source || 'Vendor').toLowerCase() === source.toLowerCase());
            if (!sourceInvoices.length) return null;
            return <div key={source}>
              <div className={`px-5 py-2 text-xs font-extrabold uppercase ${source === 'Agent' ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700'}`}>{source} Invoices</div>
              <div className="divide-y">
                {sourceInvoices.map((invoice) => <div key={invoice.referenceNumber || invoice._id} className="grid items-center gap-2 px-5 py-3 text-xs sm:grid-cols-[1.2fr_1fr_auto_auto]">
                  <strong>{invoice.referenceNumber || invoice.logisticsPaymentId}</strong>
                  <span className="text-slate-500">{invoice.typeDisplay || invoice.category}</span>
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-center font-semibold text-blue-700">{invoice.status}</span>
                  <strong className="text-right">{formatMoney(invoice.amount, invoice.currency)}</strong>
                </div>)}
              </div>
            </div>;
          })}
        </section>
      )}

      {/* Documents List */}
      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <h2 className="border-b px-5 py-4 text-sm font-extrabold">All Attached Documents ({entry.documents?.length || 0})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th>Stage</th>
                <th>Uploaded By</th>
                <th>File</th>
                <th>Date</th>
                <th className="px-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {entry.documents?.map((doc, index) => (
                <tr key={`${doc.fileUrl || doc.fileName}-${index}`} className="border-t">
                  <td className="px-4 py-4 font-semibold">{friendlyDocumentType(doc.docType)}</td>
                  <td>{friendlyStage(doc.stage || (String(doc.uploadedBy).includes('Customs Agent') ? 'custom_agent' : 'vendor_submission'))}</td>
                  <td>{friendlyUploader(doc)}</td>
                  <td className="max-w-xs truncate font-mono text-[10px]">{displayFileName(doc)}</td>
                  <td>{dateText(doc.uploadedAt, true)}</td>
                  <td className="px-4">
                    <button
                      type="button"
                      onClick={() => handleDownload(doc)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-bold text-[#0d7676] hover:bg-teal-100 transition cursor-pointer shadow-2xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Upload EXIM Document Section */}
      {entry.status !== 'custom_cleared' && <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-extrabold"><Upload className="h-4 w-4" />Upload EXIM Documents</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <SearchableSelect
            options={['Commercial Invoice', 'Packing List', 'Certificate of Origin', 'Insurance Certificate', 'Other EXIM Document']}
            value={docType}
            onChange={(val) => setDocType(val)}
            placeholder="Document type"
            size="md"
            searchable={false}
          />
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="rounded-lg border bg-slate-50 px-3 py-2 text-xs" />
          <button onClick={upload} disabled={uploading || !docType || !file} className="rounded-lg bg-[#0d7676] px-4 py-2 text-xs font-bold text-white disabled:opacity-50 hover:bg-teal-700 transition cursor-pointer">
            {uploading ? 'Uploading...' : 'Upload Documents'}
          </button>
        </div>
      </section>}

      {/* Audit History */}
      {entry.eximApprovalHistory && entry.eximApprovalHistory.length > 0 && (
        <section className="rounded-2xl border bg-white p-5 shadow-sm space-y-2">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">EXIM Approval Audit Log</h2>
          <div className="divide-y divide-slate-100 text-xs">
            {entry.eximApprovalHistory.map((act, index) => (
              <div key={index} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900">{act.actionedBy}</span>
                  <span className="text-slate-500 text-[11px] ml-1">({act.role})</span>
                  <p className="text-slate-600 text-[11px] mt-0.5">{act.remarks}</p>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">{dateText(act.actionedAt, true)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {assigning && <AssignModal entry={entry} agents={agents} onClose={() => setAssigning(false)} onSaved={(updated) => { setAssigning(false); setEntry((current) => ({ ...current, ...updated })); }} />}
    </div>
  );
}

export default function EximReviewView() {
  const { blId } = useParams();
  return blId ? <EximDetail blId={blId} /> : <EximList />;
}
