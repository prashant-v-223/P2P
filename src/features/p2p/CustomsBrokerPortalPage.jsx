import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import { 
  Ship, 
  Clock, 
  CheckCircle2, 
  Upload, 
  FileText, 
  ShieldCheck, 
  Plus, 
  LogOut, 
  Loader2, 
  Building2, 
  X,
  FileCheck2
} from 'lucide-react';

export default function CustomsBrokerPortalPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    agentName: 'Magnesh',
    agentCompany: 'Fast Forward Logistics India',
    totalAssigned: 2,
    pendingClearance: 1,
    customCleared: 1,
    assignments: []
  });

  const [selectedBl, setSelectedBl] = useState(null);
  const [showBoeModal, setShowBoeModal] = useState(false);
  const [boeNumber, setBoeNumber] = useState('');
  const [dutyAmount, setDutyAmount] = useState('');
  const [submittingBoe, setSubmittingBoe] = useState(false);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/p2p/customs-agent/assigned');
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json);
      }
    } catch (e) {
      console.error('Fetch customs assignments error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const handleUploadBoeSubmit = async (e) => {
    e.preventDefault();
    if (!boeNumber.trim()) {
      showToast({ title: 'Error', description: 'BOE Number is required.', type: 'error' });
      return;
    }
    setSubmittingBoe(true);
    try {
      const res = await apiFetch('/api/p2p/customs-agent/upload-boe', {
        method: 'POST',
        body: JSON.stringify({
          blId: selectedBl.blId,
          boeNumber,
          dutyAmount: Number(dutyAmount) || 0,
          fileName: `BOE-${boeNumber.trim()}.pdf`
        })
      });
      const json = await res.json();
      setSubmittingBoe(false);
      if (res.ok && json.success) {
        showToast({
          title: 'BOE Uploaded',
          description: `Bill of Entry ${boeNumber} uploaded successfully.`,
          type: 'success'
        });
        setShowBoeModal(false);
        setBoeNumber('');
        setDutyAmount('');
        fetchAssignments();
      }
    } catch (err) {
      setSubmittingBoe(false);
      showToast({ title: 'Error', description: err.message, type: 'error' });
    }
  };

  const handleMarkAsCleared = async (bl) => {
    if (!window.confirm(`Confirm marking BL ${bl.blNumber} as Customs Cleared?`)) return;
    try {
      const res = await apiFetch('/api/p2p/customs-agent/clear', {
        method: 'POST',
        body: JSON.stringify({ blId: bl.blId })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast({
          title: 'Customs Cleared!',
          description: 'BL marked as cleared. Invoicing options enabled for Agent & Vendors.',
          type: 'success'
        });
        fetchAssignments();
      }
    } catch (err) {
      showToast({ title: 'Error', description: err.message, type: 'error' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased pb-16 text-left">
      {/* Top Navbar Matching Screenshot 4 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#0d7676] text-white flex items-center justify-center font-extrabold text-sm">
                R
              </div>
              <span className="text-base font-extrabold text-slate-900 tracking-tight">
                RAYZON <span className="text-[#0d7676] font-medium">SOLAR</span>
              </span>
            </div>

            <nav className="hidden md:flex items-center gap-1 bg-slate-100/70 p-1 rounded-xl">
              <button className="px-3 py-1.5 bg-white text-[#0d7676] font-bold text-xs rounded-lg shadow-2xs">
                Dashboard
              </button>
              <button className="px-3 py-1.5 text-slate-600 hover:text-slate-900 font-semibold text-xs rounded-lg transition">
                BL Assignments
              </button>
              <button className="px-3 py-1.5 text-slate-600 hover:text-slate-900 font-semibold text-xs rounded-lg transition">
                Profile
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700 hidden sm:inline-block">
              {data.agentName}
            </span>
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Banner Card Matching Screenshot 4 */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0d7676] to-[#0f766e] text-white p-6 sm:p-8 shadow-md">
          <div className="relative z-10 space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-200">
              Customs Broker Portal
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {data.agentName}
            </h1>
            <p className="text-xs font-medium text-teal-100">
              {data.agentCompany}
            </p>
          </div>
          <div className="absolute -right-8 -bottom-10 opacity-15 pointer-events-none">
            <ShieldCheck className="w-64 h-64 text-white" />
          </div>
        </div>

        {/* 3 Metric Cards Matching Screenshot 4 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                TOTAL ASSIGNED
              </span>
              <p className="text-2xl font-black text-slate-900">{data.totalAssigned}</p>
              <p className="text-[11px] text-slate-400 font-medium">BL entries assigned to you</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shrink-0">
              <Ship className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-amber-200/80 bg-amber-50/20 shadow-2xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">
                PENDING CLEARANCE
              </span>
              <p className="text-2xl font-black text-amber-700">{data.pendingClearance}</p>
              <p className="text-[11px] text-amber-600 font-medium">Awaiting your action</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-emerald-200/80 bg-emerald-50/20 shadow-2xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                CUSTOM CLEARED
              </span>
              <p className="text-2xl font-black text-emerald-700">{data.customCleared}</p>
              <p className="text-[11px] text-emerald-600 font-medium">Successfully cleared</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Section Card: BL Clearance Assignments Matching Screenshot 4 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">BL Clearance Assignments</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                View and manage your assigned Bill of Lading entries
              </p>
            </div>
            <button
              onClick={fetchAssignments}
              className="px-4 py-2 bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold text-xs rounded-xl shadow-xs transition"
            >
              View All →
            </button>
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-2">
              <Loader2 className="w-7 h-7 animate-spin text-[#0d7676]" />
              <p className="text-xs font-semibold text-slate-600">Loading assignments...</p>
            </div>
          ) : data.assignments.length === 0 ? (
            <div className="py-16 text-center text-xs font-medium text-slate-400">
              No BL clearance assignments assigned to your agent account.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.assignments.map((bl) => {
                const isCleared = bl.status === 'custom_cleared';
                return (
                  <div key={bl.blId} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-900">{bl.blNumber}</span>
                        <span className="text-[10px] font-mono text-slate-400">({bl.blId})</span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            isCleared
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {isCleared ? 'CUSTOM CLEARED' : 'PENDING CLEARANCE'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium">
                        Vessel: <span className="font-bold text-slate-800">{bl.vesselName || 'EVER GIVEN V-104E'}</span> • Shipping Line: <span className="font-bold text-slate-800">{bl.shippingLine || 'MSC'}</span>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Containers: <span className="font-bold text-slate-700">{bl.containerCount || 1} x 40FT</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedBl(bl);
                          setShowBoeModal(true);
                        }}
                        className="px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-2xs transition inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#0d7676]" />
                        <span>Upload BOE</span>
                      </button>

                      {!isCleared ? (
                        <button
                          onClick={() => handleMarkAsCleared(bl)}
                          className="px-4 py-2 bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Mark as Customs Cleared</span>
                        </button>
                      ) : (
                        <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Cleared & Invoicing Enabled
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Upload BOE Modal */}
      {showBoeModal && selectedBl && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-[#0d7676]" />
                Upload Bill of Entry (BOE)
              </h3>
              <button onClick={() => setShowBoeModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadBoeSubmit} className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-500 font-medium">BL Number: <span className="font-mono font-bold text-slate-900">{selectedBl.blNumber}</span></p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">BOE Number *</label>
                <input
                  type="text"
                  required
                  value={boeNumber}
                  onChange={(e) => setBoeNumber(e.target.value)}
                  placeholder="e.g. BOE-8902145"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0d7676]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Duty Amount (INR)</label>
                <input
                  type="number"
                  value={dutyAmount}
                  onChange={(e) => setDutyAmount(e.target.value)}
                  placeholder="e.g. 450000"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0d7676]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Attach Document</label>
                <input
                  type="file"
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-teal-50 file:text-[#0d7676]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBoeModal(false)}
                  className="px-4 py-2 border border-slate-200 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBoe}
                  className="px-4 py-2 bg-[#0d7676] hover:bg-[#0f766e] text-white text-xs font-bold uppercase rounded-xl shadow-xs"
                >
                  {submittingBoe ? 'Uploading...' : 'Save BOE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
