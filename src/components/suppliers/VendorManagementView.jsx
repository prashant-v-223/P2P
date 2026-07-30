import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, CheckCircle2, Eye, KeyRound, Loader2, Pencil, Plus,
  Search, ShieldOff, ShieldCheck, Trash2, UserRoundPlus
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { ServerPagination } from '../ui/server-pagination';
import { useToast } from '../ui/toast';

const initialMeta = { page: 1, pageSize: 20, total: 0, totalPages: 1 };
const readJson = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Vendor API returned ${response.status}. Restart the backend server and try again.`);
  }
  return response.json();
};

export default function VendorManagementView() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [meta, setMeta] = useState(initialMeta);
  const [filters, setFilters] = useState({ q: '', status: 'All', type: 'All', portal: 'all' });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [password, setPassword] = useState(null);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ...filters, page, size: meta.pageSize });
      const response = await apiFetch(`/api/vendors?${params}`);
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'Unable to load vendors.');
      setSuppliers(data.vendors || []);
      setMeta({ page: data.page, pageSize: data.pageSize, total: data.total, totalPages: data.totalPages });
    } catch (error) {
      showToast({ type: 'error', title: 'Vendor list unavailable', description: error.message });
    } finally {
      setLoading(false);
    }
  }, [filters, meta.pageSize, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => load(1), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const setPortal = async (supplier) => {
    setBusyId(supplier.supplierId);
    try {
      const response = await apiFetch(`/api/vendors/${supplier._id}/portal-access`, {
        method: 'POST',
        body: JSON.stringify({ enabled: !supplier.portalEnabled })
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error);
      showToast({ title: 'Portal access updated', description: data.message });
      await load(meta.page);
    } catch (error) {
      showToast({ type: 'error', title: 'Unable to update access', description: error.message });
    } finally {
      setBusyId('');
    }
  };

  const generatePassword = async (supplier) => {
    setBusyId(supplier.supplierId);
    try {
      const response = await apiFetch(`/api/vendors/${supplier._id}/generate-password`, { method: 'POST' });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error);
      setPassword({ supplier, value: data.temporaryPassword });
      await load(meta.page);
    } catch (error) {
      showToast({ type: 'error', title: 'Password not generated', description: error.message });
    } finally {
      setBusyId('');
    }
  };

  const deleteVendor = async (supplier) => {
    if (!window.confirm(`Delete ${supplier.name} from vendor management?\n\nThe SAP supplier master record will remain available.`)) return;
    setBusyId(supplier.supplierId);
    try {
      const response = await apiFetch(`/api/vendors/${supplier._id}`, { method: 'DELETE' });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error);
      showToast({ title: 'Vendor deleted', description: data.message });
      await load(meta.page);
    } catch (error) {
      showToast({ type: 'error', title: 'Vendor not deleted', description: error.message });
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="page-stack">
      <div className="page-toolbar">
        <div>
          <h2 className="text-base font-bold text-slate-950">Vendor management</h2>
          <p className="mt-0.5 text-xs text-slate-500">SAP supplier master, purchase-order activity, and portal access in one place.</p>
        </div>
        <button onClick={() => navigate('/admin/vendors/create')} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-xs font-bold text-white hover:bg-teal-800">
          <UserRoundPlus className="h-4 w-4" /> Add vendor
        </button>
      </div>

      <section className="surface-card">
        <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-2 lg:grid-cols-[minmax(260px,1fr)_160px_180px_180px]">
          <label className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={filters.q} onChange={(event) => setFilters((value) => ({ ...value, q: event.target.value }))} placeholder="Search company, SAP code, email or contact…" className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs focus:border-teal-500" />
          </label>
          <Filter value={filters.status} onChange={(status) => setFilters((value) => ({ ...value, status }))} options={['All', 'Active', 'Inactive']} />
          <Filter value={filters.type} onChange={(type) => setFilters((value) => ({ ...value, type }))} options={['All', 'Domestic', 'Import', 'Freight Forwarder', 'Service', 'Other']} />
          <Filter value={filters.portal} onChange={(portal) => setFilters((value) => ({ ...value, portal }))} options={['all', 'enabled', 'disabled']} labels={{ all: 'All portal access', enabled: 'Portal enabled', disabled: 'Portal disabled' }} />
        </div>

        <div className="overflow-x-auto">
          <table className="data-table min-w-[1120px]">
            <thead><tr><th>#</th><th>Company</th><th>SAP code</th><th>Contact</th><th>Type</th><th>POs</th><th>Status</th><th>Portal login</th><th>Updated</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="10"><div className="flex items-center justify-center gap-2 py-10 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading vendors…</div></td></tr>
              ) : suppliers.length ? suppliers.map((supplier, index) => (
                <tr key={supplier._id}>
                  <td className="text-slate-400">{(meta.page - 1) * meta.pageSize + index + 1}</td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-xs font-black text-teal-700">{supplier.name?.[0] || 'V'}</span>
                      <div className="min-w-0"><p className="max-w-64 truncate font-semibold text-slate-900" title={supplier.name}>{supplier.name}</p><p className="max-w-64 truncate text-[10px] text-slate-400">{supplier.email || supplier.city || 'No email available'}</p></div>
                    </div>
                  </td>
                  <td><span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[10px]">{supplier.supplierId}</span></td>
                  <td><p className="font-medium">{supplier.contactPerson || '—'}</p><p className="text-[10px] text-slate-400">{supplier.phone || supplier.country || ''}</p></td>
                  <td><span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold">{supplier.vendorType || (supplier.country === 'IN' ? 'Domestic' : 'Import')}</span></td>
                  <td className="font-bold tabular-nums">{supplier.poCount || 0}</td>
                  <td><Status active={supplier.status === 'Active'} text={supplier.status || 'Active'} /></td>
                  <td><Status active={supplier.portalEnabled} text={supplier.portalEnabled ? 'Enabled' : 'Not enabled'} /></td>
                  <td className="whitespace-nowrap text-slate-500">{new Date(supplier.updatedAt).toLocaleDateString('en-IN')}</td>
                  <td>
                    <div className="flex gap-1">
                      <Action title="View" onClick={() => navigate(`/admin/vendors/${supplier._id}`)}><Eye className="h-3.5 w-3.5" /></Action>
                      <Action title="Edit" onClick={() => navigate(`/admin/vendors/${supplier._id}/edit`)}><Pencil className="h-3.5 w-3.5" /></Action>
                      <Action title="Generate one-time password" disabled={busyId === supplier.supplierId} onClick={() => generatePassword(supplier)} tone="amber"><KeyRound className="h-3.5 w-3.5" /></Action>
                      <Action title={supplier.portalEnabled ? 'Disable portal access' : 'Enable portal access'} disabled={busyId === supplier.supplierId} onClick={() => setPortal(supplier)} tone={supplier.portalEnabled ? 'rose' : 'emerald'}>
                        {supplier.portalEnabled ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      </Action>
                      <Action title="Delete vendor" disabled={busyId === supplier.supplierId} onClick={() => deleteVendor(supplier)} tone="rose"><Trash2 className="h-3.5 w-3.5" /></Action>
                    </div>
                  </td>
                </tr>
              )) : <tr><td colSpan="10"><div className="py-12 text-center"><Building2 className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 font-semibold text-slate-700">No vendors found</p><p className="text-xs text-slate-400">Try changing the filters or sync suppliers from SAP.</p></div></td></tr>}
            </tbody>
          </table>
        </div>
        <ServerPagination {...meta} itemLabel="vendors" onPageChange={load} className="rounded-none border-x-0 border-b-0 shadow-none" />
      </section>

      {password && <PasswordDialog data={password} onClose={() => setPassword(null)} showToast={showToast} />}
    </div>
  );
}

function Filter({ value, onChange, options, labels = {} }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs">{options.map((option) => <option key={option} value={option}>{labels[option] || (option === 'All' ? 'All values' : option)}</option>)}</select>;
}

function Status({ active, text }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{active && <CheckCircle2 className="h-3 w-3" />}{text}</span>;
}

function Action({ title, children, onClick, disabled, tone = 'teal' }) {
  const tones = { teal: 'hover:border-teal-300 hover:text-teal-700', amber: 'hover:border-amber-300 hover:text-amber-700', rose: 'hover:border-rose-300 hover:text-rose-700', emerald: 'hover:border-emerald-300 hover:text-emerald-700' };
  return <button type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick} className={`flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition disabled:opacity-40 ${tones[tone]}`}>{children}</button>;
}

function PasswordDialog({ data, onClose, showToast }) {
  const copy = async () => {
    await navigator.clipboard.writeText(data.value);
    showToast({ title: 'Password copied', description: 'Share it securely with the vendor.' });
  };
  return <div className="modal-backdrop"><div className="modal-panel max-w-md"><div className="modal-header"><div><h3 className="font-bold text-slate-900">One-time vendor password</h3><p className="text-xs text-slate-500">{data.supplier.name}</p></div></div><div className="modal-body"><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">This password is displayed only once. Copy it before closing.</div><div className="rounded-xl border border-slate-200 bg-slate-950 p-4 text-center font-mono text-lg font-bold tracking-wider text-white">{data.value}</div><div className="modal-footer"><button onClick={onClose} className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-bold">Close</button><button onClick={copy} className="h-9 rounded-lg bg-teal-700 px-4 text-xs font-bold text-white">Copy password</button></div></div></div></div>;
}
