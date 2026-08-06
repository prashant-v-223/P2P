import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import {
  FileText, Search, Eye, Plus, CheckCircle2, XCircle, Clock,
  ArrowLeftRight, AlertCircle, Loader2, X, ShieldCheck, DollarSign,
  Building2, Layers, Filter, Check, CornerUpLeft
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import { userHasPermission } from '../../lib/permissions';
import UniversalApprovalWorkflowCard from '../../components/common/UniversalApprovalWorkflowCard';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { ServerPagination } from '../../components/ui/server-pagination';

// ── Status Badge Component ───────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = String(status || '').toLowerCase();
  if (s === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
        <CheckCircle2 className="w-3 h-3" />
        Approved
      </span>
    );
  }
  if (s === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-600 border border-rose-200 shadow-2xs">
        <XCircle className="w-3 h-3" />
        Rejected
      </span>
    );
  }
  if (s.includes('exim')) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
        <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
        {status}
      </span>
    );
  }
  if (s.includes('finance')) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
        <Clock className="w-3 h-3 text-blue-600 animate-pulse" />
        {status}
      </span>
    );
  }
  if (s === 'returned') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-orange-50 text-orange-700 border border-orange-200 shadow-2xs">
        <CornerUpLeft className="w-3 h-3" />
        Returned
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
      {status}
    </span>
  );
}

// ── Source Badge Component ───────────────────────────────────────────────────
function SourceBadge({ source }) {
  const isAgent = String(source).toLowerCase() === 'agent';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${isAgent ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
      {source || 'Vendor'}
    </span>
  );
}

// ── Detail & Approval Modal ──────────────────────────────────────────────────
function DetailModal({ invoice, onClose, onRefresh }) {
  const currentUser = useSelector((state) => state.auth?.user);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const isPending = (invoice.status || '').toLowerCase().includes('pending');

  const handleAction = async (actionType) => {
    if ((actionType === 'reject' || actionType === 'return') && !remarks.trim()) {
      showToast({ type: 'error', title: 'Remarks required', description: `Provide remarks before ${actionType}ing this invoice.` });
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiFetch(`/api/p2p/bl-invoices/${invoice.referenceNumber || invoice.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionType, remarks: remarks.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${actionType} invoice.`);
      showToast({ title: `Invoice ${actionType}d`, description: `BL Invoice ${invoice.referenceNumber} updated.` });
      onRefresh();
      onClose();
    } catch (err) {
      showToast({ type: 'error', title: 'Action failed', description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const userRole = (currentUser?.role || '').toLowerCase();
  const isEXIMStep = (invoice.status || '').toLowerCase().includes('exim') || invoice.currentStep === 1;
  const isFinanceStep = (invoice.status || '').toLowerCase().includes('finance') || invoice.currentStep === 2;

  const canActOnCurrentStep = userRole.includes('admin') || userRole.includes('systemadmin') ||
    (isEXIMStep && (userRole.includes('exim') || userRole.includes('manager'))) ||
    (isFinanceStep && (userRole.includes('finance') || userRole.includes('cfo')));

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !submitting && onClose()}>
      <section className="modal-panel max-w-2xl">
        <header className="modal-header">
          <div className="flex items-center gap-3">
            <span className="section-icon bg-teal-50 text-teal-700"><FileText className="h-4 w-4" /></span>
            <div>
              <h3 className="text-sm font-bold text-slate-950">BL Invoice Details</h3>
              <p className="mt-0.5 text-xs text-slate-500">{invoice.referenceNumber} — {invoice.typeDisplay}</p>
            </div>
          </div>
          <button type="button" disabled={submitting} onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="modal-body space-y-5 max-h-[calc(100dvh-7rem)] overflow-y-auto">

          {/* Top Status & Summary Banner */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Invoice Amount</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">
                {invoice.currency === 'USD' ? '$' : '₹'}{Number(invoice.amount).toLocaleString('en-IN')}
                <span className="text-xs font-semibold text-slate-400 ml-1.5">{invoice.currency || 'INR'}</span>
              </p>
            </div>
            <StatusBadge status={invoice.status} />
          </div>

          {/* Detailed Specifications Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-slate-200/80 bg-white p-3 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">BL Number</span>
              <p className="font-mono font-bold text-slate-900">{invoice.blNumber}</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white p-3 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Invoice Number</span>
              <p className="font-mono font-bold text-slate-900">{invoice.invoiceNumber}</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white p-3 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Vendor / Agent Name</span>
              <p className="font-bold text-slate-900">{invoice.vendorName}</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white p-3 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Source Type</span>
              <div><SourceBadge source={invoice.source} /></div>
            </div>
          </div>

          {/* Universal Dynamic Approval Workflow Stepper Component */}
          <UniversalApprovalWorkflowCard
            referenceId={invoice.invoiceNumber || invoice.id || invoice._id}
            recordType="BL Freight Invoice"
            vendorName={invoice.vendorName}
            amountFormatted={`${invoice.currency === 'USD' ? '$' : '₹'}${Number(invoice.amount || 0).toLocaleString('en-IN')}`}
            poRef={invoice.blNumber}
            onStatusChange={() => {
              onRefresh();
              onClose();
            }}
          />

          {/* Gated Approval Action Form (Only for Designated Approvers) */}
          {isPending && canActOnCurrentStep && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
              <h4 className="text-xs font-bold text-amber-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                Action Approval Request ({isEXIMStep ? 'EXIM Manager' : 'Finance Lead'})
              </h4>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks / Note</label>
                <textarea
                  rows={2}
                  placeholder="Enter remarks for approval or rejection..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0d7676]"
                />
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleAction('return')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-lg border border-orange-200 transition"
                >
                  <CornerUpLeft className="w-3.5 h-3.5" /> Return
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleAction('reject')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleAction('approve')}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-[#0d7676] hover:bg-[#0a5c5c] rounded-lg transition shadow-xs"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Approve
                </button>
              </div>
            </div>
          )}

          {/* Workflow Status Banner for Non-Approver Viewers */}
          {isPending && !canActOnCurrentStep && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 flex items-center justify-between text-xs text-blue-950">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-600 animate-pulse flex-shrink-0" />
                <div>
                  <p className="font-bold">Approval Request Pending</p>
                  <p className="text-[11px] text-blue-700 mt-0.5">
                    Currently awaiting review & authorization from <span className="font-bold">{isEXIMStep ? 'EXIM Manager' : 'Finance Lead'}</span> (Step {invoice.currentStep || 1} of {invoice.totalSteps || 2}).
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold uppercase tracking-wide border border-blue-200">
                In Progress
              </span>
            </div>
          )}

          {/* Action History Log */}
          {invoice.actionHistory && invoice.actionHistory.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Audit & Action History</h4>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 divide-y divide-slate-200/60 text-xs">
                {invoice.actionHistory.map((act, index) => (
                  <div key={index} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">{act.actionedBy}</span>
                      <span className="text-[11px] text-slate-500 ml-1">({act.role})</span>
                      {act.remarks && <p className="text-[11px] text-slate-600 italic mt-0.5">{act.remarks}</p>}
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {new Date(act.actionedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </section>
    </div>
  );
}

// ── Submit BL Invoice Modal ──────────────────────────────────────────────────
function SubmitInvoiceModal({ onClose, onCreated }) {
  const [blNumber, setBlNumber] = useState('');
  const [typeDisplay, setTypeDisplay] = useState('Freight Invoice');
  const [source, setSource] = useState('Vendor');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!blNumber.trim() || !invoiceNumber.trim() || !amount || Number(amount) <= 0) {
      showToast({ type: 'error', title: 'Invalid inputs', description: 'Provide BL Number, Invoice Number, and valid positive amount.' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiFetch('/api/p2p/bl-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blNumber: blNumber.trim(),
          typeDisplay,
          source,
          invoiceNumber: invoiceNumber.trim(),
          vendorName: vendorName.trim() || 'Logistics Vendor',
          amount: Number(amount),
          currency,
          remarks: remarks.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit BL invoice.');
      showToast({ title: 'BL Invoice Submitted', description: `Invoice ${data.invoice?.referenceNumber} submitted for EXIM approval.` });
      onCreated();
      onClose();
    } catch (err) {
      showToast({ type: 'error', title: 'Submission failed', description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !submitting && onClose()}>
      <section className="modal-panel max-w-lg">
        <header className="modal-header">
          <div className="flex items-center gap-3">
            <span className="section-icon bg-teal-50 text-teal-700"><Plus className="h-4 w-4" /></span>
            <div>
              <h3 className="text-sm font-bold text-slate-950">Submit BL Invoice / Charge</h3>
              <p className="mt-0.5 text-xs text-slate-500">Raise freight invoice or destination charge against a Bill of Lading.</p>
            </div>
          </div>
          <button type="button" disabled={submitting} onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </header>

        <form noValidate onSubmit={handleSubmit} className="modal-body space-y-4 max-h-[calc(100dvh-7rem)] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">BL Number <span className="text-rose-500">*</span></label>
              <input type="text" required placeholder="e.g. SHMSA2600305" value={blNumber} onChange={(e) => setBlNumber(e.target.value.toUpperCase())} className="w-full text-xs p-2.5 rounded-lg border border-slate-300 uppercase font-mono focus:border-teal-600 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Number <span className="text-rose-500">*</span></label>
              <input type="text" required placeholder="e.g. INV-98471" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono focus:border-teal-600 focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Charge Type</label>
              <SearchableSelect
                options={[
                  { label: 'Freight Invoice', value: 'Freight Invoice' },
                  { label: 'Destination Charges (Shipping Line)', value: 'Destination Charges (Shipping Line)' },
                  { label: 'Recepted Charges', value: 'Recepted Charges' },
                  { label: 'Agency Charges', value: 'Agency Charges' },
                  { label: 'Port Storage', value: 'Port Storage' },
                  { label: 'Customs Clearance Fee', value: 'Customs Clearance Fee' }
                ]}
                value={typeDisplay}
                onChange={(val) => setTypeDisplay(val)}
                size="sm"
                searchable={false}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Source</label>
              <SearchableSelect
                options={[
                  { label: 'Vendor', value: 'Vendor' },
                  { label: 'Agent', value: 'Agent' }
                ]}
                value={source}
                onChange={(val) => setSource(val)}
                size="sm"
                searchable={false}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor / Agent Name</label>
            <input type="text" placeholder="e.g. IDEAL SHIPPING SERVICES" value={vendorName} onChange={(e) => setVendorName(e.target.value)} className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:border-teal-600 focus:outline-none" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
              <SearchableSelect
                options={[
                  { label: 'INR (₹)', value: 'INR' },
                  { label: 'USD ($)', value: 'USD' }
                ]}
                value={currency}
                onChange={(val) => setCurrency(val)}
                size="sm"
                searchable={false}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Amount <span className="text-rose-500">*</span></label>
              <input type="number" min="0" step="0.01" required placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-bold focus:border-teal-600 focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks / Note</label>
            <input type="text" placeholder="Optional notes for approvers" value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:border-teal-600 focus:outline-none" />
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={submitting} className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0d7676] hover:bg-[#0a5c5c] rounded-lg disabled:opacity-50">
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Submit Request</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

// ── Main BL Invoices View Component ──────────────────────────────────────────
export default function BlInvoicesView() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (search) queryParams.set('q', search);
      if (statusFilter !== 'All') queryParams.set('status', statusFilter);
      if (sourceFilter !== 'All') queryParams.set('source', sourceFilter);

      const res = await apiFetch(`/api/p2p/bl-invoices?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
      }
    } catch (e) {
      console.error('Error fetching BL invoices:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [search, statusFilter, sourceFilter]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const paginatedInvoices = invoices.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] min-h-0 w-full flex-col gap-4 overflow-hidden pb-4 font-sans antialiased">
      
      {/* Controls Bar (Matching Exact Screenshot Layout) */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto flex-1">
          <div className="relative min-w-[260px] flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search ref#, invoice#, vendor..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-[#0d7676] focus:outline-none"
            />
          </div>

          <div className="w-48">
            <SearchableSelect
              options={[
                { label: 'All Status', value: 'All' },
                { label: 'Approved', value: 'Approved' },
                { label: 'Rejected', value: 'Rejected' },
                { label: 'Pending EXIM Approval', value: 'Pending EXIM Approval' },
                { label: 'Pending Finance Approval', value: 'Pending Finance Approval' },
                { label: 'Returned', value: 'Returned' }
              ]}
              value={statusFilter}
              onChange={(val) => { setStatusFilter(val); setPage(1); }}
              size="sm"
              searchable={false}
            />
          </div>

          <div className="w-36">
            <SearchableSelect
              options={[
                { label: 'All Sources', value: 'All' },
                { label: 'Vendor', value: 'Vendor' },
                { label: 'Agent', value: 'Agent' }
              ]}
              value={sourceFilter}
              onChange={(val) => { setSourceFilter(val); setPage(1); }}
              size="sm"
              searchable={false}
            />
          </div>
        </div>

        <button
          onClick={() => setIsSubmitOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#0d7676] rounded-lg hover:bg-[#0a5c5c] transition shadow-xs flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Submit BL Invoice
        </button>
      </div>

      {/* Main Table Card (Matching Exact Reference Screenshot Columns) */}
      <div className="surface-card flex min-h-0 flex-1 flex-col border border-slate-200 rounded-xl bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#0d7676]" />
            <span>Loading BL Invoice Payments...</span>
          </div>
        ) : (
          <>
            <div className="report-scroll min-h-0 flex-1 overflow-auto">
              <table className="data-table w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">#</th>
                    <th className="py-3.5 px-4">REFERENCE</th>
                    <th className="py-3.5 px-4">TYPE</th>
                    <th className="py-3.5 px-4">FROM</th>
                    <th className="py-3.5 px-4">INVOICE #</th>
                    <th className="py-3.5 px-4">BL NUMBER</th>
                    <th className="py-3.5 px-4">VENDOR/AGENT</th>
                    <th className="py-3.5 px-4 text-right">AMOUNT</th>
                    <th className="py-3.5 px-4 text-center">STATUS</th>
                    <th className="py-3.5 px-4">DATE</th>
                    <th className="py-3.5 px-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-xs text-slate-400">No BL invoice payment records found.</td>
                    </tr>
                  ) : paginatedInvoices.map((inv, index) => (
                    <tr key={inv.id || index} className="hover:bg-teal-50/20 transition">
                      <td className="w-10 font-semibold tabular-nums text-slate-400 px-4 py-3.5">
                        {(page - 1) * pageSize + index + 1}
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="font-bold text-teal-700 hover:text-teal-900 font-mono text-xs hover:underline cursor-pointer"
                        >
                          {inv.referenceNumber}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-slate-800 font-medium">{inv.typeDisplay}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <SourceBadge source={inv.source} />
                      </td>
                      <td className="text-slate-600 font-mono px-4 py-3.5">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3.5 font-bold font-mono text-slate-900">{inv.blNumber}</td>
                      <td className="px-4 py-3.5 text-slate-800 font-semibold max-w-[220px] truncate">{inv.vendorName}</td>
                      <td className="px-4 py-3.5 text-right font-extrabold text-slate-900">
                        {inv.currency === 'USD' ? 'USD ' : 'INR '}{Number(inv.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 font-medium whitespace-nowrap">{formatDate(inv.submittedAt || inv.createdAt)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          title="View Invoice & Approval Details"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 border border-slate-200 transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ServerPagination
              page={page}
              totalPages={Math.ceil(invoices.length / pageSize) || 1}
              total={invoices.length}
              pageSize={pageSize}
              itemLabel="BL invoices"
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </>
        )}
      </div>

      {/* Invoice Detail & Approval Modal Portal */}
      {selectedInvoice && createPortal(
        <DetailModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onRefresh={fetchInvoices}
        />,
        document.body
      )}

      {/* Submit BL Invoice Modal Portal */}
      {isSubmitOpen && createPortal(
        <SubmitInvoiceModal
          onClose={() => setIsSubmitOpen(false)}
          onCreated={fetchInvoices}
        />,
        document.body
      )}

    </div>
  );
}
