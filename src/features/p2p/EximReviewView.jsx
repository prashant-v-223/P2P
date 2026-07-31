import React, { useState } from 'react';
import { Anchor, CheckCircle2, ChevronRight, FileText, Clock } from 'lucide-react';

export default function EximReviewView() {
  const [blEntries, setBlEntries] = useState([
    {
      blId: 'BL-MAEU987456',
      blNumber: 'MAEU987456320',
      vesselName: 'MAERSK SEOUL V-204W',
      shippingLine: 'Maersk Line',
      containerCount: 6,
      customAgentName: 'Oceanic Customs Clearance Agency',
      status: 'material_received'
    }
  ]);

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
    <div className="w-full space-y-4 font-sans">
      {/* Clean Toolbar Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#0d7676] border border-teal-100 flex items-center justify-center font-bold">
            <Anchor className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">EXIM Review & Shipment Lifecycle Tracker</h2>
            <p className="text-xs text-slate-500">Tracking Bill of Lading (BL) entries through EXIM review, Customs Agent assignment, and Clearance</p>
          </div>
        </div>
      </div>

      {blEntries.map((bl) => (
        <div key={bl.blId} className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-6 w-full">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">BL Number: {bl.blNumber}</h3>
              <p className="text-xs text-slate-500 mt-0.5">Vessel: <span className="font-bold text-slate-800">{bl.vesselName}</span> ({bl.shippingLine})</p>
            </div>
            <button
              onClick={() => {
                const idx = STEPS.findIndex(s => s.key === bl.status);
                if (idx < STEPS.length - 1) {
                  setBlEntries(prev => prev.map(item => item.blId === bl.blId ? { ...item, status: STEPS[idx + 1].key } : item));
                }
              }}
              className="px-4 py-2 rounded-xl bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              Advance EXIM Step <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
            {STEPS.map((step, idx) => {
              const currentIdx = STEPS.findIndex(s => s.key === bl.status);
              const isCompleted = idx <= currentIdx;
              const isCurrent = idx === currentIdx;

              return (
                <div 
                  key={step.key} 
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                    isCurrent ? 'bg-teal-50 border-[#0d7676] ring-2 ring-teal-300 font-extrabold text-[#0d7676]' :
                    isCompleted ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800 font-bold' :
                    'bg-slate-50 border-slate-200 text-slate-400 font-medium'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isCompleted ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {idx + 1}
                  </div>
                  <span className="truncate">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
