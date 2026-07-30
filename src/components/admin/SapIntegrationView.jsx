import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Cloud,
  Database,
  FileText,
  Landmark,
  Loader2,
  PackageSearch,
  RefreshCw,
  ShoppingCart,
  Users,
  X
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../ui/toast';
import { ServerPagination } from '../ui/server-pagination';

const endpointMeta = {
  suppliers: { label: 'Supplier Master', icon: Users, color: 'text-blue-600 bg-blue-50' },
  purchaseOrders: { label: 'Purchase Orders', icon: ShoppingCart, color: 'text-teal-700 bg-teal-50' },
  houseBanks: { label: 'House Banks', icon: Landmark, color: 'text-emerald-700 bg-emerald-50' },
  supplierInvoices: { label: 'Supplier Invoices', icon: FileText, color: 'text-amber-700 bg-amber-50' }
};

export default function SapIntegrationView() {
  const { showToast } = useToast();
  const [overview, setOverview] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyMeta, setHistoryMeta] = useState({ total: 0, page: 1, size: 10, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState('');
  const [poInput, setPoInput] = useState('');
  const [poNumbers, setPoNumbers] = useState([]);

  const loadOverview = async () => {
    const response = await apiFetch('/api/sap/overview');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load SAP status.');
    setOverview(data);
  };

  const loadHistory = async (page = historyMeta.page) => {
    const response = await apiFetch(`/api/sap/history?page=${page}&size=${historyMeta.size}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load sync history.');
    setHistory(data.runs || []);
    setHistoryMeta({ total: data.total, page: data.page, size: data.size, totalPages: data.totalPages });
  };

  useEffect(() => {
    Promise.all([loadOverview(), loadHistory(1)])
      .catch((error) => showToast({ type: 'error', title: 'SAP integration unavailable', description: error.message }))
      .finally(() => setLoading(false));
  }, []);

  const addPoNumbers = (rawValue) => {
    const values = rawValue.split(/[\s,\n]+/).map((item) => item.trim()).filter(Boolean);
    if (!values.length) return;
    setPoNumbers((current) => [...new Set([...current, ...values])].slice(0, 100));
    setPoInput('');
  };

  const runSync = async (entity, selectedPoNumbers = []) => {
    try {
      setSyncing(entity);
      const response = await apiFetch(`/api/sap/sync/${entity}`, {
        method: 'POST',
        body: JSON.stringify({ poNumbers: selectedPoNumbers })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'SAP sync failed.');
      showToast({
        title: 'SAP sync completed',
        description: `${data.run.fetched.toLocaleString('en-IN')} fetched · ${data.run.created.toLocaleString('en-IN')} created · ${data.run.updated.toLocaleString('en-IN')} matched/updated.`
      });
      if (selectedPoNumbers.length) setPoNumbers([]);
      await Promise.all([loadOverview(), loadHistory(1)]);
    } catch (error) {
      showToast({ type: 'error', title: 'SAP sync failed', description: error.message });
      await loadHistory(1).catch(() => {});
    } finally {
      setSyncing('');
    }
  };

  if (loading) {
    return <div className="surface-card flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin text-teal-600" /> Checking SAP connection...</div>;
  }

  return (
    <div className="page-stack">
      <section className={`surface-card flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center ${overview?.connected ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'}`}>
        <div className="flex items-center gap-3">
          <span className={`section-icon ${overview?.connected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {overview?.connected ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </span>
          <div>
            <h2 className="text-base font-bold text-slate-950">SAP S/4HANA Cloud — {overview?.connected ? 'Connected' : overview?.configured ? 'Connection failed' : 'Configuration required'}</h2>
            <p className="mt-0.5 text-xs text-slate-600">{overview?.connectionMessage}</p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Base URL</p>
          <p className="mt-0.5 font-mono text-xs font-semibold text-slate-700">{overview?.baseUrl}</p>
        </div>
      </section>

      <section className="surface-card p-4">
        <div className="mb-3 flex items-center gap-2"><Cloud className="h-4 w-4 text-slate-500" /><h2 className="text-sm font-bold text-slate-900">Configured SAP APIs</h2></div>
        <div className="grid gap-2 lg:grid-cols-2">
          {(overview?.endpoints || []).map((endpoint) => {
            const meta = endpointMeta[endpoint.key] || { label: endpoint.key, icon: Database, color: 'text-slate-600 bg-slate-50' };
            const Icon = meta.icon;
            return (
              <div key={endpoint.key} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.color}`}><Icon className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><p className="text-xs font-bold text-slate-900">{meta.label}</p><span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">{endpoint.method}</span></div>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500" title={endpoint.path}>{endpoint.path}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <SyncCard icon={ShoppingCart} title="Purchase Orders" description="Sync all purchase orders from SAP into MongoDB." count={overview?.counts?.purchaseOrders || 0} loading={syncing === 'purchase-orders'} disabled={!overview?.configured || Boolean(syncing)} onSync={() => runSync('purchase-orders')} />
        <SyncCard icon={Building2} title="Vendors / Suppliers" description="Sync supplier master records from SAP into MongoDB." count={overview?.counts?.suppliers || 0} loading={syncing === 'suppliers'} disabled={!overview?.configured || Boolean(syncing)} onSync={() => runSync('suppliers')} />
      </div>

      <section className="surface-card overflow-hidden border-teal-200">
        <header className="flex items-center gap-3 border-b border-teal-100 bg-teal-50/70 p-3">
          <span className="section-icon bg-teal-100 text-teal-700"><PackageSearch className="h-4 w-4" /></span>
          <div><h2 className="text-sm font-bold text-slate-900">Pull missing POs from SAP</h2><p className="text-xs text-slate-500">Enter one or more PO numbers to fetch and upsert immediately.</p></div>
        </header>
        <div className="p-3">
          {!!poNumbers.length && <div className="mb-2 flex flex-wrap gap-1.5">{poNumbers.map((number) => <span key={number} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{number}<button onClick={() => setPoNumbers((items) => items.filter((item) => item !== number))}><X className="h-3 w-3" /></button></span>)}</div>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={poInput}
              onChange={(event) => setPoInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addPoNumbers(poInput); } }}
              onPaste={(event) => { const value = event.clipboardData.getData('text'); if (/[\s,\n]/.test(value)) { event.preventDefault(); addPoNumbers(value); } }}
              placeholder="Type a PO number and press Enter — e.g. 4500101234"
              className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-xs focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
            <button disabled={!poNumbers.length || Boolean(syncing)} onClick={() => runSync('purchase-orders', poNumbers)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50">
              {syncing === 'purchase-orders' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Pull from SAP
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400">Press Enter or comma to add · Paste a comma, space, or line-separated list · Maximum 100 POs</p>
        </div>
      </section>

      <section className="surface-card overflow-hidden">
        <header className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-bold text-slate-900">Sync history</h2></header>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>#</th><th>Type</th><th>Mode</th><th>Fetched</th><th>Created</th><th>Updated</th><th>Failed</th><th>Status</th><th>Duration</th><th>Started</th></tr></thead>
            <tbody>
              {history.map((run, index) => (
                <tr key={run._id}>
                  <td className="text-slate-400">{(historyMeta.page - 1) * historyMeta.size + index + 1}</td>
                  <td className="font-semibold capitalize text-slate-800">{run.entity.replaceAll('-', ' ')}</td>
                  <td className="capitalize text-slate-500">{run.mode}</td>
                  <td>{run.fetched}</td><td className="text-emerald-700">+{run.created}</td><td className="text-blue-700">~{run.updated}</td><td className="text-rose-600">{run.failed}</td>
                  <td>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${run.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : run.status === 'failed' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}
                      title={run.error || undefined}
                    >
                      {run.status}
                    </span>
                    {run.error && <p className="mt-1 max-w-48 truncate text-[10px] text-rose-600" title={run.error}>{run.error}</p>}
                  </td>
                  <td>{run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '—'}</td>
                  <td>{new Date(run.startedAt).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ServerPagination {...historyMeta} itemLabel="sync runs" onPageChange={loadHistory} className="rounded-none border-x-0 border-b-0 shadow-none" />
      </section>
    </div>
  );
}

function SyncCard({ icon: Icon, title, description, count, loading, disabled, onSync }) {
  return (
    <section className="surface-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="section-icon bg-teal-50 text-teal-700"><Icon className="h-4 w-4" /></span>
          <div><h2 className="text-sm font-bold text-slate-900">{title}</h2><p className="mt-0.5 text-xs text-slate-500">{description}</p></div>
        </div>
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold tabular-nums text-slate-700">{count.toLocaleString('en-IN')}</span>
      </div>
      <button disabled={disabled} onClick={onSync} className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-teal-200 bg-white text-xs font-bold text-teal-700 hover:bg-teal-50 disabled:opacity-50">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {loading ? 'Syncing…' : 'Sync now'}
      </button>
    </section>
  );
}
