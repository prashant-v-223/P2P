import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock3,
  IndianRupee,
  Loader2,
  Search,
  Store,
  UserRound,
  XCircle
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../ui/toast';
import { setPendingCount } from '../../features/approvals/approvalsSlice';
import { ServerPagination } from '../ui/server-pagination';

const journeys = {
  'Advance Payment': ['Procurement Head Approval', 'Finance Approval'],
  'Invoice Payment': ['Invoice Verification', 'Accounts Clearance'],
  'Custom Duty': ['EXIM Executive Review', 'Treasury Fund Release'],
  'Logistics Payments': ['Logistics Lead Audit', 'Accounts Approval'],
  'Purchase Orders': ['Technical Evaluation', 'Procurement Head Signoff', 'MD Final Approval']
};

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

export default function PendingApprovalsView() {
  const { showToast } = useToast();
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [remarks, setRemarks] = useState({});
  const [pagination, setPagination] = useState({ total: 0, page: 1, size: 10, totalPages: 1 });
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
  const types = ['All', ...Object.keys(journeys)];

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/approvals/pending?${searchParams.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load approvals.');
      setApprovals(data.approvals || []);
      dispatch(setPendingCount(data.total || 0));
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
        body: JSON.stringify({ action, remarks: remarks[id]?.trim() || `${action} via approval workspace` })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to process approval.');
      const label = action === 'Approve' ? 'approved' : action === 'Return' ? 'returned' : 'rejected';
      showToast({
        type: action === 'Reject' ? 'warning' : 'success',
        title: `Request ${label}`,
        description: `${id} was ${label} successfully.`
      });
      setRemarks((current) => ({ ...current, [id]: '' }));
      await fetchApprovals();
    } catch (error) {
      showToast({ type: 'error', title: 'Approval action failed', description: error.message });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] min-h-0 w-full flex-col gap-4 overflow-hidden pb-4">
      <div className="surface-card flex flex-col gap-2 p-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(event) => updateFilters({ q: event.target.value })}
            placeholder="Search request ID, vendor, requester, workflow..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
        </div>
        <select value={type} onChange={(event) => updateFilters({ type: event.target.value })} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700">
          {types.map((item) => <option key={item} value={item}>{item === 'All' ? 'All payment types' : item}</option>)}
        </select>
        <select value={sort} onChange={(event) => updateFilters({ sort: event.target.value })} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        <select value={pageSize} onChange={(event) => updateFilters({ size: event.target.value })} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700" aria-label="Items per page">
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
          <h2 className="mt-3 text-base font-bold text-slate-900">You are all caught up</h2>
          <p className="mt-1 text-sm text-slate-500">{query || type !== 'All' ? 'No requests match the selected filters.' : 'There are no requests waiting for your approval.'}</p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="report-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-2">
          {visibleApprovals.map((approval, approvalIndex) => {
            const steps = journeys[approval.type] || ['Review request', 'Final approval'];
            const activeStep = Math.max(
              0,
              steps.findIndex((step) => approval.status?.toLowerCase().includes(step.replace(' Approval', '').toLowerCase()))
            );
            const isProcessing = processingId === approval.id;

            return (
              <article key={approval.id} className="surface-card border-t-2 border-t-teal-500">
                <div className="p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                        <IndianRupee className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-slate-500">
                            #{String((page - 1) * pageSize + approvalIndex + 1).padStart(2, '0')}
                          </span>
                          <h2 className="text-sm font-bold text-slate-950">{approval.id}</h2>
                          <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                            {approval.type}
                          </span>
                        </div>
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock3 className="h-3 w-3" /> Submitted {formatSubmitted(approval.submittedAt || approval.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Step {activeStep + 1} of {steps.length}</p>
                      <div className="mt-1.5 flex justify-end gap-1">
                        {steps.map((step, index) => (
                          <span key={step} className={`h-1.5 w-7 rounded-full ${index <= activeStep ? 'bg-teal-500' : 'bg-slate-200'}`} />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <Summary icon={IndianRupee} label="INR equivalent" value={approval.amountINR} />
                    <Summary icon={Store} label="Vendor" value={approval.vendorName} />
                    <Summary icon={UserRound} label="Requested by" value={approval.requestedBy || 'Not available'} />
                    <Summary icon={Clock3} label="Matched workflow" value={approval.currentSlab || 'Standard workflow'} />
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {steps.map((step, index) => (
                      <React.Fragment key={step}>
                        <div className={`flex min-w-36 items-center gap-1.5 rounded-md border px-2 py-1.5 ${
                          index === activeStep
                            ? 'border-teal-300 bg-teal-50 text-teal-800'
                            : 'border-slate-200 bg-white text-slate-500'
                        }`}>
                          <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded text-[9px] font-bold ${
                            index === activeStep ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'
                          }`}>{index + 1}</span>
                          <span className="truncate text-[11px] font-semibold">{step}</span>
                        </div>
                        {index < steps.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300" />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 border-t border-slate-100 bg-white p-3 lg:grid-cols-[minmax(260px,1fr)_176px]">
                  <div>
                    <label htmlFor={`remarks-${approval.id}`} className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Comments (optional)
                    </label>
                    <textarea
                      id={`remarks-${approval.id}`}
                      rows={5}
                      value={remarks[approval.id] || ''}
                      onChange={(event) => setRemarks((current) => ({ ...current, [approval.id]: event.target.value }))}
                      placeholder="Add a note before acting..."
                      className="mt-1.5 block min-h-[60px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
                    />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Action</p>
                    <div className="mt-1.5 grid gap-1.5">
                    <button disabled={isProcessing} onClick={() => handleAction(approval.id, 'Approve')} className="inline-flex h-[30px] w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50">
                      {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Approve
                    </button>
                    <button disabled={isProcessing} onClick={() => handleAction(approval.id, 'Return')} className="inline-flex h-[30px] w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50">
                      <ArrowLeft className="h-3.5 w-3.5" /> Return
                    </button>
                    <button disabled={isProcessing} onClick={() => handleAction(approval.id, 'Reject')} className="inline-flex h-[30px] w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
          </div>
          <ServerPagination
            page={page}
            totalPages={totalPages}
            total={pagination.total}
            pageSize={pageSize}
            itemLabel="requests"
            onPageChange={(nextPage) => updateFilters({ page: nextPage })}
          />
        </div>
      )}
    </div>
  );
}

function Summary({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2">
      <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className="mt-0.5 truncate text-xs font-semibold text-slate-800" title={value}>{value}</p>
    </div>
  );
}
