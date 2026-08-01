import React, { useState, useEffect } from 'react';
import { Shield, Plus, Building2, Phone, Mail, MapPin, Search } from 'lucide-react';
import { apiFetch } from '../../services/api';

export default function CustomAgentsView() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAgents() {
      try {
        setLoading(true);
        const res = await apiFetch('/api/p2p/custom-agents');
        if (res.ok) {
          const data = await res.json();
          setAgents(data.agents || []);
        }
      } catch (e) {
        console.error('Error fetching custom agents:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchAgents();
  }, []);

  return (
    <div className="w-full space-y-4 font-sans">
      {/* Clean Toolbar Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#0d7676] border border-teal-100 flex items-center justify-center font-bold">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">Customs House Agents (CHA) Directory</h2>
            <p className="text-xs text-slate-500">Manage authorized Customs House Agents (CHA) and port assignments</p>
          </div>
        </div>
        <button className="flex items-center gap-2 bg-[#0d7676] hover:bg-[#0f766e] text-white px-4 py-2 rounded-xl font-bold text-xs shadow-xs transition-colors">
          <Plus className="w-4 h-4" /> Add Customs Agent
        </button>
      </div>

      {/* Agents Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        {agents.map((agent) => (
          <div key={agent.agentId} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-2xs w-full">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-mono text-xs font-bold text-[#0d7676] bg-teal-50 px-2.5 py-0.5 rounded border border-teal-200">
                {agent.agentId}
              </span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                {agent.status}
              </span>
            </div>
            <h3 className="font-extrabold text-slate-900 text-base">{agent.agencyName}</h3>
            <div className="text-xs text-slate-600 space-y-1.5 font-medium">
              <p className="flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-slate-400" /> Licence: <span className="font-bold text-slate-800">{agent.licenceNumber}</span></p>
              <p className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-slate-400" /> Ports: <span className="font-bold text-slate-800">{agent.portLocation}</span></p>
              <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-slate-400" /> {agent.email} | {agent.phone}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
