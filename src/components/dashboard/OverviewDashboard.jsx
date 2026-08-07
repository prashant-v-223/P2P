// OverviewDashboard.jsx - Pixel-Perfect Aligned Rayzon P2P Dashboard (100% Real Live Database Data)
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  FileText, Clock, CheckSquare, Package, Users, Wallet,
  Receipt, Shield, Plus, RefreshCw, Cloud, ArrowUpRight,
  TrendingUp, CreditCard, FileSpreadsheet, Lock, Zap, CheckCircle2
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { apiFetch } from '../../services/api';
import { fetchPendingApprovals } from '../../features/approvals/approvalsSlice';

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function OverviewDashboard() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const res = await apiFetch('/api/p2p/dashboard/analytics');
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (error) {
      console.error('Error loading dashboard analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    dispatch(fetchPendingApprovals(user?.role));
  }, [loadData, dispatch, user?.role]);

  // Real Database Metrics & Dynamic Datasets
  const stats = data?.stats || {
    purchaseOrders: 0,
    purchaseOrdersSub: '0 open',
    pendingApprovals: 0,
    pendingApprovalsSub: 'Awaiting action',
    rfqs: 0,
    rfqsSub: '0 awarded',
    blEntries: 0,
    blEntriesSub: '0 cleared',
    activeVendors: 0,
    activeVendorsSub: 'Supplier base',
    advancesPaid: '₹0',
    advancesPaidSub: 'Released payments',
    invoicesPaid: '₹0',
    invoicesPaidSub: 'Completed Invoices',
    dutyPaid: '₹0',
    dutyPaidSub: 'Cleared duties'
  };

  const activityData = data?.last6MonthsActivity || [
    { month: 'Mar', Advances: 0, Invoices: 0, RFQs: 0, BlEntries: 0 },
    { month: 'Apr', Advances: 0, Invoices: 0, RFQs: 0, BlEntries: 0 },
    { month: 'May', Advances: 0, Invoices: 0, RFQs: 0, BlEntries: 0 },
    { month: 'Jun', Advances: 0, Invoices: 0, RFQs: 0, BlEntries: 0 },
    { month: 'Jul', Advances: 0, Invoices: 0, RFQs: 0, BlEntries: 0 },
    { month: 'Aug', Advances: 0, Invoices: 0, RFQs: 0, BlEntries: 0 }
  ];

  const paymentStatusMix = data?.paymentStatusMix || { draft: 0, pending: 0, rejected: 0, total: 0 };
  
  const statusPieData = [
    { name: 'Draft', value: paymentStatusMix.draft || 0, color: '#94a3b8' },
    { name: 'Pending', value: paymentStatusMix.pending || 0, color: '#f59e0b' },
    { name: 'Rejected', value: paymentStatusMix.rejected || 0, color: '#ef4444' }
  ].filter(d => d.value > 0);

  const currencyDist = data?.currencyDistribution || {
    inrTxns: 0,
    usdTxns: 0,
    inrAdvances: 0,
    usdAdvances: 0,
    inrInvoices: 0,
    usdInvoices: 0
  };

  const currencyBarData = [
    { currency: 'INR', Advances: currencyDist.inrAdvances || 0, Invoices: currencyDist.inrInvoices || 0 },
    { currency: 'USD', Advances: currencyDist.usdAdvances || 0, Invoices: currencyDist.usdInvoices || 0 }
  ];

  const approvalPipeline = data?.approvalPipeline || {
    advance: { pending: 0, approved: 0, rejected: 0 },
    invoice: { pending: 0, approved: 0, rejected: 0 },
    rfq: { pending: 0, approved: 0, rejected: 0 },
    blInvoice: { pending: 0, approved: 0, rejected: 0 }
  };

  const rfqFunnel = data?.rfqFunnel || { draft: 0, sent: 0, quoted: 0, awarded: 0, closed: 0, total: 0 };
  const blPipeline = data?.blPipeline || { assigned: 0, cleared: 0, invPending: 0, pmtReq: 0, approved: 0, paid: 0, total: 0 };
  
  const { pendingQueue = [], pendingCount = 0 } = useSelector((state) => state.approvals || {});

  // Actionable pending count & queue for the user's role (matching sidebar count)
  const displayPendingCount = pendingCount > 0 ? pendingCount : (data?.recentPendingApprovals ? data.recentPendingApprovals.length : 0);

  const displayPendingList = (pendingQueue && pendingQueue.length > 0)
    ? pendingQueue.map(a => ({
        id: a.id || a.referenceId || a._id,
        stepText: a.status || `Step ${a.currentStep || 1}`,
        dateText: a.submittedAt ? new Date(a.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Recent'
      }))
    : (data?.recentPendingApprovals || []);

  const recentActivity = data?.recentActivity || [];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans space-y-6">
      
      {/* ── HEADER ROW (ALIGNED) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Hello, {user?.name || 'System Admin'}
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            Analytics overview of your P2P system.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition shadow-2xs"
            title="Refresh analytics from database"
          >
            <RefreshCw className={cn('w-4 h-4 text-[#0d7676]', refreshing && 'animate-spin')} />
          </button>

          <button
            onClick={() => navigate('/p2p/sap-sync')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <Cloud className="w-4 h-4 text-sky-500" />
            <span>SAP Sync</span>
          </button>
        </div>
      </div>

      {/* ── STAT CARDS GRID (PERFECTLY ALIGNED 4-COLUMNS) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        
        {/* 1. PURCHASE ORDERS */}
        <div 
          onClick={() => navigate('/p2p/purchase-orders')}
          className="relative bg-[#f0f9ff]/70 border border-sky-200/80 rounded-2xl p-5 cursor-pointer transition hover:shadow-md hover:border-sky-300 flex flex-col justify-between overflow-hidden min-h-[128px]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold text-sky-700 uppercase tracking-wider">PURCHASE ORDERS</p>
              <p className="text-3xl font-black text-slate-900 mt-2">{stats.purchaseOrders}</p>
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-sky-100/80 text-sky-700 text-[11px] font-bold">
                {stats.purchaseOrdersSub}
              </span>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-sky-100 flex items-center justify-center text-sky-600 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-sky-500 rounded-b-2xl" />
        </div>

        {/* 2. PENDING APPROVALS */}
        <div 
          onClick={() => navigate('/approvals')}
          className="relative bg-[#fffbeb]/70 border border-amber-200/80 rounded-2xl p-5 cursor-pointer transition hover:shadow-md hover:border-amber-300 flex flex-col justify-between overflow-hidden min-h-[128px]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">PENDING APPROVALS</p>
              <p className="text-3xl font-black text-slate-900 mt-2">{displayPendingCount}</p>
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-amber-100/80 text-amber-700 text-[11px] font-bold">
                {displayPendingCount} awaiting your action
              </span>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500 rounded-b-2xl" />
        </div>

        {/* 3. RFQS */}
        <div 
          onClick={() => navigate('/p2p/rfq')}
          className="relative bg-[#f0fdf4]/70 border border-emerald-200/80 rounded-2xl p-5 cursor-pointer transition hover:shadow-md hover:border-emerald-300 flex flex-col justify-between overflow-hidden min-h-[128px]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">RFQS</p>
              <p className="text-3xl font-black text-slate-900 mt-2">{stats.rfqs}</p>
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-emerald-100/80 text-emerald-700 text-[11px] font-bold">
                {stats.rfqsSub}
              </span>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-b-2xl" />
        </div>

        {/* 4. BL ENTRIES */}
        <div 
          onClick={() => navigate('/p2p/bl-invoices')}
          className="relative bg-[#f0fdfa]/70 border border-teal-200/80 rounded-2xl p-5 cursor-pointer transition hover:shadow-md hover:border-teal-300 flex flex-col justify-between overflow-hidden min-h-[128px]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold text-teal-700 uppercase tracking-wider">BL ENTRIES</p>
              <p className="text-3xl font-black text-slate-900 mt-2">{stats.blEntries}</p>
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-teal-100/80 text-teal-700 text-[11px] font-bold">
                {stats.blEntriesSub}
              </span>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-600 shrink-0">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-teal-500 rounded-b-2xl" />
        </div>

        {/* 5. ACTIVE VENDORS */}
        <div 
          onClick={() => navigate('/p2p/vendors')}
          className="bg-white border border-slate-200/80 rounded-2xl p-5 cursor-pointer transition hover:shadow-md hover:border-slate-300 flex flex-col justify-between min-h-[128px]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ACTIVE VENDORS</p>
              <p className="text-3xl font-black text-slate-900 mt-2">{stats.activeVendors}</p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">{stats.activeVendorsSub}</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* 6. ADVANCES PAID */}
        <div 
          onClick={() => navigate('/p2p/advances')}
          className="bg-white border border-slate-200/80 rounded-2xl p-5 cursor-pointer transition hover:shadow-md hover:border-indigo-300 flex flex-col justify-between min-h-[128px]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ADVANCES PAID</p>
              <p className="text-3xl font-black text-slate-900 mt-2">{stats.advancesPaid}</p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">{stats.advancesPaidSub}</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* 7. INVOICES PAID */}
        <div 
          onClick={() => navigate('/p2p/invoices')}
          className="bg-white border border-slate-200/80 rounded-2xl p-5 cursor-pointer transition hover:shadow-md hover:border-sky-300 flex flex-col justify-between min-h-[128px]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">INVOICES PAID</p>
              <p className="text-3xl font-black text-slate-900 mt-2">{stats.invoicesPaid}</p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">{stats.invoicesPaidSub}</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-600 shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* 8. DUTY PAID */}
        <div 
          onClick={() => navigate('/p2p/custom-duty')}
          className="bg-white border border-slate-200/80 rounded-2xl p-5 cursor-pointer transition hover:shadow-md hover:border-rose-300 flex flex-col justify-between min-h-[128px]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">DUTY PAID</p>
              <p className="text-3xl font-black text-slate-900 mt-2">{stats.dutyPaid}</p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">{stats.dutyPaidSub}</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
          </div>
        </div>

      </div>

      {/* ── QUICK ACTIONS STRIP (ALIGNED) ── */}
      <div className="space-y-3">
        <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          QUICK ACTIONS
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/p2p/advance-payments/create')}
            className="flex items-center gap-3 p-4 bg-[#f0f9ff]/80 border border-sky-200/80 rounded-2xl hover:bg-sky-50 transition text-left shadow-2xs group"
          >
            <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-sky-700">Advance Payment</span>
          </button>

          <button
            onClick={() => navigate('/admin/rfqs/create')}
            className="flex items-center gap-3 p-4 bg-[#f0fdf4]/80 border border-emerald-200/80 rounded-2xl hover:bg-emerald-50 transition text-left shadow-2xs group"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">Create RFQ</span>
          </button>

          <button
            onClick={() => navigate('/p2p/invoice-payments/create')}
            className="flex items-center gap-3 p-4 bg-[#f0f9ff]/80 border border-sky-200/80 rounded-2xl hover:bg-sky-50 transition text-left shadow-2xs group"
          >
            <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-sky-700">Invoice Payment</span>
          </button>

          <button
            onClick={() => navigate('/p2p/custom-duty')}
            className="flex items-center gap-3 p-4 bg-[#f0fdfa]/80 border border-teal-200/80 rounded-2xl hover:bg-teal-50 transition text-left shadow-2xs group"
          >
            <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-teal-700">Custom Duty</span>
          </button>
        </div>
      </div>

      {/* ── ROW 1: ACTIVITY & PAYMENT STATUS MIX ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Line Chart: Activity - Last 6 Months */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-500" />
              Activity - Last 6 Months
            </h3>
            <span className="text-[11px] font-medium text-slate-400">transaction counts</span>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={activityData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} fontWeight={600} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} fontWeight={600} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px' }}
                labelStyle={{ fontWeight: 'bold' }}
              />
              <Legend 
                verticalAlign="top" 
                align="center"
                wrapperStyle={{ fontSize: '11px', fontWeight: 600, paddingBottom: '10px' }}
              />
              <Line type="monotone" dataKey="Advances" stroke="#a855f7" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Invoices" stroke="#0284c7" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="RFQs" stroke="#10b981" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="BlEntries" stroke="#0d7676" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Donut Chart: Payment Status Mix */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Payment Status Mix</h3>
          </div>

          {statusPieData.length > 0 ? (
            <div className="relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total</span>
                <span className="text-2xl font-black text-slate-800">{paymentStatusMix.total || 0}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 text-xs">
              No status data available
            </div>
          )}

          <div className="flex items-center justify-center gap-4 text-[11px] font-bold text-slate-600">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Draft ({paymentStatusMix.draft})</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Pending ({paymentStatusMix.pending})</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Rejected ({paymentStatusMix.rejected})</span>
          </div>
        </div>

      </div>

      {/* ── ROW 2: CURRENCY DISTRIBUTION & APPROVAL PIPELINE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Currency Distribution */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Currency Distribution</h3>
              <p className="text-[11px] text-slate-400">Multi-currency breakdown — amounts intentionally omitted</p>
            </div>
            <span className="text-[11px] text-slate-400">transaction count per currency</span>
          </div>

          <ResponsiveContainer width="100%" height={160}>
            <BarChart layout="vertical" data={currencyBarData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" stroke="#94a3b8" fontSize={11} />
              <YAxis dataKey="currency" type="category" stroke="#94a3b8" fontSize={11} fontWeight={600} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
              <Bar dataKey="Advances" fill="#818cf8" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Invoices" fill="#38bdf8" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="flex items-center gap-3 pt-2">
            <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">
              INR <span className="text-slate-400 font-normal">{currencyDist.inrTxns} txns</span>
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">
              USD <span className="text-slate-400 font-normal">{currencyDist.usdTxns} txns</span>
            </span>
          </div>
        </div>

        {/* Approval Pipeline */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-5">
          <h3 className="text-sm font-bold text-slate-800">Approval Pipeline</h3>

          <div className="space-y-4">
            {/* Advance */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="text-sky-600">Advance</span>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                  <span className="text-amber-600 font-bold">{approvalPipeline.advance.pending} pending</span>
                  <span>{approvalPipeline.advance.approved} approved</span>
                  <span>{approvalPipeline.advance.rejected} rejected</span>
                </div>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-400 rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min(100, (approvalPipeline.advance.pending * 20) || 5)}%` }} 
                />
              </div>
            </div>

            {/* Invoice */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="text-sky-600">Invoice</span>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                  <span className="text-amber-600 font-bold">{approvalPipeline.invoice.pending} pending</span>
                  <span>{approvalPipeline.invoice.approved} approved</span>
                  <span>{approvalPipeline.invoice.rejected} rejected</span>
                </div>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min(100, (approvalPipeline.invoice.pending * 15) || 5)}%` }} 
                />
              </div>
            </div>

            {/* RFQ */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="text-teal-600">RFQ</span>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                  <span className="text-amber-600 font-bold">{approvalPipeline.rfq.pending} pending</span>
                  <span>{approvalPipeline.rfq.approved} approved</span>
                  <span>{approvalPipeline.rfq.rejected} rejected</span>
                </div>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min(100, (approvalPipeline.rfq.approved * 10) || 5)}%` }} 
                />
              </div>
            </div>

            {/* BL Invoice */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="text-teal-600">BL Invoice</span>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                  <span className="text-amber-600 font-bold">{approvalPipeline.blInvoice.pending} pending</span>
                  <span>{approvalPipeline.blInvoice.approved} approved</span>
                  <span>{approvalPipeline.blInvoice.rejected} rejected</span>
                </div>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-teal-500 rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min(100, (approvalPipeline.blInvoice.approved * 20) || 5)}%` }} 
                />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── ROW 3: RFQ FUNNEL & BL CLEARANCE PIPELINE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* RFQ Funnel */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">RFQ Funnel</h3>
            <span className="text-xs font-bold text-slate-400">{rfqFunnel.total} total</span>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Draft', val: rfqFunnel.draft },
              { label: 'Sent', val: rfqFunnel.sent },
              { label: 'Quoted', val: rfqFunnel.quoted },
              { label: 'Awarded', val: rfqFunnel.awarded, color: 'bg-emerald-500' },
              { label: 'Closed', val: rfqFunnel.closed }
            ].map((f) => {
              const pct = rfqFunnel.total > 0 ? Math.round((f.val / rfqFunnel.total) * 100) : 0;
              return (
                <div key={f.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                    <span>{f.label}</span>
                    <span className="font-bold">{f.val}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all duration-300', f.color || 'bg-slate-300')} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2">
            <button
              onClick={() => navigate('/p2p/rfq')}
              className="text-xs font-bold text-sky-600 hover:underline inline-flex items-center gap-1"
            >
              View all RFQs →
            </button>
          </div>
        </div>

        {/* BL Clearance Pipeline */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">BL Clearance Pipeline</h3>
            <span className="text-xs font-bold text-slate-400">{blPipeline.total} total</span>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Assigned', val: blPipeline.assigned, color: 'bg-sky-500' },
              { label: 'Cleared', val: blPipeline.cleared, color: 'bg-teal-500' },
              { label: 'Inv. Pending', val: blPipeline.invPending, color: 'bg-amber-500' },
              { label: 'Pmt Req.', val: blPipeline.pmtReq, color: 'bg-indigo-500' },
              { label: 'Approved', val: blPipeline.approved, color: 'bg-emerald-500' },
              { label: 'Paid', val: blPipeline.paid, color: 'bg-purple-500' }
            ].map((f) => {
              const pct = blPipeline.total > 0 ? Math.round((f.val / blPipeline.total) * 100) : 0;
              return (
                <div key={f.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                    <span>{f.label}</span>
                    <span className="font-bold">{f.val}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all duration-300', f.val > 0 ? f.color : 'bg-slate-200')} style={{ width: f.val > 0 ? `${Math.max(12, pct)}%` : '0%' }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2">
            <button
              onClick={() => navigate('/p2p/bl-invoices')}
              className="text-xs font-bold text-sky-600 hover:underline inline-flex items-center gap-1"
            >
              View all BL entries →
            </button>
          </div>
        </div>

      </div>

      {/* ── ROW 4: PENDING APPROVALS LIST & RECENT ACTIVITY ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Pending Approvals List */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-800">Pending Approvals</h3>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                {displayPendingList.length}
              </span>
            </div>
            <button
              onClick={() => navigate('/approvals')}
              className="text-xs font-bold text-sky-600 hover:underline inline-flex items-center gap-1"
            >
              View all →
            </button>
          </div>

          <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
            {displayPendingList.length > 0 ? (
              displayPendingList.map((item, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100 hover:bg-slate-100/70 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 font-mono">{item.id}</p>
                      <p className="text-[11px] text-slate-400 font-medium">{item.stepText} · {item.dateText}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate('/approvals')}
                    className="px-3 py-1.5 rounded-xl border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 text-xs font-bold transition flex items-center gap-1 shrink-0"
                  >
                    Review →
                  </button>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                <p className="text-xs font-bold text-slate-700">All caught up!</p>
                <p className="text-[11px] text-slate-400">No items pending your review.</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-500" />
              Recent Activity
            </h3>
          </div>

          <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
            {recentActivity.length > 0 ? (
              recentActivity.map((act, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={cn(
                      'px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider shrink-0',
                      act.badge === 'RFQ' ? 'bg-emerald-100 text-emerald-700' :
                      act.badge === 'PO' ? 'bg-sky-100 text-sky-700' : 'bg-teal-100 text-teal-700'
                    )}>
                      {act.badge}
                    </span>
                    <span className="text-xs font-bold text-slate-800 font-mono truncate">{act.code}</span>
                  </div>
                  <span className="text-xs text-slate-400 font-medium shrink-0 ml-2">{act.date}</span>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                <Clock className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs font-medium">No recent activity recorded.</p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}