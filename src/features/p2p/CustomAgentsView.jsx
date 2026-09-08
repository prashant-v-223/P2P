import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  Plus, 
  Search, 
  Loader2, 
  Edit3, 
  Pencil,
  Key, 
  Trash2, 
  ToggleLeft, 
  ToggleRight, 
  ExternalLink,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  KeyRound,
  ShieldCheck,
  X
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { ServerPagination } from '../../components/ui/server-pagination';
import { TableActionButton } from '../../components/ui/table-action-button';

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
  const [showPassword, setShowPassword] = useState(true);
  const [copied, setCopied] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

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
      const currentlyEnabled = agent.portalAccessEnabled !== false;
      const res = await apiFetch(`/api/custom-agents/${agent._id || agent.id}/portal-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentlyEnabled })
      });
      if (res.ok) {
        showToast({ title: 'Portal access updated', description: `Portal login is now ${!currentlyEnabled ? 'enabled' : 'disabled'}`, type: 'success' });
        fetchAgents();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast({ type: 'error', title: 'Portal access was not updated', description: data.error || 'Please try again.' });
      }
    } catch (err) {
      showToast({ type: 'error', title: 'Error toggling portal access' });
    }
  };

  const handleOpenResetModal = (agent) => {
    setResetModal(agent);
    setNewPass('');
    setShowPassword(true);
    setCopied(false);
    setStatusMsg('');
    setErrorMsg('');
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let rand = 'RyznCHA@';
    for (let i = 0; i < 6; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPass(rand);
    setShowPassword(true);
    setErrorMsg('');
    setStatusMsg('');
  };

  const handleCopyPassword = () => {
    if (!newPass) return;
    navigator.clipboard.writeText(newPass);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleResetPassword = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!resetModal) return;

    if (!newPass || newPass.trim().length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    try {
      setResetting(true);
      setErrorMsg('');
      setStatusMsg('');
      const targetId = resetModal.agentId || resetModal._id || resetModal.id;
      const res = await apiFetch(`/api/custom-agents/${targetId}/generate-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPass.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast({
          title: 'Password Updated',
          description: `Password updated successfully for ${resetModal.agencyName || resetModal.contactPerson || 'Custom Agent'}.`,
          type: 'success'
        });
        setStatusMsg('Password saved successfully! Credentials are active.');
        setTimeout(() => {
          setResetModal(null);
          setNewPass('');
          setStatusMsg('');
          fetchAgents();
        }, 1200);
      } else {
        const errorText = data.error || 'Failed to update password.';
        setErrorMsg(errorText);
        showToast({
          type: 'error',
          title: 'Password Reset Failed',
          description: errorText
        });
      }
    } catch (err) {
      console.error('Error resetting password:', err);
      setErrorMsg('Network error while resetting password.');
      showToast({ type: 'error', title: 'Error resetting password', description: err.message });
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

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Toggle Portal Status */}
                          <TableActionButton
                            onClick={() => handleTogglePortal(agent)}
                            title="Toggle Portal Access"
                            icon={agent.portalAccessEnabled !== false ? ToggleRight : ToggleLeft}
                            variant="reopen"
                          />

                          {/* Edit Pencil */}
                          <TableActionButton
                            onClick={() => navigate(`${agent.agentId || agent._id}/edit`)}
                            title="Edit Custom Agent"
                            icon={Pencil}
                            variant="edit"
                          />

                          {/* Key / Password Reset */}
                          <TableActionButton
                            onClick={() => handleOpenResetModal(agent)}
                            title="Generate Password"
                            icon={KeyRound}
                            variant="close"
                          />

                          {/* Delete Trash */}
                          <TableActionButton
                            onClick={() => handleDelete(agent)}
                            title="Delete Agent"
                            icon={Trash2}
                            variant="delete"
                          />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden font-sans">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-200/80 flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-tight">Reset Agent Password</h2>
                  <p className="text-xs text-slate-500 font-medium truncate max-w-[240px]">
                    {resetModal.agencyName || resetModal.contactPerson}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleResetPassword} className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs space-y-1">
                <div className="flex justify-between items-center text-slate-500">
                  <span>Account Email:</span>
                  <span className="font-bold font-mono text-slate-800">{resetModal.email}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>License / Agent ID:</span>
                  <span className="font-semibold text-slate-700">{resetModal.licenceNumber || resetModal.agentId || '—'}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">New Portal Password</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPass}
                      onChange={(e) => {
                        setNewPass(e.target.value);
                        setErrorMsg('');
                        setStatusMsg('');
                      }}
                      placeholder="Type or click Generate..."
                      className="w-full pr-10 pl-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#0d7676] focus:ring-2 focus:ring-teal-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="border border-teal-200 text-[#0d7676] bg-teal-50/60 hover:bg-teal-50 text-xs font-bold py-2.5 px-3 rounded-xl flex items-center gap-1.5 shrink-0 transition"
                    title="Auto-generate random secure password"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Generate</span>
                  </button>
                </div>
              </div>

              {/* Action Row: Copy */}
              {newPass && (
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <span className="text-[11px] text-slate-500">Share credentials with custom agent</span>
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="text-xs font-bold text-[#0d7676] hover:text-teal-800 flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy Password'}</span>
                  </button>
                </div>
              )}

              {/* Status and Error Messages */}
              {statusMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{statusMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
                  {errorMsg}
                </div>
              )}

              {/* Footer Actions */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResetModal(null)}
                  className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetting || !newPass.trim()}
                  className="px-5 py-2 bg-[#0d7676] hover:bg-[#0f766e] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
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
