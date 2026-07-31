import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  Search,
  MessageSquare,
  FileText,
  User,
  Clock,
  ExternalLink,
  Building2,
  Check,
  RotateCcw,
  XCircle
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../ui/toast';
import { setPendingCount } from '../../features/approvals/approvalsSlice';
import { addNotification } from '../../features/notifications/notificationsSlice';
import { ServerPagination } from '../ui/server-pagination';

// Step display labels per payment type (must match backend WORKFLOW_STEPS status strings)
const JOURNEY_LABELS = {
  'Advance Payment': [
    { title: 'Purchase HOD Approval', role: 'Procurement_head' },
    { title: 'Exim HOD Approval', role: 'Exim-Manager' },
    { title: 'MD Approval', role: 'Md' }
  ],
  'Invoice Payment': [
    { title: 'Invoice Verification', role: 'Accounts_Lead' },
    { title: 'Finance Head Signoff', role: 'Finance_Head' }
  ],
  'RFQ': [
    { title: 'Purchase HOD Approval', role: 'Procurement_head' },
    { title: 'Exim HOD Approval', role: 'Exim-Manager' },
    { title: 'MD Approval', role: 'Md' }
  ],
  'Custom Duty': [
    { title: 'Logistics Head Signoff', role: 'Logistics_Head' },
    { title: 'Finance Lead Treasury Release', role: 'Finance_Lead' }
  ],
  'Logistics Payments': [
    { title: 'Logistics Lead Audit', role: 'Logistics_Lead' },
    { title: 'Accounts Approval', role: 'Accounts_Lead' }
  ],
  'Purchase Orders': [
    { title: 'Technical Evaluation', role: 'Engineer' },
    { title: 'Procurement Head Signoff', role: 'Procurement_head' },
    { title: 'MD Final Approval', role: 'Md' }
  ]
};

function getStepFromStatus(type, status = '') {
  const stepObjs = JOURNEY_LABELS[type] || JOURNEY_LABELS['Advance Payment'];
  const steps = stepObjs.map(s => s.title);
  const statusLower = status.toLowerCase();
  const idx = steps.findIndex(s => statusLower.includes(s.toLowerCase()));
  return idx === -1 ? 0 : idx;
}

const formatSubmitted = (value) => {
  if (!value) return 'Recently submitted';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
};

const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '₹ 0.00';
  const val = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]+/g, '')) || 0 : amount;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val);
};

export default function PendingApprovalsView() {
  const { showToast } = useToast();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const [searchParams, setSearchParams] = useSearchParams();
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [remarks, setRemarks] = useState({});
  const [pagination, setPagination] = useState({ total: 0, page: 1, size: 10, totalPages: 1 });

  const currentUserRole = user?.role || 'Finance Lead';
  const query = searchParams.get('q') || '';
  const type = searchParams.get('type') || 'All';
  const sort = searchParams.get('sort') || 'newest';
  const pageSize = Math.max(1, Number(searchParams.get('size')) || 10);
  const requestedPage = Math.max(1, Number(searchParams.get('page')) || 1);

  const updateFilters = (updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === 'All' || (key === 'page' && Number(value) === 1)) next.delete(key);
      else next.set(key, String(value));
    });
    if (!Object.prototype.hasOwnProperty.call(updates, 'page')) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const totalPages = pagination.totalPages || 1;
  const page = pagination.page || requestedPage;
  const visibleApprovals = approvals;
  const types = ['All', ...Object.keys(JOURNEY_LABELS)];

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams(searchParams);
      // Always send logged-in user's role so backend filters correctly
      params.set('role', currentUserRole);
      // Exclude the current user's own submitted requests
      if (user?.name)  params.set('me', user.name);
      if (user?.email) params.set('meEmail', user.email);

      const res = await apiFetch(`/api/approvals/pending?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load approvals.');

      setApprovals(data.approvals || []);
      const newTotal = data.total || 0;
      dispatch(setPendingCount(newTotal));

      setPagination({
        total: data.total || 0,
        page: data.page || 1,
        size: data.size || pageSize,
        totalPages: data.totalPages || 1
      });
    } catch (error) {
      showToast({ type: 'error', title: 'Could not load approvals', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [searchParams]);

  const handleAction = async (id, action) => {
    try {
      setProcessingId(id);
      const res = await apiFetch(`/api/approvals/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          remarks: remarks[id]?.trim() || '',
          role: currentUserRole,
          actionedBy: user?.name || user?.email || currentUserRole
        })
      });
      const data = await res.json();
      if (!res.ok) {
        // Show role-lock error prominently
        showToast({
          type: 'error',
          title: 'Not authorized for this step',
          description: data.error || 'Unable to process approval.'
        });
        return;
      }
      const label = action.toLowerCase() === 'approve' ? 'approved' : action.toLowerCase() === 'return' ? 'returned' : 'rejected';
      const isFullyApproved = data.data?.status === 'Approved & Dispatched';
      const actionType = action.toLowerCase() === 'reject'
        ? 'rejected'
        : action.toLowerCase() === 'return'
          ? 'returned'
          : isFullyApproved ? 'fully_approved' : 'approved';

      showToast({
        type: action.toLowerCase() === 'reject' ? 'error' : action.toLowerCase() === 'return' ? 'info' : 'success',
        title: isFullyApproved ? '✅ Fully Approved!' : `Request ${label}`,
        description: isFullyApproved
          ? `${id} has completed all approval steps and is Approved & Dispatched.`
          : `${id} was ${label} successfully.`
      });

      setRemarks((current) => ({ ...current, [id]: '' }));
      await fetchApprovals();
    } catch (error) {
      showToast({ type: 'error', title: 'Approval action failed', description: error.message });
    } finally {
      setProcessingId(null);
    }
  };

  // Check if logged-in user's role matches the current active step role
  const canUserActOnApproval = (approval) => {
    const ur = (currentUserRole || '').toLowerCase().replace(/[\s_-]+/g, ' ').trim();
    if (ur === 'admin' || ur === 'system admin') return true;
    const reqRole = (approval.currentStepRole || '').toLowerCase();
    if (!reqRole) return true;
    const ur2 = ur.replace(/[\s_-]+/g, '');
    const req2 = reqRole.replace(/[\s_-]+/g, '');
    return req2.includes(ur2) || ur2.includes(req2);
  };

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] min-h-0 w-full flex-col gap-3 overflow-hidden pb-4 text-left font-sans">
      
      {/* Sleek Toolbar */}
      <div className="surface-card flex flex-col gap-2 p-2.5 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(event) => updateFilters({ q: event.target.value })}
            placeholder="Search request ID, vendor, requester, workflow..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none"
          />
        </div>

        <select value={type} onChange={(event) => updateFilters({ type: event.target.value })} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none">
          {types.map((item) => <option key={item} value={item}>{item === 'All' ? 'All payment types' : item}</option>)}
        </select>

        <select value={sort} onChange={(event) => updateFilters({ sort: event.target.value })} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>

        <select value={pageSize} onChange={(event) => updateFilters({ size: event.target.value })} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none" aria-label="Items per page">
          {[5, 10, 20, 50].map((size) => <option key={size} value={size}>{size} per page</option>)}
        </select>
      </div>

      {loading ? (
        <div className="surface-card flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-teal-600" /> Loading approval queue...
        </div>
      ) : visibleApprovals.length === 0 ? (
        <div className="surface-card py-16 text-center">
          <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />
          <h3 className="mt-2 text-sm font-bold text-slate-900">No pending approvals</h3>
          <p className="mt-1 text-xs text-slate-500">
            There are currently no workflow requests waiting for your approval.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2.5">
          <div className="report-scroll min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-2">
          {visibleApprovals.map((approval, approvalIndex) => {
            const rawStepObjs = (approval.parsedSteps && approval.parsedSteps.length > 0)
              ? approval.parsedSteps
              : (JOURNEY_LABELS[approval.type] || JOURNEY_LABELS['Advance Payment']);

            const steps = rawStepObjs.map(s => typeof s === 'string' ? s : s.title);
            const stepRoles = rawStepObjs.map(s => typeof s === 'string' ? '' : (s.role || s.roleName || ''));

            const activeStep = approval.currentStep
              ? Math.min(approval.currentStep - 1, steps.length - 1)
              : getStepFromStatus(approval.type, approval.status);

            const isProcessing = processingId === approval.id;
            const isTerminal = ['Approved & Dispatched', 'Rejected', 'Returned for changes'].includes(approval.status);

            // Allocation items preview fallback data
            const allocations = approval.allocations || [
              {
                vendorName: approval.vendorName || 'Tvs Scs Global Freight Solutions Ltd',
                vendorCode: approval.vendorCode || '11001838',
                containers: approval.containers || 10,
                ratePerContainer: approval.ratePerContainer || 107783.48,
                allocationAmount: approval.amountINR ? parseFloat(String(approval.amountINR).replace(/[^0-9.-]+/g, '')) * 0.5 : 1077834.8,
                remark: approval.remarks || 'As Cargo will be ready by 31st July. We require an ETD of 6th August.'
              },
              {
                vendorName: 'Fast Forward Logistics India Private Limited',
                vendorCode: '11001811',
                containers: 10,
                ratePerContainer: 104430.64,
                allocationAmount: approval.amountINR ? parseFloat(String(approval.amountINR).replace(/[^0-9.-]+/g, '')) * 0.5 : 1044306.4,
                remark: 'L1 freight forwarder space confirmed for movement.'
              }
            ];

            return (
              <div
                key={approval.id || approvalIndex}
                className="p-5 rounded-2xl border border-slate-200/90 bg-white shadow-2xs hover:border-teal-400 hover:shadow-xs transition-all space-y-4"
              >
                {/* 1. Header Bar: Ref ID + Type Pill | Submitted Time + Step Progress */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
                      <FileText className="w-4 h-4" />
                    </div>
                    <Link
                      to={`/p2p/advance-payments/${approval.id}`}
                      className="font-mono text-base font-extrabold text-slate-900 hover:text-teal-700 transition-colors"
                    >
                      {approval.id}
                    </Link>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {approval.type}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Submitted {formatSubmitted(approval.submittedAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">
                      Step {activeStep + 1} of {steps.length}
                    </span>
                    <div className="flex items-center gap-1">
                      {steps.map((_, idx) => (
                        <div
                          key={idx}
                          className={`h-2 w-6 rounded-full transition-all ${
                            idx <= activeStep ? 'bg-emerald-500' : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. Key Attributes Bar (4 Columns) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/60 p-3.5 rounded-xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">AMOUNT</span>
                    <span className="font-mono text-base font-extrabold text-slate-900 block">
                      {formatCurrency(approval.amountINR || approval.amountOriginal || 2122141.2)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">VENDOR</span>
                    <span className="font-bold text-slate-900 block truncate">
                      {approval.vendorName || `${allocations.length} vendors`}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">CURRENT STEP</span>
                    <span className="font-semibold text-slate-800 block truncate">
                      {steps[activeStep] || 'Exim HOD Approval'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">SUBMITTED</span>
                      <span className="font-medium text-slate-700 block">
                        {approval.submittedAt ? new Date(approval.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '30 Jul 2026'}
                      </span>
                    </div>

                    <Link
                      to={`/p2p/advance-payments/${approval.id}`}
                      className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 hover:underline shrink-0"
                    >
                      View details <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* 3. Detailed Allocation Basis / Item Breakdown Container */}
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/20 p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[9px] uppercase tracking-wider">
                        RFQ ALLOCATION BASIS
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {approval.title || 'IMPORT SEA FREIGHT - 20 X 40 FT - LAEM CHABANG (THAILAND) to NHAVA SHEVA (INDIA)'}
                      </span>
                      {approval.poReference && (
                        <span className="font-mono text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                          PO {approval.poReference}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-extrabold text-emerald-700">
                      {approval.containersCount || 20} container(s) submitted
                    </span>
                  </div>

                  {/* Vendor Allocation Breakdown Rows */}
                  <div className="space-y-2.5">
                    {allocations.map((alloc, aIdx) => (
                      <div key={aIdx} className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs space-y-1.5 text-xs">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">VENDOR</span>
                            <span className="font-bold text-slate-900 block truncate">{alloc.vendorName}</span>
                            {alloc.vendorCode && <span className="text-[10px] font-mono text-slate-400 block">{alloc.vendorCode}</span>}
                          </div>

                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">CONTAINERS</span>
                            <span className="font-bold text-slate-800 block">{alloc.containers}</span>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">RATE / CONTAINER</span>
                            <span className="font-mono font-bold text-slate-800 block">{formatCurrency(alloc.ratePerContainer)}</span>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">ALLOCATION AMOUNT</span>
                            <span className="font-mono font-extrabold text-slate-900 block">{formatCurrency(alloc.allocationAmount)}</span>
                          </div>
                        </div>

                        {alloc.remark && (
                          <div className="pt-1 border-t border-slate-100">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">REMARK</span>
                            <p className="text-xs text-slate-600 italic mt-0.5">{alloc.remark}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Workflow Stepper with Role Badges */}
                <div className="pt-1 space-y-2">
                  <div className="flex items-center gap-2 overflow-x-auto text-xs pb-1">
                    {steps.map((label, index) => {
                      const isPast = index < activeStep || approval.status === 'Approved & Dispatched';
                      const isCurrent = index === activeStep && !isTerminal;
                      const roleName = stepRoles[index];

                      return (
                        <React.Fragment key={label}>
                          <div className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 transition ${
                            isPast ? 'border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold' :
                            isCurrent ? 'border-emerald-400 bg-emerald-50/80 text-emerald-900 font-extrabold ring-2 ring-emerald-500/20 shadow-2xs' :
                            'border-slate-200 bg-slate-50 text-slate-400'
                          }`}>
                            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                              isPast ? 'bg-emerald-600 text-white' :
                              isCurrent ? 'bg-emerald-600 text-white' :
                              'bg-slate-200 text-slate-500'
                            }`}>
                              {index + 1}
                            </span>
                            <div>
                              <span className="whitespace-nowrap font-bold block">{label}</span>
                              {roleName && <span className="text-[9px] font-normal text-slate-400 block capitalize">{roleName}</span>}
                            </div>
                          </div>
                          {index < steps.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* Approval History Timeline Log — real data from DB */}
                  <div className="space-y-1">
                    <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px] block">APPROVAL HISTORY</span>
                    {Array.isArray(approval.actionHistory) && approval.actionHistory.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {approval.actionHistory.map((rec, hi) => {
                          const actionColors = {
                            approve: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                            reject:  'bg-rose-50 text-rose-800 border-rose-200',
                            return:  'bg-amber-50 text-amber-800 border-amber-200'
                          };
                          const dotColors = { approve: 'bg-emerald-500', reject: 'bg-rose-500', return: 'bg-amber-500' };
                          const c = actionColors[rec.action] || 'bg-slate-50 text-slate-700 border-slate-200';
                          const d = dotColors[rec.action] || 'bg-slate-400';
                          return (
                            <div key={hi} className={`flex items-center gap-1.5 border px-2.5 py-0.5 rounded-full font-medium text-[11px] ${c}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${d}`} />
                              <span>{rec.actionedBy || 'User'}</span>
                              <span>·</span>
                              <span className="font-bold capitalize">{rec.action}</span>
                              <span>·</span>
                              <span>Step {rec.step}</span>
                              {rec.role && <span className="opacity-60">({rec.role})</span>}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">No actions taken yet</span>
                    )}
                  </div>
                </div>

                {/* 5. Bottom Comments Input & Action Buttons */}
                {!isTerminal && (() => {
                  const canAct = canUserActOnApproval(approval);
                  return (
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      {/* Role Lock Banner — shown when user cannot act */}
                      {!canAct && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          This step requires <strong className="mx-1">{approval.currentStepRole || 'another role'}</strong> to act. You are logged in as <strong className="ml-1">{currentUserRole}</strong>.
                        </div>
                      )}

                      <div className="flex flex-col md:flex-row items-stretch md:items-end justify-between gap-4">
                        {/* Left: Comments Input */}
                        <div className="flex-1 space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">COMMENTS (OPTIONAL)</label>
                          <input
                            value={remarks[approval.id] || ''}
                            onChange={(event) => setRemarks((current) => ({ ...current, [approval.id]: event.target.value }))}
                            placeholder="Add a note before acting..."
                            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-xs text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition-all"
                          />
                        </div>

                        {/* Right: Action Buttons — disabled if role mismatch */}
                        <div className="flex items-center gap-2 shrink-0 justify-end">
                          <button
                            onClick={() => handleAction(approval.id, 'Approve')}
                            disabled={isProcessing || !canAct}
                            title={!canAct ? `Only ${approval.currentStepRole} can approve this step` : 'Approve this request'}
                            className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-5 shadow-2xs transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Approve
                          </button>

                          <button
                            onClick={() => handleAction(approval.id, 'Return')}
                            disabled={isProcessing || !canAct}
                            title={!canAct ? `Only ${approval.currentStepRole} can return this step` : 'Return for changes'}
                            className="h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs px-4 transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                            Return
                          </button>

                          <button
                            onClick={() => handleAction(approval.id, 'Reject')}
                            disabled={isProcessing || !canAct}
                            title={!canAct ? `Only ${approval.currentStepRole} can reject this step` : 'Reject this request'}
                            className="h-10 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs px-4 transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
          </div>

          <ServerPagination
            page={page}
            totalPages={totalPages}
            total={pagination.total}
            pageSize={pageSize}
            itemLabel="pending requests"
            onPageChange={(nextPage) => updateFilters({ page: nextPage })}
          />
        </div>
      )}
    </div>
  );
}
