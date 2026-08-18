import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Network, List, Search, Loader2, RefreshCw, ChevronDown, ChevronRight,
  ShieldCheck, AlertCircle, Receipt, Building2, Clock, Calendar, Filter,
  ArrowUpRight, FileText, CheckCircle2, DollarSign, Wallet
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../ui/toast';
import { isFinanceRole } from '../../lib/permissions';


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

      <div className={`relative mb-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs transition-all ${level > 0 ? 'ml-6' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-[240px]">
            {hasReports ? (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 transition"
              >
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : (
              <span className="w-6" />
            )}

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0d7676]/10 font-black text-[#0d7676] text-xs shadow-2xs border border-[#0d7676]/20">
              {node.avatar || node.userName?.slice(0, 2).toUpperCase()}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-extrabold text-slate-900">{node.userName}</h4>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">
                  L{node.hierarchyLevel} · {node.userRole}
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500">{node.userEmail} · {node.department}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="text-right">
              <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Verified Records</span>
              <span className="font-extrabold text-emerald-700">{node.verifiedRecordsCount} / {node.totalRecords}</span>
            </div>

            <div className="text-right">
              <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Pending Advances</span>
              <span className="font-extrabold text-amber-600">{node.pendingNotApprovedAdvanceCount} ({formatCurrency(node.pendingNotApprovedAdvanceAmount)})</span>
            </div>

            <div className="text-right">
              <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Adv. Adjusted</span>
              <span className="font-extrabold text-teal-700">{formatCurrency(node.invoiceAdvanceAdjustedTotal)}</span>
            </div>

            <div className="text-right">
              <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Avg Turnaround</span>
              <span className="font-bold text-slate-700">{node.avgTurnaroundHours ? `${node.avgTurnaroundHours} hrs` : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Associated Vendors pill tags */}
        {node.vendorRequirements && node.vendorRequirements.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5 text-[10px]">
            <span className="font-bold text-slate-400 uppercase tracking-wider">Vendors:</span>
            {node.vendorRequirements.map((v, i) => (
              <span key={i} className="inline-flex items-center rounded-lg bg-slate-50 px-2.5 py-1 font-semibold text-slate-700 border border-slate-200/80">
                <Building2 className="mr-1 h-3 w-3 text-slate-400" />
                {v}
              </span>
            ))}
          </div>
        )}
      </div>

      {hasReports && expanded && (
        <div className="ml-4 border-l-2 border-slate-200/80 pl-2">
          {node.reports.map((reportNode) => (
            <TreeNode key={reportNode.userId} node={reportNode} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function HierarchicalReportView() {
  const { user } = useSelector((state) => state.auth);
  const userRole = user?.role;
  const [data, setData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('upcoming7d'); // 'upcoming7d' | 'grid' | 'tree' | 'vendors'
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('All');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('All');
  const [selectedUrgencyFilter, setSelectedUrgencyFilter] = useState('All');
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

  const formatCurrency = (amt, currency = 'INR') => {
    if (currency !== 'INR') {
      const symbolMap = { USD: '$', EUR: '€', GBP: '£' };
      const sym = symbolMap[currency] || currency;
      return `${sym}${(amt || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt || 0);
  };

  const totalAvailableBalance = Math.max(0, (data?.summary?.totalPoValue || 0) - (data?.summary?.totalPoCommittedAmount || 0));

  const rows = data?.rows || [];
  const tree = data?.tree || [];
  const upcomingFinancePayments = data?.upcomingFinancePayments || [];
  
  const vendorRows = (data?.vendorRows || []).filter((vendor) =>
    !search.trim() || [vendor.vendorName, vendor.vendorCode, vendor.vendorType, ...(vendor.requesters || [])]
      .some((value) => String(value || '').toLowerCase().includes(search.toLowerCase().trim()))
  );

  const filteredRows = rows.filter((r) => {
    const matchSearch = !search.trim() || [r.userName, r.userEmail, r.userRole, r.department, r.managerName]
      .some((val) => String(val || '').toLowerCase().includes(search.toLowerCase().trim()));
    const matchRole = selectedRole === 'All' || String(r.userRole || '').toLowerCase() === selectedRole.toLowerCase();
    return matchSearch && matchRole;
  });

  const filteredUpcomingPayments = upcomingFinancePayments.filter((item) => {
    const matchSearch = !search.trim() || [item.id, item.vendorName, item.poNumber, item.requestedBy, item.status]
      .some((val) => String(val || '').toLowerCase().includes(search.toLowerCase().trim()));
    const matchType = selectedTypeFilter === 'All' || item.type === selectedTypeFilter;
    const matchUrgency = selectedUrgencyFilter === 'All' || item.urgency === selectedUrgencyFilter;
    return matchSearch && matchType && matchUrgency;
  });

  const overdueOrTodayCount = upcomingFinancePayments.filter(i => i.urgency === 'overdue' || i.urgency === 'today').length;
  const overdueOrTodayTotalINR = upcomingFinancePayments.filter(i => i.urgency === 'overdue' || i.urgency === 'today').reduce((sum, i) => sum + (i.amountINR || 0), 0);

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] min-h-0 w-full flex-col gap-4 overflow-hidden pb-4 font-sans text-slate-800">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-black tracking-tight text-slate-900">Financial Hierarchy & Payment Forecast</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-teal-50 text-[#0d7676] border border-teal-200">
              Finance Audit & Cash Flow
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Department spend matrix, organizational reporting hierarchy, and 7-day Finance approval projections
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => loadReportData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50 shadow-2xs transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#0d7676] ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Report'}</span>
          </button>
        </div>
      </div>

      {/* ── Executive Summary Metrics Bar ── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 shrink-0">
        {/* Metric 1 */}
        <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-white to-teal-50/30 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Requests</span>
            <UsersIcon className="h-4 w-4 text-teal-600" />
          </div>
          <p className="mt-1 text-xl font-black text-slate-900">{rows.reduce((sum, row) => sum + row.totalRecords, 0)}</p>
          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{data?.summary?.totalUsers || 0} users in {data?.currentUser?.reportScope || 'self'} scope</p>
        </div>

        {/* Metric 2 */}
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Linked PO Value</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-1 text-lg font-black text-emerald-800">{formatCurrency(data?.summary?.totalPoValue)}</p>
          <p className="text-[10px] font-semibold text-emerald-600 mt-0.5">Total PO commitments</p>
        </div>

        {/* Metric 3: Paid */}
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50/30 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Disbursed / Paid</span>
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-1 text-lg font-black text-blue-900">{formatCurrency(data?.summary?.totalPaidAmount)}</p>
          <p className="text-[10px] font-semibold text-blue-600 mt-0.5">Bank disbursements completed</p>
        </div>

        {/* Metric 4: Approved / Payable */}
        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-white to-indigo-50/30 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Approved / Payable</span>
            <Receipt className="h-4 w-4 text-indigo-600" />
          </div>
          <p className="mt-1 text-lg font-black text-indigo-900">{formatCurrency(data?.summary?.totalApprovedAmount)}</p>
          <p className="text-[10px] font-semibold text-indigo-600 mt-0.5">Ready for release</p>
        </div>

        {/* Metric 5: Upcoming 7D Finance Queue (HIGHLIGHT CARD) */}
        <div 
          onClick={() => setViewMode('upcoming7d')}
          className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50/40 p-3.5 shadow-2xs cursor-pointer hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-600 animate-pulse" /> 7-Day Finance Queue
            </span>
            <ArrowUpRight className="h-4 w-4 text-amber-700 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
          <p className="mt-1 text-lg font-black text-amber-950">{formatCurrency(data?.summary?.upcoming7dFinanceTotalINR || 0)}</p>
          <p className="text-[10px] font-extrabold text-amber-700 mt-0.5">
            {data?.summary?.upcoming7dFinanceCount || upcomingFinancePayments.length} upcoming 7d payments
          </p>
        </div>

        {/* Metric 6: Available Balance */}
        <div className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-white to-cyan-50/40 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-800">Uncommitted Balance</span>
            <Wallet className="h-4 w-4 text-cyan-600" />
          </div>
          <p className="mt-1 text-lg font-black text-cyan-950">{formatCurrency(totalAvailableBalance)}</p>
          <p className="text-[10px] font-semibold text-cyan-600 mt-0.5">PO budget remaining</p>
        </div>
      </div>

      {/* ── Control Bar & View Tabs Switcher ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          <div className="inline-flex rounded-xl bg-slate-100/80 p-1 border border-slate-200/60">
            {/* Tab 1: 7-Day Finance Payments (PRIMARY / NEW) */}
            <button
              type="button"
              onClick={() => setViewMode('upcoming7d')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-extrabold transition ${
                viewMode === 'upcoming7d'
                  ? 'bg-gradient-to-r from-[#0d7676] to-teal-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Clock className={`h-3.5 w-3.5 ${viewMode === 'upcoming7d' ? 'text-white' : 'text-amber-600'}`} />
              <span>7-Day Finance Payments</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                viewMode === 'upcoming7d' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                {upcomingFinancePayments.length}
              </span>
            </button>

            {/* Tab 2: Report Grid */}
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-extrabold transition ${
                viewMode === 'grid' ? 'bg-white text-[#0d7676] shadow-2xs border border-slate-200/80' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>User Spend Grid</span>
            </button>

            {/* Tab 3: Hierarchy Tree */}
            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-extrabold transition ${
                viewMode === 'tree' ? 'bg-white text-[#0d7676] shadow-2xs border border-slate-200/80' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Network className="h-3.5 w-3.5" />
              <span>Hierarchy Tree</span>
            </button>

            {/* Tab 4: Vendor Report */}
            <button
              type="button"
              onClick={() => setViewMode('vendors')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-extrabold transition ${
                viewMode === 'vendors' ? 'bg-white text-[#0d7676] shadow-2xs border border-slate-200/80' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Vendor Summary ({data?.summary?.totalVendors || 0})</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={
                viewMode === 'upcoming7d'
                  ? "Search ID, vendor, PO or requester..."
                  : "Search user, manager or role..."
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-9 pr-3 py-1.5 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0d7676]"
            />
          </div>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div className="flex flex-1 min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-16 text-slate-400 text-xs gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-[#0d7676]" />
            <span className="font-bold">Loading hierarchy & 7-day payment projections...</span>
          </div>
        ) : viewMode === 'upcoming7d' ? (
          /* ── UPCOMING 7-DAY FINANCE PAYMENTS VIEW ── */
          <div className="flex flex-1 flex-col overflow-hidden">
            
            {/* Filter Bar for 7D View */}
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Filter Type:
                </span>
                {['All', 'Advance Payment', 'Invoice Payment', 'Logistics Payment', 'Custom Duty'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedTypeFilter(type)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      selectedTypeFilter === type
                        ? 'bg-[#0d7676] text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Urgency:</span>
                {[
                  { id: 'All', label: 'All 7 Days' },
                  { id: 'overdue', label: 'Overdue' },
                  { id: 'today', label: 'Due Today' },
                  { id: 'urgent', label: '1–3 Days' },
                  { id: 'upcoming', label: '4–7 Days' }
                ].map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUrgencyFilter(u.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      selectedUrgencyFilter === u.id
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-xs text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 z-10">
                  <tr>
                    <th className="px-4 py-3.5">Urgency & Due Date</th>
                    <th className="px-4 py-3.5">Reference ID & Type</th>
                    <th className="px-4 py-3.5">Vendor & SAP PO</th>
                    <th className="px-4 py-3.5">Requested By</th>
                    <th className="px-4 py-3.5 text-right">Amount (Original)</th>
                    <th className="px-4 py-3.5 text-right">Amount (INR)</th>
                    <th className="px-4 py-3.5 text-center">Finance Status</th>
                    <th className="px-4 py-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredUpcomingPayments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-slate-400">
                        <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-extrabold text-sm text-slate-600">No 7-day upcoming finance payments match your filter.</p>
                        <p className="text-xs text-slate-400 mt-1">All payment requests are either processed or fall outside the 7-day window.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredUpcomingPayments.map((item) => {
                      const typeBadgeCls = 
                        item.type === 'Advance Payment' ? 'bg-sky-100 text-sky-800 border-sky-300' :
                        item.type === 'Invoice Payment' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                        item.type === 'Logistics Payment' ? 'bg-indigo-100 text-indigo-800 border-indigo-300' :
                        'bg-purple-100 text-purple-800 border-purple-300';

                      const urgencyCls =
                        item.urgency === 'overdue' ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse' :
                        item.urgency === 'today' ? 'bg-orange-100 text-orange-800 border-orange-300 font-black' :
                        item.urgency === 'urgent' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                        'bg-teal-100 text-teal-800 border-teal-300';

                      const urgencyLabel =
                        item.urgency === 'overdue' ? `Overdue (${Math.abs(item.daysRemaining)}d)` :
                        item.urgency === 'today' ? 'DUE TODAY' :
                        item.daysRemaining === 1 ? 'Due Tomorrow' :
                        `Due in ${item.daysRemaining} Days`;

                      return (
                        <tr key={item.id} className="hover:bg-teal-50/20 transition duration-150">
                          {/* Urgency */}
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase border ${urgencyCls}`}>
                              <Clock className="w-3 h-3" />
                              {urgencyLabel}
                            </span>
                            <p className="text-[10px] text-slate-400 mt-1 font-semibold">
                              Target: {item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </p>
                          </td>

                          {/* Reference ID & Type */}
                          <td className="px-4 py-3.5">
                            {(() => {
                              const isFinanceUser = isFinanceRole(userRole);
                              if (isFinanceUser && !item.dueDate) {
                                return (
                                  <span className="font-mono text-xs font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 block" title="Request number is hidden for Finance until a due date is specified">
                                    [Pending Due Date]
                                  </span>
                                );
                              }
                              return <span className="font-mono font-extrabold text-slate-900 text-xs block">{item.id}</span>;
                            })()}
                            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold border ${typeBadgeCls}`}>
                              {item.type}
                            </span>
                          </td>

                          {/* Vendor & SAP PO */}
                          <td className="px-4 py-3.5">
                            <p className="font-bold text-slate-900 text-xs truncate max-w-[200px]">{item.vendorName}</p>
                            <p className="text-[11px] font-mono text-[#0d7676] font-bold mt-0.5">PO: {item.poNumber}</p>
                          </td>

                          {/* Requested By */}
                          <td className="px-4 py-3.5">
                            <p className="font-bold text-slate-800">{item.requestedBy}</p>
                            <p className="text-[10px] text-slate-400 font-semibold">{item.department || 'Finance'}</p>
                          </td>

                          {/* Amount Original */}
                          <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-800">
                            {formatCurrency(item.amount, item.currency)}
                          </td>

                          {/* Amount INR */}
                          <td className="px-4 py-3.5 text-right font-mono font-black text-[#0d7676] text-xs">
                            {formatCurrency(item.amountINR, 'INR')}
                          </td>

                          {/* Finance Status */}
                          <td className="px-4 py-3.5 text-center">
                            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                              {item.status}
                            </span>
                            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Role: {item.assignedApproverRole}</p>
                          </td>

                          {/* Action */}
                          <td className="px-4 py-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedUserRecords({
                                userName: item.vendorName,
                                userRole: item.type,
                                department: item.department || 'Finance Department',
                                records: [{
                                  id: item.id,
                                  type: item.type,
                                  poNumber: item.poNumber,
                                  vendorName: item.vendorName,
                                  amount: item.amount,
                                  currency: item.currency,
                                  status: item.status,
                                  verified: false,
                                  createdAt: item.createdAt,
                                  advanceAdjusted: 0,
                                  createdByName: item.requestedBy
                                }]
                              })}
                              className="px-3 py-1 rounded-lg text-[10px] font-bold text-[#0d7676] bg-teal-50 hover:bg-teal-100 border border-teal-200 transition"
                            >
                              Inspect Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : viewMode === 'vendors' ? (
          /* ── VENDOR REPORT VIEW ── */
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-4 py-3.5">Vendor</th>
                  <th className="px-4 py-3.5">Requesters / Creators</th>
                  <th className="px-4 py-3.5 text-center">Records</th>
                  <th className="px-4 py-3.5 text-right">Advances</th>
                  <th className="px-4 py-3.5 text-right">Invoices</th>
                  <th className="px-4 py-3.5 text-right">Pending</th>
                  <th className="px-4 py-3.5 text-right">Paid</th>
                  <th className="px-4 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendorRows.length === 0 ? (
                  <tr><td colSpan={8} className="py-12 text-center text-slate-400">No vendor payment records found.</td></tr>
                ) : vendorRows.map((vendor) => (
                  <tr key={vendor.vendorId} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <span className="block font-extrabold text-slate-900">{vendor.vendorName}</span>
                      <span className="text-[10px] font-semibold text-slate-500">{vendor.vendorCode || 'No Code'} · {vendor.vendorType || 'Vendor'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {vendor.requesters.map((name) => (
                          <span key={name} className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-700 border border-slate-200">
                            {name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-extrabold text-slate-900">{vendor.totalRecords}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">{formatCurrency(vendor.advanceTotal)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">{formatCurrency(vendor.invoiceTotal)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-amber-700">{formatCurrency(vendor.pendingTotal)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{formatCurrency(vendor.paidTotal)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedUserRecords({ userName: vendor.vendorName, userRole: 'Vendor Report', department: vendor.vendorType || 'Vendor', records: vendor.records })}
                        className="rounded-lg px-2.5 py-1 text-[10px] font-bold text-[#0d7676] bg-teal-50 hover:bg-teal-100 border border-teal-200 transition"
                      >
                        Inspect ({vendor.totalRecords})
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : viewMode === 'tree' ? (
          /* ── HIERARCHY TREE VIEW ── */
          <div className="flex-1 overflow-auto p-5 bg-slate-50/40">
            {tree.length === 0 ? (
              <p className="text-center py-12 text-xs font-semibold text-slate-400">No hierarchy tree nodes found.</p>
            ) : (
              tree.map((node) => <TreeNode key={node.userId} node={node} />)
            )}
          </div>
        ) : (
          /* ── REPORT GRID VIEW ── */
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-4 py-3.5">User & Role</th>
                  <th className="px-4 py-3.5">Reporting Line</th>
                  <th className="px-4 py-3.5 text-center">Requests</th>
                  <th className="px-4 py-3.5 text-right">Advances</th>
                  <th className="px-4 py-3.5 text-right">Invoices / Other</th>
                  <th className="px-4 py-3.5 text-right">Paid</th>
                  <th className="px-4 py-3.5 text-right">Pending</th>
                  <th className="px-4 py-3.5 text-right">PO / Balance</th>
                  <th className="px-4 py-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-semibold">No user records match your search filters.</td>
                  </tr>
                ) : (
                  filteredRows.map((r) => (
                    <tr key={r.userId} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-[10px] font-black text-teal-800 border border-teal-200 shrink-0">
                            {r.avatar}
                          </span>
                          <div>
                            <span className="block font-extrabold text-slate-900">{r.userName}</span>
                            <span className="block text-[10px] font-semibold text-slate-500">{r.userRole} · {r.department}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="block text-slate-800 font-bold">{r.managerName || 'Executive Leadership'}</span>
                        <span className="block text-[10px] font-semibold text-slate-400">Level {r.hierarchyLevel}</span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800 border border-emerald-200">
                          {r.totalRecords}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                        {formatCurrency(r.advancePaymentTotal)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">
                        <span className="block">Inv: {formatCurrency(r.invoicePaymentTotal)}</span>
                        <span className="text-[9px] text-slate-400 font-sans">Logistics {formatCurrency(r.logisticsPaymentTotal)} · Duty {formatCurrency(r.customDutyTotal)}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black text-blue-900">{formatCurrency(r.paidAmount)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="block font-mono font-black text-amber-700">{formatCurrency((r.approvedAmount || 0) + (r.pendingAmount || 0))}</span>
                        <span className="text-[9px] font-semibold text-slate-400">approved + pending</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="block font-mono font-semibold text-slate-700">{formatCurrency(r.poTotalAmount)}</span>
                        <span className="block font-mono font-black text-cyan-800">Bal: {formatCurrency(r.availableBalance)}</span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedUserRecords(r)}
                          className="rounded-lg px-2.5 py-1 text-[10px] font-bold text-[#0d7676] bg-teal-50 hover:bg-teal-100 border border-teal-200 transition"
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

      {/* ── User / Payment Record Details Drawer Modal ── */}
      {selectedUserRecords && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setSelectedUserRecords(null)}>
          <section className="modal-panel max-w-2xl">
            <header className="modal-header">
              <div>
                <h3 className="text-sm font-extrabold text-slate-950">Payment Records for {selectedUserRecords.userName}</h3>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">{selectedUserRecords.userRole} · {selectedUserRecords.department}</p>
              </div>
              <button type="button" onClick={() => setSelectedUserRecords(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 transition">✕</button>
            </header>

            <div className="modal-body max-h-[60vh] overflow-y-auto space-y-3 p-4">
              {selectedUserRecords.records.length === 0 ? (
                <p className="py-6 text-center text-xs font-semibold text-slate-400">No payment records found for this entry.</p>
              ) : (
                selectedUserRecords.records.map((rec, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs shadow-2xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-slate-900">{rec.id}</span>
                        <span className="rounded-md bg-teal-100 px-2 py-0.5 text-[9px] font-extrabold text-teal-800 border border-teal-200">{rec.type}</span>
                        {rec.verified && (
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[9px] font-extrabold text-emerald-800 border border-emerald-200">Verified</span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] font-medium text-slate-500">PO: {rec.poNumber} · Vendor: {rec.vendorName}</p>
                      {rec.createdByName && (
                        <p className={`mt-0.5 text-[10px] font-bold ${rec.createdByType === 'vendor' ? 'text-violet-700' : 'text-slate-500'}`}>
                          Created by {rec.createdByType === 'vendor' ? 'Vendor' : 'User'}: {rec.createdByName}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="block font-mono font-extrabold text-slate-900">{formatCurrency(rec.amount, rec.currency)}</span>
                      {rec.advanceAdjusted > 0 && (
                        <span className="block text-[10px] text-teal-700 font-bold mt-0.5">Adv. Adjusted: {formatCurrency(rec.advanceAdjusted)}</span>
                      )}
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">{rec.status}</span>
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
