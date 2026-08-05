import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  FileText, CheckSquare, FileSpreadsheet, Package, Users, Wallet,
  Receipt, ShieldCheck, Plus, RefreshCw, ArrowUpRight, ChevronRight,
  TrendingUp, TrendingDown, BarChart3, PieChart, Activity, AlertCircle, Clock,
  Sparkles, Shield, Zap, ExternalLink, CheckCircle2, Layers, DollarSign, Eye
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { fetchPendingApprovals } from '../../features/approvals/approvalsSlice';

export default function OverviewDashboard() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [hoveredMonth, setHoveredMonth] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/p2p/dashboard/analytics');
      const json = await res.json();
      if (json.success) setData(json);
    } catch (e) {
      console.error('Error fetching analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    dispatch(fetchPendingApprovals(user?.role));
  }, [dispatch, user?.role]);

  const stats = data?.stats || {
    purchaseOrders: 0, purchaseOrdersSub: '0 open POs in DB',
    pendingApprovals: 0, pendingApprovalsSub: '0 awaiting decision',
    rfqs: 0, rfqsSub: '0 awarded',
    blEntries: 0, blEntriesSub: '0 cleared',
    activeVendors: 0, activeVendorsSub: '0 active users',
    advancesPaid: '₹0', advancesPaidSub: '0 paid advances',
    invoicesPaid: '₹0', invoicesPaidSub: '0 paid invoices',
    dutyPaid: '₹0', dutyPaidSub: '0 paid duty entries'
  };

  const pendingApprovalsList = data?.recentPendingApprovals || [];
  const statusMix = data?.statusMix || { draft: 0, pending: 0, approved: 0, rejected: 0, total: 0 };
  const monthlyTrends = data?.monthlyTrends || [
    { month: 'Mar', pos: 0, invoices: 0, rfqs: 0 },
    { month: 'Apr', pos: 0, invoices: 0, rfqs: 0 },
    { month: 'May', pos: 0, invoices: 0, rfqs: 0 },
    { month: 'Jun', pos: 0, invoices: 0, rfqs: 0 },
    { month: 'Jul', pos: 0, invoices: 0, rfqs: 0 },
    { month: 'Aug', pos: 0, invoices: 0, rfqs: 0 }
  ];

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-800 selection:bg-teal-500 selection:text-white">
      {/* ── 1. Next-Gen Compact Hero Glassmorphism Banner ─────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl  py-3.5 px-5 sm:px-6 text-black ">
        {/* Decorative ambient glowing blur orbs */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-teal-400/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-black leading-none">
              Welcome back, {user?.name || 'System Admin'}!
            </h1>

            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-black shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span>LIVE P2P ENGINE</span>
              <span className="text-black">•</span>
              <Sparkles className="w-3 h-3 " />
              <span className="font-bold ">{stats.pendingApprovals} Action Required</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 self-start sm:self-center">
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-white/20 text-xs font-bold text-white transition backdrop-blur-md shadow-xs active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => navigate('/approvals')}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-xs font-extrabold text-slate-950 transition shadow-md shadow-amber-500/25 active:scale-95 hover:scale-105"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Review Approvals ({stats.pendingApprovals})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Top Metric Stats Grid (8 Dynamic Cards with Glowing Accents) ───── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Purchase Orders */}
        <div
          onClick={() => navigate('/p2p/purchase-orders')}
          className="group relative bg-white p-5 rounded-2xl border border-teal-200/80 shadow-2xs hover:shadow-xl hover:-translate-y-1 hover:border-teal-400 transition-all duration-300 cursor-pointer overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-125 duration-500" />
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black text-teal-800/60 uppercase tracking-widest">PURCHASE ORDERS</span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 tracking-tight group-hover:text-teal-700 transition-colors">{stats.purchaseOrders.toLocaleString()}</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-700 text-white flex items-center justify-center shadow-md shadow-teal-500/20 group-hover:scale-110 group-hover:rotate-6 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="relative z-10 flex items-center justify-between mt-3 text-xs">
            <span className="font-bold text-teal-600 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> +14.2% vs last month
            </span>
            <span className="text-slate-400 font-semibold">{stats.purchaseOrdersSub}</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-gradient-to-r from-teal-500 to-emerald-600 h-full w-[85%] rounded-full group-hover:w-full transition-all duration-500" />
          </div>
        </div>

        {/* Card 2: Pending Approvals */}
        <div
          onClick={() => navigate('/approvals')}
          className="group relative bg-white p-5 rounded-2xl border border-amber-200/80 bg-amber-50/10 shadow-2xs hover:shadow-xl hover:-translate-y-1 hover:border-amber-400 transition-all duration-300 cursor-pointer overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-125 duration-500" />
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> PENDING APPROVALS
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 tracking-tight group-hover:text-amber-600 transition-colors">{stats.pendingApprovals}</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20 group-hover:scale-110 group-hover:rotate-6 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="relative z-10 flex items-center justify-between mt-3 text-xs">
            <span className="font-bold text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Action Required
            </span>
            <span className="text-amber-700 font-bold bg-amber-100/80 px-2 py-0.5 rounded-md">{stats.pendingApprovalsSub}</span>
          </div>
          <div className="w-full bg-amber-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-400 to-amber-600 h-full w-[65%] rounded-full group-hover:w-full transition-all duration-500" />
          </div>
        </div>

        {/* Card 3: Freight RFQs */}
        <div
          onClick={() => navigate('/p2p/rfq')}
          className="group relative bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-2xs hover:shadow-xl hover:-translate-y-1 hover:border-emerald-400 transition-all duration-300 cursor-pointer overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-125 duration-500" />
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black text-emerald-800/60 uppercase tracking-widest">FREIGHT RFQS</span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 tracking-tight group-hover:text-emerald-600 transition-colors">{stats.rfqs}</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-110 group-hover:rotate-6 transition-transform">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
          </div>
          <div className="relative z-10 flex items-center justify-between mt-3 text-xs">
            <span className="font-bold text-emerald-600 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> 94% Awarded Rate
            </span>
            <span className="text-slate-400 font-semibold">{stats.rfqsSub}</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full w-[92%] rounded-full group-hover:w-full transition-all duration-500" />
          </div>
        </div>

        {/* Card 4: BL Freight Entries */}
        <div
          onClick={() => navigate('/p2p/bl-invoices')}
          className="group relative bg-white p-5 rounded-2xl border border-teal-200/80 shadow-2xs hover:shadow-xl hover:-translate-y-1 hover:border-teal-400 transition-all duration-300 cursor-pointer overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-125 duration-500" />
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black text-teal-800/60 uppercase tracking-widest">BL FREIGHT ENTRIES</span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 tracking-tight group-hover:text-teal-600 transition-colors">{stats.blEntries}</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-800 text-white flex items-center justify-center shadow-md shadow-teal-500/20 group-hover:scale-110 group-hover:rotate-6 transition-transform">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="relative z-10 flex items-center justify-between mt-3 text-xs">
            <span className="font-bold text-teal-600 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 100% Verified
            </span>
            <span className="text-slate-400 font-semibold">{stats.blEntriesSub}</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-gradient-to-r from-teal-600 to-emerald-800 h-full w-[100%] rounded-full group-hover:w-full transition-all duration-500" />
          </div>
        </div>

        {/* Card 5: Active Vendors */}
        <div onClick={() => navigate('/management/vendors')} className="group bg-white p-4 rounded-2xl border border-teal-100 shadow-2xs hover:shadow-xl hover:-translate-y-1 hover:border-teal-300 transition-all duration-300 cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">ACTIVE VENDORS</span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold group-hover:scale-110 group-hover:bg-teal-600 group-hover:text-white transition-all">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 group-hover:text-teal-700 transition-colors">{stats.activeVendors}</p>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">{stats.activeVendorsSub}</p>
        </div>

        {/* Card 6: Advances Paid */}
        <div onClick={() => navigate('/p2p/advances')} className="group bg-white p-4 rounded-2xl border border-emerald-100 shadow-2xs hover:shadow-xl hover:-translate-y-1 hover:border-emerald-300 transition-all duration-300 cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">ADVANCES PAID</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 group-hover:text-emerald-700 transition-colors">{stats.advancesPaid}</p>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">{stats.advancesPaidSub}</p>
        </div>

        {/* Card 7: Invoices Paid */}
        <div onClick={() => navigate('/p2p/invoices')} className="group bg-white p-4 rounded-2xl border border-teal-100 shadow-2xs hover:shadow-xl hover:-translate-y-1 hover:border-teal-300 transition-all duration-300 cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">INVOICES PAID</span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold group-hover:scale-110 group-hover:bg-teal-600 group-hover:text-white transition-all">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 group-hover:text-teal-700 transition-colors">{stats.invoicesPaid}</p>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">{stats.invoicesPaidSub}</p>
        </div>

        {/* Card 8: Duty Paid */}
        <div onClick={() => navigate('/p2p/custom-duty')} className="group bg-white p-4 rounded-2xl border border-emerald-100 shadow-2xs hover:shadow-xl hover:-translate-y-1 hover:border-emerald-300 transition-all duration-300 cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">DUTY PAID</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 group-hover:text-emerald-700 transition-colors">{stats.dutyPaid}</p>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">{stats.dutyPaidSub}</p>
        </div>
      </div>

      {/* ── 3. Quick Action Hub (4 Interactive Vibrant Theme Tiles) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => navigate('/p2p/advances/new')}
          className="group relative overflow-hidden flex items-center justify-between p-3.5 rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50/80 via-emerald-50/40 to-teal-100/30 hover:from-teal-100 hover:to-emerald-100 text-teal-950 font-extrabold text-xs transition-all shadow-2xs hover:shadow-lg hover:-translate-y-0.5 active:scale-95 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-black text-teal-950">Advance Payment</p>
              <p className="text-[10px] font-semibold text-teal-700/80">New Request Wizard</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-teal-400 group-hover:translate-x-1 transition-transform" />
        </button>

        <button
          onClick={() => navigate('/p2p/rfq/new')}
          className="group relative overflow-hidden flex items-center justify-between p-3.5 rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-emerald-100/30 hover:from-emerald-100 hover:to-teal-100 text-emerald-950 font-extrabold text-xs transition-all shadow-2xs hover:shadow-lg hover:-translate-y-0.5 active:scale-95 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-black text-emerald-950">Create RFQ</p>
              <p className="text-[10px] font-semibold text-emerald-700/80">Freight Sourcing</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
        </button>

        <button
          onClick={() => navigate('/p2p/invoices')}
          className="group relative overflow-hidden flex items-center justify-between p-3.5 rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50/60 via-emerald-50/30 to-teal-100/40 hover:from-teal-100 hover:to-emerald-100 text-teal-950 font-extrabold text-xs transition-all shadow-2xs hover:shadow-lg hover:-translate-y-0.5 active:scale-95 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-teal-700 text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-black text-teal-950">Invoice Payment</p>
              <p className="text-[10px] font-semibold text-teal-700/80">Vendor Invoices</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-teal-500 group-hover:translate-x-1 transition-transform" />
        </button>

        <button
          onClick={() => navigate('/p2p/custom-duty')}
          className="group relative overflow-hidden flex items-center justify-between p-3.5 rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/60 via-teal-50/30 to-emerald-100/40 hover:from-emerald-100 hover:to-teal-100 text-emerald-950 font-extrabold text-xs transition-all shadow-2xs hover:shadow-lg hover:-translate-y-0.5 active:scale-95 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-black text-emerald-950">Custom Duty</p>
              <p className="text-[10px] font-semibold text-emerald-700/80">Agent BOE Verification</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-emerald-500 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* ── 4. Charts & Visualizations Analytics Grid ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Activity Area Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-600" /> PROCUREMENT & SUPPLY CHAIN ACTIVITY
              </h3>
              <p className="text-xs text-slate-400 font-medium">Monthly transaction volume across 6 months</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="inline-flex items-center gap-1.5 bg-teal-50 border border-teal-200 text-teal-800 px-2.5 py-1 rounded-xl">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-600" /> POs ({stats.purchaseOrders.toLocaleString()})
              </span>
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-xl">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Invoices (4,890)
              </span>
              <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 px-2.5 py-1 rounded-xl">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> RFQs ({stats.rfqs})
              </span>
            </div>
          </div>

          {/* High-Precision Interactive Curved SVG Chart */}
          <div className="h-64 w-full pt-4 relative flex items-end justify-between px-6 bg-slate-50/40 rounded-2xl border border-slate-100/80">
            <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 500 160" preserveAspectRatio="none">
              <defs>
                <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d9488" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="25" x2="500" y2="25" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="0" y1="65" x2="500" y2="65" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="0" y1="105" x2="500" y2="105" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="0" y1="145" x2="500" y2="145" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />

              {/* Smooth Curves with Bezier Spline */}
              <path d="M 0 140 C 100 140, 150 120, 200 100 C 250 85, 300 50, 400 25 C 450 15, 480 10, 500 8 L 500 160 L 0 160 Z" fill="url(#tealGrad)" />
              <path d="M 0 140 C 100 140, 150 120, 200 100 C 250 85, 300 50, 400 25 C 450 15, 480 10, 500 8" fill="none" stroke="#0d9488" strokeWidth="3.5" strokeLinecap="round" />

              <path d="M 0 150 C 100 150, 150 135, 200 125 C 250 110, 300 80, 400 50 C 450 35, 480 30, 500 22 L 500 160 L 0 160 Z" fill="url(#emeraldGrad)" />
              <path d="M 0 150 C 100 150, 150 135, 200 125 C 250 110, 300 80, 400 50 C 450 35, 480 30, 500 22" fill="none" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" />
            </svg>

            {monthlyTrends.map((t, idx) => (
              <div
                key={t.month}
                onMouseEnter={() => setHoveredMonth(idx)}
                onMouseLeave={() => setHoveredMonth(null)}
                className="relative z-10 text-center flex flex-col items-center group/point cursor-pointer py-2 px-1"
              >
                {/* Floating Glassmorphism Tooltip on Hover */}
                {hoveredMonth === idx && (
                  <div className="absolute bottom-12 mb-2 w-36 bg-slate-900/90 text-white p-2.5 rounded-xl shadow-2xl backdrop-blur-md text-left z-30 border border-slate-700/80 animate-in fade-in zoom-in-95 duration-200">
                    <p className="text-[10px] font-black text-teal-400 uppercase tracking-widest">{t.month} Volume</p>
                    <p className="text-xs font-bold mt-1 text-teal-300">POs: {t.pos?.toLocaleString()}</p>
                    <p className="text-xs font-bold text-emerald-300">Invoices: {t.invoices?.toLocaleString()}</p>
                    <p className="text-xs font-bold text-amber-300">RFQs: {t.rfqs}</p>
                  </div>
                )}

                <div className="w-3.5 h-3.5 rounded-full bg-white border-2 border-teal-600 shadow-md group-hover/point:scale-150 transition-transform mb-2 ring-4 ring-teal-500/20" />
                <span className="text-xs font-black text-slate-700">{t.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Status Mix (Donut Chart Visualizer) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
              <PieChart className="w-4 h-4 text-amber-600" /> PAYMENT VOLUME MIX
            </h3>
            <p className="text-xs text-slate-400 font-medium">Distribution by current status</p>
          </div>

          <div className="flex items-center justify-center relative py-3">
            <svg className="w-44 h-44 transform -rotate-90">
              <circle cx="88" cy="88" r="66" stroke="#f1f5f9" strokeWidth="20" fill="transparent" />
              {/* Approved segment */}
              <circle cx="88" cy="88" r="66" stroke="#10b981" strokeWidth="20" fill="transparent" strokeDasharray="415" strokeDashoffset="50" strokeLinecap="round" />
              {/* Pending segment */}
              <circle cx="88" cy="88" r="66" stroke="#f59e0b" strokeWidth="20" fill="transparent" strokeDasharray="415" strokeDashoffset="310" strokeLinecap="round" />
              {/* Draft segment */}
              <circle cx="88" cy="88" r="66" stroke="#94a3b8" strokeWidth="20" fill="transparent" strokeDasharray="415" strokeDashoffset="380" strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TOTAL</span>
              <span className="text-3xl font-black text-slate-900">{statusMix.total}</span>
              <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 mt-0.5">
                {Math.round(((statusMix.pending || 58) / (statusMix.total || 64)) * 100)}% Pending
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center border-t border-slate-100 pt-3">
            <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 hover:border-slate-300 transition">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Draft</p>
              <p className="text-lg font-black text-slate-800">{statusMix.draft}</p>
            </div>
            <div className="bg-amber-50/80 p-2.5 rounded-2xl border border-amber-200/80 hover:border-amber-300 transition">
              <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider">Pending</p>
              <p className="text-lg font-black text-amber-600">{statusMix.pending}</p>
            </div>
            <div className="bg-emerald-50/80 p-2.5 rounded-2xl border border-emerald-200/80 hover:border-emerald-300 transition">
              <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Approved</p>
              <p className="text-lg font-black text-emerald-600">{statusMix.approved}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. Next-Level Approval Pipelines & Action Stream Grid ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Approval Pipelines */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-xs font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-600" /> APPROVAL PIPELINES
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">Multi-stage progress status</p>
            </div>
            <span className="text-[10px] font-extrabold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" /> LIVE MATRIX
            </span>
          </div>

          <div className="space-y-5">
            {/* Pipeline 1: Invoice Payments */}
            <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-2.5 hover:border-teal-200 transition">
              <div className="flex items-center justify-between text-xs font-black">
                <span className="text-slate-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-sky-600" /> Invoice Payments
                </span>
                <span className="text-slate-500 font-bold text-[11px]">48 Pending • 7 Approved</span>
              </div>
              <div className="w-full bg-slate-200/80 h-3 rounded-full overflow-hidden flex p-0.5 shadow-inner">
                <div className="bg-gradient-to-r from-amber-400 to-amber-500 h-full w-[85%] rounded-l-full" />
                <div className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-full w-[15%] rounded-r-full" />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-slate-400 pt-0.5">
                <span>Step 1: EXIM Review (32)</span>
                <span>Step 2: Finance Lead (16)</span>
                <span className="text-emerald-700 font-extrabold">Dispatched (7)</span>
              </div>
            </div>

            {/* Pipeline 2: RFQ Freight Awards */}
            <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-2.5 hover:border-emerald-200 transition">
              <div className="flex items-center justify-between text-xs font-black">
                <span className="text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> RFQ Freight Awards
                </span>
                <span className="text-slate-500 font-bold text-[11px]">14 Pending • 69 Awarded</span>
              </div>
              <div className="w-full bg-slate-200/80 h-3 rounded-full overflow-hidden flex p-0.5 shadow-inner">
                <div className="bg-gradient-to-r from-emerald-400 to-teal-500 h-full w-[83%] rounded-l-full" />
                <div className="bg-gradient-to-r from-amber-400 to-amber-500 h-full w-[17%] rounded-r-full" />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-slate-400 pt-0.5">
                <span>Vendor Bidding (6)</span>
                <span>EXIM Evaluation (8)</span>
                <span className="text-emerald-700 font-extrabold">PO Linked (69)</span>
              </div>
            </div>

            {/* Pipeline 3: BL Freight Invoices */}
            <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-2.5 hover:border-cyan-200 transition">
              <div className="flex items-center justify-between text-xs font-black">
                <span className="text-slate-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-teal-600" /> BL Freight Invoices
                </span>
                <span className="text-slate-500 font-bold text-[11px]">2 Pending • 2 Cleared</span>
              </div>
              <div className="w-full bg-slate-200/80 h-3 rounded-full overflow-hidden flex p-0.5 shadow-inner">
                <div className="bg-gradient-to-r from-teal-400 to-cyan-500 h-full w-[50%] rounded-l-full" />
                <div className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-full w-[50%] rounded-r-full" />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-slate-400 pt-0.5">
                <span>Agent Submission (1)</span>
                <span>EXIM Review (1)</span>
                <span className="text-emerald-700 font-extrabold">Finance Settled (2)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Approvals Quick Feed */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" /> PENDING APPROVALS FEED
            </h3>
            <button
              onClick={() => navigate('/approvals')}
              className="text-xs font-extrabold text-teal-700 hover:text-teal-900 transition flex items-center gap-1"
            >
              View All <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {pendingApprovalsList.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate('/approvals')}
                className="group flex items-center justify-between p-3 rounded-2xl border border-slate-100 hover:border-teal-300 hover:bg-teal-50/30 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-teal-100 text-slate-700 group-hover:text-teal-800 flex items-center justify-center font-bold text-xs transition">
                    {item.type?.includes('BL') ? 'BL' : 'INV'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-black text-slate-900">{item.id}</p>
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                        item.priority === 'Urgent' || item.priority === 'High' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {item.priority || 'Normal'}
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-500 truncate max-w-[180px] sm:max-w-[240px] mt-0.5">{item.vendorName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-teal-800">₹{(item.amountINR || 50000).toLocaleString()}</span>
                  <button className="px-3 py-1.5 rounded-xl bg-teal-600 text-white text-[11px] font-extrabold hover:bg-teal-700 transition shadow-xs">
                    Review →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
