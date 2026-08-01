import React, { useState, useEffect } from 'react';
import { Building2, Plus, Phone, Mail, MapPin, Truck } from 'lucide-react';
import { apiFetch } from '../../services/api';

export default function LogisticsProvidersView() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProviders() {
      try {
        setLoading(true);
        const res = await apiFetch('/api/p2p/logistics-providers');
        if (res.ok) {
          const data = await res.json();
          setProviders(data.providers || []);
        }
      } catch (e) {
        console.error('Error fetching logistics providers:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchProviders();
  }, []);

  return (
    <div className="w-full space-y-4 font-sans">
      {/* Clean Toolbar Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#0d7676] border border-teal-100 flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">Freight Forwarders & Logistics Directory</h2>
            <p className="text-xs text-slate-500">Empanelled shipping lines, ocean freight forwarders, and logistics partners</p>
          </div>
        </div>
        <button className="flex items-center gap-2 bg-[#0d7676] hover:bg-[#0f766e] text-white px-4 py-2 rounded-xl font-bold text-xs shadow-2xs transition-colors">
          <Plus className="w-4 h-4" /> Add Logistics Provider
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        {providers.map((p) => (
          <div key={p.providerId} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-2xs w-full">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-mono text-xs font-bold text-[#0d7676] bg-teal-50 px-2.5 py-0.5 rounded border border-teal-200">
                {p.providerId}
              </span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                {p.status}
              </span>
            </div>
            <h3 className="font-extrabold text-slate-900 text-base">{p.name}</h3>
            <p className="text-xs text-slate-600 font-semibold flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-slate-400" /> {p.serviceType}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
