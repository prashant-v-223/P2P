import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { 
  FileSpreadsheet, 
  Plus, 
  Search, 
  Eye, 
  Pencil, 
  Copy, 
  Trash2, 
  Loader2,
  Calendar,
  PackageCheck,
  Ship,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function RfqSourcingView() {
  const navigate = useNavigate();
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const fetchRfqs = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/p2p/rfqs?search=${encodeURIComponent(search)}&status=${encodeURIComponent(statusFilter)}`);
      const json = await res.json();
      if (res.ok && json.data) {
        setRfqs(json.data);
      }
    } catch (e) {
      console.error('Fetch RFQs error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRfqs();
  }, [search, statusFilter]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this RFQ record from MongoDB?')) return;
    try {
      const res = await apiFetch(`/api/p2p/rfqs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRfqs(prev => prev.filter(r => r.rfqId !== id && r._id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopy = async (rfq, e) => {
    e.stopPropagation();
    try {
      const res = await apiFetch(`/api/p2p/rfqs/${rfq.rfqId}/copy`, { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success) {
        fetchRfqs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="w-full space-y-5 font-sans pb-12 antialiased text-left">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">RFQ Management</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Create and manage Request for Quotations — Invite vendors and compare quotes
          </p>
        </div>

        <button
          onClick={() => navigate('/admin/rfqs/create')}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold text-xs rounded-xl shadow-xs transition uppercase tracking-wider self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create RFQ</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search RFQ number, title..."
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d7676] cursor-pointer"
          >
            <option value="All">All Status</option>
            <option value="Published">Published</option>
            <option value="Pending Approval">Pending Approval</option>
            <option value="Awarded">Awarded</option>
            <option value="Expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Main Table Matching Screenshot 1 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-2">
            <Loader2 className="w-7 h-7 animate-spin text-[#0d7676]" />
            <p className="text-xs font-semibold text-slate-600">Loading RFQ Directory...</p>
          </div>
        ) : rfqs.length === 0 ? (
          <div className="py-20 px-4 flex flex-col items-center justify-center text-center space-y-2">
            <FileSpreadsheet className="w-10 h-10 text-slate-300 stroke-[1.5]" />
            <h3 className="text-xs font-bold text-slate-700">No RFQs found</h3>
            <p className="text-[11px] text-slate-400 font-medium">Create a new freight sourcing RFQ to invite forwarders.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 px-4 w-10 text-center">#</th>
                  <th className="py-3.5 px-4">RFQ NUMBER</th>
                  <th className="py-3.5 px-4">TITLE</th>
                  <th className="py-3.5 px-4">LINKED PO</th>
                  <th className="py-3.5 px-4">CLOSING DATE</th>
                  <th className="py-3.5 px-4 text-center">VENDORS</th>
                  <th className="py-3.5 px-4 text-center">QUOTES</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {rfqs.map((rfq, idx) => {
                  const statusKey = (rfq.status || '').toLowerCase();
                  return (
                    <tr
                      key={rfq.rfqId}
                      onClick={() => navigate(`/admin/rfqs/${rfq.rfqId}`)}
                      className="hover:bg-slate-50/80 transition cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-3.5 px-4 font-bold text-[#0d7676] font-mono group-hover:underline">{rfq.rfqNumber}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 max-w-xs truncate">
                        {rfq.title}
                        {rfq.cargoDetails?.cargoType && (
                          <span className="block text-[10px] font-semibold text-slate-400">
                            {rfq.cargoDetails.cargoType} • {rfq.cargoDetails.containerCount || 1} containers
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">{rfq.poId || rfq.sapPoNumber || '4700000251'}</td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {rfq.closingDateFormatted || '31 Jul 2026'}
                        <span className="block text-[10px] text-slate-400 font-normal">Expired</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-800 text-[11px] font-extrabold inline-flex items-center justify-center">
                          {rfq.invitedVendorsCount || 12}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold inline-flex items-center justify-center">
                          {rfq.quotesCount || 8}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block border ${
                            statusKey === 'published'
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : statusKey === 'awarded'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : statusKey === 'pending_approval'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {statusKey === 'pending_approval' ? 'Pending Approval' : statusKey.charAt(0).toUpperCase() + statusKey.slice(1)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            title="View RFQ"
                            onClick={() => navigate(`/admin/rfqs/${rfq.rfqId}`)}
                            className="p-1.5 text-slate-400 hover:text-[#0d7676] hover:bg-teal-50 rounded-lg transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            title="Edit RFQ"
                            onClick={() => navigate(`/admin/rfqs/${rfq.rfqId}/edit`)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            title="Copy RFQ"
                            onClick={(e) => handleCopy(rfq, e)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            title="Delete RFQ"
                            onClick={(e) => handleDelete(rfq.rfqId, e)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
    </div>
  );
}
