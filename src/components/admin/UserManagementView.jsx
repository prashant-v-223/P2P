import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  UserPlus, Search, Shield, CheckCircle2, Loader2, X,
  XCircle, Users, AlertCircle, Pencil, Trash2, ShieldAlert, GitBranch, ChevronDown, ChevronRight, List, Network, RefreshCw
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { SearchableSelect } from '../ui/searchable-select';
import { FieldError } from '../ui/field-error';
import { useToast } from '../ui/toast';
import { ServerPagination } from '../ui/server-pagination';
import { userHasPermission } from '../../lib/permissions';

// ── Hierarchy Node Component ──────────────────────────────────────────────────
function HierarchyNode({ user, canEditUser, onEdit, level = 0 }) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasReports = user.reports?.length > 0;

  return (
    <li className="relative">
      {/* Tree line connector */}
      {level > 0 && (
        <div className="absolute left-0 top-0 h-full w-6">
          <div className="absolute left-[11px] top-0 h-[26px] w-[1px] bg-slate-200"></div>
          <div className="absolute left-[11px] top-[26px] h-[calc(100%-26px)] w-[1px] bg-slate-200"></div>
          <div className="absolute left-[11px] top-[26px] h-[1px] w-3 bg-slate-200"></div>
        </div>
      )}
      
      <div className={`relative group rounded-lg transition-all duration-200 ${level > 0 ? 'ml-6' : ''}`}>
        <div className="flex items-start gap-2 py-1.5">
          <span className="mt-3 w-5 shrink-0">
            {hasReports && (
              <button 
                type="button" 
                onClick={() => setExpanded((value) => !value)} 
                className="rounded p-0.5 text-slate-500 hover:bg-slate-100" 
                aria-label={`${expanded ? 'Collapse' : 'Expand'} ${user.name}'s reports`}
              >
                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            )}
          </span>
          
          <div className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-2.5 py-2 shadow-2xs ${
            user.status === 'Active' 
              ? 'border-slate-200 bg-white' 
              : 'border-rose-100 bg-rose-50/50 opacity-60'
          }`}>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              user.status === 'Active' ? 'bg-teal-100 text-teal-700' : 'bg-slate-200 text-slate-500'
            }`}>
              {user.avatar}
            </span>
            
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-bold text-slate-800">{user.name}</span>
              <span className="block truncate text-[10px] text-slate-500">{user.role} · {user.department}</span>
            </span>
            
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
              user.status === 'Active' 
                ? 'bg-emerald-50 text-emerald-700' 
                : 'bg-slate-100 text-slate-500'
            }`}>
              {user.status}
            </span>
            
            {hasReports && (
              <span className="hidden rounded bg-teal-50 px-1.5 py-0.5 text-[9px] font-bold text-teal-700 sm:inline">
                {user.reports.length} report{user.reports.length === 1 ? '' : 's'}
              </span>
            )}
            
            {canEditUser && (
              <button 
                type="button" 
                onClick={() => onEdit(user)} 
                className="rounded p-1 text-slate-400 hover:bg-teal-50 hover:text-teal-700" 
                title={`Edit ${user.name}`} 
                aria-label={`Edit ${user.name}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        
        {hasReports && expanded && (
          <ul className="ml-4 border-l border-slate-200 pl-3">
            {user.reports.map((report) => (
              <HierarchyNode 
                key={report.id} 
                user={report} 
                level={level + 1}
                canEditUser={canEditUser} 
                onEdit={onEdit} 
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

// ── Edit User Modal ──────────────────────────────────────────────────────────
function EditUserModal({ user, roleOptions, allUsers, onClose, onSaved }) {
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [role, setRole] = useState(user.role || 'procurement');
  const [department, setDepartment] = useState(user.department || 'Procurement');
  const [status, setStatus] = useState(user.status || 'Active');
  const [managerId, setManagerId] = useState(user.managerId || '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const { showToast } = useToast();

  const handleUpdate = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (name.trim().length < 2) nextErrors.name = 'Enter at least 2 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Enter a valid email.';
    if (password && password.length < 8) nextErrors.password = 'Password must be at least 8 characters.';
    if (!role) nextErrors.role = 'Select a system role.';
    if (!department) nextErrors.department = 'Select a department.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      setSaving(true);
      const payload = { 
        name: name.trim(), 
        email: email.trim(), 
        role, 
        department, 
        status, 
        managerId: managerId || null 
      };
      if (password) payload.password = password;

      const res = await apiFetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user.');
      showToast({ title: 'User updated', description: `${name.trim()}'s profile was updated.` });
      onSaved();
    } catch (err) {
      showToast({ type: 'error', title: 'Update failed', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <section className="modal-panel max-w-lg">
        <header className="modal-header">
          <div className="flex items-center gap-3">
            <span className="section-icon bg-teal-50 text-teal-700"><Pencil className="h-4 w-4" /></span>
            <div>
              <h3 className="text-sm font-bold text-slate-950">Edit User Account</h3>
              <p className="mt-0.5 text-xs text-slate-500">Update profile details, assigned role, and status for {user.name}.</p>
            </div>
          </div>
          <button type="button" disabled={saving} onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </header>

        <form noValidate onSubmit={handleUpdate} className="modal-body max-h-[calc(100dvh-5.5rem)] overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name <span className="text-rose-500">*</span></label>
            <input 
              type="text" 
              required 
              value={name} 
              onChange={(e) => { setName(e.target.value); setErrors({ ...errors, name: '' }); }} 
              className={`w-full text-sm p-2.5 rounded-lg border ${errors.name ? 'border-rose-400' : 'border-slate-300'}`} 
            />
            <FieldError>{errors.name}</FieldError>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Official Email <span className="text-rose-500">*</span></label>
            <input 
              type="email" 
              required 
              value={email} 
              onChange={(e) => { setEmail(e.target.value); setErrors({ ...errors, email: '' }); }} 
              className={`w-full text-sm p-2.5 rounded-lg border ${errors.email ? 'border-rose-400' : 'border-slate-300'}`} 
            />
            <FieldError>{errors.email}</FieldError>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">System Role <span className="text-rose-500">*</span></label>
              <SearchableSelect 
                value={role} 
                onChange={(value) => { setRole(value); setErrors({ ...errors, role: '' }); }} 
                error={errors.role} 
                options={roleOptions} 
                searchPlaceholder="Search roles..." 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department <span className="text-rose-500">*</span></label>
              <SearchableSelect 
                value={department} 
                onChange={(value) => { setDepartment(value); setErrors({ ...errors, department: '' }); }} 
                error={errors.department} 
                options={['Procurement', 'Finance & Accounts', 'EXIM & Logistics', 'Supply Chain', 'IT Operations', 'Executive Management', 'Accounts & Finance']} 
                searchPlaceholder="Search departments..." 
              />
            </div>
          </div>

          <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3 space-y-3">
            <p className="text-xs font-bold text-teal-900">Organisation hierarchy</p>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reports to</label>
            <SearchableSelect 
              value={managerId} 
              onChange={setManagerId} 
              options={[
                { label: 'No manager (system-managed role)', value: '' },
                ...allUsers
                  .filter((item) => item.id !== user.id && item.status === 'Active')
                  .map((item) => ({ label: `${item.name} — ${item.role}`, value: item.id }))
              ]} 
              searchable 
            />
            <p className="text-[11px] text-teal-800">Level, visibility, and approval scope are assigned automatically from the selected role and reporting manager.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Account Status</label>
              <SearchableSelect
                options={['Active', 'Inactive']}
                value={status}
                onChange={(val) => setStatus(val)}
                size="md"
                searchable={false}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reset Password <span className="font-normal text-slate-400">(optional)</span></label>
              <input 
                type="password" 
                placeholder="Leave blank to keep current" 
                value={password} 
                onChange={(e) => { setPassword(e.target.value); setErrors({ ...errors, password: '' }); }} 
                className={`w-full text-sm p-2.5 rounded-lg border ${errors.password ? 'border-rose-400' : 'border-slate-300'}`} 
              />
              <FieldError>{errors.password}</FieldError>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0d7676] hover:bg-[#0a5c5c] rounded-lg disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

// ── Delete User Confirmation Modal ──────────────────────────────────────────
function DeleteUserModal({ user, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const { showToast } = useToast();

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/users/${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user.');
      showToast({ title: 'User deleted', description: `${user.name} was removed from the directory.` });
      onDeleted();
    } catch (err) {
      showToast({ type: 'error', title: 'Delete failed', description: err.message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !deleting && onClose()}>
      <section className="modal-panel max-w-md">
        <header className="modal-header">
          <div className="flex items-center gap-3">
            <span className="section-icon bg-rose-50 text-rose-600"><Trash2 className="h-4 w-4" /></span>
            <div>
              <h3 className="text-sm font-bold text-slate-950">Delete User Account</h3>
              <p className="mt-0.5 text-xs text-slate-500">Confirm permanent account deletion.</p>
            </div>
          </div>
          <button type="button" disabled={deleting} onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="modal-body space-y-4">
          <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-700">
            Are you sure you want to permanently delete <strong>{user.name}</strong> ({user.email})? This action cannot be undone.
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} disabled={deleting} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="button" onClick={handleDelete} disabled={deleting} className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Delete User</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Main UserManagementView Component ──────────────────────────────────────
export default function UserManagementView() {
  const currentUser = useSelector((state) => state.auth?.user);
  const [usersList, setUsersList] = useState([]);
  const [hierarchyUsers, setHierarchyUsers] = useState([]);
  const [hierarchyTree, setHierarchyTree] = useState([]);
  const [viewMode, setViewMode] = useState('table');
  const [roleOptions, setRoleOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [pagination, setPagination] = useState({ total: 0, page: 1, size: 10, totalPages: 1 });
  const [stats, setStats] = useState({ activeUsers: 0, inactiveUsers: 0, totalUsers: 0 });
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editUserModal, setEditUserModal] = useState(null);
  const [deleteUserModal, setDeleteUserModal] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('procurement');
  const [department, setDepartment] = useState('Procurement');
  const [managerId, setManagerId] = useState('');
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [resettingDb, setResettingDb] = useState(false);
  const [errors, setErrors] = useState({});
  const { showToast } = useToast();

  const handleResetDatabase = async () => {
    if (!window.confirm('Are you sure you want to drop current data and reseed fresh user hierarchy (Admin, MD, CFO, Purchase Head, Purchase Manager, Inner Team)?')) {
      return;
    }
    setResettingDb(true);
    try {
      const res = await apiFetch('/api/users/reset-database', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Database reset failed.');
      showToast({ title: 'Database Reset & Reseeded', description: 'Fresh user hierarchy and seed records loaded.' });
      fetchUsers();
    } catch (err) {
      showToast({ type: 'error', title: 'Reset Failed', description: err.message });
    } finally {
      setResettingDb(false);
    }
  };

  const currentPerms = currentUser?.permissions;
  const canManageUsers = userHasPermission(currentUser?.role, 'users.manage', currentPerms);
  const canCreateUser = canManageUsers || userHasPermission(currentUser?.role, 'users.create', currentPerms);
  const canEditUser = canManageUsers || userHasPermission(currentUser?.role, 'users.edit', currentPerms);
  const canDeleteUser = canManageUsers || userHasPermission(currentUser?.role, 'users.delete', currentPerms);
  const search = searchParams.get('q') || '';
  const statusFilter = searchParams.get('status') || 'All';
  const sort = searchParams.get('sort') || 'newest';
  const pageSize = Math.max(1, Number(searchParams.get('size')) || 10);

  const updateFilters = (updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === 'All' || (key === 'page' && Number(value) === 1)) next.delete(key);
      else next.set(key, String(value));
    });
    if (!Object.prototype.hasOwnProperty.call(updates, 'page')) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes, hierarchyRes] = await Promise.all([
        apiFetch(`/api/users?${searchParams.toString()}`),
        apiFetch('/api/roles?size=100'),
        apiFetch('/api/users/hierarchy')
      ]);
      if (!usersRes.ok) throw new Error('Unable to load users.');
      const usersData = await usersRes.json();
      setUsersList(usersData.users || []);
      setPagination({
        total: usersData.total || 0,
        page: usersData.page || 1,
        size: usersData.size || pageSize,
        totalPages: usersData.totalPages || 1
      });
      setStats(usersData.stats || { activeUsers: 0, inactiveUsers: 0, totalUsers: usersData.total || 0 });
      if (hierarchyRes.ok) {
        const hierarchyData = await hierarchyRes.json();
        setHierarchyUsers(hierarchyData.users || []);
        setHierarchyTree(hierarchyData.tree || []);
      }
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        const activeRoles = (rolesData.roles || []).filter((item) => item.status !== 'Inactive').map((item) => item.roleName);
        setRoleOptions(activeRoles);
        if (activeRoles.length && !activeRoles.includes(role)) setRole(activeRoles[0]);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [searchParams]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (name.trim().length < 2) nextErrors.name = 'Enter at least 2 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Enter a valid email.';
    if (password.length < 8) nextErrors.password = 'Use at least 8 characters.';
    if (!role) nextErrors.role = 'Select a system role.';
    if (!department) nextErrors.department = 'Select a department.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      showToast({ type: 'error', title: 'Check user details', description: 'Correct the highlighted fields before provisioning.' });
      return;
    }
    try {
      setSubmitting(true);
      const res = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role, department, managerId: managerId || null })
      });
      const data = await res.json();
      if (res.ok) {
        setIsAddUserOpen(false);
        setName(''); setEmail(''); setPassword(''); setManagerId('');
        fetchUsers();
        showToast({ title: 'User provisioned', description: `${name.trim()} can now sign in.` });
      } else {
        throw new Error(data.error || 'Unable to create user.');
      }
    } catch (err) {
      showToast({ type: 'error', title: 'User was not created', description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusToggle = async (user) => {
    const nextStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    setStatusUpdatingId(user.id);
    try {
      const res = await apiFetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to update account status.');
      showToast({ title: `Account ${nextStatus.toLowerCase()}`, description: `${user.name} is now ${nextStatus.toLowerCase()}.` });
      fetchUsers();
    } catch (err) {
      showToast({ type: 'error', title: 'Status was not updated', description: err.message });
    } finally {
      setStatusUpdatingId(null);
    }
  };

  // Calculate active reports for each manager
  const activeReportCounts = hierarchyUsers.reduce((counts, user) => {
    if (user.status === 'Active' && user.managerId) {
      counts[user.managerId] = (counts[user.managerId] || 0) + 1;
    }
    return counts;
  }, {});

  const managerCount = Object.keys(activeReportCounts).length;
  const topLevelCount = hierarchyTree.length;

  // Stat cards
  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
    { label: 'Active', value: stats.activeUsers, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { label: 'Inactive', value: stats.inactiveUsers, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
    { label: 'Managers', value: managerCount, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  ];

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] min-h-0 w-full flex-col gap-4 overflow-hidden pb-4 font-sans">

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} px-4 py-3 flex items-center justify-between`}>
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{s.label}</p>
              <p className={`text-2xl font-extrabold mt-0.5 ${s.color}`}>{s.value}</p>
            </div>
            <Users className={`h-5 w-5 opacity-40 ${s.color}`} />
          </div>
        ))}
      </div>

      {/* View Toggle */}
      <section className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2 shadow-2xs">
        <div className="inline-flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="User directory view">
          <button 
            type="button" 
            role="tab" 
            aria-selected={viewMode === 'table'} 
            onClick={() => setViewMode('table')} 
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold transition ${
              viewMode === 'table' 
                ? 'bg-white text-teal-700 shadow-2xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            User table
          </button>
          <button 
            type="button" 
            role="tab" 
            aria-selected={viewMode === 'hierarchy'} 
            onClick={() => setViewMode('hierarchy')} 
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold transition ${
              viewMode === 'hierarchy' 
                ? 'bg-white text-teal-700 shadow-2xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Network className="h-3.5 w-3.5" />
            Organisation hierarchy
          </button>
        </div>
        <span className="hidden text-[10px] font-medium text-slate-400 sm:block">
          {viewMode === 'table' ? 'Search, filter, and manage user accounts' : 'Review reporting lines and manage each user'}
        </span>
      </section>

      {/* Controls Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        {viewMode === 'table' && (
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto flex-1">
            <div className="relative min-w-[240px] flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search user by name, email or role..."
                value={search}
                onChange={(e) => updateFilters({ q: e.target.value })}
                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-[#0d7676] focus:outline-none"
              />
            </div>
            <div className="w-36">
              <SearchableSelect
                options={[
                  { label: 'All statuses', value: 'All' },
                  { label: 'Active', value: 'Active' },
                  { label: 'Inactive', value: 'Inactive' }
                ]}
                value={statusFilter}
                onChange={(val) => updateFilters({ status: val })}
                size="sm"
                searchable={false}
              />
            </div>
            <div className="w-36">
              <SearchableSelect
                options={[
                  { label: 'Newest first', value: 'newest' },
                  { label: 'Oldest first', value: 'oldest' },
                  { label: 'Name A–Z', value: 'name' }
                ]}
                value={sort}
                onChange={(val) => updateFilters({ sort: val })}
                size="sm"
                searchable={false}
              />
            </div>
            <div className="w-32">
              <SearchableSelect
                options={[
                  { label: '10 per page', value: 10 },
                  { label: '20 per page', value: 20 },
                  { label: '50 per page', value: 50 },
                  { label: '100 per page', value: 100 }
                ]}
                value={pageSize}
                onChange={(val) => updateFilters({ size: val })}
                size="sm"
                searchable={false}
              />
            </div>
          </div>
        )}
        
        {viewMode === 'hierarchy' && (
          <div className="flex min-w-0 items-center gap-3">
            <span className="section-icon hidden bg-teal-50 text-teal-700 sm:inline-flex">
              <GitBranch className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-bold text-slate-900">Hierarchy management</p>
              <p className="text-[10px] text-slate-500">Edit a user to update their reporting manager.</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          {canCreateUser ? (
            <button
              onClick={() => setIsAddUserOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#0d7676] rounded-lg hover:bg-[#0a5c5c] transition shadow-xs"
            >
              <UserPlus className="w-4 h-4" />
              Provision New User
            </button>
          ) : (
            <button
              disabled
              title="You do not have permission to provision new users."
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-400 bg-slate-100 border border-slate-200 rounded-lg cursor-not-allowed"
            >
              <ShieldAlert className="w-4 h-4 text-slate-400" />
              Provisioning Restricted
            </button>
          )}
        </div>
      </div>

      {/* Permission Warning */}
      {!canManageUsers && !canCreateUser && !canEditUser && !canDeleteUser && (
        <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-800 font-medium shadow-2xs">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>Viewing User Directory in <strong>Read-Only Mode</strong>. Administrative actions require <strong>users.manage</strong> permission.</span>
        </div>
      )}

      {/* Main Content */}
      <div className="surface-card flex min-h-0 flex-1 flex-col border border-slate-200 rounded-xl bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#0d7676]" />
            <span>Loading user directory...</span>
          </div>
        ) : viewMode === 'hierarchy' ? (
          <div className="report-scroll min-h-0 flex-1 overflow-auto p-4">
            <div className="mx-auto grid w-full max-w-7xl gap-4 xl:grid-cols-[minmax(0,1fr)_270px]">
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                {hierarchyTree.length > 0 ? (
                  <ul className="space-y-1">
                    {hierarchyTree.map((user) => (
                      <HierarchyNode 
                        key={user.id} 
                        user={user} 
                        canEditUser={canEditUser} 
                        onEdit={setEditUserModal} 
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="py-12 text-center text-xs text-slate-400">No hierarchy data available.</p>
                )}
              </section>
              
              <aside className="h-fit space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs xl:sticky xl:top-4">
                <div>
                  <p className="text-xs font-bold text-slate-900">Hierarchy overview</p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">
                    Keep managers active and assign each team member to the right reporting line.
                  </p>
                </div>
                
                <div className="grid grid-cols-3 gap-2 xl:grid-cols-1">
                  <div className="rounded-lg border border-teal-100 bg-teal-50 p-2.5">
                    <p className="text-[10px] font-semibold uppercase text-teal-700">People</p>
                    <p className="mt-1 text-xl font-extrabold text-teal-800">{stats.totalUsers}</p>
                  </div>
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-2.5">
                    <p className="text-[10px] font-semibold uppercase text-blue-700">Managers</p>
                    <p className="mt-1 text-xl font-extrabold text-blue-800">{managerCount}</p>
                  </div>
                  <div className="rounded-lg border border-amber-100 bg-amber-50 p-2.5">
                    <p className="text-[10px] font-semibold uppercase text-amber-700">Top level</p>
                    <p className="mt-1 text-xl font-extrabold text-amber-800">{topLevelCount}</p>
                  </div>
                </div>
                
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Management tip</p>
                  <p className="mt-1.5 text-[11px] leading-5 text-slate-600">
                    Before deactivating a manager, reassign their active direct reports through the edit form.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        ) : (
          <div className="report-scroll min-h-0 flex-1 overflow-auto">
            <table className="data-table w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">#</th>
                  <th className="py-3.5 px-4">USER</th>
                  <th className="py-3.5 px-4">EMAIL</th>
                  <th className="py-3.5 px-4">ASSIGNED ROLE</th>
                  <th className="py-3.5 px-4">DEPARTMENT</th>
                  <th className="py-3.5 px-4">HIERARCHY</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {usersList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-slate-400">No users found.</td>
                  </tr>
                ) : usersList.map((usr, index) => (
                  <tr key={usr.id} className="hover:bg-teal-50/20 transition">
                    <td className="w-12 font-semibold tabular-nums text-slate-400 px-4 py-3">
                      {(pagination.page - 1) * pagination.size + index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center border shadow-2xs ${
                          usr.status === 'Active' 
                            ? 'bg-teal-100 text-[#0d7676] border-teal-200' 
                            : 'bg-slate-200 text-slate-500 border-slate-300'
                        }`}>
                          {usr.avatar}
                        </div>
                        <span className="font-bold text-slate-900">{usr.name}</span>
                      </div>
                    </td>
                    <td className="text-slate-600 font-mono px-4 py-3">{usr.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        <Shield className="w-3 h-3 text-[#0d7676]" />
                        {usr.role}
                      </span>
                    </td>
                    <td className="text-slate-500 font-medium px-4 py-3">{usr.department}</td>
                    <td className="px-4 py-3">
                      <div className="text-[11px] text-slate-600">
                        <span className="font-bold">Level {usr.hierarchyLevel ?? '—'}</span>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          {usr.managerName ? `Reports to ${usr.managerName}` : 'Top-level user'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {canEditUser ? (() => {
                        const hasActiveReports = Boolean(activeReportCounts[usr.id]);
                        const isCurrentUser = currentUser?.id === usr.id;
                        const disabled = statusUpdatingId === usr.id || (usr.status === 'Active' && (hasActiveReports || isCurrentUser));
                        const title = hasActiveReports 
                          ? 'Reassign or deactivate direct reports before deactivating this manager.' 
                          : isCurrentUser 
                            ? 'You cannot deactivate your own account.' 
                            : `Set account to ${usr.status === 'Active' ? 'inactive' : 'active'}`;
                        return (
                          <button 
                            type="button" 
                            role="switch" 
                            aria-checked={usr.status === 'Active'} 
                            disabled={disabled} 
                            title={title} 
                            onClick={() => handleStatusToggle(usr)} 
                            className="inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <span className={`relative h-5 w-9 rounded-full transition ${usr.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${usr.status === 'Active' ? 'left-[18px]' : 'left-0.5'}`} />
                            </span>
                            <span className={`text-[10px] font-bold ${usr.status === 'Active' ? 'text-emerald-700' : 'text-slate-500'}`}>
                              {statusUpdatingId === usr.id ? 'Saving...' : usr.status}
                            </span>
                          </button>
                        );
                      })() : (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          usr.status === 'Active' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-rose-50 text-rose-600 border-rose-200'
                        }`}>
                          {usr.status === 'Active' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {usr.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canEditUser && (
                          <button
                            onClick={() => setEditUserModal(usr)}
                            title="Edit user details"
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg border border-slate-200 transition"
                          >
                            <Pencil className="w-3 h-3 text-teal-600" />
                            Edit
                          </button>
                        )}

                        {canDeleteUser && (
                          <button
                            onClick={() => setDeleteUserModal(usr)}
                            title="Delete user account"
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-slate-200 transition"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        )}

                        {!canEditUser && !canDeleteUser && (
                          <span className="text-[11px] text-slate-400 italic">Read-only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {viewMode === 'table' && (
        <ServerPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          pageSize={pagination.size}
          itemLabel="users"
          onPageChange={(nextPage) => updateFilters({ page: nextPage })}
        />
      )}

      {/* Edit User Modal */}
      {editUserModal && createPortal(
        <EditUserModal
          user={editUserModal}
          roleOptions={roleOptions}
          allUsers={hierarchyUsers}
          onClose={() => setEditUserModal(null)}
          onSaved={() => { setEditUserModal(null); fetchUsers(); }}
        />,
        document.body
      )}

      {/* Delete User Modal */}
      {deleteUserModal && createPortal(
        <DeleteUserModal
          user={deleteUserModal}
          onClose={() => setDeleteUserModal(null)}
          onDeleted={() => { setDeleteUserModal(null); fetchUsers(); }}
        />,
        document.body
      )}

      {/* Add User Modal */}
      {isAddUserOpen && createPortal(
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !submitting && setIsAddUserOpen(false)}>
          <section className="modal-panel max-w-lg">
            <header className="modal-header">
              <div className="flex items-center gap-3">
                <span className="section-icon bg-teal-50 text-teal-700"><UserPlus className="h-4 w-4" /></span>
                <div>
                  <h3 className="text-sm font-bold text-slate-950">Provision user account</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Create an account and assign database-backed access.</p>
                </div>
              </div>
              <button 
                type="button" 
                disabled={submitting} 
                onClick={() => setIsAddUserOpen(false)} 
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" 
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            
            <form noValidate onSubmit={handleCreateUser} className="modal-body max-h-[calc(100dvh-5.5rem)] overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name <span className="text-rose-500" aria-hidden="true">*</span></label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Ramesh Shah" 
                  value={name} 
                  onChange={(e) => { setName(e.target.value); setErrors({ ...errors, name: '' }); }} 
                  className={`w-full text-sm p-2.5 rounded-lg border ${errors.name ? 'border-rose-400' : 'border-slate-300'}`} 
                />
                <FieldError>{errors.name}</FieldError>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Official Email <span className="text-rose-500" aria-hidden="true">*</span></label>
                <input 
                  type="email" 
                  required 
                  placeholder="ramesh@rayzon.one" 
                  value={email} 
                  onChange={(e) => { setEmail(e.target.value); setErrors({ ...errors, email: '' }); }} 
                  className={`w-full text-sm p-2.5 rounded-lg border ${errors.email ? 'border-rose-400' : 'border-slate-300'}`} 
                />
                <FieldError>{errors.email}</FieldError>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Temporary Password <span className="text-rose-500" aria-hidden="true">*</span></label>
                <input 
                  type="password" 
                  required 
                  minLength={8} 
                  placeholder="Minimum 8 characters" 
                  value={password} 
                  onChange={(e) => { setPassword(e.target.value); setErrors({ ...errors, password: '' }); }} 
                  className={`w-full text-sm p-2.5 rounded-lg border ${errors.password ? 'border-rose-400' : 'border-slate-300'}`} 
                />
                <FieldError>{errors.password}</FieldError>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">System Role <span className="text-rose-500" aria-hidden="true">*</span></label>
                <SearchableSelect 
                  value={role} 
                  onChange={(value) => { setRole(value); setErrors({ ...errors, role: '' }); }} 
                  error={errors.role} 
                  options={roleOptions} 
                  searchPlaceholder="Search roles..." 
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department <span className="text-rose-500" aria-hidden="true">*</span></label>
                <SearchableSelect 
                  value={department} 
                  onChange={(value) => { setDepartment(value); setErrors({ ...errors, department: '' }); }} 
                  error={errors.department} 
                  options={['Procurement', 'Finance & Accounts', 'EXIM & Logistics', 'Supply Chain', 'IT Operations', 'Executive Management', 'Accounts & Finance']} 
                  searchPlaceholder="Search departments..." 
                />
              </div>
              
              <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3 space-y-2">
                <p className="text-xs font-bold text-teal-900">Organisation hierarchy</p>
                <label className="block text-xs font-semibold text-slate-700">Reports to</label>
                <SearchableSelect 
                  value={managerId} 
                  onChange={setManagerId} 
                  options={[
                    { label: 'No manager (system-managed role)', value: '' },
                    ...hierarchyUsers
                      .filter((item) => item.status === 'Active')
                      .map((item) => ({ label: `${item.name} — ${item.role}`, value: item.id }))
                  ]} 
                  searchable 
                />
                <p className="text-[11px] text-teal-800">The system automatically assigns the hierarchy level, visibility, and approval scope.</p>
              </div>
              
              <div className="modal-footer">
                <button type="button" onClick={() => setIsAddUserOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={submitting} className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0d7676] hover:bg-[#0a5c5c] rounded-lg disabled:opacity-50">
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Provisioning...</span>
                    </>
                  ) : (
                    <span>Provision User</span>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>,
        document.body
      )}
    </div>
  );
}