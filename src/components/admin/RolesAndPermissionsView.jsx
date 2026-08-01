import React, { useEffect, useMemo, useState } from 'react';
import {
  Check, KeyRound, Lock, Pencil, Plus, Save, Search, ShieldCheck,
  Trash2, Users, X
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../ui/toast';
import { useConfirm } from '../ui/confirm-dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { FieldError } from '../ui/field-error';

const emptyRole = { roleName: '', description: '', status: 'Active' };
const emptyPermission = { key: '', name: '', module: '', description: '', status: 'Active' };

const FALLBACK_PERMISSIONS = [
  { id: 'perm-1', key: 'users.read', name: 'View Users', module: 'User Management', action: 'read', description: 'View user directory and account details.', type: 'System', status: 'Active' },
  { id: 'perm-2', key: 'users.create', name: 'Provision User', module: 'User Management', action: 'create', description: 'Create new user accounts.', type: 'System', status: 'Active' },
  { id: 'perm-3', key: 'users.update', name: 'Edit User', module: 'User Management', action: 'update', description: 'Update existing user profile and roles.', type: 'System', status: 'Active' },
  { id: 'perm-4', key: 'users.delete', name: 'Delete User', module: 'User Management', action: 'delete', description: 'Remove user accounts.', type: 'System', status: 'Active' },
  { id: 'perm-5', key: 'vendors.read', name: 'View Vendors', module: 'Vendor Management', action: 'read', description: 'View vendor directory and profile details.', type: 'System', status: 'Active' },
  { id: 'perm-6', key: 'vendors.create', name: 'Add Vendor', module: 'Vendor Management', action: 'create', description: 'Create new vendor accounts.', type: 'System', status: 'Active' },
  { id: 'perm-7', key: 'vendors.update', name: 'Edit Vendor', module: 'Vendor Management', action: 'update', description: 'Modify vendor profile details and bank info.', type: 'System', status: 'Active' },
  { id: 'perm-8', key: 'vendors.delete', name: 'Delete Vendor', module: 'Vendor Management', action: 'delete', description: 'Delete vendor records.', type: 'System', status: 'Active' },
  { id: 'perm-9', key: 'workflows.read', name: 'View Workflows', module: 'Workflow Slabs', action: 'read', description: 'View workflow slab routing rules.', type: 'System', status: 'Active' },
  { id: 'perm-10', key: 'workflows.create', name: 'Add Workflow', module: 'Workflow Slabs', action: 'create', description: 'Create new workflow approval slabs.', type: 'System', status: 'Active' },
  { id: 'perm-11', key: 'workflows.update', name: 'Edit Workflow', module: 'Workflow Slabs', action: 'update', description: 'Modify workflow slab rules and stages.', type: 'System', status: 'Active' },
  { id: 'perm-12', key: 'workflows.delete', name: 'Delete Workflow', module: 'Workflow Slabs', action: 'delete', description: 'Remove workflow slabs.', type: 'System', status: 'Active' },
  { id: 'perm-13', key: 'exchange-rates.read', name: 'View Rates', module: 'Exchange Rates', action: 'read', description: 'View currency exchange rates.', type: 'System', status: 'Active' },
  { id: 'perm-14', key: 'exchange-rates.update', name: 'Manage Rates', module: 'Exchange Rates', action: 'update', description: 'Update FX rates used for INR conversion.', type: 'System', status: 'Active' },
  { id: 'perm-15', key: 'approvals.read', name: 'View Approvals', module: 'Approvals', action: 'read', description: 'View pending and completed approval requests.', type: 'System', status: 'Active' },
  { id: 'perm-16', key: 'approvals.approve', name: 'Approve Request', module: 'Approvals', action: 'approve', description: 'Approve payment or PO requests.', type: 'System', status: 'Active' },
  { id: 'perm-17', key: 'approvals.reject', name: 'Reject Request', module: 'Approvals', action: 'reject', description: 'Reject requests with remarks.', type: 'System', status: 'Active' },
  { id: 'perm-18', key: 'roles.read', name: 'View Roles', module: 'Roles & Permissions', action: 'read', description: 'View system roles and permission matrix.', type: 'System', status: 'Active' },
  { id: 'perm-19', key: 'roles.update', name: 'Manage Permissions', module: 'Roles & Permissions', action: 'update', description: 'Assign permissions to system roles.', type: 'System', status: 'Active' }
];

const requestJson = async (url, options) => {
  const response = await apiFetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
};

function ManageDialog({ type, record, onClose, onSaved }) {
  const isRole = type === 'role';
  const [form, setForm] = useState(record ? {
    ...(isRole ? emptyRole : emptyPermission),
    ...record
  } : (isRole ? emptyRole : emptyPermission));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (isRole) {
      if (form.roleName.trim().length < 2) nextErrors.roleName = 'Enter at least 2 characters.';
    } else {
      if (!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(form.key.trim().toLowerCase())) nextErrors.key = 'Use module.action format, for example users.read.';
      if (form.name.trim().length < 3) nextErrors.name = 'Enter a clear permission name.';
      if (form.module.trim().length < 2) nextErrors.module = 'Enter the module name.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    try {
      const endpoint = isRole ? '/api/roles' : '/api/permissions';
      await requestJson(record ? `${endpoint}/${record.id}` : endpoint, {
        method: record ? 'PUT' : 'POST',
        body: JSON.stringify(form)
      });
      onSaved(`${isRole ? 'Role' : 'Permission'} ${record ? 'updated' : 'created'} successfully.`);
    } catch (error) {
      setErrors({ form: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-panel max-w-lg">
        <header className="modal-header">
          <div className="flex items-center gap-3">
            <span className="section-icon bg-teal-50 text-teal-700">{isRole ? <ShieldCheck className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}</span>
            <div>
              <h2 className="text-sm font-bold text-slate-950">{record ? 'Edit' : 'Create'} {isRole ? 'role' : 'permission'}</h2>
              <p className="mt-0.5 text-xs text-slate-500">{isRole ? 'Define access responsibility and account status.' : 'Create a reusable module action key.'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </header>
        <form noValidate onSubmit={submit} className="modal-body">
          {errors.form && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{errors.form}</div>}
          {isRole ? (
            <>
              <label className="block text-xs font-semibold text-slate-700">Role name <span className="text-rose-500">*</span>
                <Input className="mt-1.5" maxLength={80} placeholder="e.g. Treasury Manager" value={form.roleName} onChange={(event) => update('roleName', event.target.value)} />
                <FieldError>{errors.roleName}</FieldError>
              </label>
              <label className="block text-xs font-semibold text-slate-700">Description
                <Input className="mt-1.5" maxLength={240} placeholder="Describe the role responsibility" value={form.description} onChange={(event) => update('description', event.target.value)} />
              </label>
            </>
          ) : (
            <>
              <label className="block text-xs font-semibold text-slate-700">Permission key <span className="text-rose-500">*</span>
                <Input className="mt-1.5 font-mono" maxLength={100} placeholder="users.read" value={form.key} onChange={(event) => update('key', event.target.value.toLowerCase().replace(/\s/g, '-'))} />
                <FieldError>{errors.key}</FieldError>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">Display name <span className="text-rose-500">*</span>
                  <Input className="mt-1.5" maxLength={100} placeholder="View users" value={form.name} onChange={(event) => update('name', event.target.value)} />
                  <FieldError>{errors.name}</FieldError>
                </label>
                <label className="block text-xs font-semibold text-slate-700">Module <span className="text-rose-500">*</span>
                  <Input className="mt-1.5" maxLength={80} placeholder="User Management" value={form.module} onChange={(event) => update('module', event.target.value)} />
                  <FieldError>{errors.module}</FieldError>
                </label>
              </div>
              <label className="block text-xs font-semibold text-slate-700">Description
                <Input className="mt-1.5" maxLength={240} placeholder="Explain when this permission is used" value={form.description} onChange={(event) => update('description', event.target.value)} />
              </label>
            </>
          )}
          <label className="block text-xs font-semibold text-slate-700">Status
            <select value={form.status} onChange={(event) => update('status', event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/10">
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </label>
          <div className="modal-footer">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saving}>{record ? 'Save changes' : `Create ${isRole ? 'role' : 'permission'}`}</Button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function RolesAndPermissionsView() {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [activeModule, setActiveModule] = useState('roles');
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rolesData, permissionsData] = await Promise.all([
        requestJson('/api/roles'),
        requestJson('/api/permissions')
      ]);
      setRoles(rolesData.roles || []);
      setPermissions(permissionsData.permissions || []);
      setSelectedRoleId((current) => current || rolesData.roles?.[0]?.id || null);
    } catch (error) {
      console.error('Failed to load permissions:', error.message);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const selectedRole = roles.find((role) => role.id === selectedRoleId) || roles[0];
  
  const effectivePermissions = useMemo(() => {
    return (permissions && permissions.length > 0) ? permissions : FALLBACK_PERMISSIONS;
  }, [permissions]);

  const modules = useMemo(() => {
    const map = new Map();
    const activePerms = effectivePermissions.filter((permission) => (permission.status || 'Active') === 'Active');
    
    activePerms.forEach((permission) => {
      const parts = permission.key.split('.');
      const moduleKey = parts[0];
      const action = parts.slice(1).join('.') || 'read';
      if (!map.has(moduleKey)) {
        map.set(moduleKey, { key: moduleKey, name: permission.module || moduleKey, actions: [] });
      }
      map.get(moduleKey).actions.push({ action, permission });
    });
    return [...map.values()];
  }, [effectivePermissions]);

  const filteredPermissions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (permissions.length > 0 ? permissions : FALLBACK_PERMISSIONS).filter((permission) => 
      !query || [permission.key, permission.name, permission.module].some((value) => value?.toLowerCase().includes(query))
    );
  }, [permissions, search]);

  const togglePermission = (moduleKey, action) => {
    if (!selectedRole) return;
    const current = selectedRole.permissions?.[moduleKey] || [];
    const next = current.includes(action) ? current.filter((item) => item !== action) : [...current, action];
    setRoles((items) => items.map((role) => role.id === selectedRole.id
      ? { ...role, permissions: { ...role.permissions, [moduleKey]: next } }
      : role));
  };

  const saveMatrix = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      await requestJson(`/api/roles/${selectedRole.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: selectedRole.permissions })
      });
      showToast({ title: 'Permissions saved', description: `${selectedRole.roleName} access was updated in MongoDB.` });
      await loadData();
    } catch (error) {
      showToast({ type: 'error', title: 'Permissions not saved', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const removeRecord = async (type, record) => {
    const approved = await confirm({
      title: `Delete ${type}?`,
      description: `${type === 'role' ? record.roleName : record.key} will be permanently removed. Assigned users or system records are protected.`,
      confirmLabel: `Delete ${type}`
    });
    if (!approved) return;
    try {
      await requestJson(`/api/${type === 'role' ? 'roles' : 'permissions'}/${record.id}`, { method: 'DELETE' });
      showToast({ title: `${type === 'role' ? 'Role' : 'Permission'} deleted`, description: 'Database records and assignments were updated.' });
      if (record.id === selectedRoleId) setSelectedRoleId(null);
      await loadData();
    } catch (error) {
      showToast({ type: 'error', title: `Cannot delete ${type}`, description: error.message });
    }
  };

  const dialogSaved = async (message) => {
    setDialog(null);
    showToast({ title: message, description: 'The change was stored in MongoDB.' });
    await loadData();
  };

  return (
    <div className="space-y-4 font-sans pb-12 w-full">
      
      {/* SINGLE UNIFIED CONTROLS BAR (Tabs + Add Button) */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
        <div className="flex w-fit rounded-lg border border-slate-200 bg-slate-50 p-1">
          {[['roles', ShieldCheck, 'Roles'], ['permissions', KeyRound, 'Permissions']].map(([key, Icon, label]) => (
            <button 
              key={key} 
              onClick={() => setActiveModule(key)} 
              className={`flex h-8 items-center gap-2 rounded-md px-3 text-xs font-bold transition ${activeModule === key ? 'bg-[#0d7676] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200'}`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <Button onClick={() => setDialog({ type: activeModule === 'roles' ? 'role' : 'permission' })} className="bg-[#0d7676] hover:bg-[#0a5c5c] text-white font-bold text-xs px-3.5">
          <Plus className="h-4 w-4 mr-1" /> New {activeModule === 'roles' ? 'role' : 'permission'}
        </Button>
      </div>

      {loading ? (
        <div className="surface-card py-16 text-center text-xs text-slate-400">Loading roles and permissions…</div>
      ) : activeModule === 'roles' ? (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-4 border-slate-200 shadow-2xs">
            <CardHeader className="flex-row items-center justify-between p-4 border-b border-slate-100">
              <div><CardTitle className="text-xs font-bold">System roles</CardTitle><CardDescription className="text-[11px]">Select a role to configure access.</CardDescription></div>
              <Badge variant="secondary">{roles.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-2 p-3">
              {roles.map((role) => (
                <button key={role.id} onClick={() => setSelectedRoleId(role.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedRole?.id === role.id ? 'border-teal-300 bg-teal-50/60 ring-2 ring-teal-500/10' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-slate-900">{role.roleName}</span>
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500"><Users className="h-3 w-3" />{role.usersCount}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{role.description || 'No description provided.'}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <Badge variant={role.type === 'System' ? 'secondary' : 'emerald'}>{role.type || 'Custom'}</Badge>
                    <span className="flex gap-1">
                      <span onClick={(event) => { event.stopPropagation(); setDialog({ type: 'role', record: role }); }} className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-teal-700"><Pencil className="h-3.5 w-3.5" /></span>
                      {role.type !== 'System' && <span onClick={(event) => { event.stopPropagation(); removeRecord('role', role); }} className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></span>}
                    </span>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="xl:col-span-8 border-slate-200 shadow-2xs">
            <CardHeader className="flex-row items-center justify-between gap-3 p-4 border-b border-slate-100">
              <div><CardTitle className="text-xs font-bold">{selectedRole?.roleName || 'Select a role'}</CardTitle><CardDescription className="text-[11px]">{selectedRole?.description}</CardDescription></div>
              <Button onClick={saveMatrix} loading={saving} disabled={!selectedRole} className="bg-[#0d7676] hover:bg-[#0a5c5c] text-xs font-bold"><Save className="h-3.5 w-3.5 mr-1" /> Save permissions</Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="data-table min-w-[680px] text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-extrabold uppercase text-[11px]"><tr><th className="py-3 px-4">Module</th><th className="py-3 px-4">Available permissions</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {modules.map((module) => (
                      <tr key={module.key} className="hover:bg-teal-50/20 transition">
                        <td className="w-52 py-3 px-4"><p className="font-bold text-slate-900">{module.name}</p><p className="mt-0.5 font-mono text-[10px] text-slate-400">{module.key}</p></td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-2">
                            {module.actions.map(({ action, permission }) => {
                              const checked = selectedRole?.permissions?.[module.key]?.includes(action);
                              return (
                                <button key={permission.id} type="button" onClick={() => togglePermission(module.key, action)} className={`inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-xs font-semibold transition ${checked ? 'border-teal-300 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>
                                  <span className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300'}`}>{checked && <Check className="h-3 w-3" />}</span>
                                  {action}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="flex-row items-center justify-between gap-3 p-4 border-b border-slate-100">
            <div><CardTitle className="text-xs font-bold">Permission registry</CardTitle><CardDescription className="text-[11px]">Reusable access keys enforced by backend RBAC middleware.</CardDescription></div>
            <div className="relative w-full max-w-xs"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input className="pl-9 text-xs" placeholder="Search permissions…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="data-table min-w-[820px] text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-extrabold uppercase text-[11px]"><tr><th className="py-3 px-4">Permission</th><th className="py-3 px-4">Module</th><th className="py-3 px-4">Roles</th><th className="py-3 px-4">Type</th><th className="py-3 px-4 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPermissions.map((permission) => (
                    <tr key={permission.id} className="hover:bg-teal-50/20 transition">
                      <td className="py-3 px-4"><p className="font-mono font-bold text-[#0d7676]">{permission.key}</p><p className="mt-0.5 text-[11px] text-slate-500">{permission.name}</p></td>
                      <td className="py-3 px-4"><Badge variant="secondary">{permission.module}</Badge></td>
                      <td className="py-3 px-4"><span className="inline-flex items-center gap-1.5 font-semibold text-slate-600"><Users className="h-3.5 w-3.5 text-slate-400" />{permission.rolesCount || 0}</span></td>
                      <td className="py-3 px-4"><Badge variant={permission.type === 'System' ? 'secondary' : 'emerald'}>{permission.type}</Badge></td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-1.5">
                          <Button size="icon" variant="outline" onClick={() => setDialog({ type: 'permission', record: permission })} title="Edit permission"><Pencil className="h-3.5 w-3.5" /></Button>
                          {permission.type !== 'System' && <Button size="icon" variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => removeRecord('permission', permission)} title="Delete permission"><Trash2 className="h-3.5 w-3.5" /></Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredPermissions.length && <div className="py-12 text-center text-xs text-slate-400">No permissions match your search.</div>}
            </div>
          </CardContent>
        </Card>
      )}

      {dialog && <ManageDialog type={dialog.type} record={dialog.record} onClose={() => setDialog(null)} onSaved={dialogSaved} />}
    </div>
  );
}
