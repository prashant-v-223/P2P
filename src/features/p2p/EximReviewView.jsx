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

function AssignModal({ entry, agents, onClose, onSaved }) {
  const { showToast } = useToast();
  const [agentId, setAgentId] = useState(entry.customAgentId || '');
  const [notes, setNotes] = useState(entry.eximNotes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
                options={agents.map((agent) => ({ label: `${agent.agencyName} — ${agent.contactPerson || agent.email}`, value: agent.agentId }))}
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

      if (resBl.ok) setEntries(dataBl.entries || []);
      else setError(dataBl.error || 'Failed to load BL entries.');

      if (resAgents.ok) setAgents(dataAgents.agents || []);
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
                  <th className="px-4 py-3">#</th>
                  <th>BL Number</th>
                  <th>RFQ</th>
                  <th>Vendor</th>
                  <th className="text-center">Containers</th>
                  <th>Status</th>
                  <th>Assigned Agent</th>
                  <th>Date</th>
                  <th className="px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((entry, index) => (
                  <tr key={entry.blId} className="border-t hover:bg-slate-50/70">
                    <td className="px-4 py-4 text-slate-400">{(page - 1) * pageSize + index + 1}</td>
                    <td className="font-bold">{entry.blNumber}</td>
                    <td><span className="rounded border bg-slate-50 px-2 py-1 font-mono text-[10px]">{entry.rfqNumber || entry.rfqId}</span></td>
                    <td>{entry.vendorName || '—'}</td>
                    <td className="text-center"><span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-cyan-50 font-bold text-[#0d7676]">{entry.containerCount}</span></td>
                    <td><span className={`rounded-full px-2 py-1 text-[10px] font-bold border ${statusClass(entry.status)}`}>{statusLabel(entry.status)}</span></td>
                    <td>{entry.customAgentName ? <span className="rounded border border-teal-200 bg-teal-50 px-2 py-1 text-[10px] font-semibold text-[#0d7676]">{entry.customAgentName}</span> : <span className="text-slate-400">Unassigned</span>}</td>
                    <td className="text-slate-500">{dateText(entry.createdAt)}</td>
                    <td className="px-4 text-center">
                      <button onClick={() => navigate(`/admin/exim/${entry.blId}`)} className="rounded-lg border p-2 text-slate-500 hover:border-teal-300 hover:text-[#0d7676]" title="View BL Details & Workflow">
                        <Eye className="h-4 w-4" />
                      </button>
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
  const [entry, setEntry] = useState(null); const [agents, setAgents] = useState([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [assigning, setAssigning] = useState(false); const [docType, setDocType] = useState(''); const [file, setFile] = useState(null); const [uploading, setUploading] = useState(false);
  const [remarks, setRemarks] = useState(''); const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`/api/p2p/exim/bl-entries/${blId}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'BL entry not found.');
      setEntry(json.data);
      setAgents(json.agents || []);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [blId]);

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
            <button onClick={() => setAssigning(true)} className="inline-flex items-center gap-1 rounded-lg bg-[#0d7676] px-4 py-2 text-xs font-bold text-white">
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

      {/* EXIM Approval Action Form */}
      {entry.status !== 'custom_cleared' && entry.status !== 'rejected' && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 space-y-3">
          <h2 className="text-xs font-bold text-amber-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            Process EXIM Approval Cycle Decision
          </h2>
          <div>
            <textarea
              rows={2}
              placeholder="Enter EXIM review notes or remarks..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0d7676]"
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleWorkflowAction('return')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-orange-800 bg-orange-100 hover:bg-orange-200 rounded-lg border border-orange-200 transition"
            >
              <CornerUpLeft className="w-3.5 h-3.5" /> Return for Correction
            </button>
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleWorkflowAction('reject')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition"
            >
              <XCircle className="w-3.5 h-3.5" /> Reject BL Entry
            </button>
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleWorkflowAction('approve')}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#0d7676] hover:bg-[#0a5c5c] rounded-lg transition shadow-xs"
            >
              {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Approve BL Entry
            </button>
          </div>
        </section>
      )}

      <section className="grid gap-4 rounded-2xl border bg-white p-5 text-xs shadow-sm sm:grid-cols-3">
        <div><p className="text-slate-400">EXIM Reviewed</p><strong>{dateText(entry.eximReviewedAt, true)}</strong></div>
        <div><p className="text-slate-400">Assigned At</p><strong>{dateText(entry.assignedAt, true)}</strong></div>
        <div><p className="text-slate-400">Customs Cleared At</p><strong className={entry.customsClearedAt ? 'text-emerald-700' : 'text-slate-400'}>{dateText(entry.customsClearedAt, true)}</strong></div>
        {entry.customAgentName && <div><p className="text-slate-400">Assigned Agent</p><strong>{entry.customAgentName}</strong></div>}
        {entry.eximNotes && <div className="sm:col-span-2"><p className="text-slate-400">EXIM Notes</p><strong>{entry.eximNotes}</strong></div>}
      </section>

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
                <tr key={`${doc.fileUrl}-${index}`} className="border-t">
                  <td className="px-4 py-4 font-semibold">{doc.docType}</td>
                  <td>{doc.stage || (String(doc.uploadedBy).includes('Customs Agent') ? 'Customs Agent' : 'Vendor Submission')}</td>
                  <td>{doc.uploadedBy || 'Vendor'}</td>
                  <td className="max-w-xs truncate font-mono text-[10px]">{doc.fileUrl}</td>
                  <td>{dateText(doc.uploadedAt, true)}</td>
                  <td className="px-4">
                    <button className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[#0d5bd7]"><Download className="h-3 w-3" />Download</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Upload EXIM Document Section */}
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
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
          <button onClick={upload} disabled={uploading || !docType || !file} className="rounded-lg bg-[#0d7676] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
            {uploading ? 'Uploading...' : 'Upload Documents'}
          </button>
        </div>
      </section>

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
