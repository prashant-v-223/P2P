import React, { useState, useEffect } from 'react';
import {
  Network, List, Search, Loader2, RefreshCw, ChevronDown, ChevronRight,
  ShieldCheck, AlertCircle, Receipt, Building2
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../ui/toast';

function TreeNode({ node, level = 0 }) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasReports = node.reports && node.reports.length > 0;

  const formatCurrency = (amt) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt || 0);
  };

  return (
    <div className="relative">
      {level > 0 && (
        <div className="absolute left-0 top-0 h-full w-6">
          <div className="absolute left-[11px] top-0 h-[28px] w-[1px] bg-slate-200" />
          <div className="absolute left-[11px] top-[28px] h-[calc(100%-28px)] w-[1px] bg-slate-200" />
          <div className="absolute left-[11px] top-[28px] h-[1px] w-3 bg-slate-200" />
        </div>
      )}

      <div className={`relative mb-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs transition-all ${level > 0 ? 'ml-6' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-[240px]">
            {hasReports ? (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : (
              <span className="w-6" />
            )}

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 font-bold text-teal-800 text-xs shadow-2xs">
              {node.avatar || node.userName?.slice(0, 2).toUpperCase()}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-slate-900">{node.userName}</h4>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                  L{node.hierarchyLevel} · {node.userRole}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">{node.userEmail} · {node.department}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="text-right">
              <span className="block text-[10px] font-semibold text-slate-400 uppercase">Verified Records</span>
              <span className="font-bold text-emerald-700">{node.verifiedRecordsCount} / {node.totalRecords}</span>
            </div>

            <div className="text-right">
              <span className="block text-[10px] font-semibold text-slate-400 uppercase">Pending Advance QTs</span>
              <span className="font-bold text-amber-600">{node.pendingNotApprovedAdvanceCount} ({formatCurrency(node.pendingNotApprovedAdvanceAmount)})</span>
            </div>

            <div className="text-right">
              <span className="block text-[10px] font-semibold text-slate-400 uppercase">Invoice Adv. Adjusted</span>
              <span className="font-bold text-teal-700">{formatCurrency(node.invoiceAdvanceAdjustedTotal)}</span>
            </div>

            <div className="text-right">
              <span className="block text-[10px] font-semibold text-slate-400 uppercase">Turnaround</span>
              <span className="font-medium text-slate-600">{node.avgTurnaroundHours ? `${node.avgTurnaroundHours} hrs` : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Associated Vendors pill tags */}
        {node.vendorRequirements && node.vendorRequirements.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2 text-[10px]">
            <span className="font-semibold text-slate-400">Vendors:</span>
            {node.vendorRequirements.map((v, i) => (
              <span key={i} className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                <Building2 className="mr-1 h-3 w-3 text-slate-400" />
                {v}
              </span>
            ))}
          </div>
        )}
      </div>

      {hasReports && expanded && (
        <div className="ml-4 border-l border-slate-200 pl-2">
          {node.reports.map((reportNode) => (
            <TreeNode key={reportNode.userId} node={reportNode} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function HierarchicalReportView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'tree'
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('All');
  const [selectedUserRecords, setSelectedUserRecords] = useState(null);
  const { showToast } = useToast();

  const loadReportData = async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const res = await apiFetch('/api/p2p/reports/hierarchy');
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json);
      } else {
        throw new Error(json.error || 'Failed to load hierarchy report.');
      }
    } catch (err) {
      showToast({ type: 'error', title: 'Load Error', description: err.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, []);

  const formatCurrency = (amt) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt || 0);
  };

  const rows = data?.rows || [];
  const tree = data?.tree || [];

  const filteredRows = rows.filter((r) => {
    const matchSearch = !search.trim() || [r.userName, r.userEmail, r.userRole, r.department, r.managerName]
      .some((val) => String(val || '').toLowerCase().includes(search.toLowerCase().trim()));
    const matchRole = selectedRole === 'All' || String(r.userRole || '').toLowerCase() === selectedRole.toLowerCase();
    return matchSearch && matchRole;
  });

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] min-h-0 w-full flex-col gap-4 overflow-hidden pb-4 font-sans text-slate-800">
      
      {/* ── Summary Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-teal-200 bg-white p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Users in Scope</span>
            <UsersIcon className="h-4 w-4 text-teal-600" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-teal-900">{data?.summary?.totalUsers || 0}</p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-white p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Verified Records</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-emerald-800">{data?.summary?.totalVerifiedRecords || 0}</p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-white p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending Advance QTs</span>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-amber-700">
            {data?.summary?.totalPendingAdvanceCount || 0} ({formatCurrency(data?.summary?.totalPendingAdvanceAmount)})
          </p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-white p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Invoice Adv. Adjusted</span>
            <Receipt className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-blue-900">{formatCurrency(data?.summary?.totalInvoiceAdvanceAdjusted)}</p>
        </div>
      </div>

      {/* ── Control Bar & View Switcher ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold transition ${
                viewMode === 'grid' ? 'bg-white text-teal-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Report Grid
            </button>

            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold transition ${
                viewMode === 'tree' ? 'bg-white text-teal-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Network className="h-3.5 w-3.5" />
              Hierarchy Tree
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search user, manager or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0d7676]"
            />
          </div>

          <button
            type="button"
            onClick={() => loadReportData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#0d7676] ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div className="flex flex-1 min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-16 text-slate-400 text-xs gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-teal-700" />
            <span>Loading hierarchical report...</span>
          </div>
        ) : viewMode === 'tree' ? (
          <div className="flex-1 overflow-auto p-4">
            {tree.length === 0 ? (
              <p className="text-center py-12 text-xs text-slate-400">No hierarchy tree nodes found.</p>
            ) : (
              tree.map((node) => <TreeNode key={node.userId} node={node} />)
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-3 py-3">User & Role</th>
                  <th className="px-3 py-3">Reporting Line</th>
                  <th className="px-3 py-3 text-center">Verified / Total</th>
                  <th className="px-3 py-3 text-right">Not-Approved Advance QTs</th>
                  <th className="px-3 py-3 text-right">PO Total Amount</th>
                  <th className="px-3 py-3 text-right">Invoice Adv. Adjusted</th>
                  <th className="px-3 py-3">Vendor Requirements</th>
                  <th className="px-3 py-3 text-center">Turnaround</th>
                  <th className="px-3 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">No records match your filters.</td>
                  </tr>
                ) : (
                  filteredRows.map((r) => (
                    <tr key={r.userId} className="hover:bg-slate-50/80 transition">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-50 text-[10px] font-bold text-teal-700 border border-teal-200/60">
                            {r.avatar}
                          </span>
                          <div>
                            <span className="block font-bold text-slate-900">{r.userName}</span>
                            <span className="block text-[10px] text-slate-500">{r.userRole} · {r.department}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-2.5">
                        <span className="block text-slate-800 font-medium">{r.managerName || 'Top Level Executive'}</span>
                        <span className="block text-[10px] font-semibold text-slate-400">Hierarchy Level {r.hierarchyLevel}</span>
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                          {r.verifiedRecordsCount} / {r.totalRecords}
                        </span>
                      </td>

                      <td className="px-3 py-2.5 text-right font-medium text-amber-700">
                        {r.pendingNotApprovedAdvanceCount > 0 ? (
                          <span>{r.pendingNotApprovedAdvanceCount} ({formatCurrency(r.pendingNotApprovedAdvanceAmount)})</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-right font-semibold text-slate-800">
                        {formatCurrency(r.poTotalAmount)}
                      </td>

                      <td className="px-3 py-2.5 text-right font-bold text-teal-700">
                        {formatCurrency(r.invoiceAdvanceAdjustedTotal)}
                      </td>

                      <td className="px-3 py-2.5">
                        {r.vendorRequirements && r.vendorRequirements.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {r.vendorRequirements.slice(0, 2).map((v, i) => (
                              <span key={i} className="truncate max-w-[140px] rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-700">
                                {v}
                              </span>
                            ))}
                            {r.vendorRequirements.length > 2 && (
                              <span className="rounded bg-slate-200 px-1 py-0.5 text-[9px] font-bold text-slate-600">
                                +{r.vendorRequirements.length - 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px]">None</span>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-center font-medium text-slate-600">
                        {r.avgTurnaroundHours ? `${r.avgTurnaroundHours} hrs` : 'N/A'}
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedUserRecords(r)}
                          className="rounded px-2 py-1 text-[10px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200"
                        >
                          Inspect ({r.records.length})
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── User Record Drawer Modal ── */}
      {selectedUserRecords && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setSelectedUserRecords(null)}>
          <section className="modal-panel max-w-2xl">
            <header className="modal-header">
              <div>
                <h3 className="text-sm font-bold text-slate-950">Records for {selectedUserRecords.userName}</h3>
                <p className="mt-0.5 text-xs text-slate-500">{selectedUserRecords.userRole} · {selectedUserRecords.department}</p>
              </div>
              <button type="button" onClick={() => setSelectedUserRecords(null)} className="rounded p-1 text-slate-400 hover:bg-slate-100">✕</button>
            </header>

            <div className="modal-body max-h-[60vh] overflow-y-auto space-y-3 p-4">
              {selectedUserRecords.records.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">No advance or invoice payment records found for this user.</p>
              ) : (
                selectedUserRecords.records.map((rec, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{rec.id}</span>
                        <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[9px] font-bold text-teal-800">{rec.type}</span>
                        {rec.verified && (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">Verified</span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">PO: {rec.poNumber} · Vendor: {rec.vendorName}</p>
                    </div>

                    <div className="text-right">
                      <span className="block font-bold text-slate-900">{formatCurrency(rec.amount)}</span>
                      {rec.advanceAdjusted > 0 && (
                        <span className="block text-[10px] text-teal-700 font-semibold">Adv. Adjusted: {formatCurrency(rec.advanceAdjusted)}</span>
                      )}
                      <span className="block text-[10px] text-slate-400">{rec.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

    </div>
  );
}

function UsersIcon(props) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
