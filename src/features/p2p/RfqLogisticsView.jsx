import React, { useState, useEffect } from 'react';
import { 
  Ship, 
  Award, 
  Layers, 
  CheckCircle2, 
  Clock, 
  FileText, 
  ShieldAlert, 
  ChevronRight, 
  Anchor,
  Truck,
  Building,
  DollarSign,
  Plus
} from 'lucide-react';

const MOCK_RFQS = [
  {
    rfqId: 'RFQ-2026-0089',
    rfqNumber: 'RFQ-2026-0089',
    title: 'Ocean Freight Sourcing - Vietnam to Mundra Port',
    poId: 'PO-4300001510',
    sapPoNumber: '4300001510',
    cargoDetails: { containerType: '40ft High Cube Solar Glass', containerCount: 6, portOfOrigin: 'Haiphong Port, VN', portOfDestination: 'Mundra Port, IN' },
    closingDate: new Date(Date.now() + 86400000 * 7).toISOString(),
    status: 'awarded',
    awardedVendorId: 'LOG-90012',
    awardedVendorName: 'Kuehne + Nagel Logistics India Pvt Ltd'
  }
];

const MOCK_QUOTES = [
  { quoteId: 'Q-01', rfqId: 'RFQ-2026-0089', vendorId: 'LOG-90012', vendorName: 'Kuehne + Nagel Logistics', freightAmount: 480000, destinationCharges: 45000, transitDays: 14, rank: 'L1', status: 'awarded' },
  { quoteId: 'Q-02', rfqId: 'RFQ-2026-0089', vendorId: 'LOG-90044', vendorName: 'DHL Global Forwarding', freightAmount: 520000, destinationCharges: 40000, transitDays: 12, rank: 'L2', status: 'submitted' },
  { quoteId: 'Q-03', rfqId: 'RFQ-2026-0089', vendorId: 'LOG-90088', vendorName: 'Maersk Logistics India', freightAmount: 560000, destinationCharges: 38000, transitDays: 10, rank: 'L3', status: 'submitted' }
];

const MOCK_BL_ENTRIES = [
  {
    blId: 'BL-MAEU987456',
    rfqId: 'RFQ-2026-0089',
    blNumber: 'MAEU987456320',
    vesselName: 'MAERSK SEOUL V-204W',
    shippingLine: 'Maersk Line',
    containerCount: 6,
    etaDate: new Date(Date.now() + 86400000 * 4).toISOString(),
    customAgentName: 'Oceanic Customs Clearance Agency',
    status: 'material_received',
    documents: [
      { docType: 'Original Bill of Lading', fileUrl: '/docs/bl.pdf', uploadedBy: 'Logistics Vendor' },
      { docType: 'Customs Bill of Entry (BOE)', fileUrl: '/docs/boe.pdf', uploadedBy: 'Customs Agent' }
    ]
  }
];

const BL_STEPS = [
  { key: 'submitted', label: '1. Vendor BL Submitted' },
  { key: 'exim_review', label: '2. EXIM Review' },
  { key: 'assigned_to_agent', label: '3. Assigned to Agent' },
  { key: 'material_received', label: '4. Material Arrived' },
  { key: 'custom_cleared', label: '5. Customs Cleared' },
  { key: 'invoice_pending', label: '6. Logistics Invoice' },
  { key: 'payment_approved', label: '7. Payment Approved' },
  { key: 'closed', label: '8. Shipment Closed' }
];

export default function RfqLogisticsView() {
  const [activeTab, setActiveTab] = useState('rfqs'); // 'rfqs' | 'bl_tracking'
  const [rfqs, setRfqs] = useState(MOCK_RFQS);
  const [quotes, setQuotes] = useState(MOCK_QUOTES);
  const [blEntries, setBlEntries] = useState(MOCK_BL_ENTRIES);
  const [selectedBl, setSelectedBl] = useState(MOCK_BL_ENTRIES[0]);

  const [showDutyModal, setShowDutyModal] = useState(false);
  const [dutyAmount, setDutyAmount] = useState('1450000');
  const [icegateRef, setIcegateRef] = useState('ICEGATE-9028471');

  useEffect(() => {
    fetchRfqData();
  }, []);

  const fetchRfqData = async () => {
    try {
      const res1 = await fetch('/api/p2p/rfqs');
      if (res1.ok) {
        const json1 = await res1.json();
        if (json1.rfqs?.length) setRfqs(json1.rfqs);
        if (json1.quotes?.length) setQuotes(json1.quotes);
      }
      const res2 = await fetch('/api/p2p/bl-entries');
      if (res2.ok) {
        const json2 = await res2.json();
        if (json2.blEntries?.length) {
          setBlEntries(json2.blEntries);
          setSelectedBl(json2.blEntries[0]);
        }
      }
    } catch (e) {
      console.log('Using mock RFQ & BL data');
    }
  };

  const handleAdvanceBlStatus = async (blId, currentStatus) => {
    const currentIndex = BL_STEPS.findIndex(s => s.key === currentStatus);
    if (currentIndex < BL_STEPS.length - 1) {
      const nextStatus = BL_STEPS[currentIndex + 1].key;
      setBlEntries(prev => prev.map(b => b.blId === blId ? { ...b, status: nextStatus } : b));
      if (selectedBl?.blId === blId) {
        setSelectedBl(prev => ({ ...prev, status: nextStatus }));
      }
      try {
        await fetch(`/api/p2p/bl-entries/${blId}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nextStatus })
        });
      } catch (e) {
        // local updated
      }
    }
  };

  const handlePayCustomsDuty = async (e) => {
    e.preventDefault();
    if (!selectedBl) return;
    try {
      await fetch(`/api/p2p/bl-entries/${selectedBl.blId}/duty-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dutyAmount: Number(dutyAmount), icegateRef })
      });
      fetchRfqData();
    } catch (e) {
      setBlEntries(prev => prev.map(b => b.blId === selectedBl.blId ? { ...b, status: 'custom_cleared' } : b));
      setSelectedBl(prev => ({ ...prev, status: 'custom_cleared' }));
    } finally {
      setShowDutyModal(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-950 via-slate-900 to-teal-950 text-white p-6 rounded-2xl shadow-md border border-blue-800/40 w-full">
        <div>
          <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs uppercase tracking-wider mb-1">
            <Ship className="w-4 h-4" /> LOGISTICS & SOURCING PIPELINE (FLOW C)
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">RFQ Freight Sourcing & BL Shipment Tracker</h1>
          <p className="text-slate-300 text-xs mt-1">
            Source shipping vendors with L1..L5 quote ranking, manage Award allocations, track Bill of Lading (BL) customs clearance, and execute ICEGATE Duty payments.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700">
          <button
            onClick={() => setActiveTab('rfqs')}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${
              activeTab === 'rfqs' ? 'bg-[#0d7676] text-white shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            RFQs & Quotes (L1..L5)
          </button>
          <button
            onClick={() => setActiveTab('bl_tracking')}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${
              activeTab === 'bl_tracking' ? 'bg-[#0d7676] text-white shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            BL Shipment Stepper
          </button>
        </div>
      </div>

      {/* TAB 1: RFQ & QUOTES */}
      {activeTab === 'rfqs' && (
        <div className="space-y-6 w-full">
          {rfqs.map((rfq) => (
            <div key={rfq.rfqId} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 w-full">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    {rfq.rfqNumber}
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-900 mt-1">{rfq.title}</h3>
                  <p className="text-xs text-slate-500">
                    PO: <span className="font-mono font-bold text-slate-700">{rfq.poId}</span> | Route: <span className="font-semibold text-slate-700">{rfq.cargoDetails?.portOfOrigin} → {rfq.cargoDetails?.portOfDestination}</span> ({rfq.cargoDetails?.containerCount} Containers)
                  </p>
                </div>
                <div>
                  <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    STATUS: {rfq.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Vendor Submitted Quotes (Ranked L1 to L3):</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                  {quotes.map((q) => (
                    <div 
                      key={q.quoteId} 
                      className={`p-4 rounded-xl border transition-all ${
                        q.rank === 'L1' ? 'bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-400/20' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold ${
                          q.rank === 'L1' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                          Rank: {q.rank}
                        </span>
                        {q.status === 'awarded' && (
                          <span className="text-[10px] font-extrabold text-emerald-700 uppercase flex items-center gap-1">
                            <Award className="w-3.5 h-3.5" /> Awarded
                          </span>
                        )}
                      </div>
                      <p className="font-extrabold text-slate-900 text-sm truncate">{q.vendorName}</p>
                      <div className="mt-2 text-xs space-y-1 text-slate-600">
                        <p className="flex justify-between"><span>Freight Cost:</span> <span className="font-extrabold text-slate-900">₹{q.freightAmount.toLocaleString('en-IN')}</span></p>
                        <p className="flex justify-between"><span>Dest Charges:</span> <span className="font-bold text-slate-800">₹{q.destinationCharges.toLocaleString('en-IN')}</span></p>
                        <p className="flex justify-between"><span>Transit Time:</span> <span className="font-bold text-slate-800">{q.transitDays} Days</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: BL SHIPMENT STEPPER TRACKER */}
      {activeTab === 'bl_tracking' && selectedBl && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6 w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Anchor className="w-5 h-5 text-blue-600" />
                <h3 className="text-xl font-extrabold text-slate-900">Bill of Lading: {selectedBl.blNumber}</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Vessel: <span className="font-bold text-slate-800">{selectedBl.vesselName}</span> | Shipping Line: <span className="font-bold text-slate-800">{selectedBl.shippingLine}</span> | Containers: <span className="font-bold text-slate-800">{selectedBl.containerCount}x40HC</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDutyModal(true)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5"
              >
                <DollarSign className="w-4 h-4" /> Execute ICEGATE Customs Duty
              </button>
              <button
                onClick={() => handleAdvanceBlStatus(selectedBl.blId, selectedBl.status)}
                className="px-4 py-2 rounded-xl bg-[#0d7676] hover:bg-teal-600 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5"
              >
                Advance Shipment Stage <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stepper Timeline Visualizer */}
          <div className="py-4">
            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-4">Shipment Lifecycle State Machine:</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
              {BL_STEPS.map((step, idx) => {
                const currentIdx = BL_STEPS.findIndex(s => s.key === selectedBl.status);
                const isCompleted = idx <= currentIdx;
                const isCurrent = idx === currentIdx;

                return (
                  <div 
                    key={step.key} 
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 transition-all ${
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

          {/* Documents Attached */}
          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Attached Clearance Documents:</h4>
            <div className="flex flex-wrap gap-3">
              {selectedBl.documents?.map((doc, idx) => (
                <div key={idx} className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800">
                  <FileText className="w-4 h-4 text-[#0d7676]" />
                  <span>{doc.docType}</span>
                  <span className="text-[10px] text-slate-400 font-normal">({doc.uploadedBy})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Customs Duty Modal */}
      {showDutyModal && selectedBl && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-600" /> Execute ICEGATE Customs Duty Payout
            </h3>
            <p className="text-xs text-slate-500">
              Direct Customs Duty payment for Bill of Lading <span className="font-bold text-slate-900">{selectedBl.blNumber}</span>.
            </p>

            <form onSubmit={handlePayCustomsDuty} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Customs Duty Amount (₹)</label>
                <input
                  type="number"
                  value={dutyAmount}
                  onChange={(e) => setDutyAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">ICEGATE Reference Number</label>
                <input
                  type="text"
                  value={icegateRef}
                  onChange={(e) => setIcegateRef(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-mono font-bold"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDutyModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-sm"
                >
                  Pay via ICEGATE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
