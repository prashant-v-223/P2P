import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import { 
  FileSpreadsheet, FileCheck, Plus, Search, Eye, Pencil, Copy, Trash2, Loader2,
  ChevronLeft, ChevronRight, Box, MapPin
} from 'lucide-react';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { getRfqAllocationSummary } from './rfqStatus';

export default function RfqSourcingView() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchRfqs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        search: search,
        status: statusFilter === 'All' ? '' : statusFilter
      });
      const res = await apiFetch(`/api/p2p/rfqs?${params.toString()}`);
      const json = await res.json();
      if (res.ok && json.data) {
        setRfqs(json.data);
      } else throw new Error(json.error || 'Unable to load RFQs.');
    } catch (e) {
      showToast({ title: 'RFQ Load Failed', description: e.message, type: 'error' });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchRfqs(); }, [search, statusFilter]);

  const totalPages = Math.ceil(rfqs.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const displayedRfqs = rfqs.slice(startIndex, startIndex + pageSize);

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter]);

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
    if (!window.confirm('Are you sure you want to delete this RFQ record?')) return;
    const targetId = rfq?.rfqId || rfq?._id;
    if (!targetId) {
      showToast({ title: 'Delete Blocked', description: 'RFQ id is missing for this record.', type: 'error' });
      return;
    }
    try {
      const res = await apiFetch(`/api/p2p/rfqs/${targetId}`, { method: 'DELETE' });
      if (res.ok) {
        setRfqs(prev => prev.filter(r => r._id !== rfq?._id && r.rfqId !== rfq?.rfqId));
        showToast({ title: 'Success', description: 'RFQ deleted.', type: 'success' });
      } else {
        const json = await res.json();
        throw new Error(json.error || 'Unable to delete RFQ.');
      }
    } catch (err) { showToast({ title: 'Delete Blocked', description: err.message, type: 'error' }); }
  };

  const handleCopy = async (rfq, e) => {
    e.stopPropagation();
    try {
      const res = await apiFetch(`/api/p2p/rfqs/${rfq.rfqId}/copy`, { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success) {
        fetchRfqs();
        showToast({ title: 'Draft Copy Created', description: `${json.data.rfqNumber} created.`, type: 'success' });
      } else throw new Error(json.error || 'Unable to copy RFQ.');
    } catch (err) { showToast({ title: 'Copy Failed', description: err.message, type: 'error' }); }
  };

  return (
    <div className="w-full space-y-5 font-sans pb-12 antialiased text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">RFQ Management</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Create and manage Request for Quotations</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate('/admin/rfqs/create')} className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0d7676] hover:bg-[#085a5a] text-white font-bold text-xs rounded-xl shadow-xs transition uppercase tracking-wider cursor-pointer">
            <Plus className="w-4 h-4" /><span>Create RFQ</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search RFQ number, title..." className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white" />
        </div>
        <div className="w-44">
          <SearchableSelect
            options={[{ label: 'All Status', value: 'All' }, { label: 'Published', value: 'Published' }, { label: 'Pending Approval', value: 'Pending Approval' }, { label: 'Awarded', value: 'Awarded' }, { label: 'Expired', value: 'Expired' }]}
            value={statusFilter} onChange={(val) => setStatusFilter(val)} size="sm" searchable={false}
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 px-4 w-10 text-center">#</th>
                  <th className="py-3.5 px-4">RFQ Number</th>
                  <th className="py-3.5 px-4">Title / Cargo</th>
                  <th className="py-3.5 px-4">Linked PO</th>
                  <th className="py-3.5 px-4">Closing Date</th>
                  <th className="py-3.5 px-4 text-center">Vendors</th>
                  <th className="py-3.5 px-4 text-center">Quotes</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {displayedRfqs.map((rfq, idx) => {
                  const rowNum = startIndex + idx + 1;
                  const closingDateStr = formatDate(rfq.closingDate);
                  const vendorCount = rfq.invitedVendors?.length || 0;
                  const quoteCount = rfq.quotes?.length || 0;
                  const cargoType = rfq.cargoDetails?.cargoType || 'General';
                  const origin = rfq.cargoDetails?.portOfOrigin || '—';
                  const dest = rfq.cargoDetails?.portOfDestination || '—';

                  return (
                    <tr key={rfq._id} onClick={() => navigate(`/admin/rfqs/${rfq.rfqId}`)} className="hover:bg-slate-50/80 transition cursor-pointer group">
                      <td className="py-3.5 px-4 text-center font-mono text-slate-400 font-bold">{rowNum}</td>
                      <td className="py-3.5 px-4 font-bold text-[#0d7676] font-mono group-hover:underline">{rfq.rfqNumber || '—'}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 max-w-xs">
                        <div className="truncate">{rfq.title || 'Untitled'}</div>
                        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-400 truncate mt-0.5">
                          <span className="flex items-center gap-1"><Box className="w-3 h-3" />{rfq.cargoDetails?.containerCount || 0} ctrs</span>
                          <span className="text-slate-200">|</span>
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{origin} → {dest}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">{rfq.sapPoNumber || rfq.poId || '—'}</td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {closingDateStr}
                      </td>
                      <td className="py-3.5 px-4 text-center"><span className="w-6 h-6 rounded-full bg-sky-100 text-sky-800 text-[11px] font-extrabold inline-flex items-center justify-center">{vendorCount}</span></td>
                      <td className="py-3.5 px-4 text-center"><span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold inline-flex items-center justify-center">{quoteCount}</span></td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(rfq)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => navigate(`/admin/rfqs/${rfq.rfqId}`)} className="p-1.5 text-slate-400 hover:text-[#0d7676] hover:bg-teal-50 rounded-lg transition"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => navigate(`/admin/rfqs/${rfq.rfqId}/edit`)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"><Pencil className="w-4 h-4" /></button>
                          <button onClick={(e) => handleCopy(rfq, e)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"><Copy className="w-4 h-4" /></button>
                          <button onClick={(e) => handleDelete(rfq, e)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rfqs.length > pageSize && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50">
                <span className="text-[11px] text-slate-500 font-medium">Showing {startIndex + 1} to {Math.min(startIndex + pageSize, rfqs.length)} of {rfqs.length} RFQs</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition"><ChevronLeft className="w-4 h-4 text-slate-600" /></button>
                  <span className="text-[11px] font-bold text-slate-700 px-1">{currentPage} / {totalPages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition"><ChevronRight className="w-4 h-4 text-slate-600" /></button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
