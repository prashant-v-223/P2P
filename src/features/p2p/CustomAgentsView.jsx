import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Plus, Search, Loader2, Edit3, Key, Trash2, ToggleLeft, ToggleRight, ExternalLink } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { ServerPagination } from '../../components/ui/server-pagination';

export default function CustomAgentsView() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Password reset modal state
  const [resetModal, setResetModal] = useState(null);
  const [newPass, setNewPass] = useState('');
  const [resetting, setResetting] = useState(false);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/custom-agents');
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } catch (err) {
      console.error('Error fetching custom agents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleToggleStatus = async (agent) => {
    try {
      const nextStatus = agent.status === 'Active' ? 'Inactive' : 'Active';
      const res = await apiFetch(`/api/custom-agents/${agent._id || agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        showToast({ title: 'Status updated', description: `Agent is now ${nextStatus}`, type: 'success' });
        fetchAgents();
      }
    } catch (err) {
      showToast({ type: 'error', title: 'Error updating status' });
    }
  };

  const handleTogglePortal = async (agent) => {
    try {
      const res = await apiFetch(`/api/custom-agents/${agent._id || agent.id}/portal-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !agent.portalEnabled })
      });
      if (res.ok) {
        showToast({ title: 'Portal access updated', description: `Portal login is now ${!agent.portalEnabled ? 'enabled' : 'disabled'}`, type: 'success' });
        fetchAgents();
      }
    } catch (err) {
      showToast({ type: 'error', title: 'Error toggling portal access' });
    }
  };

  const handleResetPassword = async () => {
    if (!resetModal) return;
    try {
      setResetting(true);
      const res = await apiFetch(`/api/custom-agents/${resetModal._id || resetModal.id}/generate-password`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.temporaryPassword) {
        setNewPass(data.temporaryPassword);
      } else {
        showToast({ type: 'error', title: 'Failed to reset password' });
      }
    } catch (err) {
      showToast({ type: 'error', title: 'Error resetting password' });
    } finally {
      setResetting(false);
    }
  };

  const handleDelete = async (agent) => {
    if (!window.confirm(`Are you sure you want to delete "${agent.agencyName || agent.contactPerson}"?`)) return;
    try {
      const res = await apiFetch(`/api/custom-agents/${agent._id || agent.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast({ title: 'Agent deleted', type: 'success' });
        fetchAgents();
      }
    } catch (err) {
      showToast({ type: 'error', title: 'Error deleting agent' });
    }
  };

  const filtered = agents.filter((a) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      (a.agencyName || '').toLowerCase().includes(q) ||
      (a.contactPerson || '').toLowerCase().includes(q) ||
      (a.email || '').toLowerCase().includes(q) ||
      (a.iecCode || '').toLowerCase().includes(q) ||
      (a.chaLicenseNo || '').toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === 'All Status' ||
      (a.status || 'Active').toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-4 font-sans pb-12">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0d7676] flex items-center justify-center font-bold">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight">Customs Clearing Agents Directory</h1>
              <span className="bg-teal-50 text-[#0d7676] font-bold text-[10px] px-2 py-0.5 rounded-full border border-teal-200">
                {agents.length} Total Registered
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Manage CHA licenses, IEC codes, portal security credentials & assigned Customs Duty clearance activities.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('create')}
          className="flex items-center gap-2 bg-[#0d7676] hover:bg-[#0f766e] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all shrink-0"
        >
          <Plus className="w-4 h-4" /> Add Agent
        </button>
      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search name, company, email, ..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
            />
          </div>

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
          Showing {filtered.length} of {agents.length} agents
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 text-[#0d7676] animate-spin mr-2" />
            <span className="text-sm text-slate-500 font-semibold">Loading Custom Agents...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <Shield className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-600">No Custom Agents found</p>
            <p className="text-xs text-slate-400">Try adjusting search query or click Add Agent to create one.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-4 w-12 text-center">#</th>
                    <th className="py-3.5 px-4">AGENT</th>
                    <th className="py-3.5 px-4">IEC CODE</th>
                    <th className="py-3.5 px-4">CHA LICENSE</th>
                    <th className="py-3.5 px-4 text-center">BLS</th>
                    <th className="py-3.5 px-4">STATUS</th>
                    <th className="py-3.5 px-4">PORTAL LOGIN</th>
                    <th className="py-3.5 px-4">ADDED</th>
                    <th className="py-3.5 px-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {paginated.map((agent, idx) => {
                    const name = agent.contactPerson || agent.agencyName || 'Custom Agent';
                    const company = agent.agencyName || agent.contactPerson;
                    const initial = name[0].toUpperCase();
                    const addedDate = agent.createdAt ? new Date(agent.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '01 Jul 2026';

                    return (
                      <tr key={agent.agentId || agent._id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 text-center font-mono text-slate-400 text-[11px] font-bold">
                          {(page - 1) * pageSize + idx + 1}
                        </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center text-xs shrink-0">
                            {initial}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-snug">{name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">
                              {company}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* IEC CODE */}
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        {agent.iecCode || '—'}
                      </td>

                      {/* CHA LICENSE */}
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        {agent.licenceNumber || '—'}
                      </td>

                      {/* BLS */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-slate-100 rounded-full font-bold text-xs text-slate-700">
                          {agent.assignedBlCount || 0}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                          agent.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-red-50 text-red-600 border-red-200'
                        }`}>
                          {agent.status || 'Active'}
                        </span>
                      </td>

                      {/* PORTAL LOGIN */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                          agent.portalAccessEnabled !== false
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-red-50 text-red-600 border-red-200'
                        }`}>
                          {agent.portalAccessEnabled !== false ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>

                      {/* ADDED */}
                      <td className="py-3.5 px-4 text-slate-400 font-medium text-[11px]">
                        {addedDate}
                      </td>

                      {/* ACTIONS matching Screenshot 1 */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Toggle Portal Status */}
                          <button
                            onClick={() => handleTogglePortal(agent)}
                            title="Toggle Portal Access"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                          >
                            {agent.portalAccessEnabled !== false ? (
                              <ToggleRight className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <ToggleLeft className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </button>

                          {/* Edit Pencil */}
                          <button
                            onClick={() => navigate(`${agent.agentId || agent._id}/edit`)}
                            title="Edit Custom Agent"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Key / Password Reset */}
                          <button
                            onClick={() => setResetModal(agent)}
                            title="Reset Password"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-amber-600 hover:text-amber-800 transition-colors"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Trash */}
                          <button
                            onClick={() => handleDelete(agent)}
                            title="Delete Agent"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ServerPagination
            page={page}
            totalPages={Math.ceil(filtered.length / pageSize) || 1}
            total={filtered.length}
            pageSize={pageSize}
            itemLabel="custom agents"
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        </>
        )}
      </div>

      {/* Password Reset Modal */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xl w-full max-w-md space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-600" /> Reset Password for {resetModal.agencyName || resetModal.contactPerson}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Enter a new portal login password for account <span className="font-bold text-slate-800">{resetModal.email}</span>.
            </p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New Password</label>
                <input
                  type="text"
                  required
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Enter new password (min 6 chars)"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setResetModal(null)}
                  className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="px-4 py-2 bg-[#0d7676] hover:bg-[#0f766e] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
                >
                  {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
