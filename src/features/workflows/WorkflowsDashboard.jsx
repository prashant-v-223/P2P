import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchWorkflows, setCategoryFilter, setSearchQuery } from './workflowsSlice';
import AddWorkflowModal from '../../components/workflows/AddWorkflowModal';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useConfirm } from '../../components/ui/confirm-dialog';
import { useToast } from '../../components/ui/toast';
import { apiFetch } from '../../services/api';
import { cn } from '../../lib/utils';
import { 
  GitFork, 
  Plus, 
  Search, 
  Pencil, 
  Trash2, 
  ArrowRight,
  ShieldCheck,
  X
} from 'lucide-react';
import { ServerPagination } from '../../components/ui/server-pagination';

export default function WorkflowsDashboard() {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const { slabs, loading, categoryFilter, searchQuery, pagination } = useSelector((state) => state.workflows);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSlab, setEditingSlab] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const sort = searchParams.get('sort') || 'category';
  const pageSize = Math.max(1, Number(searchParams.get('size')) || 10);
  const requestedPage = Math.max(1, Number(searchParams.get('page')) || 1);

  useEffect(() => {
    dispatch(setCategoryFilter(searchParams.get('category') || 'All'));
    dispatch(setSearchQuery(searchParams.get('q') || ''));
    dispatch(fetchWorkflows(searchParams.toString()));
  }, [dispatch, searchParams]);

  const updateUrl = (updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === 'All' || (key === 'page' && Number(value) === 1)) next.delete(key);
      else next.set(key, String(value));
    });
    if (!Object.prototype.hasOwnProperty.call(updates, 'page')) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const categories = [
    'All',
    'Advance Payment',
    'Invoice Payment',
    'Custom Duty',
    'Logistics Payments',
    'Purchase Orders'
  ];

  const handleEditSlab = (slab) => {
    setEditingSlab(slab);
    setIsAddModalOpen(true);
  };

  const handleAddNewSlab = () => {
    setEditingSlab(null);
    setIsAddModalOpen(true);
  };

  const handleDeleteSlab = async (id) => {
    const slab = slabs.find((item) => item.id === id);
    const approved = await confirm({
      title: 'Delete workflow rule?',
      description: `${slab?.name || 'This workflow slab'} will be permanently removed from the approval routing configuration.`,
      confirmLabel: 'Delete workflow',
      cancelLabel: 'Keep workflow'
    });
    if (!approved) return;

    try {
      setDeletingId(id);
      const response = await apiFetch(`/api/workflows/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to delete this workflow.');
      showToast({
        type: 'success',
        title: 'Workflow deleted',
        description: `${slab?.name || 'The workflow rule'} was removed successfully.`
      });
      dispatch(fetchWorkflows(searchParams.toString()));
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Could not delete workflow',
        description: error.message
      });
    } finally {
      setDeletingId(null);
    }
  };

  const total = pagination.total || 0;
  const totalPages = pagination.totalPages || 1;
  const page = pagination.page || requestedPage;
  const visibleSlabs = slabs;

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] min-h-0 w-full flex-col gap-4 overflow-hidden pb-4 font-sans">
      
      {/* SINGLE UNIFIED COMPACT CONTROLS BAR (Matching User Directory Pattern) */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto flex-1">
          
          {/* Search Box */}
          <div className="relative min-w-[240px] flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search slab by name or range..."
              value={searchQuery}
              onChange={(e) => updateUrl({ q: e.target.value })}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
            {searchQuery && (
              <button onClick={() => updateUrl({ q: '' })} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Filter Select */}
          <select 
            value={categoryFilter} 
            onChange={(e) => updateUrl({ category: e.target.value })} 
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d7676]"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat === 'All' ? 'All categories' : cat}</option>
            ))}
          </select>

          {/* Sort Select */}
          <select 
            value={sort} 
            onChange={(event) => updateUrl({ sort: event.target.value })} 
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d7676]"
          >
            <option value="category">Sort by category</option>
            <option value="name">Sort by name</option>
            <option value="threshold">Sort by threshold</option>
          </select>

          {/* Page Size Select */}
          <select 
            value={pageSize} 
            onChange={(event) => updateUrl({ size: event.target.value })} 
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d7676]"
          >
            {[6, 10, 20, 50].map((size) => <option key={size} value={size}>{size} per page</option>)}
          </select>
        </div>

        {/* Add Workflow Slab Button */}
        <button
          onClick={handleAddNewSlab}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#0d7676] rounded-lg hover:bg-[#0a5c5c] transition shadow-xs flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Workflow Slab</span>
        </button>
      </div>

      {/* Workflow Slabs Grid */}
      {loading ? (
        <div className="surface-card flex flex-1 items-center justify-center text-xs text-slate-400">Loading workflow slabs...</div>
      ) : visibleSlabs.length === 0 ? (
        <Card className="flex flex-1 items-center justify-center p-12 text-center text-xs text-slate-500 font-semibold">
          No workflow slabs match your filter query.
        </Card>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className={cn('report-scroll grid min-h-0 flex-1 auto-rows-max grid-cols-1 content-start items-start gap-4 overflow-y-auto overscroll-contain pr-2', visibleSlabs.length > 1 && 'md:grid-cols-2')}>
            {visibleSlabs.map((slab, slabIndex) => (
              <Card key={slab.id} className="group relative h-auto self-start overflow-hidden transition-all hover:border-teal-300 hover:shadow-md hover:shadow-teal-900/5 border-slate-200">
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-teal-600 via-teal-400 to-transparent opacity-70" />
                <CardHeader className="border-b border-slate-100 p-3.5">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-slate-500">
                          #{String((page - 1) * pageSize + slabIndex + 1).padStart(2, '0')}
                        </span>
                        <Badge variant="teal" className="px-2 py-0 text-[10px]">{slab.category}</Badge>
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active rule
                        </span>
                      </div>
                      <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                        <CardTitle className="truncate text-[13px] font-bold text-slate-900">{slab.name}</CardTitle>
                        <div className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-teal-100 bg-teal-50/70 px-2 py-0.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#0d7676]">Threshold</span>
                          <span className="truncate font-sans text-[11px] font-bold tabular-nums text-teal-900">
                            {String(slab.formattedRange || '').split('∞').map((part, index, parts) => (
                              <React.Fragment key={`${part}-${index}`}>
                                {part}
                                {index < parts.length - 1 && (
                                  <span className="relative -top-px inline-block px-0.5 pt-1 font-sans text-[15px] font-semibold leading-none" aria-label="No upper limit">
                                    &infin;
                                  </span>
                                )}
                              </React.Fragment>
                            ))}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-700" onClick={() => handleEditSlab(slab)} title="Edit workflow rule">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button disabled={deletingId === slab.id} variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => handleDeleteSlab(slab.id)} title="Delete workflow rule">
                        <Trash2 className={cn('h-3.5 w-3.5', deletingId === slab.id && 'animate-pulse')} />
                      </Button>
                    </div>
                  </div>

                  <CardDescription className="mt-1 line-clamp-1 text-[11px] leading-4 text-slate-500">
                    {slab.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-1.5 bg-slate-50/60 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">Approval journey</span>
                    <Badge variant="emerald" className="px-2 py-0 text-[10px]">
                      <ShieldCheck className="w-3 h-3 text-emerald-600 mr-1" />
                      {slab.steps.length} Steps
                    </Badge>
                  </div>

                  {/* Steps Chain */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {slab.steps.map((st, idx) => (
                      <React.Fragment key={idx}>
                        <div title={st.roleName || st.roleKey?.replaceAll('_', ' ') || 'Assigned approver'} className="flex h-9 min-w-[125px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 shadow-sm shadow-slate-900/[0.03]">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#0d7676] text-[9px] font-black text-white shadow-sm">
                            {idx + 1}
                          </span>
                          <p className="min-w-0 truncate text-[11px] font-bold text-slate-900">{st.title}</p>
                        </div>
                        {idx < slab.steps.length - 1 && (
                          <span className="flex items-center text-teal-400"><ArrowRight className="h-3.5 w-3.5" /></span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <ServerPagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            itemLabel="workflows"
            onPageChange={(nextPage) => updateUrl({ page: nextPage })}
          />
        </div>
      )}

      {/* Add / Edit Workflow Modal */}
      {isAddModalOpen && (
        <AddWorkflowModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          editingSlab={editingSlab}
          onSuccess={() => dispatch(fetchWorkflows(searchParams.toString()))}
        />
      )}
    </div>
  );
}
