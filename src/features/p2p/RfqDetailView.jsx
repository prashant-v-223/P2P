import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import { 
  ArrowLeft, 
  Pencil, 
  Copy, 
  Trash2, 
  Ship, 
  Loader2, 
  Award,
  CheckCircle2,
  Calendar,
  Layers,
  Container,
  Building2,
  FileText,
  Plus,
  X
} from 'lucide-react';

export default function RfqDetailView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useToast();

  const [rfq, setRfq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('quotes');

  // New quote modal state
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [shippingLine, setShippingLine] = useState('');
  const [oceanFreightUsd, setOceanFreightUsd] = useState('');
  const [stChargesInr, setStChargesInr] = useState('');
  const [otherChargesInr, setOtherChargesInr] = useState('');
  const [transitDays, setTransitDays] = useState('');
  const [submittingQuote, setSubmittingQuote] = useState(false);

  const loadRfq = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/p2p/rfqs/${id}`);
      const json = await res.json();
      if (res.ok && json.data) {
        setRfq(json.data);
      }
    } catch (e) {
      console.error('Error fetching RFQ detail:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRfq();
  }, [id]);

  const handleAwardQuote = async (quote) => {
    if (!window.confirm(`Award RFQ ${rfq.rfqNumber} to ${quote.vendorName || 'selected vendor'}?`)) return;
    try {
      const res = await apiFetch(`/api/p2p/rfqs/${rfq.rfqId}/award`, {
        method: 'POST',
        body: JSON.stringify({
          quoteId: quote.quoteId,
          vendorId: quote.vendorId || 'VEND-10029',
          vendorName: quote.vendorName || 'Dummy FF'
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast({
          title: 'RFQ Awarded!',
          description: `Awarded to ${quote.vendorName}. Saved to MongoDB.`,
          type: 'success'
        });
        loadRfq();
      }
    } catch (err) {
      showToast({ title: 'Award Error', description: err.message, type: 'error' });
    }
  };

  const handleCreateQuoteSubmit = async (e) => {
    e.preventDefault();
    setSubmittingQuote(true);
    try {
      const res = await apiFetch(`/api/p2p/rfqs/${rfq.rfqId}/quote`, {
        method: 'POST',
        body: JSON.stringify({
          vendorName,
          shippingLine,
          oceanFreightUsd,
          stChargesInr,
          otherChargesInr,
          transitDays
        })
      });
      const json = await res.json();
      setSubmittingQuote(false);
      if (res.ok && json.success) {
        showToast({
          title: 'Quote Submitted',
          description: 'Freight quote submitted and auto-ranked in MongoDB.',
          type: 'success'
        });
        setShowQuoteModal(false);
        loadRfq();
      }
    } catch (err) {
      setSubmittingQuote(false);
      showToast({ title: 'Quote Error', description: err.message, type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center space-y-2">
        <Loader2 className="w-8 h-8 animate-spin text-[#0d7676]" />
        <p className="text-xs font-semibold text-slate-600">Loading RFQ Details from MongoDB...</p>
      </div>
    );
  }

  if (!rfq) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-sm font-bold text-slate-700">RFQ record not found in MongoDB.</p>
        <Link to="/admin/rfqs" className="text-xs text-[#0d7676] font-bold hover:underline">
          ← Back to RFQs
        </Link>
      </div>
    );
  }

  const cargo = rfq.cargoDetails || {};
  const quotesList = rfq.quotes || [];

  return (
    <div className="w-full space-y-5 font-sans pb-16 antialiased text-left">
      {/* Top Navigation & Actions Bar Matching Screenshot 2 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/admin/rfqs')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to RFQs</span>
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{rfq.rfqNumber}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0d7676]/10 text-[#0d7676] border border-[#0d7676]/20 uppercase">
              {rfq.status || 'Published'}
            </span>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-0.5">{rfq.title}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/admin/rfqs/${rfq.rfqId}/edit`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Edit RFQ</span>
          </button>
          <button
            onClick={async () => {
              const res = await apiFetch(`/api/p2p/rfqs/${rfq.rfqId}/copy`, { method: 'POST' });
              if (res.ok) {
                showToast({ title: 'Copied', description: 'RFQ copied in MongoDB.', type: 'success' });
                navigate('/admin/rfqs');
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy RFQ</span>
          </button>
          <button
            onClick={async () => {
              if (window.confirm('Delete this RFQ from MongoDB?')) {
                await apiFetch(`/api/p2p/rfqs/${rfq.rfqId}`, { method: 'DELETE' });
                navigate('/admin/rfqs');
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete RFQ</span>
          </button>
        </div>
      </div>

      {/* Top 3 Summary Cards Matching Screenshot 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">TOTAL RFQ QUANTITY</span>
          <p className="text-lg font-black text-slate-900">
            {rfq.totalQuantity || cargo.containerCount || 1} <span className="text-xs font-bold text-slate-500">Containers</span>
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">ALLOCATED</span>
          <p className="text-lg font-black text-emerald-600">
            {rfq.allocatedQuantity || 0} <span className="text-xs font-bold text-slate-500">Containers</span>
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600">PENDING ALLOCATION</span>
          <p className="text-lg font-black text-amber-600">
            {rfq.pendingAllocation !== undefined ? rfq.pendingAllocation : (cargo.containerCount || 1)} <span className="text-xs font-bold text-slate-500">Containers</span>
          </p>
        </div>
      </div>

      {/* Two Column Layout Matching Screenshot 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Sidebar Cards */}
        <div className="space-y-4 lg:col-span-1">
          {/* Card: RFQ Info */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">
              RFQ INFO
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">RFQ Number</span>
                <span className="font-mono font-bold text-slate-900">{rfq.rfqNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">PO Number</span>
                <span className="font-mono font-bold text-slate-900">{rfq.poId || '4700000251'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Created By</span>
                <span className="font-bold text-slate-800">System Admin</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Closing</span>
                <span className="font-bold text-slate-700">
                  {rfq.closingDate ? new Date(rfq.closingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Expired'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Vendors</span>
                <span className="font-bold text-[#0d7676]">{(rfq.invitedVendors || []).length || 1} invited</span>
              </div>
            </div>
          </div>

          {/* Card: Shipment Requirements */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">
              SHIPMENT REQUIREMENTS
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Shipping Terms</span>
                <span className="font-bold text-slate-900">{cargo.shippingTerms || 'FOB'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Port of Loading</span>
                <span className="font-bold text-slate-900">{cargo.portOfOrigin || 'SHANGHAI'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Port of Discharge</span>
                <span className="font-bold text-slate-900">{cargo.portOfDestination || 'NHAVA SHEVA'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Cargo Type</span>
                <span className="font-bold text-slate-900">{cargo.cargoType || 'SOLAR CELL'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Container Type</span>
                <span className="font-bold text-slate-900">{cargo.containerType || '40 FT'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Quotes & Vendors Matrix Matching Screenshot 2 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden lg:col-span-2 space-y-4 p-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            {/* Tabs */}
            <div className="flex items-center gap-4 text-xs font-bold">
              <button
                onClick={() => setActiveTab('quotes')}
                className={`pb-2 border-b-2 transition ${
                  activeTab === 'quotes'
                    ? 'border-[#0d7676] text-[#0d7676]'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Quotes ({quotesList.length})
              </button>
              <button
                onClick={() => setActiveTab('vendors')}
                className={`pb-2 border-b-2 transition ${
                  activeTab === 'vendors'
                    ? 'border-[#0d7676] text-[#0d7676]'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Vendors ({(rfq.invitedVendors || []).length || 1})
              </button>
            </div>

            <button
              onClick={() => setShowQuoteModal(true)}
              className="px-3 py-1.5 bg-[#0d7676] hover:bg-[#0f766e] text-white text-xs font-bold rounded-xl transition inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Submit Quote</span>
            </button>
          </div>

          {/* Quotes Table Matching Screenshot 2 */}
          {activeTab === 'quotes' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100">
                  <tr>
                    <th className="p-3">Vendor</th>
                    <th className="p-3">Shipping Line</th>
                    <th className="p-3 text-right">Ocean Freight (USD)</th>
                    <th className="p-3 text-right">St. Charges (INR)</th>
                    <th className="p-3 text-right">Total (INR)</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                  {quotesList.map((q, idx) => (
                    <tr key={q.quoteId || idx} className="hover:bg-slate-50/80">
                      <td className="p-3 font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center justify-center">
                          {q.rank || `L${idx + 1}`}
                        </span>
                        {q.vendorName}
                      </td>
                      <td className="p-3 font-bold text-slate-700">{q.shippingLine}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        USD {(q.oceanFreightUsd || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        ₹{(q.stChargesInr || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono font-extrabold text-emerald-700">
                        ₹{(q.totalInr || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-right">
                        {rfq.status === 'awarded' && rfq.awardedVendorName === q.vendorName ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Awarded
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAwardQuote(q)}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] rounded-lg shadow-2xs transition cursor-pointer"
                          >
                            Award RFQ
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'vendors' && (
            <div className="p-4 space-y-2">
              {(rfq.invitedVendors || []).map((v, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900">{v.companyName || (typeof v === 'string' ? v : '')}</p>
                    <p className="text-[10px] font-mono text-slate-400">{v.sapVendorCode || ''}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Invited
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Submit Vendor Quote Modal */}
      {showQuoteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Ship className="w-4 h-4 text-[#0d7676]" />
                Submit Vendor Quote
              </h3>
              <button onClick={() => setShowQuoteModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateQuoteSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Vendor Name</label>
                <input
                  type="text"
                  required
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0d7676]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Shipping Line</label>
                <input
                  type="text"
                  required
                  value={shippingLine}
                  onChange={(e) => setShippingLine(e.target.value)}
                  placeholder="e.g. MSC / MAERSK"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0d7676]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Ocean Freight (USD)</label>
                  <input
                    type="number"
                    required
                    value={oceanFreightUsd}
                    onChange={(e) => setOceanFreightUsd(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">St. Charges (INR)</label>
                  <input
                    type="number"
                    value={stChargesInr}
                    onChange={(e) => setStChargesInr(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuoteModal(false)}
                  className="px-4 py-2 border border-slate-200 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingQuote}
                  className="px-4 py-2 bg-[#0d7676] hover:bg-[#0f766e] text-white text-xs font-bold uppercase rounded-xl shadow-xs"
                >
                  {submittingQuote ? 'Submitting...' : 'Save Quote to MongoDB'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
