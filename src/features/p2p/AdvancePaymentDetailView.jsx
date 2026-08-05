import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import DocumentUploader from '../../components/shared/DocumentUploader';
import RecordDbInfoDrawer from '../../components/common/RecordDbInfoDrawer';
import UniversalApprovalWorkflowCard from '../../components/common/UniversalApprovalWorkflowCard';
import {
  ChevronLeft, Trash2, Edit3, Send, CheckCircle2, XCircle,
  Clock, Plus, Loader2, AlertTriangle, RotateCcw, Lock
} from 'lucide-react';

// ── Derive steps dynamically from the Approval document (DB-stored workflow) ─
function deriveSteps(approvalDoc) {
  if (!approvalDoc) return [];

  let dbSteps = approvalDoc.parsedSteps || null;
  if (!dbSteps && approvalDoc.workflowSteps) {
    try { dbSteps = JSON.parse(approvalDoc.workflowSteps); } catch (_) {}
  }

  if (!dbSteps || dbSteps.length === 0) {
    dbSteps = [
      { step: 1, title: 'Procurement Manager Verification', roleName: 'Nikunj Bhagat (Finance Lead)', statusKey: 'Pending Procurement Head Approval' },
      { step: 2, title: 'Finance Head Sign-off',            roleName: 'Prashant V (Finance Head)',    statusKey: 'Pending Finance Approval' }
    ];
  }

  const sorted        = [...dbSteps].sort((a, b) => (a.step || 0) - (b.step || 0));
  const currentStepIdx = Math.max(0, (approvalDoc.currentStep || 1) - 1);
  const isRejected    = approvalDoc.status === 'Rejected';
  const isReturned    = approvalDoc.status === 'Returned for changes';
  const isFullDone    = approvalDoc.status === 'Approved & Dispatched';

  return sorted.map((s, idx) => {
    let stepStatus;
    if (isFullDone) {
      stepStatus = 'approved';
    } else if (isRejected) {
      stepStatus = idx < currentStepIdx ? 'approved' : idx === currentStepIdx ? 'rejected' : 'not_started';
    } else if (isReturned) {
      stepStatus = idx < currentStepIdx ? 'approved' : idx === currentStepIdx ? 'returned' : 'not_started';
    } else {
      stepStatus = idx < currentStepIdx ? 'approved' : idx === currentStepIdx ? 'pending' : 'not_started';
    }
    return {
      label:    s.title,
      approver: s.roleName,
      statusKey: s.statusKey || `Pending ${s.title}`,
      stepStatus,
      isActive: idx === currentStepIdx && !isFullDone && !isRejected && !isReturned,
      actionedBy:  isRejected && idx === currentStepIdx ? approvalDoc.actionedBy : null,
      actionedAt:  isRejected && idx === currentStepIdx ? approvalDoc.actionedAt : null,
      remarks:     (isRejected || isReturned) && idx === currentStepIdx ? approvalDoc.remarks : null
    };
  });
}

// ── Status display config ─────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft:    { label: 'Draft',    pill: 'bg-slate-100 text-slate-600 border-slate-200',   icon: null },
  pending:  { label: 'Pending',  pill: 'bg-amber-50 text-amber-700 border-amber-200',    icon: Clock },
  approved: { label: 'Approved', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  rejected: { label: 'Rejected', pill: 'bg-rose-50 text-rose-700 border-rose-200',       icon: XCircle },
  returned: { label: 'Returned', pill: 'bg-orange-50 text-orange-700 border-orange-200', icon: RotateCcw },
  paid:     { label: 'Paid',     pill: 'bg-sky-50 text-sky-700 border-sky-200',          icon: CheckCircle2 }
};

export default function AdvancePaymentDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const fileInputRef = useRef(null);

  const [loading, setLoading]         = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // 'approve' | 'reject' | 'return' | 'submit'
  const [advance, setAdvance]         = useState(null);
  const [approval, setApproval]       = useState(null);
  const [steps, setSteps]             = useState([]);
  const [docs, setDocs]               = useState([]);
  const [remarksText, setRemarksText] = useState(''); // Added for approval actions

  useEffect(() => { fetchData(); }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/p2p/advances/${id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          const approvalDoc = d.approval || null;
          setAdvance(d);
          setApproval(approvalDoc);
          setSteps(deriveSteps(approvalDoc));
          if (Array.isArray(d.documents)) setDocs(d.documents);
          return;
        }
      }
      // Fallback: scan list
      const listRes = await apiFetch('/api/p2p/advances');
      if (listRes.ok) {
        const listJson = await listRes.json();
        const found = (listJson.data || []).find(a => a.advanceId === id);
        if (found) { setAdvance(found); setSteps([]); }
      }
    } catch (e) {
      console.error('fetchData error:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Submit for Approval ───────────────────────────────────────────────────
  const handleSubmitForApproval = async () => {
    setActionLoading('submit');
    try {
      const res = await apiFetch(`/api/p2p/advances/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'pending' })
      });
      if (!res.ok) throw new Error('Failed');
      showToast({ title: 'Submitted for Approval', description: `${id} is now in the approval queue.`, type: 'success' });
      await fetchData();
    } catch {
      showToast({ title: 'Error', description: 'Could not submit for approval.', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // ── Approve current step ──────────────────────────────────────────────────
  const handleApproveStep = async () => {
    setActionLoading('approve');
    try {
      const res = await apiFetch(`/api/approvals/${id}/action`, {
        method: 'POST',
        headers: { 'Idempotency-Key': `${id}:approve:${approval?.currentStep || 1}` },
        body: JSON.stringify({ action: 'Approve', remarks: remarksText.trim() || 'Approved' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      const isFullyDone = data.nextStatus === 'Approved & Dispatched';
      showToast({
        title:       isFullyDone ? '✓ Fully Approved' : '✓ Step Approved',
        description: isFullyDone ? `${id} has been fully approved.` : `Workflow advanced to next step.`,
        type:        'success'
      });
      setRemarksText('');
      await fetchData();
    } catch (e) {
      showToast({ title: 'Approval Failed', description: e.message, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // ── Return for changes ────────────────────────────────────────────────────
  const handleReturnStep = async () => {
    setActionLoading('return');
    try {
      const res = await apiFetch(`/api/approvals/${id}/action`, {
        method: 'POST',
        headers: { 'Idempotency-Key': `${id}:return:${approval?.currentStep || 1}` },
        body: JSON.stringify({ action: 'Return', remarks: remarksText.trim() || 'Returned for changes' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      showToast({ title: 'Returned for Changes', description: `${id} sent back to requester.`, type: 'warning' });
      setRemarksText('');
      await fetchData();
    } catch (e) {
      showToast({ title: 'Action Failed', description: e.message, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // ── Reject ────────────────────────────────────────────────────────────────
  const handleRejectStep = async () => {
    if (!remarksText.trim()) {
      showToast({ title: 'Remarks Required', description: 'Please enter a reason for rejection before rejecting.', type: 'warning' });
      return;
    }
    setActionLoading('reject');
    try {
      const res = await apiFetch(`/api/approvals/${id}/action`, {
        method: 'POST',
        headers: { 'Idempotency-Key': `${id}:reject:${approval?.currentStep || 1}` },
        body: JSON.stringify({ action: 'Reject', remarks: remarksText.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      showToast({ title: '✗ Request Rejected', description: `${id} has been rejected.`, type: 'error' });
      setRemarksText('');
      await fetchData();
    } catch (e) {
      showToast({ title: 'Rejection Failed', description: e.message, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // ── Delete (only allowed on draft) ───────────────────────────────────────
  const handleDelete = async () => {
    if (!window.confirm(`Permanently delete advance request ${id}?`)) return;
    try {
      await apiFetch(`/api/p2p/advances/${id}`, { method: 'DELETE' });
      showToast({ title: 'Deleted', description: `${id} has been deleted.`, type: 'info' });
      navigate('/p2p/advances');
    } catch {
      navigate('/p2p/advances');
    }
  };

  // ── File upload ───────────────────────────────────────────────────────────
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setDocs(prev => [...prev, ...files.map(f => ({ name: f.name, type: 'advance_request', version: 'v1', uploadedBy: 'Finance Team' }))]);
    showToast({ title: 'Document Uploaded', description: `${files.length} file(s) attached.`, type: 'success' });
    e.target.value = '';
  };

  // ── Derived booleans ──────────────────────────────────────────────────────
  const status     = advance?.status || 'draft';
  const isDraft    = status === 'draft';
  const isPending  = status === 'pending';
  const isApproved = status === 'approved';
  const isRejected = status === 'rejected';
  const isReturned = status === 'returned';
  const isPaid     = status === 'paid';

  // Once submitted (pending/approved/rejected/paid), lock Edit & Delete
  const isLocked = !isDraft && !isReturned;

  const sc = STATUS_CONFIG[status] || STATUS_CONFIG.draft;

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 gap-2">
      <Loader2 className="w-5 h-5 animate-spin text-teal-600" /> Loading...
    </div>
  );

  return (
    <div className="w-full space-y-4 font-sans text-slate-800 pb-10 text-left">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />

      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Link to="/p2p/advances" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-slate-900 tracking-tight font-mono">{id}</h1>
              <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${sc.pill}`}>
                {sc.icon && <sc.icon className="w-3 h-3" />}
                {sc.label}
              </span>
              {isLocked && !isApproved && !isPaid && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200">
                  <Lock className="w-2.5 h-2.5" /> Locked
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <RecordDbInfoDrawer entityId={id} entityType="AdvancePayment" recordData={advance || approval} />

          {/* Delete — only shown for draft */}
          {isDraft && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Universal Dynamic Approval Workflow Stepper Component */}
      <UniversalApprovalWorkflowCard
        referenceId={id}
        recordType="Advance Payment"
        vendorName={advance?.vendorName || approval?.vendorName}
        amountFormatted={advance?.amount ? `₹${advance.amount.toLocaleString('en-IN')}` : approval?.amountINR}
        poRef={advance?.sapPoNumber || advance?.poId}
        onStatusChange={fetchData}
      />

      {/* ─── BANNERS ────────────────────────────────────────────────────── */}
      {isRejected && (
        <div className="p-4 rounded-2xl border-2 border-rose-300 bg-rose-50 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5 text-rose-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-rose-800 text-sm">Request Rejected</p>
            <p className="text-xs text-rose-700 mt-0.5">This advance payment request has been rejected and cannot be edited.</p>
            {approval?.remarks && (
              <div className="mt-2 p-2.5 bg-white rounded-lg border border-rose-200">
                <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1">Rejection Reason</p>
                <p className="text-xs text-slate-700 italic">"{approval.remarks}"</p>
              </div>
            )}
            {approval?.actionedBy && (
              <p className="text-[11px] text-slate-400 mt-2">
                Rejected by <span className="font-semibold text-slate-600">{approval.actionedBy}</span>
                {approval.actionedAt && ` · ${new Date(approval.actionedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
              </p>
            )}
          </div>
        </div>
      )}

      {isReturned && (
        <div className="p-4 rounded-2xl border-2 border-orange-300 bg-orange-50 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
            <RotateCcw className="w-5 h-5 text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-orange-800 text-sm">Returned for Changes</p>
            <p className="text-xs text-orange-700 mt-0.5">This request was sent back. Please edit and re-submit.</p>
            {approval?.remarks && (
              <div className="mt-2 p-2.5 bg-white rounded-lg border border-orange-200">
                <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-1">Reviewer's Note</p>
                <p className="text-xs text-slate-700 italic">"{approval.remarks}"</p>
              </div>
            )}
            {approval?.actionedBy && (
              <p className="text-[11px] text-slate-400 mt-2">
                Returned by <span className="font-semibold text-slate-600">{approval.actionedBy}</span>
                {approval.actionedAt && ` · ${new Date(approval.actionedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
              </p>
            )}
          </div>
        </div>
      )}

      {isApproved && (
        <div className="p-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          <div>
            <p className="font-extrabold text-emerald-800 text-sm">Fully Approved</p>
            <p className="text-xs text-emerald-700 mt-0.5">This advance payment has been approved and is ready for disbursement.</p>
          </div>
        </div>
      )}

      {/* ─── MAIN LAYOUT ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full items-start">

        {/* LEFT — Details + Docs */}
        <div className="lg:col-span-8 space-y-4">

          {/* Specification Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">REFERENCE NUMBER</p>
                <p className="font-mono font-extrabold text-slate-900 text-base mt-0.5">{id}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${sc.pill}`}>{sc.label}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-xs">
              {[
                { label: 'PO NUMBER',        value: advance?.sapPoNumber || advance?.poId || '—', mono: true },
                { label: 'VENDOR',           value: advance?.vendorName || '—' },
                { label: 'PO VALUE',         value: `INR ${(0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, mono: true },
                { label: 'REQUESTED AMOUNT', value: `INR ${(advance?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, mono: true, highlight: true },
                { label: '% OF PO',          value: `${advance?.percentageOfPo || 0}%`, mono: true },
                { label: 'PAYMENT MODE',     value: advance?.paymentMode || 'NEFT' },
                { label: 'REQUESTED BY',     value: advance?.createdBy || 'Finance Team' },
                { label: 'SUBMITTED ON',     value: advance?.createdAt ? new Date(advance.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
                { label: 'GST',              value: (advance?.gstBreakup?.totalGst || 0) > 0 ? 'With GST' : 'Without GST', badge: true }
              ].map(({ label, value, mono, highlight, badge }) => (
                <div key={label}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                  {badge
                    ? <span className="inline-block mt-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-semibold">{value}</span>
                    : <p className={`mt-0.5 font-bold ${mono ? 'font-mono' : ''} ${highlight ? 'text-sky-600 text-sm' : 'text-slate-900'}`}>{value}</p>
                  }
                </div>
              ))}
            </div>

            {advance?.remarks && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">REASON / REMARKS</p>
                <p className="text-xs text-slate-700">{advance.remarks}</p>
              </div>
            )}
          </div>

          {/* Documents Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Documents</h3>
            </div>
            
            <DocumentUploader
              documentableType="AdvancePayment"
              documentableId={id}
              documentType="advance_request"
              multiple={true}
            />
          </div>
        </div>

        {/* RIGHT — Actions + Timeline */}
        <div className="lg:col-span-4 space-y-4">

          {/* ── Edit Card (draft or returned only) ───────────────────── */}
          {(isDraft || isReturned) && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-sm">
              <h3 className="font-bold text-slate-900 text-sm">Edit Request</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {isReturned ? 'Edit and re-submit this returned request to restart the approval flow.' : 'Make changes to this draft before submitting.'}
              </p>
              <button
                onClick={() => navigate(`/p2p/advance-payments/${id}/edit`)}
                className="w-full py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit Request
              </button>
            </div>
          )}

          {/* ── Locked notice (pending / approved / rejected / paid) ──── */}
          {isLocked && !isApproved && !isPaid && !isRejected && (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex items-start gap-2.5 shadow-sm">
              <Lock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-slate-700 text-xs">Request Locked</p>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                  This request is in the approval workflow and cannot be edited or deleted.
                </p>
              </div>
            </div>
          )}

          {/* ── Submit (draft only) ───────────────────────────────────── */}
          {isDraft && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-5 space-y-3 shadow-sm">
              <h3 className="font-bold text-amber-900 text-sm">Ready to Submit?</h3>
              <p className="text-xs text-amber-800/90 leading-relaxed">This is saved as a draft. Submit to start the approval workflow.</p>
              <button
                disabled={actionLoading === 'submit'}
                onClick={handleSubmitForApproval}
                className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
              >
                {actionLoading === 'submit' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {actionLoading === 'submit' ? 'Submitting...' : 'Submit for Approval'}
              </button>
            </div>
          )}

          {/* ── Re-submit (returned only) ─────────────────────────────── */}
          {isReturned && (
            <div className="bg-orange-50 rounded-2xl border border-orange-200 p-5 space-y-3 shadow-sm">
              <h3 className="font-bold text-orange-900 text-sm">Re-submit for Approval</h3>
              <p className="text-xs text-orange-800/90 leading-relaxed">Make your changes then re-submit to restart the approval workflow.</p>
              <button
                disabled={actionLoading === 'submit'}
                onClick={handleSubmitForApproval}
                className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
              >
                {actionLoading === 'submit' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Re-Submit for Approval
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
