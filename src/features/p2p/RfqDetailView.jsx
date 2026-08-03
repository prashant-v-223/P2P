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
  X,
  ChevronDown,
  ChevronRight,
  Users
} from 'lucide-react';

export default function RfqDetailView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useToast();

  const [rfq, setRfq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('quotes');
  const [expandedQuotes, setExpandedQuotes] = useState({});
  const [showVendorManager, setShowVendorManager] = useState(false);
  const [logisticsVendors, setLogisticsVendors] = useState([]);
  const [managedVendorIds, setManagedVendorIds] = useState([]);
  const [vendorSearch, setVendorSearch] = useState('');
  const [savingVendors, setSavingVendors] = useState(false);
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [awardRows, setAwardRows] = useState([]);
  const [submittingAward, setSubmittingAward] = useState(false);

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
        setManagedVendorIds((json.data.invitedVendors || []).map((vendor) => vendor.vendorId || vendor.sapVendorCode || vendor).filter(Boolean));
      }
    } catch (e) {
      console.error('Error fetching RFQ detail:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRfq();
    apiFetch('/api/p2p/rfqs/logistics-vendors').then((res) => res.json()).then((json) => setLogisticsVendors(json.data || [])).catch(() => {});
  }, [id]);

  const quoteMatchesVendor = (vendor) => (rfq?.quotes || []).some((quote) =>
    [vendor.id, vendor.sapVendorCode].filter(Boolean).map(String).includes(String(quote.vendorId)) || quote.vendorName === vendor.companyName
  );

  const toggleManagedVendor = (vendor) => {
    if (quoteMatchesVendor(vendor)) return;
    setManagedVendorIds((current) => current.includes(vendor.id)
      ? current.filter((value) => value !== vendor.id)
      : [...current, vendor.id]);
  };

  const saveManagedVendors = async () => {
    const lockedIds = logisticsVendors.filter(quoteMatchesVendor).map((vendor) => vendor.id);
    const vendorIdsToSave = [...new Set([...managedVendorIds, ...lockedIds])];
    if (!vendorIdsToSave.length) return showToast({ title: 'Vendor Required', description: 'At least one Freight Forwarder must remain invited.', type: 'error' });
    setSavingVendors(true);
    try {
      const invitedVendors = vendorIdsToSave.map((vendorId) => {
        const vendor = logisticsVendors.find((item) => item.id === vendorId || item.sapVendorCode === vendorId);
        return { vendorId: vendor?.id || vendorId, sapVendorCode: vendor?.sapVendorCode || vendorId, companyName: vendor?.companyName || 'Freight Forwarder' };
      });
      const response = await apiFetch(`/api/p2p/rfqs/${rfq.rfqId}`, { method: 'PUT', body: JSON.stringify({ invitedVendors }) });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Unable to update invited vendors.');
      setShowVendorManager(false);
      showToast({ title: 'Invited Vendors Updated', description: `${invitedVendors.length} vendor(s) can access this RFQ.`, type: 'success' });
      await loadRfq();
    } catch (error) { showToast({ title: 'Update Failed', description: error.message, type: 'error' }); }
    finally { setSavingVendors(false); }
  };

  const handleAwardQuote = async (quote) => {
    const quantity = Number(rfq?.cargoDetails?.containerCount) || Number(rfq?.totalQuantity) || 1;
    setAwardRows([{ quoteId: quote.quoteId, containers: quantity, remark: '' }]);
    setShowAwardModal(true);
  };

  const submitAwardAllocations = async () => {
    const totalContainers = Number(rfq?.cargoDetails?.containerCount) || Number(rfq?.totalQuantity) || 0;
    const allocated = awardRows.reduce((sum, row) => sum + (Number(row.containers) || 0), 0);
    if (!awardRows.length || allocated <= 0 || allocated > totalContainers) {
      return showToast({ title: 'Invalid Allocation', description: `Allocate between 1 and ${totalContainers} containers.`, type: 'error' });
    }
    if (new Set(awardRows.map((row) => row.quoteId)).size !== awardRows.length) {
      return showToast({ title: 'Duplicate Vendor', description: 'Each vendor quote can only appear once.', type: 'error' });
    }
    setSubmittingAward(true);
    try {
      const res = await apiFetch(`/api/p2p/rfqs/${rfq.rfqId}/award`, {
        method: 'POST',
        body: JSON.stringify({ allocations: awardRows, submitForApproval: true })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Unable to submit vendor allocations.');
      showToast({ title: 'Submitted For Approval', description: `${allocated} container(s) submitted to Procurement Head.`, type: 'success' });
      setShowAwardModal(false);
      await loadRfq();
    } catch (err) {
      showToast({ title: 'Award Error', description: err.message, type: 'error' });
    } finally { setSubmittingAward(false); }
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
  const totalContainers = Number(cargo.containerCount) || Number(rfq.totalQuantity) || 0;
  const allocatedContainers = Math.min(Number(rfq.allocatedQuantity) || 0, totalContainers);
  const pendingContainers = Math.max(0, totalContainers - allocatedContainers);
  const awardAllocated = awardRows.reduce((sum, row) => sum + (Number(row.containers) || 0), 0);
  const awardTotal = awardRows.reduce((sum, row) => {
    const quote = quotesList.find((item) => item.quoteId === row.quoteId);
    return sum + (Number(quote?.totalInr) || 0) * (Number(row.containers) || 0);
  }, 0);
  const filteredManagerVendors = logisticsVendors.filter((vendor) => `${vendor.companyName || ''} ${vendor.sapVendorCode || ''}`.toLowerCase().includes(vendorSearch.toLowerCase()));

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
            {totalContainers} <span className="text-xs font-bold text-slate-500">Containers</span>
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">ALLOCATED</span>
          <p className="text-lg font-black text-emerald-600">
            {allocatedContainers} <span className="text-xs font-bold text-slate-500">Containers</span>
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600">PENDING ALLOCATION</span>
          <p className="text-lg font-black text-amber-600">
            {pendingContainers} <span className="text-xs font-bold text-slate-500">Containers</span>
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 pt-3">
            {/* Tabs */}
            <div className="flex items-center gap-1 text-xs font-bold">
              <button
                onClick={() => setActiveTab('quotes')}
                className={`flex items-center gap-1.5 border-b-2 px-3 pb-3 transition ${
                  activeTab === 'quotes'
                    ? 'border-[#0d7676] text-[#0d7676]'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />Quotes <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">{quotesList.length}</span>
              </button>
              <button
                onClick={() => setActiveTab('vendors')}
                className={`flex items-center gap-1.5 border-b-2 px-3 pb-3 transition ${
                  activeTab === 'vendors'
                    ? 'border-[#0d7676] text-[#0d7676]'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <Users className="h-3.5 w-3.5" />Vendors <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{(rfq.invitedVendors || []).length}</span>
              </button>
              <button onClick={() => setActiveTab('bl')} className={`flex items-center gap-1.5 border-b-2 px-3 pb-3 transition ${activeTab === 'bl' ? 'border-[#0d7676] text-[#0d7676]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><Ship className="h-3.5 w-3.5" />BL Entries <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{(rfq.blEntries || []).length}</span></button>
            </div>

            <div className="mb-2 flex items-center gap-2">
              {quotesList.length > 0 && <button onClick={() => handleAwardQuote(quotesList[0])} className="px-3 py-1.5 border border-amber-300 bg-amber-50 text-amber-700 text-xs font-bold rounded-xl transition inline-flex items-center gap-1"><Award className="w-3.5 h-3.5" />Award Vendors</button>}
              <button onClick={() => { setActiveTab('vendors'); setShowVendorManager(true); }} className="px-3 py-1.5 border border-teal-200 bg-teal-50 text-[#0d7676] text-xs font-bold rounded-xl transition inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />Manage Vendors</button>
            </div>
          </div>

          {/* Quotes Table Matching Screenshot 2 */}
          {activeTab === 'quotes' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-500">
                  <tr>
                    <th className="p-3">Vendor</th>
                    <th className="p-3">Shipping Line</th>
                    <th className="p-3">Route</th>
                    <th className="p-3 text-right">Ocean Freight (USD)</th>
                    <th className="p-3 text-right">St. Charges (INR)</th>
                    <th className="p-3 text-right">Other (INR)</th>
                    <th className="p-3 text-right">Total (INR)</th>
                    <th className="p-3 text-center">Transit</th>
                    <th className="p-3 text-center">ETD</th>
                    <th className="p-3 text-center">ETA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                  {quotesList.map((q, idx) => (
                    <tr key={q.quoteId || idx} className="hover:bg-slate-50/80">
                      <td className="p-3 font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center justify-center">
                          {q.rank || `L${idx + 1}`}
                        </span>
                        {q.vendorName}
                      </td>
                      <td className="p-3 font-bold text-slate-700">{q.shippingLine}</td>
                      <td className="p-3 text-slate-500">{q.vesselRoute || '—'}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        USD {(q.oceanFreightUsd || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        ₹{(q.stChargesInr || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700">{q.otherChargesInr ? `₹${Number(q.otherChargesInr).toLocaleString('en-IN')}` : '—'}</td>
                      <td className="bg-amber-50/60 p-3 text-right font-mono font-extrabold text-emerald-700">
                        ₹{(q.totalInr || 0).toLocaleString()}
                      </td>
                      <td className="hidden">
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
                      <td className="p-3 text-center text-slate-500">{q.transitDays ? `${q.transitDays}d` : '—'}</td>
                      <td className="p-3 text-center text-slate-500">{q.vesselEtd ? new Date(q.vesselEtd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}</td>
                      <td className="p-3 text-center text-slate-500">{q.vesselEta ? new Date(q.vesselEta).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="divide-y divide-slate-100 border-t border-slate-100">
                {quotesList.map((quote, index) => {
                  const key = quote.quoteId || index;
                  return <div key={key}><button type="button" onClick={() => setExpandedQuotes((current) => ({ ...current, [key]: !current[key] }))} className="flex w-full items-center gap-2 bg-slate-50/80 px-5 py-3 text-left text-xs font-bold text-slate-800 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-300">{expandedQuotes[key] ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}<span>{quote.vendorName} — full details</span></button>{expandedQuotes[key] && <div className="grid gap-4 border-t border-slate-100 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">{[
                    ['Cost Particular', quote.costParticular], ['Free Days', quote.freeDays], ['Cutoff Date', quote.cutoffDate ? new Date(quote.cutoffDate).toLocaleDateString('en-GB') : '—'], ['Rate Validity', quote.rateValidity], ['Remarks', quote.remarks], ['Vessel ETD', quote.vesselEtd ? new Date(quote.vesselEtd).toLocaleDateString('en-GB') : '—'], ['Vessel ETA', quote.vesselEta ? new Date(quote.vesselEta).toLocaleDateString('en-GB') : '—'], ['Transit Time', quote.transitDays ? `${quote.transitDays} days` : '—'], ['Decision', rfq.status === 'awarded' && rfq.awardedVendorName === quote.vendorName ? <span className="text-emerald-700">Awarded to this vendor</span> : <button type="button" onClick={() => handleAwardQuote(quote)} className="rounded-lg bg-amber-500 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-amber-600">Award RFQ</button>]
                  ].map(([label, value]) => <div key={label} className={label === 'Cost Particular' || label === 'Remarks' ? 'sm:col-span-2' : ''}><p className="text-[10px] font-bold uppercase text-slate-400">{label}</p><p className="mt-1 whitespace-pre-wrap text-xs font-semibold text-slate-800">{value || '—'}</p></div>)}</div>}</div>;
                })}
              </div>
            </div>
          )}

          {activeTab === 'vendors' && (
            <div className="p-4 space-y-2">
              {showVendorManager && <div className="mb-4 space-y-3 rounded-xl border border-teal-200 bg-teal-50/40 p-4">
                <div className="flex items-start justify-between"><div><h3 className="text-sm font-bold text-slate-900">Manage Invited Vendors</h3><p className="text-[11px] text-slate-500">Vendors with submitted quotes are locked and cannot be removed.</p></div><button type="button" onClick={() => setShowVendorManager(false)}><X className="h-4 w-4 text-slate-400" /></button></div>
                <input value={vendorSearch} onChange={(event) => setVendorSearch(event.target.value)} placeholder="Search vendor name or code..." className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-teal-300" />
                <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                  {filteredManagerVendors.map((vendor) => { const selected = managedVendorIds.includes(vendor.id) || managedVendorIds.includes(vendor.sapVendorCode); const locked = quoteMatchesVendor(vendor); return <label key={vendor.id} className={`flex items-center justify-between gap-3 p-3 ${locked ? 'bg-slate-50' : 'cursor-pointer hover:bg-teal-50/40'}`}><div className="flex items-center gap-3"><input type="checkbox" checked={selected || locked} disabled={locked} onChange={() => toggleManagedVendor(vendor)} className="h-4 w-4 accent-[#0d7676]" /><div><p className="text-xs font-bold text-slate-900">{vendor.companyName}</p><p className="font-mono text-[10px] text-slate-400">{vendor.sapVendorCode}</p></div></div>{locked && <span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-600">Quote submitted</span>}</label>; })}
                </div>
                <div className="flex items-center justify-between"><p className="text-[10px] font-semibold text-slate-500">{managedVendorIds.length} vendor(s) selected</p><div className="flex gap-2"><button type="button" onClick={() => setShowVendorManager(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold">Cancel</button><button type="button" disabled={savingVendors} onClick={saveManagedVendors} className="rounded-lg bg-[#0d7676] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{savingVendors ? 'Saving...' : 'Save Vendor List'}</button></div></div>
              </div>}
              {(rfq.invitedVendors || []).map((v, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900">{v.companyName || (typeof v === 'string' ? v : '')}</p>
                    <p className="text-[10px] font-mono text-slate-400">{v.sapVendorCode || ''}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${quotesList.some((quote) => quote.vendorId === v.vendorId || quote.vendorId === v.sapVendorCode || quote.vendorName === v.companyName) ? 'bg-blue-50 text-blue-700' : 'bg-emerald-100 text-emerald-800'}`}>{quotesList.some((quote) => quote.vendorId === v.vendorId || quote.vendorId === v.sapVendorCode || quote.vendorName === v.companyName) ? 'Quote submitted' : 'Invited'}</span>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'bl' && <div className="p-4">{(rfq.blEntries || []).length ? <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">{rfq.blEntries.map((entry) => <div key={entry.blId || entry._id} className="grid gap-3 p-3 text-xs sm:grid-cols-4"><div><p className="text-[10px] uppercase text-slate-400">BL Number</p><p className="font-bold">{entry.blNumber}</p></div><div><p className="text-[10px] uppercase text-slate-400">Shipping Line</p><p className="font-bold">{entry.shippingLine || '—'}</p></div><div><p className="text-[10px] uppercase text-slate-400">ETA</p><p className="font-bold">{entry.etaDate ? new Date(entry.etaDate).toLocaleDateString('en-GB') : '—'}</p></div><div><p className="text-[10px] uppercase text-slate-400">Status</p><p className="font-bold capitalize text-[#0d7676]">{String(entry.status || 'submitted').replaceAll('_', ' ')}</p></div></div>)}</div> : <p className="py-10 text-center text-xs text-slate-400">No Bill of Lading entries have been created for this RFQ.</p>}</div>}
        </div>
      </div>

      {showAwardModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-[1px]">
        <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900"><Award className="h-5 w-5 text-amber-500" />Award Vendors</h2><p className="mt-1 text-xs text-slate-500">Split awarded containers across one or more quoted vendors. Award amount is calculated from each quote total.</p></div><button type="button" onClick={() => setShowAwardModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
          <div className="p-5"><div className="overflow-x-auto rounded-xl border border-slate-200"><div className="grid min-w-[760px] grid-cols-[1.5fr_.7fr_1fr_1fr_1.1fr_36px] gap-3 bg-slate-50 px-4 py-2 text-[10px] font-extrabold uppercase text-slate-500"><span>Vendor</span><span>Containers</span><span>Quote Total</span><span>Award Amount</span><span>Remark</span><span /></div>
            {awardRows.map((row, index) => { const quote = quotesList.find((item) => item.quoteId === row.quoteId); return <div key={index} className="grid min-w-[760px] grid-cols-[1.5fr_.7fr_1fr_1fr_1.1fr_36px] items-center gap-3 border-t border-slate-100 px-4 py-3"><select value={row.quoteId} onChange={(event) => setAwardRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, quoteId: event.target.value } : item))} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"><option value="">Select vendor quote</option>{quotesList.map((item) => <option key={item.quoteId} value={item.quoteId}>{item.vendorName} ({item.rank})</option>)}</select><input type="number" min="1" max={totalContainers} value={row.containers} onChange={(event) => setAwardRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, containers: event.target.value } : item))} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold" /><span className="text-xs font-bold">₹{Number(quote?.totalInr || 0).toLocaleString('en-IN')}</span><span className="text-xs font-extrabold text-slate-900">₹{((Number(quote?.totalInr) || 0) * (Number(row.containers) || 0)).toLocaleString('en-IN')}</span><textarea rows="2" value={row.remark} onChange={(event) => setAwardRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, remark: event.target.value } : item))} placeholder="Optional remark" className="resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs" /><button type="button" disabled={awardRows.length === 1} onClick={() => setAwardRows((current) => current.filter((_, rowIndex) => rowIndex !== index))} className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:text-rose-600 disabled:opacity-40"><X className="h-3.5 w-3.5" /></button></div>; })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><button type="button" disabled={awardRows.length >= quotesList.length} onClick={() => setAwardRows((current) => [...current, { quoteId: quotesList.find((quote) => !current.some((row) => row.quoteId === quote.quoteId))?.quoteId || '', containers: 1, remark: '' }])} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-[#0d7676] disabled:opacity-40">+ Add Vendor Allocation</button><div className="text-right text-xs text-slate-500"><p>Batch allocation: <strong className={awardAllocated > totalContainers ? 'text-rose-600' : 'text-slate-900'}>{awardAllocated} / {totalContainers}</strong> containers</p><p>Total award amount: <strong className="text-sm text-slate-900">₹{awardTotal.toLocaleString('en-IN')}</strong></p></div></div></div>
          <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3"><button type="button" onClick={() => setShowAwardModal(false)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold">Cancel</button><button type="button" disabled={submittingAward || awardAllocated <= 0 || awardAllocated > totalContainers} onClick={submitAwardAllocations} className="rounded-lg border border-amber-400 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50">{submittingAward ? 'Submitting...' : 'Submit For Approval'}</button></div>
        </div>
      </div>}

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
