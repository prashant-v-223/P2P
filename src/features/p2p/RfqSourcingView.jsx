import React, { useState } from 'react';
import { FileSpreadsheet, Plus, Award, CheckCircle2, ChevronRight, Search, Filter } from 'lucide-react';

export default function RfqSourcingView() {
  const [search, setSearch] = useState('');
  const [rfqs] = useState([
    {
      rfqId: 'RFQ-2026-0089',
      rfqNumber: 'RFQ-2026-0089',
      title: 'Ocean Freight Sourcing - Vietnam to Mundra Port',
      poId: 'PO-4300001510',
      route: 'Haiphong Port, VN → Mundra Port, IN',
      containers: '6x40HC Solar Glass Containers',
      status: 'awarded',
      quotes: [
        { rank: 'L1', vendor: 'Kuehne + Nagel Logistics', amount: 480000, days: 14, status: 'awarded' },
        { rank: 'L2', vendor: 'DHL Global Forwarding', amount: 520000, days: 12, status: 'submitted' },
        { rank: 'L3', vendor: 'Maersk Logistics India', amount: 560000, days: 10, status: 'submitted' }
      ]
    }
  ]);

  return (
    <div className="w-full space-y-4 font-sans">
      {/* Clean Toolbar Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#0d7676] border border-teal-100 flex items-center justify-center font-bold">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">Request For Quotes (RFQ)</h2>
            <p className="text-xs text-slate-500">Source shipping freight rates from logistics vendors & award container allocations</p>
          </div>
        </div>
        <button className="flex items-center gap-2 bg-[#0d7676] hover:bg-[#0f766e] text-white px-4 py-2 rounded-xl font-bold text-xs shadow-xs transition-colors">
          <Plus className="w-4 h-4" /> Create New RFQ
        </button>
      </div>

      {/* RFQ Directory Cards */}
      <div className="space-y-4 w-full">
        {rfqs.map((rfq) => (
          <div key={rfq.rfqId} className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-teal-50 text-[#0d7676] border border-teal-200">
                    {rfq.rfqNumber}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-500">PO: {rfq.poId}</span>
                </div>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">{rfq.title}</h3>
                <p className="text-xs text-slate-500">
                  Route: <span className="font-bold text-slate-800">{rfq.route}</span> ({rfq.containers})
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-center">
                STATUS: {rfq.status.toUpperCase()}
              </span>
            </div>

            <div className="space-y-2">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Vendor Quotes (Auto-Ranked L1..L3):</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                {rfq.quotes.map((q) => (
                  <div key={q.rank} className={`p-4 rounded-xl border ${q.rank === 'L1' ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-400/30' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${q.rank === 'L1' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                        Rank: {q.rank}
                      </span>
                      {q.status === 'awarded' && (
                        <span className="text-[10px] font-extrabold text-emerald-700 uppercase flex items-center gap-1">
                          <Award className="w-3.5 h-3.5" /> Awarded
                        </span>
                      )}
                    </div>
                    <p className="font-extrabold text-slate-900 text-sm truncate">{q.vendor}</p>
                    <div className="mt-2 text-xs text-slate-600 space-y-1">
                      <p className="flex justify-between"><span>Freight Rate:</span> <span className="font-black text-slate-900">₹{q.amount.toLocaleString('en-IN')}</span></p>
                      <p className="flex justify-between"><span>Transit Time:</span> <span className="font-bold text-slate-800">{q.days} Days</span></p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
