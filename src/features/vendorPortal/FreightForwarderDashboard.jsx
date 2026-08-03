import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Ship, User, ArrowUpRight, Info } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useVendor } from './vendorContext';

export default function FreightForwarderDashboard() {
  const { vendorProfile } = useVendor();
  const [rfqs, setRfqs] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/p2p/vendor-rfqs').then((res) => res.json()).then((json) => {
      if (json.success) setRfqs(json.data || []);
      else setError(json.error || 'Unable to load assigned RFQs.');
    }).catch((err) => setError(err.message || 'Unable to load assigned RFQs.'));
    const updateFromLayout = (event) => setRfqs(event.detail || []);
    window.addEventListener('vendor-rfqs-updated', updateFromLayout);
    return () => window.removeEventListener('vendor-rfqs-updated', updateFromLayout);
  }, []);

  const isOpen = (rfq) => {
    if (String(rfq.status).toLowerCase() !== 'published') return false;
    if (!rfq.closingDate) return true;
    const deadline = new Date(rfq.closingDate);
    const utcMidnight = deadline.getUTCHours() === 0 && deadline.getUTCMinutes() === 0 && deadline.getUTCSeconds() === 0;
    const localMidnight = deadline.getHours() === 0 && deadline.getMinutes() === 0 && deadline.getSeconds() === 0;
    if (localMidnight) deadline.setHours(23, 59, 59, 999);
    else if (utcMidnight) deadline.setUTCHours(23, 59, 59, 999);
    return deadline >= new Date();
  };
  const open = rfqs.filter(isOpen).length;
  const quoted = rfqs.filter((rfq) => rfq.myQuote).length;
  const awarded = rfqs.filter((rfq) => rfq.status === 'awarded' && rfq.awardedVendorName === vendorProfile.companyName).length;

  return <div className="space-y-5 pb-10">
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0d7676] to-[#159a91] p-6 text-white shadow-lg shadow-teal-900/10">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
        <span className="rounded-full border border-white/40 bg-white/15 px-3 py-1">Freight Forwarder</span>
        <span className="rounded-full border border-white/40 bg-white/15 px-3 py-1 font-mono">{vendorProfile.sapVendorCode}</span>
        <span className="rounded-full border border-emerald-200/50 bg-emerald-500/30 px-3 py-1">Active</span>
      </div>
      <h1 className="mt-3 text-2xl font-extrabold">{vendorProfile.companyName}</h1>
      <p className="mt-1 text-xs text-teal-50">{vendorProfile.email}</p>
      <div className="mt-5 flex items-center gap-2 border-t border-white/25 pt-4 text-xs font-semibold">
        <Info className="h-4 w-4" /> Freight Forwarders work through assigned RFQ and BL workflows. Standard invoice and advance modules are disabled.
      </div>
    </section>

    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div>}
    <section className="grid gap-4 sm:grid-cols-3">
      {[["Open RFQs", open, ClipboardList, 'text-[#0d7676] bg-teal-50'], ["Quotes Submitted", quoted, Ship, 'text-blue-600 bg-blue-50'], ["Awards", awarded, User, 'text-emerald-600 bg-emerald-50']].map(([label, value, Icon, tone]) =>
        <Link key={label} to="/vendor/rfqs" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-md">
          <div className={`inline-flex rounded-xl p-2.5 ${tone}`}><Icon className="h-5 w-5" /></div>
          <p className="mt-3 text-xs font-bold uppercase text-slate-500">{label}</p>
          <p className="text-3xl font-black text-slate-900">{value}</p>
          <span className="mt-3 flex items-center gap-1 text-xs font-bold text-[#0d7676]">View RFQs <ArrowUpRight className="h-3.5 w-3.5" /></span>
        </Link>)}
    </section>
  </div>;
}
