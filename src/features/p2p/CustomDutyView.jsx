import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import { ServerPagination } from '../../components/ui/server-pagination';
import { ShieldCheck, CheckCircle2, Plus, FileCheck2, Loader2, X } from 'lucide-react';

export default function CustomDutyView() {
  const { showToast } = useToast();

  const [duties, setDuties] = useState([]);
  const [loadingDuties, setLoadingDuties] = useState(true);

  const fetchDuties = async () => {
    try {
      setLoadingDuties(true);
      const res = await apiFetch('/api/p2p/custom-duties');
      if (res.ok) {
        const json = await res.json();
        setDuties(json.duties || []);
      }
    } catch (e) {
      console.error('Error fetching custom duties:', e);
    } finally {
      setLoadingDuties(false);
    }
  };

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [clearedBls, setClearedBls] = useState([]);
  const [selectedBlId, setSelectedBlId] = useState('');
  const [boeNumber, setBoeNumber] = useState('');
  const [dutyAmount, setDutyAmount] = useState('');
  const [portCode, setPortCode] = useState('INNHAV (Nhava Sheva)');
  const [customAgentName, setCustomAgentName] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchDuties();
    async function loadClearedBls() {
      try {
        const res = await apiFetch('/api/p2p/customs-agent/assigned');
        const json = await res.json();
        if (res.ok && json.assignments) {
          setClearedBls(json.assignments);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadClearedBls();
  }, []);

  const handleSelectBl = (blId) => {
    setSelectedBlId(blId);
    const target = clearedBls.find(b => b.blId === blId || b.blNumber === blId);
    if (target) {
      setBoeNumber(`BOE-${target.blNumber.slice(-7)}`);
      setDutyAmount('1450000');
      setCustomAgentName(target.customAgentName || 'Magnesh - Fast Forward Logistics India');
      setPortCode(target.portCode || 'INNHAV (Nhava Sheva)');
    }
  };

  const handleCreateDuty = (e) => {
    e.preventDefault();
    if (!selectedBlId) {
      showToast({ title: 'Error', description: 'Please select a BL / BOE entry.', type: 'error' });
      return;
    }

    const newDuty = {
      dutyId: `DUTY-${Math.floor(100000 + Math.random() * 900000)}`,
      blNumber: selectedBlId,
      boeNumber: boeNumber || 'BOE-908124',
      vesselName: 'EVER GIVEN V-104E',
      portCode,
      dutyAmount: Number(dutyAmount) || 1450000,
      customAgentName: customAgentName || 'Magnesh - Fast Forward Logistics India',
      icegateRef: `ICEGATE-${Math.floor(1000000 + Math.random() * 9000000)}`,
      status: 'pending',
      utrNumber: null,
      paidAt: null
    };

    setDuties(prev => [newDuty, ...prev]);
    setShowCreateModal(false);
    showToast({
      title: 'Custom Duty Payment Created',
      description: `Populated cleared BOE ${boeNumber} details. Ready for ICEGATE payout.`,
      type: 'success'
    });
  };

  const totalPages = Math.ceil(duties.length / pageSize) || 1;
  const paginatedDuties = duties.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="w-full space-y-4 font-sans text-slate-800 text-left pb-16 antialiased">
      {/* Clean Toolbar Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0d7676] border border-teal-100 flex items-center justify-center font-semibold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Customs Duty & ICEGATE Settlement</h2>
            <p className="text-xs text-slate-500">Direct ICEGATE customs duty payment execution for imported cargo BL entries</p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Custom Duty Payout</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden w-full flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Customs Duty Payout Records</h3>
          <span className="text-xs font-semibold text-slate-500">{duties.length} Items</span>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Duty ID</th>
                <th className="py-3 px-4">BL / BOE Number</th>
                <th className="py-3 px-4">Customs Agent</th>
                <th className="py-3 px-4">Port Location</th>
                <th className="py-3 px-4 text-right">Duty Amount</th>
                <th className="py-3 px-4 font-mono">ICEGATE Ref</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {paginatedDuties.map((item) => (
                <tr key={item.dutyId} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-[#0d7676]">{item.dutyId}</td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    {item.blNumber}
                    {item.boeNumber && <span className="block text-[10px] font-mono text-slate-400">{item.boeNumber}</span>}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800">{item.customAgentName || 'Magnesh (Fast Forward)'}</td>
                  <td className="py-3.5 px-4 font-medium text-slate-800">{item.portCode}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-sm">₹{item.dutyAmount.toLocaleString('en-IN')}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-700">{item.icegateRef}</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      item.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {item.status === 'pending' ? (
                      <button 
                        onClick={() => setDuties(prev => prev.map(d => d.dutyId === item.dutyId ? { ...d, status: 'paid', utrNumber: 'ICEGATE-UTR-99102' } : d))}
                        className="px-3.5 py-1.5 rounded-xl bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold text-xs shadow-2xs transition cursor-pointer"
                      >
                        Execute ICEGATE Payout
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-600 flex items-center justify-end gap-1 font-mono">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Paid via ICEGATE
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Custom Duty Modal with Auto-Population of Cleared BL / BOE */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-[#0d7676]" />
                Select BL / BOE for Customs Duty Payment
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDuty} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Select Cleared BL / BOE Entry *</label>
                <select
                  value={selectedBlId}
                  onChange={(e) => handleSelectBl(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#0d7676]"
                >
                  <option value="">-- Choose BL / BOE Entry --</option>
                  {clearedBls.map(b => (
                    <option key={b.blId} value={b.blNumber}>
                      {b.blNumber} ({b.customAgentName || 'Magnesh'})
                    </option>
                  ))}
                  <option value="MSK-908124501">MSK-908124501 (Magnesh - Fast Forward)</option>
                  <option value="MAEU-8812904">MAEU-8812904 (Magnesh - Fast Forward)</option>
                </select>
              </div>

              {selectedBlId && (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">BOE Number</label>
                    <input
                      type="text"
                      readOnly
                      value={boeNumber}
                      className="w-full px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">Customs House Agent</label>
                    <input
                      type="text"
                      readOnly
                      value={customAgentName}
                      className="w-full px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">Duty Amount (INR)</label>
                    <input
                      type="number"
                      value={dutyAmount}
                      onChange={(e) => setDutyAmount(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#0d7676]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">Port Location</label>
                    <input
                      type="text"
                      value={portCode}
                      onChange={(e) => setPortCode(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0d7676] hover:bg-[#0f766e] text-white text-xs font-bold uppercase rounded-xl shadow-xs"
                >
                  Save Duty Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
