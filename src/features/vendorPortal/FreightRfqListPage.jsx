import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Search } from 'lucide-react';
import { apiFetch } from '../../services/api';

export default function FreightRfqListPage() {
  const [rfqs, setRfqs] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [error, setError] = useState('');
  useEffect(() => { apiFetch('/api/p2p/vendor-rfqs').then((r) => r.json()).then((j) => { if (j.success) setRfqs(j.data || []); else setError(j.error || 'Unable to load assigned RFQs.'); }).catch((err) => setError(err.message)); }, []);
  const filtered = useMemo(() => rfqs.filter((rfq) => {
    const q = search.toLowerCase();
    return (!q || `${rfq.rfqNumber} ${rfq.title} ${rfq.poId}`.toLowerCase().includes(q)) && (status === 'All' || rfq.status === status);
  }), [rfqs, search, status]);
  return <div className="space-y-5">
    <div><h1 className="flex items-center gap-2 text-xl font-extrabold"><ClipboardList className="h-5 w-5" /> My RFQs</h1><p className="text-xs text-slate-500">Requests for quotation assigned to your company</p></div>
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div>}
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex gap-2 border-b border-slate-100 p-4"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search RFQ, title, or PO..." className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-xs" /></div><select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 text-xs"><option>All</option><option value="published">Published</option><option value="awarded">Awarded</option><option value="closed">Closed</option></select></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="p-4">RFQ</th><th className="p-4">Title</th><th className="p-4">PO</th><th className="p-4">Route</th><th className="p-4">Closing</th><th className="p-4">Status</th><th className="p-4"></th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((rfq) => <tr key={rfq.rfqId} className="transition hover:bg-slate-50"><td className="p-4 font-mono font-bold text-[#0d7676]">{rfq.rfqNumber}</td><td className="p-4 font-bold">{rfq.title}</td><td className="p-4 font-mono">{rfq.poId || '—'}</td><td className="p-4">{rfq.cargoDetails?.portOfOrigin} → {rfq.cargoDetails?.portOfDestination}</td><td className="p-4">{rfq.closingDate ? new Date(rfq.closingDate).toLocaleDateString('en-GB') : '—'}</td><td className="p-4 capitalize">{rfq.myQuote ? 'Quote submitted' : rfq.status}</td><td className="p-4"><Link to={`/vendor/rfqs/${rfq.rfqId}`} className="rounded-lg bg-[#0d7676] px-3 py-1.5 font-bold text-white hover:bg-[#0f6666]">{rfq.myQuote ? 'Update Quote' : 'View & Quote'}</Link></td></tr>)}</tbody></table>{filtered.length === 0 && <p className="p-10 text-center text-xs text-slate-500">No assigned RFQs found.</p>}</div>
    </div>
  </div>;
}
