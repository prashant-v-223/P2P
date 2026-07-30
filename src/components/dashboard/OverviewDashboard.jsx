import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitFork, DollarSign, Clock3, Users, ArrowUpRight, Sparkles,
  CircleCheck, RefreshCw, ShieldCheck,
} from 'lucide-react';
import WorkflowAnalyticsChart from './WorkflowAnalyticsChart';

const stats = [
  { label: 'Workflow rules', value: '8', sub: 'Across 5 payment types', icon: GitFork, tone: 'teal', path: '/admin/workflows' },
  { label: 'FX currencies', value: '4', sub: 'All rates up to date', icon: DollarSign, tone: 'emerald', path: '/admin/exchange-rates' },
  { label: 'Awaiting approval', value: '50', sub: '12 marked high priority', icon: Clock3, tone: 'rose', path: '/approvals' },
  { label: 'Active users', value: '3,420', sub: '98.4% active this month', icon: Users, tone: 'indigo', path: '/admin/users' },
];

const toneMap = {
  teal: 'bg-teal-50 text-teal-700 ring-teal-100',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  rose: 'bg-rose-50 text-rose-700 ring-rose-100',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
};

export default function OverviewDashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-4 pb-7 font-sans">
      {/* Top Banner (Bright Light Teal Corporate Style) */}
      <section className="relative overflow-hidden rounded-2xl bg-[#0d7676] px-5 py-5 text-white shadow-lg shadow-teal-900/10 sm:px-6 sm:py-6">
        <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-teal-100">
              <Sparkles className="h-3.5 w-3.5" /> Wednesday, 29 July
            </div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Good morning. Operations look healthy.</h2>
            <p className="mt-2 max-w-xl text-xs leading-5 text-teal-50/90">
              Your procurement workspace is synchronized and ready. Twelve priority requests need a decision today.
            </p>
          </div>
          <button onClick={() => navigate('/approvals')} className="inline-flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#0d7676] transition hover:bg-teal-50 shadow-xs">
            Review approvals <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* Key Metric Stats Cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <button key={stat.label} onClick={() => navigate(stat.path)} className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className={`rounded-lg p-2 ring-1 ${toneMap[stat.tone]}`}><Icon className="h-[18px] w-[18px]" /></div>
                <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-[#0d7676]" />
              </div>
              <p className="mt-3 text-xs font-bold text-slate-500">{stat.label}</p>
              <p className="mt-0.5 text-xl font-extrabold tracking-tight text-slate-900">{stat.value}</p>
              <p className="mt-1 text-xs text-slate-400 font-medium">{stat.sub}</p>
            </button>
          );
        })}
      </section>

      {/* Analytics Chart & System Readiness Grid */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3"><WorkflowAnalyticsChart /></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">System Readiness</h3>
              <p className="mt-0.5 text-xs text-slate-500">Live service and policy status</p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Operational
            </span>
          </div>
          <div className="mt-2.5 divide-y divide-slate-100">
            {[
              [CircleCheck, 'Approval engine', 'Operational'],
              [RefreshCw, 'SAP synchronization', '2 min ago'],
              [ShieldCheck, 'Access policies', 'Protected'],
            ].map(([Icon, label, value]) => (
              <div key={label} className="flex items-center gap-2.5 py-2.5">
                <div className="rounded-lg bg-teal-50 p-2 text-[#0d7676]"><Icon className="h-4 w-4" /></div>
                <span className="flex-1 text-xs font-bold text-slate-800">{label}</span>
                <span className="text-xs font-semibold text-slate-500">{value}</span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/admin/exchange-rates')} className="mt-3 w-full rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 hover:border-teal-300">
            View Exchange Rates
          </button>
        </div>
      </section>
    </div>
  );
}
