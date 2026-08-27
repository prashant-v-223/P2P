import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import { useConfirm } from '../../components/ui/confirm-dialog';
import {
  FileSpreadsheet, FileCheck, Plus, Search, Eye, Pencil, Copy, Trash2, Loader2,
  Box, MapPin, X, RefreshCw
} from 'lucide-react';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { Button } from '../../components/ui/button';
import { ServerPagination } from '../../components/ui/server-pagination';
import { getRfqAllocationSummary } from './rfqStatus';

import { useSelector } from 'react-redux';
import { userHasPermission } from '../../lib/permissions';
import { TableActionButton } from '../../components/ui/table-action-button';

const ActionButton = ({ onClick, icon: Icon, label, color = "slate" }) => {
  const variantMap = {
    slate: 'view',
    blue: 'edit',
    emerald: 'copy',
    teal: 'reopen',
    rose: 'delete'
  };
  const variant = variantMap[color] || 'view';

  return (
    <TableActionButton
      onClick={onClick}
      icon={Icon}
      title={label}
      variant={variant}
    />
  );
};

export default function RfqSourcingView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatus = searchParams.get('status') || 'All';
  const urlSearch = searchParams.get('search') || '';
  const urlPage = Number(searchParams.get('page')) || 1;

  const { showToast } = useToast();
  const confirm = useConfirm();
  const { user } = useSelector((state) => state.auth || {});
  const userPerms = user?.permissions || user?.customPermissions;
  const canCreate = userHasPermission(user?.role, 'rfq.create', userPerms);
  const canEdit = canCreate || userHasPermission(user?.role, 'rfq.edit', userPerms);
  const canDelete = userHasPermission(user?.role, 'rfq.delete', userPerms);

  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(urlSearch);
  const [statusFilter, setStatusFilter] = useState(urlStatus);
  const [currentPage, setCurrentPage] = useState(urlPage);
  const [totalRfqs, setTotalRfqs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch);
  const [pageSize, setPageSize] = useState(10);

  // Sync state with URL search params
  useEffect(() => {
    const params = {};
    if (statusFilter && statusFilter !== 'All') params.status = statusFilter;
    if (debouncedSearch) params.search = debouncedSearch;
    if (currentPage > 1) params.page = String(currentPage);
    setSearchParams(params, { replace: true });
  }, [statusFilter, debouncedSearch, currentPage, setSearchParams]);

  // Helper function
  const isRfqClosed = (rfq) => {
    return rfq.status === 'closed' ||
      (rfq.closingDate && new Date(rfq.closingDate) < new Date());
  };
  const fetchRfqs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        search: debouncedSearch,
        status: statusFilter === 'All' ? '' : statusFilter,
        page: String(currentPage),
        pageSize: String(pageSize)
      });
      const res = await apiFetch(`/api/p2p/rfqs?${params.toString()}`);
      const json = await res.json();
      if (res.ok && json.data) {
        setRfqs(json.data);
        setTotalRfqs(Number(json.total) || 0);
        setTotalPages(Math.max(1, Number(json.totalPages) || 1));
        if (json.page && Number(json.page) !== currentPage) setCurrentPage(Number(json.page));
      } else throw new Error(json.error || 'Unable to load RFQs.');
    } catch (e) {
      showToast({ title: 'RFQ Load Failed', description: e.message, type: 'error' });
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => { fetchRfqs(); }, [debouncedSearch, statusFilter, currentPage, pageSize]);

  const startIndex = (currentPage - 1) * pageSize;
  const displayedRfqs = rfqs;

  // --- Helpers ---
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return '—'; }
  };

  const getStatusBadge = (rfq) => {
    const { badgeText, badgeTone } = getRfqAllocationSummary(rfq);
    const badgeClass = {
      amber: 'bg-amber-50 text-amber-800 border-amber-300',
      emerald: 'bg-emerald-50 text-emerald-800 border-emerald-300',
      rose: 'bg-rose-50 text-rose-700 border-rose-300',
      sky: 'bg-sky-50 text-sky-700 border-sky-200',
      slate: 'bg-slate-100 text-slate-600 border-slate-200'
    }[badgeTone] || 'bg-slate-100 text-slate-600 border-slate-200';

    return (
      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold inline-block border whitespace-nowrap ${badgeClass}`}>
        {badgeText}
      </span>
    );
  };

  // --- Actions ---
  const handleDelete = async (rfq, e) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Delete RFQ Record',
      description: `Are you sure you want to delete RFQ ${rfq.rfqNumber}? This action cannot be undone.`,
      confirmLabel: 'Delete RFQ',
      cancelLabel: 'Cancel'
    });
    if (!ok) return;
    const targetId = rfq?.rfqId || rfq?._id;
    if (!targetId) {
      showToast({ title: 'Delete Blocked', description: 'RFQ id is missing for this record.', type: 'error' });
      return;
    }
    try {
      const res = await apiFetch(`/api/p2p/rfqs/${targetId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast({ title: 'Success', description: 'RFQ deleted.', type: 'success' });
        if (rfqs.length === 1 && currentPage > 1) setCurrentPage((page) => page - 1);
        else fetchRfqs();
      } else {
        const json = await res.json();
        throw new Error(json.error || 'Unable to delete RFQ.');
      }
    } catch (err) { showToast({ title: 'Delete Blocked', description: err.message, type: 'error' }); }
  };

  const [showReopenModal, setShowReopenModal] = useState(false);
  const [selectedRfqForReopen, setSelectedRfqForReopen] = useState(null);
  const [reopenClosingDate, setReopenClosingDate] = useState('');
  const [submittingReopen, setSubmittingReopen] = useState(false);

  const handleCopy = async (rfq, e) => {
    e.stopPropagation();
    try {
      const targetId = rfq.rfqId || rfq._id;
      const res = await apiFetch(`/api/p2p/rfqs/${targetId}/copy`, { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast({ title: 'RFQ Copied', description: `${json.data.rfqNumber} pre-filled. Complete details and publish.`, type: 'success' });
        navigate('/admin/rfqs/create', { state: { copyFrom: json.data } });
      } else throw new Error(json.error || 'Unable to copy RFQ.');
    } catch (err) { showToast({ title: 'Copy Failed', description: err.message, type: 'error' }); }
  };

  const handleClose = async (rfq, e) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Close RFQ Confirmation',
      description: `Are you sure you want to close RFQ ${rfq.rfqNumber}? Bidding will be locked.`,
      confirmLabel: 'Close RFQ',
      cancelLabel: 'Cancel'
    });
    if (!ok) return;
    try {
      const targetId = rfq.rfqId || rfq._id;
      const res = await apiFetch(`/api/p2p/rfqs/${targetId}/close`, { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast({ title: 'RFQ Closed', description: json.message, type: 'success' });
        fetchRfqs();
      } else throw new Error(json.error || 'Unable to close RFQ.');
    } catch (err) { showToast({ title: 'Close Failed', description: err.message, type: 'error' }); }
  };

  const handleOpenReopenModal = (rfq, e) => {
    e.stopPropagation();
    setSelectedRfqForReopen(rfq);
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setReopenClosingDate(d.toISOString().slice(0, 10));
    setShowReopenModal(true);
  };

  const handleReopenSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRfqForReopen || !reopenClosingDate) return;
    setSubmittingReopen(true);
    try {
      const targetId = selectedRfqForReopen.rfqId || selectedRfqForReopen._id;
      const res = await apiFetch(`/api/p2p/rfqs/${targetId}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closingDate: reopenClosingDate })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast({ title: 'RFQ Reopened', description: json.message, type: 'success' });
        setShowReopenModal(false);
        fetchRfqs();
      } else throw new Error(json.error || 'Unable to reopen RFQ.');
    } catch (err) { showToast({ title: 'Reopen Failed', description: err.message, type: 'error' }); }
    finally { setSubmittingReopen(false); }
  };

  return (
    <div className="w-full space-y-4 pb-8 text-left font-sans antialiased">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">RFQ Management</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Create and manage requests for quotations</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreate && (
            <button onClick={() => navigate('/admin/rfqs/create')} className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0d7676] hover:bg-[#085a5a] text-white font-bold text-xs rounded-xl shadow-xs transition uppercase tracking-wider cursor-pointer">
              <Plus className="w-4 h-4" /><span>Create RFQ</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col items-stretch justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xl sm:flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by RFQ number, title or PO number..." className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3.5 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0d7676]" />
        </div>
        <div className="w-full sm:w-56">
          <SearchableSelect
            options={[{ label: 'All Status', value: 'All' }, { label: 'Published', value: 'Published' }, { label: 'Pending Approval', value: 'Pending Approval' }, { label: 'Awarded', value: 'Awarded' }, { label: 'Expired', value: 'Expired' }]}
            value={statusFilter} onChange={(val) => { setCurrentPage(1); setStatusFilter(val); }} size="sm" searchable={false}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-2"><Loader2 className="w-7 h-7 animate-spin text-[#0d7676]" /><p className="text-xs font-semibold text-slate-600">Loading RFQ Directory...</p></div>
        ) : rfqs.length === 0 ? (
          <div className="py-20 px-4 flex flex-col items-center justify-center text-center space-y-2"><FileSpreadsheet className="w-10 h-10 text-slate-300 stroke-[1.5]" /><h3 className="text-xs font-bold text-slate-700">No RFQs found</h3><p className="text-[11px] text-slate-400 font-medium">Adjust filters or create a new RFQ.</p></div>
        ) : (
          <div className="overflow-x-auto table-scrollbar">
            <table className="rfq-table border-collapse text-left text-xs">
              <colgroup>
                <col className="w-11" /><col className="w-[120px]" /><col className="w-[110px]" />
                <col className="w-[380px]" /><col className="w-[175px]" /><col className="w-[175px]" />
                <col className="w-20" /><col className="w-[70px]" /><col className="w-[145px]" />
                <col className="w-[190px]" /><col className="w-[150px]" />
              </colgroup>
              <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2.5 px-2 w-7 text-center whitespace-nowrap">#</th>
                  <th className="py-2.5 px-2.5 w-28 whitespace-nowrap">RFQ Number</th>
                  <th className="py-2.5 px-2.5 w-24 whitespace-nowrap">Linked PO</th>
                  <th className="px-3 py-3 whitespace-nowrap">Shipper name</th>
                  <th className="py-2.5 px-2.5 w-32 whitespace-nowrap">POL</th>
                  <th className="py-2.5 px-2.5 w-32 whitespace-nowrap">POD</th>
                  <th className="py-2.5 px-2 text-center whitespace-nowrap">Ctr Type</th>
                  <th className="py-2.5 px-2 text-center whitespace-nowrap">Ctr Qty</th>
                  <th className="py-2.5 px-2.5 w-28 whitespace-nowrap">Closing Date</th>
                  <th className="py-2.5 px-2.5 w-28 whitespace-nowrap">Status</th>
                  <th className="py-2.5 px-2.5 w-24 text-right sticky right-0 bg-slate-100 font-extrabold text-slate-800 border-l border-slate-300 shadow-[-6px_0_12px_-2px_rgba(0,0,0,0.1)] z-20 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {displayedRfqs.map((rfq, idx) => {
                  const rowNum = startIndex + idx + 1;
                  const closingDateStr = formatDate(rfq.closingDate);
                  const containerType = rfq.cargoDetails?.containerType || rfq.cargoDetails?.cargoType || '—';
                  const containerCount = rfq.cargoDetails?.containerCount ?? '—';
                  const origin = rfq.cargoDetails?.portOfOrigin || '—';
                  const dest = rfq.cargoDetails?.portOfDestination || '—';
                  const targetRfqId = rfq.rfqId || rfq._id;
                  const normalizedStatus = String(rfq.status || '').toLowerCase();
                  const deadlineExpired = Boolean(rfq.closingDate && new Date(rfq.closingDate) < new Date());
                  const canReopenRfq = normalizedStatus === 'closed' || (normalizedStatus === 'published' && deadlineExpired);
                  const canCloseRfq = ['published', 'partially_awarded'].includes(normalizedStatus) && !deadlineExpired;
                  const isRfqAwarded = normalizedStatus.includes('award') || Number(rfq.allocatedQuantity || 0) > 0;
                  const canDeleteRfq = canDelete && !isRfqAwarded && !['awarded', 'partially_awarded', 'closed'].includes(normalizedStatus);

                  return (
                    <tr key={rfq._id || rfq.rfqId} onClick={() => navigate(`/admin/rfqs/${targetRfqId}`)} className="hover:bg-slate-50/80 transition cursor-pointer group">
                      <td className="px-2 py-3 text-center font-mono text-[11px] font-bold text-slate-400 whitespace-nowrap">{rowNum}</td>
                      <td className="px-2.5 py-3 font-mono text-xs font-bold text-[#0d7676] group-hover:underline whitespace-nowrap">{rfq.rfqNumber || '—'}</td>
                      <td className="px-2.5 py-3 font-mono text-xs font-bold text-slate-700 whitespace-nowrap">{rfq.sapPoNumber || rfq.poId || '—'}</td>
                      <td
                        className="px-3 py-3 font-bold text-slate-900 whitespace-nowrap truncate"
                        title={rfq.title}
                      >
                        {rfq.title}
                      </td>
                      <td className="px-2.5 py-3 text-xs font-medium text-slate-700 whitespace-nowrap">{origin}</td>
                      <td className="px-2.5 py-3 text-xs font-medium text-slate-700 whitespace-nowrap">{dest}</td>
                      <td className="px-2 py-3 text-center text-xs font-medium text-slate-700 whitespace-nowrap">{containerType}</td>
                      <td className="px-2 py-3 text-center text-xs font-bold text-slate-800 whitespace-nowrap">{containerCount}</td>
                      <td className="px-2.5 py-3 text-xs whitespace-nowrap">
                        <span className={`
    ${isRfqClosed(rfq)
                            ? 'text-red-600 font-semibold bg-red-50 px-1.5 py-0.5 rounded text-[10.5px]'
                            : 'text-slate-600'
                          }
  `}>
                          {closingDateStr}
                          {isRfqClosed(rfq) && (
                            <span className="ml-1 text-[10px] text-red-400">(Closed)</span>
                          )}
                        </span>
                      </td>
                      <td className="px-2.5 py-3 whitespace-nowrap">
                        {getStatusBadge(rfq)}
                      </td>
                      <td className="sticky right-0 z-10 border-l border-slate-200 bg-white px-2.5 py-2 text-right shadow-[-6px_0_12px_-2px_rgba(0,0,0,0.08)] group-hover:bg-slate-50 whitespace-nowrap">
                        <div
                          className="flex items-center justify-end gap-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* View Button */}
                          <ActionButton
                            onClick={() => navigate(`/admin/rfqs/${targetRfqId}`)}
                            icon={Eye}
                            label="View RFQ"
                            color="slate"
                          />

                          {/* Edit Button */}
                          {canEdit && !['pending_approval', 'awarded', 'closed', 'cancelled'].includes(String(rfq.status || '').toLowerCase()) && (
                            <ActionButton
                              onClick={() => navigate(`/admin/rfqs/${targetRfqId}/edit`)}
                              icon={Pencil}
                              label="Edit RFQ"
                              color="blue"
                            />
                          )}

                          {/* Copy Button */}
                          {canCreate && (
                            <ActionButton
                              onClick={(e) => handleCopy(rfq, e)}
                              icon={Copy}
                              label="Copy RFQ (Opens pre-filled form)"
                              color="emerald"
                            />
                          )}

                          {/* Close/Reopen Button */}
                          {canEdit && canReopenRfq && (
                            <ActionButton
                              onClick={(e) => handleOpenReopenModal(rfq, e)}
                              icon={RefreshCw}
                              label="Reopen Closed RFQ"
                              color="teal"
                              bordered
                            />
                          )}
                          {canEdit && canCloseRfq && (
                            <ActionButton
                              onClick={(e) => handleClose(rfq, e)}
                              icon={X}
                              label="Close RFQ"
                              color="rose"
                            />
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="pt-1">
        <ServerPagination
          page={currentPage}
          totalPages={totalPages}
          total={totalRfqs}
          pageSize={pageSize}
          itemLabel="RFQs"
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
        />
      </div>

      {/* REOPEN RFQ MODAL */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-[#0d7676]" />
                <h3 className="text-sm font-bold text-slate-900">Reopen RFQ {selectedRfqForReopen?.rfqNumber}</h3>
              </div>
              <button type="button" onClick={() => setShowReopenModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReopenSubmit} className="space-y-4">
              <p className="text-xs text-slate-600">
                Reopening this RFQ will set its status to <strong className="text-teal-700">Published</strong> and allow vendors to submit new quotations.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">New Closing Date <span className="text-rose-500">*</span></label>
                <input
                  type="date"
                  required
                  value={reopenClosingDate}
                  onChange={(e) => setReopenClosingDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-[#0d7676] focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowReopenModal(false)}>Cancel</Button>
                <Button type="submit" loading={submittingReopen}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Confirm Reopen</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
