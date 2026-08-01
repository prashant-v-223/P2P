import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Search, Loader2, Edit3, Trash2 } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';

export default function LogisticsProvidersView() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/p2p/logistics-providers');
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
      }
    } catch (e) {
      console.error('Error fetching logistics providers:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleDelete = async (p) => {
    const targetId = p.providerId || p._id || p.id;
    if (!window.confirm(`Are you sure you want to delete logistics provider "${p.name}"?`)) {
      return;
    }
    try {
      const res = await apiFetch(`/api/p2p/logistics-providers/${targetId}`, {
        method: 'DELETE'
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToast({ title: 'Deleted', description: 'Logistics provider deleted successfully.', type: 'success' });
        fetchProviders();
      } else {
        showToast({ title: 'Error', description: data.error || 'Failed to delete provider.', type: 'error' });
      }
    } catch (e) {
      showToast({ title: 'Error', description: e.message, type: 'error' });
    }
  };

  const filtered = providers.filter((p) => {
    const term = search.toLowerCase();
    const matchesSearch =
      p.name?.toLowerCase().includes(term) ||
      p.contactPerson?.toLowerCase().includes(term) ||
      p.phone?.toLowerCase().includes(term) ||
      p.email?.toLowerCase().includes(term) ||
      p.providerId?.toLowerCase().includes(term);

    const matchesStatus =
      statusFilter === 'All Status' ||
      (statusFilter === 'Active' && p.status === 'Active') ||
      (statusFilter === 'Inactive' && p.status === 'Inactive');

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="w-full space-y-4 font-sans pb-12">
      {/* Header Banner matching Screenshot 4 */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900 leading-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#0d7676]" /> Logistics Providers
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Manage the logistics parties used while raising transport payments.
          </p>
        </div>
        <button
          onClick={() => navigate('create')}
          className="flex items-center gap-2 bg-[#0d7676] hover:bg-[#0f766e] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all shrink-0"
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search provider, contact, phone..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
            />
          </div>

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
          >
            <option value="All Status">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
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
                {filtered.map((p, idx) => (
                  <tr key={p.providerId || p._id} className="hover:bg-slate-50/80 transition-colors">
                    {/* # */}
                    <td className="py-3.5 px-4 text-center font-mono text-slate-400 text-[11px] font-bold">
                      {idx + 1}
                    </td>

                    {/* PROVIDER */}
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900 leading-snug">{p.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{p.providerId}</p>
                    </td>

                    {/* CONTACT PERSON */}
                    <td className="py-3.5 px-4 text-slate-700 font-semibold">
                      {p.contactPerson || '—'}
                    </td>

                    {/* PHONE */}
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {p.phone || '—'}
                    </td>

                    {/* PAYMENTS */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-slate-100 rounded-full font-bold text-xs text-slate-700">
                        {p.paymentsCount || 0}
                      </span>
                    </td>

                    {/* STATUS */}
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                        p.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-red-50 text-red-600 border-red-200'
                      }`}>
                        {p.status || 'Active'}
                      </span>
                    </td>

                    {/* ACTIONS */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Edit Pencil */}
                        <button
                          onClick={() => navigate(`${p.providerId || p._id}/edit`)}
                          title="Edit Provider"
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Trash */}
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
        )}
      </div>
    </div>
  );
}
