import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import { Anchor, CheckCircle2, ChevronRight, FileText, Clock, Plus, Ship, UserCheck, ShieldCheck, FileCheck2 } from 'lucide-react';

export default function EximReviewView() {
  const { showToast } = useToast();
  const [blEntries, setBlEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // New BL form state
  const [blNumber, setBlNumber] = useState('');
  const [vesselName, setVesselName] = useState('EVER GIVEN V-104E');
  const [shippingLine, setShippingLine] = useState('MSC');
  const [containerCount, setContainerCount] = useState('1');
  const [customAgentName, setCustomAgentName] = useState('Magnesh - Fast Forward Logistics India');

  const fetchBlEntries = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/p2p/customs-agent/assigned');
      const json = await res.json();
      if (res.ok && json.assignments) {
        setBlEntries(json.assignments);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlEntries();
  }, []);

  const handleCreateBl = (e) => {
    e.preventDefault();
    if (!blNumber.trim()) {
      showToast({ title: 'Validation Error', description: 'BL Number is required.', type: 'error' });
      return;
    }

    const autoAsnNumber = `ASN-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const newBl = {
      blId: `BL-${Math.floor(1000 + Math.random() * 9000)}`,
      blNumber: blNumber.trim(),
      vesselName,
      shippingLine,
      containerCount: Number(containerCount) || 1,
      customAgentName,
      autoAsnNumber,
      status: 'assigned_to_agent'
    };

    setBlEntries((prev) => [newBl, ...prev]);
    setShowAddModal(false);
    setBlNumber('');

    showToast({
      title: 'BL Entry Added & Agent Assigned',
      description: `Assigned QFR/BL to ${customAgentName}. Auto-generated Import ASN: ${autoAsnNumber}`,
      type: 'success'
    });
  };

  const STEPS = [
    { key: 'submitted', label: '1. Vendor BL Submitted' },
    { key: 'exim_review', label: '2. EXIM Review' },
    { key: 'assigned_to_agent', label: '3. Assigned to Agent' },
    { key: 'material_received', label: '4. Material Arrived' },
    { key: 'custom_cleared', label: '5. Customs Cleared' },
    { key: 'invoice_pending', label: '6. Logistics Invoice' },
    { key: 'payment_approved', label: '7. Payment Approved' },
    { key: 'closed', label: '8. Shipment Closed' }
  ];

  return (
    <div className="w-full space-y-4 font-sans text-left pb-16 antialiased">
      {/* Clean Toolbar Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#0d7676] border border-teal-100 flex items-center justify-center font-bold">
            <Anchor className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">EXIM Review & Shipment Lifecycle Tracker</h2>
            <p className="text-xs text-slate-500">Tracking Bill of Lading (BL) entries through EXIM review, Customs Agent assignment, and Clearance</p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New BL Entry</span>
        </button>
      </div>

      {blEntries.map((bl) => {
        const autoAsn = bl.autoAsnNumber || `ASN-2026-9021`;
        return (
          <div key={bl.blId} className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-6 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-extrabold text-slate-900">BL Number: {bl.blNumber}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    Auto System ASN: {autoAsn}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Vessel: <span className="font-bold text-slate-800">{bl.vesselName}</span> ({bl.shippingLine}) • Assigned Agent: <span className="font-bold text-[#0d7676]">{bl.customAgentName || 'Magnesh - Fast Forward Logistics'}</span>
                </p>
              </div>
              <button
                onClick={() => {
                  const idx = STEPS.findIndex((s) => s.key === bl.status);
                  if (idx < STEPS.length - 1) {
                    setBlEntries((prev) =>
                      prev.map((item) => (item.blId === bl.blId ? { ...item, status: STEPS[idx + 1].key } : item))
                    );
                  }
                }}
                className="px-4 py-2 rounded-xl bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition cursor-pointer self-start sm:self-center"
              >
                Advance EXIM Step <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
              {STEPS.map((step, idx) => {
                const currentIdx = STEPS.findIndex((s) => s.key === bl.status);
                const isCompleted = idx <= currentIdx;
                const isCurrent = idx === currentIdx;

                return (
                  <div
                    key={step.key}
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                      isCurrent
                        ? 'bg-teal-50 border-[#0d7676] ring-2 ring-teal-300 font-extrabold text-[#0d7676]'
                        : isCompleted
                        ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-400 font-medium'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        isCompleted ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <span className="truncate">{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Add New BL Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Ship className="w-4 h-4 text-[#0d7676]" />
                New EXIM BL Entry
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBl} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">BL Number *</label>
                <input
                  type="text"
                  required
                  value={blNumber}
                  onChange={(e) => setBlNumber(e.target.value)}
                  placeholder="e.g. MSK-908124501"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0d7676]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Vessel Name</label>
                <input
                  type="text"
                  value={vesselName}
                  onChange={(e) => setVesselName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0d7676]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Assign Customs Agent *</label>
                <select
                  value={customAgentName}
                  onChange={(e) => setCustomAgentName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                >
                  <option value="Magnesh - Fast Forward Logistics India">Magnesh - Fast Forward Logistics India</option>
                  <option value="Oceanic Customs Clearance Agency">Oceanic Customs Clearance Agency</option>
                  <option value="Babaji Shivram Clearing & Carriers">Babaji Shivram Clearing & Carriers</option>
                </select>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 font-semibold">
                ℹ System Rule: ASN Number is auto-generated for Import type vendors upon BL creation.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0d7676] hover:bg-[#0f766e] text-white text-xs font-bold uppercase rounded-xl shadow-xs"
                >
                  Create & Assign Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
