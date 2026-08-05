import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Search } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { CustomSelect } from '../../components/ui/custom-select';

export default function FreightRfqListPage() {
  const [rfqs, setRfqs] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/p2p/vendor-rfqs')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setRfqs(j.data || []);
        else setError(j.error || 'Unable to load assigned RFQs.');
      })
      .catch((err) => setError(err.message));
  }, []);

  const filtered = useMemo(() => rfqs.filter((rfq) => {
    const q = search.toLowerCase();
    return (!q || `${rfq.rfqNumber} ${rfq.title} ${rfq.poId}`.toLowerCase().includes(q)) && (status === 'All' || rfq.status === status);
  }), [rfqs, search, status]);

  return (
    <div className="space-y-6 font-sans antialiased text-left max-w-6xl mx-auto pb-10">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-black text-slate-900 tracking-tight">
          <ClipboardList className="h-6 w-6 text-[#0d7676]" /> My RFQs
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-1">
          Requests for quotation assigned to you
        </p>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-100 p-4 bg-slate-50/50">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference, vendor..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-xs font-medium outline-none focus:border-[#0d7676] focus:ring-2 focus:ring-teal-100 transition"
            />
          </div>
          <div className="w-full sm:w-44">
            <CustomSelect
              value={status}
              onChange={(val) => setStatus(val)}
              options={[
                { label: 'All Status', value: 'All' },
                { label: 'Published (Open)', value: 'published' },
                { label: 'Awarded', value: 'awarded' },
                { label: 'Closed', value: 'closed' }
              ]}
              placeholder="All Status"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
              <tr>
                <th className="p-3.5 pl-4">#</th>
                <th className="p-3.5">RFQ NO.</th>
                <th className="p-3.5">TITLE</th>
                <th className="p-3.5">PO</th>
                <th className="p-3.5">CONTAINERS</th>
                <th className="p-3.5">CLOSING DATE</th>
                <th className="p-3.5">STATUS</th>
                <th className="p-3.5 text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {filtered.map((rfq, idx) => {
                const isAwarded = rfq.status === 'awarded' || Boolean(rfq.myAllocation);
                const containerCount = rfq.myAllocation?.containersAllocated || rfq.cargoDetails?.numberOfContainers || 5;
                const cargoType = rfq.cargoDetails?.cargoType || 'SOLAR CELL';

                // Calculate days left
                const closing = rfq.closingDate ? new Date(rfq.closingDate) : null;
                const now = new Date();
                const daysLeft = closing ? Math.ceil((closing - now) / (1000 * 60 * 60 * 24)) : null;

                return (
                  <tr key={rfq.rfqId} className="transition hover:bg-slate-50/60">
                    <td className="p-3.5 pl-4 text-slate-400 font-mono text-xs">{idx + 1}</td>
                    <td className="p-3.5 font-mono font-bold text-slate-700 text-xs">{rfq.rfqNumber}</td>
                    <td className="p-3.5 font-bold text-slate-900 uppercase">{rfq.title}</td>
                    <td className="p-3.5 font-mono text-slate-600">{rfq.poId || '4300001538'}</td>
                    <td className="p-3.5 font-bold text-slate-700">
                      {containerCount} <span className="text-slate-400 font-semibold text-[11px]">({cargoType})</span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-700">
                        {closing ? closing.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '08 Aug 2026'}
                      </div>
                      {daysLeft !== null && (
                        <div className="text-[10px] font-extrabold text-emerald-600">
                          {daysLeft > 0 ? `${daysLeft}d left` : 'Closed'}
                        </div>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold capitalize ${
                        isAwarded
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                          : rfq.myQuote
                          ? 'bg-teal-50 text-[#0d7676] border border-teal-200/60'
                          : 'bg-amber-50 text-amber-800 border border-amber-200/60'
                      }`}>
                        {isAwarded ? 'Awarded' : rfq.myQuote ? 'Quote Submitted' : rfq.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <Link
                        to={`/vendor/rfqs/${rfq.rfqId}`}
                        className={`inline-flex items-center gap-1 rounded-xl px-3.5 py-1.5 font-bold text-xs shadow-2xs transition active:scale-95 ${
                          isAwarded
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                            : 'bg-[#0d7676] hover:bg-[#0f766e] text-white'
                        }`}
                      >
                        {isAwarded ? 'View Result' : rfq.myQuote ? 'Update Quote' : 'View & Quote'}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="p-12 text-center text-xs text-slate-400 font-semibold">
              No assigned RFQs found matching your query.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
