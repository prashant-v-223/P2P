import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchWorkflows, setCategoryFilter, setSearchQuery } from './workflowsSlice';
import AddWorkflowModal from '../../components/workflows/AddWorkflowModal';
import { useConfirm } from '../../components/ui/confirm-dialog';
import { useToast } from '../../components/ui/toast';
import { apiFetch } from '../../services/api';
import { 
  GitFork, 
  Plus, 
  Search, 
  Pencil, 
  Trash2, 
  ArrowRight,
  ShieldCheck,
  X,
  CreditCard,
  FileText,
  CheckCircle2,
  Loader2,
  ChevronRight,
  Banknote,
  LayoutGrid,
  AlertTriangle
} from 'lucide-react';
import { ServerPagination } from '../../components/ui/server-pagination';

/* ── Indian currency formatter ─────────────────────────────────────────── */
function formatINR(val) {
  if (val === null || val === undefined || val === '') return '∞  (No Limit)';
  const n = Number(val);
  if (!Number.isFinite(n)) return '∞';
  if (n === 0) return '₹0';
  if (n >= 10000000) return `₹${(n / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`;
  if (n >= 1000)     return `₹${(n / 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 })}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

/* ── Category meta (icon + colour) ──────────────────────────────────────── */
const CATEGORY_META = {
  'Advance Payment':    { icon: CreditCard,  bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   accent: 'border-l-amber-500' },
  'Invoice Payment':    { icon: FileText,    bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    accent: 'border-l-blue-500' },
  'BL Freight Invoice': { icon: Banknote,    bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',  accent: 'border-l-violet-500' },
  'RFQ Vendor Award':   { icon: ShieldCheck, bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', accent: 'border-l-emerald-500' },
  'Custom Duty':        { icon: LayoutGrid,  bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    accent: 'border-l-rose-500' },
  'Purchase Orders':    { icon: GitFork,     bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200',     accent: 'border-l-sky-500' },
  'Logistics Payments': { icon: Banknote,    bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200',    accent: 'border-l-teal-500' },
};
const DEFAULT_META = { icon: GitFork, bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', accent: 'border-l-[#0d7676]' };

/* ── Category filter tabs ───────────────────────────────────────────────── */
const CATEGORIES = [
  'All',
  'Advance Payment',
  'Invoice Payment',
  'BL Freight Invoice',
  'RFQ Vendor Award',
  'Custom Duty',
  'Purchase Orders',
  'Logistics Payments',
];

export default function WorkflowsDashboard() {
  const dispatch    = useDispatch();
  const confirm     = useConfirm();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const { slabs, loading, categoryFilter, searchQuery, pagination }
    = useSelector((s) => s.workflows);

  const [modalOpen,   setModalOpen]   = useState(false);
  const [editingSlab, setEditingSlab] = useState(null);
  const [deletingId,  setDeletingId]  = useState(null);

  const pageSize      = Math.max(1, Number(searchParams.get('size')) || 10);
  const requestedPage = Math.max(1, Number(searchParams.get('page')) || 1);

  /* ── URL-driven fetch ─────────────────────────────────────────────────── */
  const refreshSlabs = useCallback(
    () => dispatch(fetchWorkflows(searchParams.toString())),
    [dispatch, searchParams]
  );

  useEffect(() => {
    dispatch(setCategoryFilter(searchParams.get('category') || 'All'));
    dispatch(setSearchQuery(searchParams.get('q') || ''));
    refreshSlabs();
  }, [dispatch, searchParams, refreshSlabs]);

  const updateUrl = (updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (!v || v === 'All' || (k === 'page' && Number(v) === 1)) next.delete(k);
      else next.set(k, String(v));
    });
    if (!Object.prototype.hasOwnProperty.call(updates, 'page')) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  /* ── CRUD handlers ────────────────────────────────────────────────────── */
  const openAdd = () => { setEditingSlab(null); setModalOpen(true); };
  const openEdit = (slab) => { setEditingSlab(slab); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingSlab(null); };

  const handleDelete = async (slab) => {
    const yes = await confirm({
      title: 'Delete this workflow slab?',
      description: `"${slab.name}" will be retired from the approval routing. Existing approvals already using this slab will keep their original snapshot.`,
      confirmLabel: 'Yes, Delete',
      cancelLabel: 'Cancel',
    });
    if (!yes) return;
    try {
      setDeletingId(slab.id);
      const res  = await apiFetch(`/api/workflows/${slab.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      showToast({ type: 'success', title: 'Workflow deleted', description: `"${slab.name}" was retired successfully.` });
      refreshSlabs();
    } catch (err) {
      showToast({ type: 'error', title: 'Delete failed', description: err.message });
    } finally {
      setDeletingId(null);
    }
  };

  /* ── Derived stats ────────────────────────────────────────────────────── */
  const total      = pagination.total || slabs.length || 0;
  const totalPages = pagination.totalPages || 1;
  const page       = pagination.page || requestedPage;
  const totalSteps = slabs.reduce((s, w) => s + (w.steps?.length || 0), 0);
  const catCounts  = {};
  slabs.forEach((s) => { catCounts[s.category] = (catCounts[s.category] || 0) + 1; });

  /* ─────────────────────────────────── JSX ──────────────────────────────── */
  return (
    <div className="flex w-full flex-col gap-5 pb-10 font-sans antialiased">

      {/* ═══════ 1. HEADER + METRICS ═══════════════════════════════════════ */}
      <section className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-6 space-y-5">
        {/* Title row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-teal-50 text-[#0d7676]"><GitFork className="w-5 h-5" /></span>
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Workflow Approval Engine</h1>
                <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                  Configure multi-level monetary threshold slabs, role authorisations & approval sequences.
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0d7676] hover:bg-[#0a5c5c] text-white font-bold text-xs shadow-sm transition active:scale-[.97] shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Workflow Slab
          </button>
        </div>

        {/* Metric strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'TOTAL SLABS',  value: total,      Icon: GitFork,     color: '#0d7676' },
            { label: 'CATEGORIES',   value: Object.keys(catCounts).length, Icon: LayoutGrid, color: '#6366f1' },
            { label: 'ACTIVE STEPS', value: totalSteps,  Icon: ShieldCheck, color: '#059669' },
            { label: 'ON THIS PAGE', value: slabs.length, Icon: FileText,    color: '#d97706' },
          ].map((m) => (
            <div key={m.label} className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200/80 shadow-2xs space-y-1"
                 style={{ borderLeftWidth: 4, borderLeftColor: m.color }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{m.label}</span>
                <m.Icon className="w-4 h-4" style={{ color: m.color }} />
              </div>
              <p className="text-2xl font-black text-slate-900">{m.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ 2. FILTERS + SEARCH ═══════════════════════════════════════ */}
      <section className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-4 flex flex-col md:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search slab name, role, threshold…"
            value={searchQuery}
            onChange={(e) => updateUrl({ q: e.target.value })}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-[#0d7676] outline-none"
          />
          {searchQuery && (
            <button onClick={() => updateUrl({ q: '' })} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category pill tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => updateUrl({ category: cat })}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition ${
                categoryFilter === cat
                  ? 'bg-[#0d7676] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat === 'All' ? 'All Categories' : cat}
            </button>
          ))}
        </div>
      </section>

      {/* ═══════ 3. SLAB CARDS ═════════════════════════════════════════════ */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 p-16 bg-white rounded-3xl border border-slate-200 text-xs font-bold text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading workflow slabs…
        </div>
      ) : slabs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 p-16 bg-white rounded-3xl border border-slate-200 text-center">
          <AlertTriangle className="w-8 h-8 text-slate-300" />
          <p className="text-sm font-bold text-slate-500">No workflow slabs found</p>
          <p className="text-xs text-slate-400 max-w-sm">Try selecting a different category, clearing your search, or add a new slab using the button above.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            {slabs.map((slab, idx) => {
              const meta = CATEGORY_META[slab.category] || DEFAULT_META;
              const CatIcon = meta.icon;
              const isDeleting = deletingId === slab.id;

              return (
                <div
                  key={slab.id}
                  className={`bg-white rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all overflow-hidden border-l-4 ${meta.accent} ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  {/* ── Card Header ────────────────────────────────────── */}
                  <div className="p-5 pb-3.5 flex items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${meta.bg} ${meta.text} border ${meta.border}`}>
                          <CatIcon className="w-3 h-3" />
                          {slab.category}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-mono font-bold text-slate-500">
                          #{String((page - 1) * pageSize + idx + 1).padStart(2, '0')}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      </div>
                      <h3 className="text-sm font-extrabold text-slate-900 truncate">{slab.name}</h3>
                      {slab.description && (
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed line-clamp-2">{slab.description}</p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                      <button
                        onClick={() => openEdit(slab)}
                        title="Edit this workflow slab"
                        className="p-2 rounded-xl border border-slate-200 hover:bg-teal-50 hover:border-teal-300 text-slate-500 hover:text-[#0d7676] transition"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(slab)}
                        disabled={isDeleting}
                        title="Delete this workflow slab"
                        className="p-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition disabled:opacity-40"
                      >
                        {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* ── Threshold Range ─────────────────────────────────── */}
                  <div className="mx-5 mb-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">MONETARY THRESHOLD</span>
                    <div className="flex items-center justify-between mt-1">
                      <p className="font-mono font-extrabold text-slate-900 text-sm">
                        {formatINR(slab.minAmount)}
                        <span className="mx-2 text-slate-400">→</span>
                        {formatINR(slab.maxAmount)}
                      </p>
                      <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[10px] font-bold text-slate-700 shadow-2xs">
                        {slab.steps?.length || 0} Step{(slab.steps?.length || 0) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* ── Approval Step Chain ─────────────────────────────── */}
                  <div className="px-5 pb-5">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 block">APPROVAL JOURNEY</span>
                    <div className="flex flex-wrap items-stretch gap-1.5">
                      {(slab.steps || []).map((st, sIdx) => (
                        <React.Fragment key={sIdx}>
                          <div className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white shadow-2xs min-w-[130px] flex-1">
                            <span className="w-6 h-6 rounded-lg bg-[#0d7676] text-white text-[10px] font-black flex items-center justify-center shrink-0">
                              {sIdx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-slate-900 truncate">{st.title}</p>
                              <p className="text-[10px] font-semibold text-slate-400 capitalize truncate">
                                {(st.roleName || st.roleKey || 'Approver').replace(/_/g, ' ')}
                              </p>
                            </div>
                          </div>
                          {sIdx < (slab.steps.length - 1) && (
                            <ChevronRight className="w-4 h-4 text-teal-400 self-center shrink-0" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <ServerPagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            itemLabel="workflow slabs"
            onPageChange={(p) => updateUrl({ page: p })}
          />
        </div>
      )}

      {/* ═══════ 4. ADD / EDIT MODAL ═══════════════════════════════════════ */}
      <AddWorkflowModal
        isOpen={modalOpen}
        onClose={closeModal}
        editingSlab={editingSlab}
        onSuccess={() => { closeModal(); refreshSlabs(); }}
      />
    </div>
  );
}
