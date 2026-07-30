import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { UserPlus, Search, Shield, CheckCircle2, Loader2, X } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { SearchableSelect } from '../ui/searchable-select';
import { FieldError } from '../ui/field-error';
import { useToast } from '../ui/toast';
import { ServerPagination } from '../ui/server-pagination';

export default function UserManagementView() {
  const [usersList, setUsersList] = useState([]);
  const [roleOptions, setRoleOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [pagination, setPagination] = useState({ total: 0, page: 1, size: 10, totalPages: 1 });
  const [stats, setStats] = useState({ activeUsers: 0, inactiveUsers: 0, totalUsers: 0 });
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Procurement Head');
  const [department, setDepartment] = useState('Procurement');
  const [errors, setErrors] = useState({});
  const { showToast } = useToast();
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
      const [usersRes, rolesRes] = await Promise.all([
        apiFetch(`/api/users?${searchParams.toString()}`),
        apiFetch('/api/roles?size=100')
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

  useEffect(() => {
    fetchUsers();
  }, [searchParams]);

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
        body: JSON.stringify({ name, email, password, role, department })
      });
      const data = await res.json();
      if (res.ok) {
        setIsAddUserOpen(false);
        setName('');
        setEmail('');
        setPassword('');
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

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] min-h-0 w-full flex-col gap-4 overflow-hidden pb-4 font-sans">
      
      {/* SINGLE UNIFIED COMPACT CONTROLS BAR (Search + Status + Sort + Provision Button) */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
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
          <select value={statusFilter} onChange={(event) => updateFilters({ status: event.target.value })} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
            <option value="All">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <select value={sort} onChange={(event) => updateFilters({ sort: event.target.value })} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name A–Z</option>
          </select>
          <select value={pageSize} onChange={(event) => updateFilters({ size: event.target.value })} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
            {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size} per page</option>)}
          </select>
        </div>

        <button
          onClick={() => setIsAddUserOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#0d7676] rounded-lg hover:bg-[#0a5c5c] transition shadow-xs flex-shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Provision New User
        </button>
      </div>

      {/* Main Table Card */}
      <div className="surface-card flex min-h-0 flex-1 flex-col border border-slate-200 rounded-xl bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#0d7676]" />
            <span>Loading user directory...</span>
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
                  <th className="py-3.5 px-4">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {usersList.map((usr, index) => (
                  <tr key={usr.id} className="hover:bg-teal-50/20 transition">
                    <td className="w-12 font-semibold tabular-nums text-slate-400 px-4 py-3">{(pagination.page - 1) * pagination.size + index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-100 text-[#0d7676] font-bold text-xs flex items-center justify-center border border-teal-200 shadow-2xs">
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
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {usr.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ServerPagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        pageSize={pagination.size}
        itemLabel="users"
        onPageChange={(nextPage) => updateFilters({ page: nextPage })}
      />

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
              <button type="button" disabled={submitting} onClick={() => setIsAddUserOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close modal"><X className="h-4 w-4" /></button>
            </header>
            <form noValidate onSubmit={handleCreateUser} className="modal-body max-h-[calc(100dvh-5.5rem)] overflow-y-auto">
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
                <SearchableSelect value={role} onChange={(value) => { setRole(value); setErrors({ ...errors, role: '' }); }} error={errors.role} options={roleOptions} searchPlaceholder="Search roles..." />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department <span className="text-rose-500" aria-hidden="true">*</span></label>
                <SearchableSelect value={department} onChange={(value) => { setDepartment(value); setErrors({ ...errors, department: '' }); }} error={errors.department} options={['Procurement', 'Finance & Accounts', 'Supply Chain & Logistics', 'IT Operations', 'Executive Management']} searchPlaceholder="Search departments..." />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0d7676] hover:bg-[#0a5c5c] rounded-lg disabled:opacity-50"
                >
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
