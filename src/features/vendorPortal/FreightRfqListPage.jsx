import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardList, Search } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { CustomSelect } from '../../components/ui/custom-select';
import { ServerPagination } from '../../components/ui/server-pagination';

export default function FreightRfqListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatus = searchParams.get('status') || 'All';
  const urlSearch = searchParams.get('search') || '';
  const urlPage = Number(searchParams.get('page')) || 1;

  const [rfqs, setRfqs] = useState([]);
  const [search, setSearch] = useState(urlSearch);
  const [status, setStatus] = useState(urlStatus);
  const [error, setError] = useState('');
  const [page, setPage] = useState(urlPage);
  const [pageSize, setPageSize] = useState(10);

  // Sync state changes to URL query parameters
  useEffect(() => {
    const params = {};
    if (status && status !== 'All') params.status = status;
    if (search.trim()) params.search = search.trim();
    if (page > 1) params.page = String(page);
    setSearchParams(params, { replace: true });
  }, [status, search, page, setSearchParams]);

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
    const matchesQuery = !q || `${rfq.rfqNumber} ${rfq.title} ${rfq.poId}`.toLowerCase().includes(q);
    if (!matchesQuery) return false;

    if (status === 'All') return true;

    const normStat = String(rfq.status || '').toLowerCase();
    const awardedToMe = Boolean(rfq.myAllocation);
    const isClosed = rfq.closingDate && new Date(rfq.closingDate) < new Date();

    if (status === 'published' || status === 'open') {
      return normStat === 'published' && !isClosed;
    }
    if (status === 'quoted') {
      return Boolean(rfq.myQuote);
    }
    if (status === 'awarded') {
      return awardedToMe || normStat === 'awarded' || normStat === 'fully_awarded' || normStat === 'partially_awarded';
    }
    if (status === 'closed') {
      return normStat === 'closed' || isClosed;
    }

    return normStat === status.toLowerCase();
  }), [rfqs, search, status]);

  const paginated = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  return (
    <div className="space-y-6 font-sans antialiased text-left w-full pb-10">
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
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search reference, vendor..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-xs font-medium outline-none focus:border-[#0d7676] focus:ring-2 focus:ring-teal-100 transition"
            />
          </div>
          <div className="w-full sm:w-44">
            <CustomSelect
              value={status}
              onChange={(val) => { setStatus(val); setPage(1); }}
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

        <div className="overflow-x-auto table-scrollbar">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-100 text-[9.5px] font-black uppercase text-slate-500 tracking-tight">
              <tr>
                <th className="py-2.5 px-2 w-7 text-center whitespace-nowrap">#</th>
                <th className="py-2.5 px-2.5 w-28 whitespace-nowrap">RFQ NUMBER</th>
                <th className="py-2.5 px-2.5 w-24 whitespace-nowrap">LINKED PO</th>
                <th className="py-2.5 px-2.5 whitespace-nowrap">SHIPPER NAME</th>
                <th className="py-2.5 px-2.5 w-32 whitespace-nowrap">POL</th>
                <th className="py-2.5 px-2.5 w-32 whitespace-nowrap">POD</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap">CTR TYPE</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap">CTR QTY</th>
                <th className="py-2.5 px-2.5 w-28 whitespace-nowrap">CLOSING DATE</th>
                <th className="py-2.5 px-2.5 w-28 whitespace-nowrap">STATUS</th>
                <th className="py-2.5 px-2.5 w-24 text-center whitespace-nowrap sticky right-0 bg-slate-100 font-extrabold text-slate-800 border-l border-slate-300 shadow-[-6px_0_12px_-2px_rgba(0,0,0,0.1)] z-20">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {paginated.map((rfq, idx) => {
                const normStat = String(rfq.status || '').toLowerCase();
                const awardedToMe = Boolean(rfq.myAllocation);
                const isAwardedRfq = ['partially_awarded', 'awarded', 'fully_awarded'].includes(normStat) || normStat.includes('award') || Number(rfq.allocatedQuantity || 0) > 0;
                const awardedToOther = isAwardedRfq && !awardedToMe;
                const containerCount = rfq.myAllocation?.containers || rfq.cargoDetails?.containerCount || '—';
                const containerType = rfq.cargoDetails?.containerType || rfq.cargoDetails?.cargoType || '—';
                const origin = rfq.cargoDetails?.portOfOrigin || '—';
                const dest = rfq.cargoDetails?.portOfDestination || '—';

                // Calculate days left
                const closing = rfq.closingDate ? new Date(rfq.closingDate) : null;
                const now = new Date();
                const daysLeft = closing ? Math.ceil((closing - now) / (1000 * 60 * 60 * 24)) : null;
                const isClosed = normStat !== 'published' || (closing && closing < now);

                return (
                  <tr key={rfq.rfqId} className="transition hover:bg-slate-50/60 group">
                    <td className="py-2 px-2 text-center text-slate-400 font-mono text-[10px] whitespace-nowrap">{(page - 1) * pageSize + idx + 1}</td>
                    <td className="py-2 px-2.5 font-mono font-bold text-slate-700 text-[11px] whitespace-nowrap">{rfq.rfqNumber}</td>
                    <td className="py-2 px-2.5 font-mono text-slate-600 font-bold text-[11px] whitespace-nowrap">{rfq.poId || rfq.sapPoNumber || '—'}</td>
         <td
  className="py-2 px-2.5 font-bold text-slate-900 text-[11px] whitespace-nowrap max-w-[200px] truncate"
  title={rfq.title}
>
  {rfq.title}
</td>
                    <td className="py-2 px-2.5 font-medium text-slate-700 text-[11px] whitespace-nowrap">{origin}</td>
                    <td className="py-2 px-2.5 font-medium text-slate-700 text-[11px] whitespace-nowrap">{dest}</td>
                    <td className="py-2 px-2 text-center font-medium text-slate-700 text-[11px] whitespace-nowrap">{containerType}</td>
                    <td className="py-2 px-2 text-center font-bold text-slate-800 text-[11px] whitespace-nowrap">{containerCount}</td>
                    <td className="py-2 px-2.5 text-[11px] whitespace-nowrap">
                      <div className="font-bold text-slate-700 text-[11px]">
                        {closing ? closing.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </div>
                      {daysLeft !== null && (
                        <div className={`text-[10px] font-extrabold ${daysLeft > 0 && !isClosed ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {daysLeft > 0 && !isClosed ? `${daysLeft}d left` : 'Closed'}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold capitalize ${
                        awardedToMe
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                          : awardedToOther
                          ? 'bg-amber-50 text-amber-800 border border-amber-200/60'
                          : isClosed
                          ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                          : rfq.myQuote
                          ? 'bg-teal-50 text-[#0d7676] border border-teal-200/60'
                          : 'bg-amber-50 text-amber-800 border border-amber-200/60'
                      }`}>
                        {awardedToMe ? 'Awarded' : awardedToOther ? 'Awarded (Other)' : isClosed ? 'Closed' : rfq.myQuote ? 'Quoted' : rfq.status}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 text-center whitespace-nowrap sticky right-0 bg-white group-hover:bg-slate-50/90 border-l border-slate-200 shadow-[-6px_0_12px_-2px_rgba(0,0,0,0.08)] z-10">
                      <Link
                        to={`/vendor/rfqs/${rfq.rfqId}`}
                        className={`inline-flex items-center gap-1 rounded-xl px-3 py-1 font-bold text-[11px] shadow-2xs transition active:scale-95 whitespace-nowrap ${
                          awardedToMe
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                            : awardedToOther || isClosed
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                            : 'bg-[#0d7676] hover:bg-[#0f766e] text-white'
                        }`}
                      >
                        {awardedToMe ? 'Shipment →' : awardedToOther || isClosed ? 'View RFQ' : rfq.myQuote ? 'Edit Quote' : 'View & Quote'}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="p-12 text-center text-xs text-slate-400 font-semibold">
              No RFQs found.
            </div>
          )}
        </div>

        <ServerPagination
          page={page}
          totalPages={Math.ceil(filtered.length / pageSize) || 1}
          total={filtered.length}
          pageSize={pageSize}
          itemLabel="RFQs"
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>
    </div>
  );
}
