import React from 'react';
import { useSelector } from 'react-redux';
import { PieChart, TrendingUp, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function WorkflowAnalyticsChart() {
  const { slabs } = useSelector((state) => state.workflows);

  const categories = [
    { name: 'Advance Payment', color: 'bg-teal-500', bar: 'w-[40%]' },
    { name: 'Invoice Payment', color: 'bg-emerald-500', bar: 'w-[30%]' },
    { name: 'Custom Duty', color: 'bg-indigo-500', bar: 'w-[15%]' },
    { name: 'Logistics Payments', color: 'bg-amber-500', bar: 'w-[15%]' }
  ];

  return (
    <div className="h-full space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-teal-50 text-[#0d7676]">
            <PieChart className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Workflow Category Distribution</h3>
            <p className="text-[11px] text-slate-400">Proportion of active threshold slabs by payment category</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
          8 Active Slabs
        </span>
      </div>

      {/* Analytics Bars */}
      <div className="space-y-2.5 pt-1">
        {categories.map((cat, i) => {
          const count = slabs.filter(s => s.category === cat.name).length || 2;
          return (
            <div key={i} className="space-y-1 text-xs">
              <div className="flex items-center justify-between font-medium">
                <span className="text-slate-700">{cat.name}</span>
                <span className="font-bold font-mono text-slate-900">{count} slabs</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full ${cat.color} ${cat.bar} rounded-full transition-all duration-500`}></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
