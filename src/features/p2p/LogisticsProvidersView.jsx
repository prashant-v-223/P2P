import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Search, Loader2, Edit3, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { ServerPagination } from '../../components/ui/server-pagination';

export default function LogisticsProvidersView() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/p2p/logistics-providers');
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
      }
    } catch (err) {
      console.error('Error fetching logistics providers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleToggleStatus = async (provider) => {
    try {
      const nextStatus = provider.status === 'Active' ? 'Inactive' : 'Active';
      const id = provider._id || provider.id || provider.providerId;
      const res = await apiFetch(`/api/p2p/logistics-providers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        showToast({ title: 'Status updated', description: `Provider is now ${nextStatus}`, type: 'success' });
        fetchProviders();
      }
    } catch (err) {
      showToast({ type: 'error', title: 'Error updating status' });
    }
  };

  const handleDelete = async (provider) => {
    const id = provider._id || provider.id || provider.providerId;
    if (!window.confirm(`Are you sure you want to delete "${provider.name}"?`)) return;
    try {
      const res = await apiFetch(`/api/p2p/logistics-providers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast({ title: 'Provider deleted', type: 'success' });
        fetchProviders();
      }
    } catch (err) {
      showToast({ type: 'error', title: 'Error deleting provider' });
    }
  };

  const filtered = providers.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.contactPerson || '').toLowerCase().includes(q) ||
      (p.phone || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === 'All Status' ||
      (p.status || 'Active').toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-4 font-sans pb-12">
      {/* Top Header Card matching Screenshot 4 */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0d7676] flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight">Logistics Service Providers</h1>
              <span className="bg-teal-50 text-[#0d7676] font-bold text-[10px] px-2 py-0.5 rounded-full border border-teal-200">
                {providers.length} Registered
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Freight forwarders, shipping lines, transport agencies & port handling vendors
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('create')}
          className="flex items-center gap-2 bg-[#0d7676] hover:bg-[#0f766e] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Provider
        </button>
      </div>

      {/* Filter Toolbar matching Screenshot 4 */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search provider, contact, phone..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
            />
          </div>

          {/* Status Dropdown */}
          <div className="w-36">
            <SearchableSelect
              options={[
                { label: 'All Status', value: 'All Status' },
                { label: 'Active', value: 'Active' },
                { label: 'Inactive', value: 'Inactive' }
              ]}
              value={statusFilter}
              onChange={(val) => { setStatusFilter(val); setPage(1); }}
              size="sm"
              searchable={false}
            />
          </div>
        </div>

        <span className="text-xs font-bold text-slate-400">
          Showing {filtered.length} of {providers.length} providers
        </span>
      </div>

      {/* Table Section matching Screenshot 4 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 text-[#0d7676] animate-spin mr-2" />
            <span className="text-sm text-slate-500 font-semibold">Loading Logistics Providers...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-600">No logistics providers found</p>
            <p className="text-xs text-slate-400">Try adjusting search query or click Add Provider to create one.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-4 w-12 text-center">#</th>
                    <th className="py-3.5 px-4">PROVIDER</th>
                    <th className="py-3.5 px-4">CONTACT PERSON</th>
                    <th className="py-3.5 px-4">PHONE</th>
                    <th className="py-3.5 px-4 text-center">PAYMENTS</th>
                    <th className="py-3.5 px-4">STATUS</th>
                    <th className="py-3.5 px-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {paginated.map((p, idx) => (
                    <tr key={p.providerId || p._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-center font-mono text-slate-400 text-[11px] font-bold">
                        {(page - 1) * pageSize + idx + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs uppercase">
                            {(p.name || 'L')[0]}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{p.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{p.providerId || p.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">{p.contactPerson || '—'}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{p.phone || '—'}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center justify-center h-6 min-w-6 px-2 rounded-full bg-teal-50 text-[#0d7676] font-bold text-xs">
                          {p.paymentsCount || 0}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                          (p.status || 'Active') === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {p.status || 'Active'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleStatus(p)}
                            title="Toggle Status"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                          >
                            {(p.status || 'Active') === 'Active' ? (
                              <ToggleRight className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <ToggleLeft className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </button>
                          <button
                            onClick={() => navigate(`${p.providerId || p._id}/edit`)}
                            title="Edit Provider"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            title="Delete Provider"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ServerPagination
              page={page}
              totalPages={Math.ceil(filtered.length / pageSize) || 1}
              total={filtered.length}
              pageSize={pageSize}
              itemLabel="providers"
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </>
        )}
      </div>
    </div>
  );
}
