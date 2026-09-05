import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  Search,
  FileText,
  Clock,
  Check,
  RotateCcw,
  XCircle,
  ArrowRightLeft,
  AlertTriangle,
  Inbox,
  X,
  Filter,
  ShieldCheck,
  Building2,
  UserCheck
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../ui/toast';
import { SearchableSelect } from '../ui/searchable-select';
import { setPendingCount } from '../../features/approvals/approvalsSlice';
import { ServerPagination } from '../ui/server-pagination';
import { isFinanceRole } from '../../lib/permissions';

// Step display labels per payment type (must match backend WORKFLOW_STEPS status strings)
const JOURNEY_LABELS = {
  'BL Freight Invoice': [
    { title: 'EXIM Manager Approval', role: 'EXIM Manager' },
    { title: 'Finance Lead Approval', role: 'Finance Lead' }
  ],
  'Logistics Payments': [
    { title: 'EXIM Manager Approval', role: 'EXIM Manager' },
    { title: 'Finance Lead Approval', role: 'Finance Lead' }
  ],
  'Logistics Payment': [
    { title: 'EXIM Manager Approval', role: 'EXIM Manager' },
    { title: 'Finance Lead Approval', role: 'Finance Lead' }
  ],
  'Advance Payment': [
    { title: 'Purchase Manager Approval', role: 'Purchase Manager' }
  ],
  'Invoice Payment': [
    { title: 'Purchase Manager Approval', role: 'Purchase Manager' }
  ],
  'RFQ Vendor Award': [
    { title: 'Purchase Head Review', role: 'Procurement_head' },
    { title: 'CFO Signoff', role: 'CFO' }
  ],
  'RFQ': [
    { title: 'Purchase Head Review', role: 'Procurement_head' },
    { title: 'CFO Signoff', role: 'CFO' }
  ],
  'Custom Duty': [
    { title: 'Logistics Head Signoff', role: 'Logistics_Head' },
    { title: 'Finance Lead Treasury Release', role: 'Finance_Lead' }
  ],
  'Purchase Orders': [
    { title: 'Technical Evaluation', role: 'Engineer' },
    { title: 'Procurement Head Signoff', role: 'Procurement_head' },
    { title: 'MD Final Approval', role: 'Md' }
  ]
};

// One distinct color per payment type
const TYPE_STYLES = {
  'BL Freight Invoice': { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  'Logistics Payments': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  'Logistics Payment': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  'Advance Payment': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  'Invoice Payment': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'RFQ': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  'Custom Duty': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  'Purchase Orders': { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-200' }
};
const DEFAULT_TYPE_STYLE = { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };

function formatRoleLabel(role = '') {
  const r = String(role || '').trim();
  if (!r) return 'Approver';
  const rLower = r.toLowerCase();
  if (rLower === 'cfo') return 'CFO';
  if (rLower === 'md' || rLower === 'director') return 'Managing Director (MD)';
  if (rLower.includes('procurement_head') || rLower.includes('purchase_head')) return 'Procurement Head';
  if (rLower.includes('procurement_manager') || rLower.includes('purchase_manager')) return 'Purchase Manager';
  if (rLower.includes('finance_head') || rLower.includes('finance_lead') || rLower === 'finance') return 'Finance Lead';
  if (rLower.includes('logistics')) return 'Logistics Head';
  if (rLower.includes('exim')) return 'EXIM Manager';
  return r.replace(/[_-]+/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatActionVerb(action = '') {
  const a = String(action || '').toLowerCase().trim();
  if (a === 'approve') return 'Approved';
  if (a === 'return') return 'Returned';
  if (a === 'reject') return 'Rejected';
  return action;
}

function getStepFromStatus(type, status = '') {
  const stepObjs = JOURNEY_LABELS[type] || JOURNEY_LABELS['Advance Payment'];
  const steps = stepObjs.map((s) => s.title);
  const statusLower = status.toLowerCase();
  const idx = steps.findIndex((s) => statusLower.includes(s.toLowerCase()));
  return idx === -1 ? 0 : idx;
}

const getApprovalDetailUrl = (approval) => {
  if (!approval) return '/approvals';
  const type = String(approval.type || '').toLowerCase();
  const refId = approval.referenceId || approval.id;

  if (type.includes('invoice')) {
    return `/admin/invoice-payments/${refId}`;
  }
  if (type.includes('rfq') || type.includes('freight')) {
    return `/admin/rfqs/${refId}`;
  }
  if (type.includes('custom') || type.includes('duty')) {
    return `/admin/custom-duty`;
  }
  if (type.includes('logistics')) {
    return `/admin/logistics-payments`;
  }
  return `/admin/advance-payments/${refId}`;
};

const formatSubmittedDate = (value) => {
  if (!value) return 'Recently submitted';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return 'Recently submitted';
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  } catch {
    return 'Recently submitted';
  }
};

const formatTargetDate = (value) => {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(d);
  } catch {
    return String(value);
  }
};

const formatCurrency = (amount, currency = 'INR', amountFormatted = '') => {
  if (amountFormatted && amountFormatted !== '₹0' && amountFormatted !== '₹0.00' && amountFormatted !== '₹ 0.00') return amountFormatted;
  if (typeof amount === 'string' && (amount.includes('USD') || amount.includes('INR') || (amount.includes('₹') && !amount.startsWith('₹0')) || amount.includes('$') || amount.includes('€') || amount.includes('£'))) {
    return amount;
  }
  if (!amount && amount !== 0) return `${currency === 'USD' ? '$' : '₹'}0.00`;
  const val = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]+/g, '')) || 0 : Number(amount) || 0;
  const curr = String(currency || 'INR').toUpperCase();
  if (curr === 'USD') return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (curr === 'EUR') return `€${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (curr === 'GBP') return `£${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val);
};

function formatRelativeTime(value) {
  if (!value) return '';
  const diffMs = Date.now() - new Date(value).getTime();
  if (diffMs < 0 || Number.isNaN(diffMs)) return '';
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHrs < 1) return 'Just now';
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

function getUrgency(approval) {
  if (!approval) return 'normal';
  if (approval.urgency) return approval.urgency;
  if (approval.isOverdue) return 'overdue';
  const now = Date.now();
  const due = approval.dueDate ? new Date(approval.dueDate).getTime() : (approval.submittedAt ? new Date(approval.submittedAt).getTime() + 48 * 3600 * 1000 : null);
  if (due && due < now) return 'overdue';
  return 'normal';
}

const TERMINAL_STATUSES = ['Approved & Dispatched', 'Rejected', 'Returned for changes'];

const STATUS_STYLES = {
  'Approved & Dispatched': { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'Rejected': { dot: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
  'Returned for changes': { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' }
};

const URGENCY_STYLES = {
  overdue: { accent: 'bg-rose-500', label: 'Overdue', badge: 'bg-rose-100 text-rose-800 border-rose-300' },
  today: { accent: 'bg-orange-500', label: 'Due Today', badge: 'bg-orange-100 text-orange-800 border-orange-300' },
  urgent: { accent: 'bg-amber-500', label: '1–3 Days', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  upcoming: { accent: 'bg-teal-500', label: '4–7 Days', badge: 'bg-teal-100 text-teal-800 border-teal-300' },
  normal: { accent: 'bg-slate-200', label: null, badge: '' }
};

// Shown while the queue loads so the layout doesn't jump once data arrives
function ApprovalCardSkeleton() {
  return (
    <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-slate-100" />
        <div className="h-4 w-32 rounded bg-slate-100" />
        <div className="h-4 w-20 rounded-full bg-slate-100" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 rounded-lg bg-slate-100" />)}
      </div>
      <div className="h-20 rounded-xl bg-slate-100" />
      <div className="h-10 rounded-xl bg-slate-100" />
    </div>
  );
}

export default function PendingApprovalsView() {
  const { showToast } = useToast();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const [searchParams, setSearchParams] = useSearchParams();
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [processingAction, setProcessingAction] = useState(null);
  const [remarks, setRemarks] = useState({});
  const [remarkErrors, setRemarkErrors] = useState({});
  const [confirmingReject, setConfirmingReject] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1, size: 10, totalPages: 1 });

  const query = searchParams.get('q') || '';
  const type = searchParams.get('type') || 'All';
  const sort = searchParams.get('sort') || 'newest';
  const onlyMine = searchParams.get('mine') === 'true';
  const urgencyFilter = searchParams.get('urgency') || 'All';
  const pageSize = Math.max(1, Number(searchParams.get('size')) || 10);
  const requestedPage = Math.max(1, Number(searchParams.get('page')) || 1);

  const [searchInput, setSearchInput] = useState(query);
  useEffect(() => setSearchInput(query), [query]);
  const debounceRef = useRef(null);
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const updateFilters = useCallback((updates) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(updates).forEach(([key, value]) => {
        if (!value || value === 'All' || (key === 'page' && Number(value) === 1)) next.delete(key);
        else next.set(key, String(value));
      });
      if (!Object.prototype.hasOwnProperty.call(updates, 'page')) next.delete('page');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleSearchChange = (value) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateFilters({ q: value }), 350);
  };

  const totalPages = pagination.totalPages || 1;
  const page = pagination.page || requestedPage;
  const types = useMemo(() => ['All', ...Object.keys(JOURNEY_LABELS)], []);
  const hasActiveFilters = Boolean(query || type !== 'All' || searchParams.get('urgency') || onlyMine);

  const [allCount, setAllCount] = useState(0);

  const fetchApprovals = useCallback(async () => {
    try {
      setLoading(true);
      const queryString = searchParams.toString();
      const res = await apiFetch(`/api/approvals/pending${queryString ? `?${queryString}` : ''}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load approvals.');

      const rawApprovals = data.approvals || [];
      setApprovals(rawApprovals);

      const totalPending = data.total ?? data.count ?? rawApprovals.length;
      setAllCount(totalPending);

      dispatch(setPendingCount(totalPending));

      setPagination({
        total: data.total || rawApprovals.length,
        page: data.page || page,
        size: data.size || pageSize,
        totalPages: data.totalPages || 1
      });
    } catch (error) {
      showToast({ type: 'error', title: 'Could not load approvals', description: error.message });
    } finally {
      setLoading(false);
    }
  }, [searchParams, dispatch, page, pageSize, showToast]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleAction = async (id, action) => {
    const trimmedRemark = remarks[id]?.trim() || '';

    if ((action === 'Return' || action === 'Reject') && !trimmedRemark) {
      setRemarkErrors((current) => ({ ...current, [id]: `Please provide a reason before ${action === 'Return' ? 'returning' : 'rejecting'} this request.` }));
      return;
    }
    if (action === 'Reject' && confirmingReject !== id) {
      setConfirmingReject(id);
      return;
    }

    try {
      setProcessingId(id);
      setProcessingAction(action);
      const step = approvals.find((item) => item.id === id)?.currentStep || 1;
      const idempotencyKey = `${id}:${action.toLowerCase()}:${step}`;
      const res = await apiFetch(`/api/approvals/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ action, remarks: trimmedRemark, idempotencyKey })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast({ type: 'error', title: 'Action not authorized', description: data.error || 'Unable to process approval.' });
        return;
      }
      const label = action === 'Approve' ? 'approved' : action === 'Return' ? 'returned' : 'rejected';
      const isFullyApproved = data.data?.status === 'Approved & Dispatched';

      showToast({
        type: action === 'Reject' ? 'error' : action === 'Return' ? 'info' : 'success',
        title: isFullyApproved ? 'Fully Approved & Dispatched' : `Request ${label}`,
        description: isFullyApproved
          ? `${id} has successfully cleared all workflow approval stages.`
          : `${id} was ${label}.`
      });

      setRemarks((current) => ({ ...current, [id]: '' }));
      setRemarkErrors((current) => ({ ...current, [id]: undefined }));
      setConfirmingReject(null);
      await fetchApprovals();
    } catch (error) {
      showToast({ type: 'error', title: 'Approval action failed', description: error.message });
    } finally {
      setProcessingId(null);
      setProcessingAction(null);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] min-h-0 w-full flex-col gap-3.5 overflow-hidden pb-4 text-left font-sans text-slate-800">
      
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs shrink-0">
        
        {/* Left: Pending Approvals Title Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0d7676] to-teal-700 px-3.5 py-2 text-xs font-extrabold text-white shadow-sm">
            <FileText className="h-4 w-4" />
            <span>Pending Approvals</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-black text-white">
              {allCount}
            </span>
          </div>
        </div>

        {/* Search Bar & Reset */}
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-lg justify-end">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-2.5 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <input
              value={searchInput}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Search request ID, vendor, PO number, or requester..."
              aria-label="Search pending approvals"
              className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-9 pr-8 text-xs font-medium placeholder:text-slate-400 focus:bg-white focus:border-[#0d7676] focus:ring-2 focus:ring-[#0d7676]/20 outline-none transition"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-2.5 text-slate-300 hover:text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Sub-Toolbar: Urgency Filters + Payment Type + Sort ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-2xs shrink-0">
        
        {/* Urgency Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" /> Urgency:
          </span>
          {[
            { id: 'All', label: 'All 7 Days' },
            { id: 'overdue', label: 'Overdue' },
            { id: 'today', label: 'Due Today' },
            { id: 'urgent', label: '1–3 Days' },
            { id: 'upcoming', label: '4–7 Days' }
          ].map((u) => {
            const isSelected = urgencyFilter === u.id;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => updateFilters({ urgency: u.id === 'All' ? null : u.id })}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  isSelected
                    ? (u.id === 'overdue' ? 'bg-rose-600 text-white shadow-2xs font-extrabold' : u.id === 'today' ? 'bg-orange-500 text-white shadow-2xs font-extrabold' : 'bg-[#0d7676] text-white shadow-2xs font-extrabold')
                    : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {u.label}
              </button>
            );
          })}
        </div>

        {/* Dropdowns & Reset */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-44">
            <SearchableSelect
              options={types.map((item) => ({ label: item === 'All' ? 'All Payment Types' : item, value: item }))}
              value={type}
              onChange={(val) => updateFilters({ type: val })}
              size="sm"
              searchable={false}
            />
          </div>

          <div className="w-36">
            <SearchableSelect
              options={[
                { label: 'Newest First', value: 'newest' },
                { label: 'Oldest First', value: 'oldest' },
                { label: 'Overdue First', value: 'overdue' }
              ]}
              value={sort}
              onChange={(val) => updateFilters({ sort: val })}
              size="sm"
              searchable={false}
            />
          </div>

          <div className="w-28">
            <SearchableSelect
              options={[
                { label: '5 / page', value: '5' },
                { label: '10 / page', value: '10' },
                { label: '20 / page', value: '20' },
                { label: '50 / page', value: '50' }
              ]}
              value={String(pageSize)}
              onChange={(val) => updateFilters({ size: val })}
              size="sm"
              searchable={false}
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
              className="h-8 rounded-lg px-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* ── Main Approvals List Area ── */}
      {loading ? (
        <div className="report-scroll min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
          {Array.from({ length: 3 }).map((_, i) => <ApprovalCardSkeleton key={i} />)}
        </div>
      ) : approvals.length === 0 ? (
        <div className="surface-card py-16 text-center rounded-2xl border border-slate-200 bg-white">
          <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />
          <h3 className="mt-2 text-sm font-bold text-slate-900">
            {hasActiveFilters ? 'No approvals match these filters' : 'No pending approvals'}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {hasActiveFilters
              ? 'Try widening the search, payment type, or clearing filters.'
              : 'There are currently no workflow requests waiting for approval in this queue.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
              className="mt-3 text-xs font-bold text-[#0d7676] hover:underline"
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="report-scroll min-h-0 flex-1 space-y-3.5 overflow-y-auto overscroll-contain pr-1.5">
            {approvals.map((approval, approvalIndex) => {
              const rawStepObjs = (approval.parsedSteps && Array.isArray(approval.parsedSteps) && approval.parsedSteps.length > 0)
                ? approval.parsedSteps
                : (approval.workflowSnapshot?.steps || JOURNEY_LABELS[approval.type] || JOURNEY_LABELS['Advance Payment']);

              const steps = rawStepObjs.map((s) => (typeof s === 'string' ? s : (s.title || s.roleName || s.name || 'Approval')));
              const stepRoles = rawStepObjs.map((s) => (typeof s === 'string' ? '' : (s.roleName || s.roleKey || s.role || '')));

              const activeStep = approval.currentStep
                ? Math.min(approval.currentStep - 1, Math.max(0, steps.length - 1))
                : getStepFromStatus(approval.type, approval.status);
              const activeStepObject = typeof rawStepObjs[activeStep] === 'object' ? rawStepObjs[activeStep] : null;
              const assignedNames = activeStepObject?.isPoolApproval && activeStepObject?.resolutionMethod === 'vendor_linked_user_pool'
                ? [...new Set((activeStepObject.approverPool || []).map((person) => person.name).filter(Boolean))]
                : activeStepObject?.isPoolApproval
                  ? []
                  : [...new Set([activeStepObject?.assignedApproverName, approval.assignedApproverName].filter(Boolean))];

              const isProcessing = processingId === approval.id;
              const isTerminal = TERMINAL_STATUSES.includes(approval.status);
              const urgency = isTerminal ? 'normal' : getUrgency(approval);
              const urgencyStyle = URGENCY_STYLES[urgency] || URGENCY_STYLES.normal;
              const statusStyle = STATUS_STYLES[approval.status];
              const typeStyle = TYPE_STYLES[approval.type] || DEFAULT_TYPE_STYLE;
              const allocations = Array.isArray(approval.allocations) ? approval.allocations : null;
              const isOverdueItem = !isTerminal && (urgency === 'overdue' || approval.isOverdue);
              const poNumber = approval.poReference || approval.sapPoNumber || approval.poId || '—';

              return (
                <div
                  key={approval.id || approvalIndex}
                  className="flex overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs transition-all hover:border-[#0d7676]/40 hover:shadow-xs"
                >
                  {/* Urgency accent rail */}
                  <div className={`w-1.5 shrink-0 ${isTerminal ? (statusStyle?.dot || 'bg-slate-200') : urgencyStyle.accent}`} aria-hidden="true" />

                  <div className="flex-1 space-y-3 p-4">
                    
                    {/* 1. Header: Ref ID + Type + Urgency Badges + Stage Title */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${typeStyle.border} ${typeStyle.bg} ${typeStyle.text}`}>
                          <FileText className="h-4 w-4" />
                        </div>
                        <Link
                          to={getApprovalDetailUrl(approval)}
                          className="font-mono text-base font-extrabold text-slate-900 transition-colors hover:text-[#0d7676]"
                        >
                          {approval.id}
                        </Link>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>
                          {approval.type}
                        </span>

                        {isTerminal && (
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${statusStyle?.bg} ${statusStyle?.text} ${statusStyle?.border}`}>
                            {approval.status}
                          </span>
                        )}

                        {isOverdueItem && (
                          <span className="flex items-center gap-1 rounded-full border border-rose-300 bg-rose-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-rose-800 animate-pulse">
                            <Clock className="h-3 w-3 text-rose-600" />
                            {`OVERDUE (${Math.abs(approval.daysRemaining || 1)}D)`}
                          </span>
                        )}

                        {!isTerminal && !isOverdueItem && urgencyStyle.label && (
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${urgencyStyle.badge}`}>
                            {urgencyStyle.label}
                          </span>
                        )}

                        {approval.delegatedFrom && (
                          <span className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                            <ArrowRightLeft className="h-3 w-3 text-amber-600" />
                            Delegated from {approval.delegatedFrom.name} ({approval.delegatedFrom.role})
                          </span>
                        )}

                        <span className="text-slate-300">·</span>
                        <span className="flex items-center gap-1 text-xs font-medium text-slate-500" title={formatSubmittedDate(approval.submittedAt)}>
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {formatRelativeTime(approval.submittedAt) || formatSubmittedDate(approval.submittedAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <span className="text-slate-400">Step {activeStep + 1} of {steps.length}</span>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                          (approval.status || '').toLowerCase().includes('manager') ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          (approval.status || '').toLowerCase().includes('finance') ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          (approval.status || '').toLowerCase().includes('md') || (approval.status || '').toLowerCase().includes('director') ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          'bg-teal-50 text-teal-700 border-teal-200'
                        }`}>
                          {formatRoleLabel(steps[activeStep] || approval.status || 'Approval')}
                        </span>
                      </div>
                    </div>

                    {/* 2. Key Attributes Grid */}
                    <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs md:grid-cols-4">
                      <div>
                        <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Amount (Payable)</span>
                        <span className="block font-mono text-base font-extrabold text-slate-900">
                          {approval.amountFormatted || formatCurrency(approval.amountOriginal || approval.amountINR, approval.currency, approval.amountFormatted)}
                        </span>
                      </div>
                      
                      <div>
                        <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Vendor & PO</span>
                        <span className="block truncate font-bold text-slate-900">
                          {approval.vendorName || (allocations ? `${allocations.length} vendors` : '—')}
                        </span>
                        {poNumber && poNumber !== '—' && (
                          <span className="block font-mono text-[11px] font-bold text-[#0d7676] mt-0.5">
                            PO: {poNumber}
                          </span>
                        )}
                      </div>
                      
                      <div>
                        <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Requested By</span>
                        <span className="block truncate font-semibold text-slate-800">{approval.requestedBy || '—'}</span>
                        <span className="block text-[10px] text-slate-400 font-medium">Procurement Team</span>
                      </div>
                      
                      <div className="flex flex-col gap-1 justify-between">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Target / Due Date</span>
                            <span className={`block font-bold ${
                              isOverdueItem ? 'text-rose-600 font-extrabold' : 'text-slate-700'
                            }`}>
                              {formatTargetDate(approval.dueDate || approval.transactionSnapshot?.paymentDueDate || approval.transactionSnapshot?.expectedPaymentDate)}
                            </span>
                          </div>
                        </div>
                        <Link
                          to={getApprovalDetailUrl(approval)}
                          className="flex shrink-0 items-center gap-1 text-xs font-bold text-[#0d7676] hover:text-teal-800 hover:underline self-end"
                        >
                          Inspect Details <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>

                    {/* 3. Item / Allocation breakdown */}
                    {allocations && allocations.length > 0 && (
                      <div className="space-y-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/20 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 pb-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-emerald-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-800">
                              Allocation Basis
                            </span>
                            {approval.title && <span className="text-xs font-bold text-slate-800">{approval.title}</span>}
                            {approval.poReference && (
                              <span className="rounded border border-teal-200 bg-teal-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-teal-700">
                                PO {approval.poReference}
                              </span>
                            )}
                          </div>
                          {approval.containersCount != null && (
                            <span className="text-xs font-extrabold text-emerald-700">{approval.containersCount} container(s)</span>
                          )}
                        </div>

                        <div className="space-y-2.5">
                          {allocations.map((alloc, aIdx) => (
                            <div key={aIdx} className="space-y-1 rounded-lg border border-slate-200/80 bg-white p-2.5 text-xs shadow-2xs">
                              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                <div>
                                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Vendor</span>
                                  <span className="block truncate font-bold text-slate-900">{alloc.vendorName}</span>
                                  {alloc.vendorCode && <span className="block font-mono text-[10px] text-slate-400">{alloc.vendorCode}</span>}
                                </div>
                                <div>
                                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Containers</span>
                                  <span className="block font-bold text-slate-800">{alloc.containers}</span>
                                </div>
                                <div>
                                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Rate / Container</span>
                                  <span className="block font-mono font-bold text-slate-800">{formatCurrency(alloc.ratePerContainer)}</span>
                                </div>
                                <div>
                                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Allocation Amount</span>
                                  <span className="block font-mono font-extrabold text-slate-900">{formatCurrency(alloc.allocationAmount)}</span>
                                </div>
                              </div>
                              {alloc.remark && (
                                <div className="border-t border-slate-100 pt-1">
                                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Remark</span>
                                  <p className="mt-0.5 text-xs italic text-slate-600">{alloc.remark}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 4. Workflow Stepper & Role Badges */}
                    <div className="space-y-1.5 pt-0.5">
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                        {steps.map((label, index) => {
                          const isPast = index < activeStep || approval.status === 'Approved & Dispatched';
                          const isCurrent = index === activeStep && !isTerminal;
                          const roleName = stepRoles[index];

                          return (
                            <React.Fragment key={label}>
                              <div
                                className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 transition ${
                                  isPast ? 'border-emerald-200 bg-emerald-50 font-semibold text-emerald-700'
                                    : isCurrent ? 'border-emerald-400 bg-emerald-50/80 font-extrabold text-emerald-900 shadow-2xs ring-2 ring-emerald-500/20'
                                    : 'border-slate-200 bg-slate-50 text-slate-400'
                                }`}
                              >
                                <span
                                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                                    isPast || isCurrent ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                                  }`}
                                >
                                  {isPast ? <Check className="h-3 w-3" /> : index + 1}
                                </span>
                                <div>
                                  <span className="block whitespace-nowrap font-bold">{label}</span>
                                  {roleName && <span className="block text-[9px] font-normal capitalize text-slate-400">{formatRoleLabel(roleName)}</span>}
                                  {isCurrent && assignedNames.length > 0 && (
                                    <span className="block max-w-[280px] whitespace-normal text-[9px] font-semibold text-[#0d7676]">
                                      Assigned to: {assignedNames.join(', ')}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {index < steps.length - 1 && <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />}
                            </React.Fragment>
                          );
                        })}
                      </div>

                      {/* Approval History Trail */}
                      <div className="space-y-1">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Approval Audit Trail</span>
                        {Array.isArray(approval.actionHistory) && approval.actionHistory.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {approval.actionHistory.map((rec, hi) => {
                              const actionColors = {
                                approve: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                                reject: 'bg-rose-50 text-rose-800 border-rose-200',
                                return: 'bg-amber-50 text-amber-800 border-amber-200'
                              };
                              const dotColors = { approve: 'bg-emerald-500', reject: 'bg-rose-500', return: 'bg-amber-500' };
                              const c = actionColors[rec.action] || 'bg-slate-50 text-slate-700 border-slate-200';
                              const d = dotColors[rec.action] || 'bg-slate-400';
                              return (
                                <div key={hi} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${c}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${d}`} />
                                  <span className="font-bold">{rec.actionedBy || 'User'}</span>
                                  <span>·</span>
                                  <span className="font-bold capitalize">{formatActionVerb(rec.action)}</span>
                                  <span>·</span>
                                  <span>Step {rec.step}</span>
                                  {rec.role && <span className="opacity-75">({formatRoleLabel(rec.role)})</span>}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-[11px] italic text-slate-400">No prior approval actions recorded</span>
                        )}
                      </div>
                    </div>

                    {/* 5. Comments & Authorization Action Controls */}
                    {!isTerminal && (
                      <div className="space-y-2.5 border-t border-slate-100 pt-2.5">
                        {!approval.isUserTurnToApprove && (
                          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 font-medium">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                            <span>
                              {`Currently awaiting Step ${approval.currentStep} approval by ${formatRoleLabel(approval.currentStepRole || 'Assigned Approver')}. Action is locked until preceding steps are completed.`}
                            </span>
                          </div>
                        )}

                        <div className="flex flex-col items-stretch justify-between gap-2.5 md:flex-row md:items-end">
                          <div className="flex-1 space-y-1">
                            <label htmlFor={`remark-${approval.id}`} className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Approver Remarks (Optional for Approve, Required for Return / Reject)
                            </label>
                            <input
                              id={`remark-${approval.id}`}
                              value={remarks[approval.id] || ''}
                              onChange={(event) => {
                                setRemarks((current) => ({ ...current, [approval.id]: event.target.value }));
                                setRemarkErrors((current) => ({ ...current, [approval.id]: undefined }));
                              }}
                              disabled={!approval.isUserTurnToApprove || isProcessing}
                              placeholder={approval.isUserTurnToApprove ? "Add an approval note or return reason..." : "Action locked for this step"}
                              aria-invalid={Boolean(remarkErrors[approval.id])}
                              className={`h-10 w-full rounded-xl border bg-slate-50/50 px-3.5 text-xs text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:ring-2 ${
                                remarkErrors[approval.id] ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100' : 'border-slate-200 focus:border-[#0d7676] focus:ring-[#0d7676]/20'
                              } disabled:cursor-not-allowed disabled:opacity-50`}
                            />
                            {remarkErrors[approval.id] && (
                              <p className="text-[11px] font-semibold text-rose-600">{remarkErrors[approval.id]}</p>
                            )}
                          </div>

                          <div className="flex shrink-0 items-center justify-end gap-2">
                            <button
                              onClick={() => handleAction(approval.id, 'Approve')}
                              disabled={!approval.isUserTurnToApprove || isProcessing}
                              className="flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-xs font-extrabold text-white shadow-2xs transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
                            >
                              {isProcessing && processingAction === 'Approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                              Approve
                            </button>

                            <button
                              onClick={() => handleAction(approval.id, 'Return')}
                              disabled={!approval.isUserTurnToApprove || isProcessing}
                              className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
                            >
                              {isProcessing && processingAction === 'Return' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 text-slate-500" />}
                              Return
                            </button>

                            <button
                              onClick={() => handleAction(approval.id, 'Reject')}
                              onBlur={() => setConfirmingReject((current) => (current === approval.id ? null : current))}
                              disabled={!approval.isUserTurnToApprove || isProcessing}
                              className={`flex h-10 items-center gap-1.5 rounded-xl border px-4 text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40 active:scale-95 ${
                                confirmingReject === approval.id
                                  ? 'border-rose-600 bg-rose-600 text-white hover:bg-rose-700'
                                  : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                              }`}
                            >
                              {isProcessing && processingAction === 'Reject' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                              {confirmingReject === approval.id ? 'Confirm Reject?' : 'Reject'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
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
