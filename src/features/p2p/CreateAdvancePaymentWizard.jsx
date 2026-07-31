import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import {
  Search, Check, Upload, X, FileText, Loader2, AlertCircle,
  ChevronRight, Building2, IndianRupee, Percent, ArrowLeft, Send,
  ShieldCheck, Banknote, TrendingUp, Info, CheckCircle2, Clock,
  Receipt
} from 'lucide-react';

const fmt = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STEPS = [
  { id: 1, label: 'Select PO',       icon: Building2   },
  { id: 2, label: 'Payment Details', icon: IndianRupee },
  { id: 3, label: 'Documents',       icon: FileText    },
  { id: 4, label: 'Review & Submit', icon: ShieldCheck },
];

export default function CreateAdvancePaymentWizard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useSelector((s) => s.auth);

  const [currentStep, setCurrentStep] = useState(1);
  const [livePos,     setLivePos]     = useState([]);
  const [searchPo,   setSearchPo]    = useState('');
  const [loadingPos, setLoadingPos]  = useState(false);
  const [selectedPo, setSelectedPo]  = useState(null);
  const [amountMode,  setAmountMode]  = useState('pct');
  const [amountValue, setAmountValue] = useState('');
  const [pctValue,    setPctValue]    = useState('20');
  const [reason,      setReason]      = useState('');
  const [paymentMode, setPaymentMode] = useState('NEFT');
  const [bankName,    setBankName]    = useState('');
  const [withGst,  setWithGst]  = useState(false);
  const [gstType,  setGstType]  = useState('inter');
  const [cgstPct,  setCgstPct]  = useState('9');
  const [sgstPct,  setSgstPct]  = useState('9');
  const [igstPct,  setIgstPct]  = useState('18');
  const [documents, setDocuments] = useState([]);
  const [dragging,  setDragging]  = useState(false);
  const [errors,    setErrors]    = useState({});
  const [saving,    setSaving]    = useState(false);
  const [dynamicWorkflow, setDynamicWorkflow] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoadingPos(true);
        const res  = await apiFetch('/api/p2p/purchase-orders?size=100');
        const json = await res.json();
        if (json.data?.length) setLivePos(json.data.map(p => ({
          poNumber:     p.sapPoNumber || p.poNumber,
          supplierName: p.supplierName || 'Vendor',
          supplierId:   p.supplierId   || '',
          totalAmount:  p.totalAmount  || 0,
          advancePaid:  p.advancePaid  || 0,
          currency:     p.currency     || 'INR',
          status:       p.status       || 'open',
        })));
      } catch (e) { console.error(e); } finally { setLoadingPos(false); }
    })();
  }, []);

  const filteredPos = useMemo(() => {
    const q = searchPo.trim().toLowerCase();
    if (!q) return livePos.slice(0, 8);
    return livePos.filter(p =>
      p.poNumber.toLowerCase().includes(q) ||
      p.supplierName.toLowerCase().includes(q) ||
      p.supplierId.toLowerCase().includes(q)
    );
  }, [searchPo, livePos]);

  const poValue          = selectedPo?.totalAmount || 0;
  const advancePaid      = selectedPo?.advancePaid || 0;
  const availableBalance = Math.max(0, poValue - advancePaid);

  const calculatedAmount = useMemo(() => {
    if (!selectedPo) return 0;
    return amountMode === 'pct' ? availableBalance * (Number(pctValue) / 100) : Number(amountValue) || 0;
  }, [selectedPo, amountMode, pctValue, amountValue, availableBalance]);

  const calculatedPct = useMemo(() => {
    if (!selectedPo || availableBalance === 0) return 0;
    return amountMode === 'pct' ? Number(pctValue) || 0 : (calculatedAmount / availableBalance) * 100;
  }, [selectedPo, availableBalance, amountMode, pctValue, calculatedAmount]);

  const remainingAfter = availableBalance - calculatedAmount;
  const cgstAmount     = withGst && gstType === 'intra' ? calculatedAmount * (Number(cgstPct) / 100) : 0;
  const sgstAmount     = withGst && gstType === 'intra' ? calculatedAmount * (Number(sgstPct) / 100) : 0;
  const igstAmount     = withGst && gstType === 'inter' ? calculatedAmount * (Number(igstPct) / 100) : 0;
  const totalGstAmount = cgstAmount + sgstAmount + igstAmount;
  const grandTotal     = calculatedAmount + totalGstAmount;

  // Fetch dynamic workflow preview from backend whenever amount changes
  useEffect(() => {
    const amt = grandTotal || calculatedAmount || 0;
    let active = true;
    apiFetch(`/api/p2p/workflows/preview?module=Advance Payment&amount=${amt}`)
      .then(res => res.json())
      .then(data => {
        if (active && data.workflow) {
          setDynamicWorkflow(data.workflow);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [grandTotal, calculatedAmount]);

  const validate = (step) => {
    const e = {};
    if (step === 1 && !selectedPo)                                          e.po     = 'Please select a Purchase Order.';
    if (step === 2 && calculatedAmount <= 0)                                e.amount = 'Amount must be greater than ₹0.';
    if (step === 2 && calculatedAmount > availableBalance)                  e.amount = `Exceeds available balance ₹${fmt(availableBalance)}.`;
    if (step === 2 && (!reason.trim() || reason.trim().length < 5))         e.reason = 'Please enter a reason (min 5 chars).';
    if (step === 3 && documents.length === 0)                               e.docs   = 'At least one supporting document is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goNext = () => { if (validate(currentStep)) setCurrentStep(s => Math.min(s + 1, 4)); };
  const goBack = () => { setErrors({}); setCurrentStep(s => Math.max(s - 1, 1)); };

  const addFiles = (files) => {
    setDocuments(prev => [...prev, ...Array.from(files).map(f => ({ name: f.name, size: `${(f.size/1024).toFixed(1)} KB`, file: f }))]);
    setErrors(p => ({ ...p, docs: null }));
  };

  const handleSubmit = async () => {
    if (!validate(2)) { setCurrentStep(2); return; }
    setSaving(true);
    try {
      const res  = await apiFetch('/api/p2p/advances/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poNumber: selectedPo.poNumber, vendorName: selectedPo.supplierName,
          vendorCode: selectedPo.supplierId, amount: calculatedAmount, percentageOfPo: calculatedPct,
          cgst: cgstAmount, sgst: sgstAmount, igst: igstAmount, totalGst: totalGstAmount,
          grandTotal, paymentMode, bankName, remarks: reason,
          requestedBy: user?.name || user?.email || 'Finance Team' }),
      });
      const data = await res.json();
      if (!res.ok) { showToast({ type: 'error', title: 'Submission failed', description: data.error || 'Server error.' }); return; }
      showToast({ type: 'success', title: 'Advance Payment Submitted', description: `${data.data?.advanceId || 'Request'} sent for Procurement Head approval.` });
      navigate('/p2p/advances');
    } catch (e) {
      showToast({ type: 'error', title: 'Network error', description: e.message });
    } finally { setSaving(false); }
  };

  // ─── Compact input class ──────────────────────────────────────────────────
  const inp = (err) => `w-full px-3 py-2 text-xs border rounded-lg outline-none transition-all ${err
    ? 'border-rose-300 bg-rose-50/30 focus:ring-2 focus:ring-rose-100'
    : 'border-slate-200 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-100'}`;

  // ─── Sidebar ──────────────────────────────────────────────────────────────
  const Sidebar = () => (
    <aside className="hidden xl:flex flex-col gap-2.5 w-60 shrink-0 text-xs">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5 text-teal-600" />
          <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">Summary</span>
        </div>
        <div className="p-3 space-y-2.5">
          {selectedPo ? (
            <>
              <div>
                <p className="text-slate-400 font-medium text-[10px]">Purchase Order</p>
                <p className="font-mono font-bold text-slate-900">{selectedPo.poNumber}</p>
                <p className="text-slate-500 text-[10px] mt-0.5 leading-snug">{selectedPo.supplierName}</p>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-slate-400 text-[9px] font-bold uppercase">PO Value</p>
                  <p className="font-mono font-bold text-slate-700 text-[11px] mt-0.5">₹{fmt(poValue)}</p>
                </div>
                <div className="bg-teal-50 rounded-lg p-2">
                  <p className="text-teal-600 text-[9px] font-bold uppercase">Available</p>
                  <p className="font-mono font-bold text-teal-700 text-[11px] mt-0.5">₹{fmt(availableBalance)}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="py-3 text-center text-slate-400">
              <Building2 className="w-6 h-6 mx-auto mb-1 opacity-25" />
              <p className="text-[10px] font-medium">No PO selected</p>
            </div>
          )}

          {calculatedAmount > 0 && (
            <div className="border-t border-slate-100 pt-2.5 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Advance</span>
                <span className="font-mono font-bold text-teal-700">₹{fmt(calculatedAmount)}</span>
              </div>
              {totalGstAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">+ GST</span>
                  <span className="font-mono font-bold text-amber-600">₹{fmt(totalGstAmount)}</span>
                </div>
              )}
              <div className="flex justify-between bg-teal-50 px-2 py-1.5 rounded-lg">
                <span className="font-bold text-teal-800">Total</span>
                <span className="font-mono font-bold text-teal-700">₹{fmt(grandTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Remaining</span>
                <span className={`font-mono font-bold ${remainingAfter < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>₹{fmt(remainingAfter)}</span>
              </div>
            </div>
          )}
          {documents.length > 0 && (
            <div className="border-t border-slate-100 pt-2">
              <p className="text-slate-400 flex items-center gap-1"><FileText className="w-3 h-3" /> {documents.length} doc{documents.length > 1 ? 's' : ''} attached</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
            <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">Approval Flow</span>
          </div>
          {dynamicWorkflow?.slab && (
            <span className="text-[9px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">
              {dynamicWorkflow.slab}
            </span>
          )}
        </div>
        <div className="p-3 space-y-2">
          {(dynamicWorkflow?.steps || [
            { step: 1, title: 'Procurement Head Approval', roleName: 'Procurement Head' },
            { step: 2, title: 'Finance Lead Approval',     roleName: 'Finance Lead' }
          ]).map((st, i) => (
            <div key={st.step || i} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 text-[9px] font-bold flex items-center justify-center shrink-0">
                {st.step || i + 1}
              </div>
              <span className="text-[11px] font-semibold text-slate-700">
                {st.roleName || st.title}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-50">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-[10px] text-slate-500 font-semibold">Payment released</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 flex gap-2 text-[10px] text-blue-700">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-400" />
        <p className="leading-relaxed">Advance cannot exceed PO value. GST is applicable based on vendor location.</p>
      </div>
    </aside>
  );

  return (
    <div className="w-full font-sans text-slate-800 pb-6">

      {/* ── Header ── */}

      {/* ── Stepper ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3 mb-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium mb-0.5">
            <Link to="/p2p/advances" className="hover:text-slate-700 transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Advance Payments
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-600 font-semibold">New Request</span>
          </div>
        </div>
        <button onClick={() => navigate('/p2p/advances')}
          className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-sm shrink-0">
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
      </div>
        <div className="flex items-center justify-between relative">
          <div className="absolute inset-x-10 top-4 h-px bg-slate-100" />
          <div className="absolute left-10 top-4 h-px bg-teal-500 transition-all duration-500"
            style={{ width: `calc(${((currentStep - 1) / (STEPS.length - 1)) * 100}% - 80px / ${STEPS.length})` }} />
          {STEPS.map((step) => {
            const done = currentStep > step.id, active = currentStep === step.id;
            const Icon = step.icon;
            return (
              <button key={step.id} onClick={() => { if (step.id < currentStep) { setErrors({}); setCurrentStep(step.id); } }}
                className={`relative flex flex-col items-center gap-1 z-10 ${step.id < currentStep ? 'cursor-pointer' : 'cursor-default'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all
                  ${done   ? 'bg-teal-600 border-teal-600 text-white' :
                    active  ? 'bg-white border-teal-600 text-teal-600' :
                    'bg-white border-slate-200 text-slate-400'}`}>
                  {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                </div>
                <span className={`text-[10px] font-bold whitespace-nowrap ${done || active ? 'text-teal-700' : 'text-slate-400'}`}>
                  {step.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Layout ── */}
      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0">

          {/* ════ STEP 1: SELECT PO ════ */}
          {currentStep === 1 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">Select Purchase Order</h2>
                  <p className="text-[10px] text-slate-400">Search and select the PO to raise an advance against</p>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {/* Search */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Search Purchase Order <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    {loadingPos && <Loader2 className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-teal-500 animate-spin" />}
                    <input type="text" placeholder="Type PO number, vendor name or code…"
                      value={searchPo} onChange={(e) => { setSearchPo(e.target.value); setErrors(p => ({ ...p, po: null })); }}
                      className={inp(errors.po) + ' pl-9 pr-9'} />
                  </div>
                  {errors.po && <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.po}</p>}
                </div>

                {/* Selected PO banner */}
                {selectedPo && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-teal-50 border border-teal-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                      <div>
                        <p className="font-mono font-bold text-slate-900 text-xs">{selectedPo.poNumber}</p>
                        <p className="text-[10px] text-slate-500">{selectedPo.supplierName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-bold text-teal-700 uppercase">Available</p>
                      <p className="font-mono font-bold text-teal-700 text-xs">₹{fmt(availableBalance)}</p>
                    </div>
                  </div>
                )}

                {/* PO list */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-3 py-1.5 flex items-center justify-between border-b border-slate-200">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Purchase Orders</span>
                    {!loadingPos && <span className="text-[9px] text-slate-400">{filteredPos.length} result{filteredPos.length !== 1 ? 's' : ''}</span>}
                  </div>
                  <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                    {loadingPos ? (
                      <div className="flex items-center justify-center py-8 gap-2 text-slate-500 text-xs">
                        <Loader2 className="w-4 h-4 animate-spin text-teal-600" /> Loading purchase orders…
                      </div>
                    ) : filteredPos.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 gap-1 text-slate-400">
                        <Search className="w-5 h-5 opacity-40" />
                        <p className="text-xs font-semibold text-slate-500">{searchPo ? `No results for "${searchPo}"` : 'No POs found'}</p>
                      </div>
                    ) : filteredPos.map((p) => {
                      const avail = Math.max(0, p.totalAmount - (p.advancePaid || 0));
                      const isSel = selectedPo?.poNumber === p.poNumber;
                      return (
                        <button key={p.poNumber} onClick={() => { setSelectedPo(p); setErrors(prev => ({ ...prev, po: null })); }}
                          className={`w-full px-3 py-2.5 flex items-center justify-between text-left transition-colors border-l-2
                            ${isSel ? 'bg-teal-50 border-l-teal-500' : 'hover:bg-slate-50 border-l-transparent'}`}>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-xs text-slate-900">{p.poNumber}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${p.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{p.status}</span>
                              {isSel && <span className="text-[9px] font-bold bg-teal-600 text-white px-1.5 py-0.5 rounded-full uppercase">Selected</span>}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5 truncate">{p.supplierName} · <span className="font-mono text-slate-400">{p.supplierId}</span></p>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <p className="font-mono font-bold text-xs text-slate-800">₹{fmt(avail)}</p>
                            <p className="text-[9px] text-slate-400">{p.currency}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 border-t border-slate-100 flex justify-end">
                <button onClick={goNext} disabled={!selectedPo}
                  className="h-8 px-5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
                  Continue <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ════ STEP 2: PAYMENT DETAILS ════ */}
          {currentStep === 2 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                  <IndianRupee className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">Payment Details</h2>
                  <p className="text-[10px] text-slate-400">Set the advance amount and payment information</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-lg">
                  <span className="text-[9px] font-bold text-teal-700 uppercase">PO</span>
                  <span className="font-mono font-bold text-[11px] text-slate-800">{selectedPo?.poNumber}</span>
                  <span className="text-teal-400">·</span>
                  <span className="font-mono font-bold text-[11px] text-teal-700">₹{fmt(availableBalance)}</span>
                </div>
              </div>

              <div className="p-4 space-y-4">

                {/* Amount */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Advance Amount <span className="text-rose-500">*</span></label>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-medium">Quick %:</span>
                    {[10, 20, 25, 30, 50].map(pct => (
                      <button key={pct} type="button" onClick={() => { setAmountMode('pct'); setPctValue(pct.toString()); setErrors(p => ({ ...p, amount: null })); }}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-all
                          ${amountMode === 'pct' && Number(pctValue) === pct
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-teal-400'}`}>
                        {pct}%
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                        <button type="button" onClick={() => setAmountMode('pct')}
                          className={`flex-1 py-1.5 text-[11px] font-bold transition-all flex items-center justify-center gap-1
                            ${amountMode === 'pct' ? 'bg-teal-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                          <Percent className="w-3 h-3" /> Percentage
                        </button>
                        <button type="button" onClick={() => setAmountMode('amount')}
                          className={`flex-1 py-1.5 text-[11px] font-bold transition-all flex items-center justify-center gap-1
                            ${amountMode === 'amount' ? 'bg-teal-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                          <IndianRupee className="w-3 h-3" /> Amount
                        </button>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{amountMode === 'pct' ? '%' : '₹'}</span>
                        <input type="number" min="0"
                          value={amountMode === 'amount' ? amountValue : pctValue}
                          onChange={(e) => { if (amountMode === 'amount') setAmountValue(e.target.value); else setPctValue(e.target.value); setErrors(p => ({ ...p, amount: null })); }}
                          placeholder="0.00"
                          className={inp(errors.amount) + ' pl-7 font-mono font-bold'} />
                      </div>
                      {errors.amount && <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.amount}</p>}
                    </div>

                    {/* Live calc box */}
                    <div className="bg-teal-50 rounded-lg border border-teal-200 p-3 space-y-2 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Requesting</span>
                        <span className="font-mono font-bold text-teal-700">₹{fmt(calculatedAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Of available</span>
                        <span className="font-mono font-semibold text-slate-600">{calculatedPct.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between border-t border-teal-200 pt-2">
                        <span className="text-slate-500">Remaining</span>
                        <span className={`font-mono font-bold ${remainingAfter < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>₹{fmt(remainingAfter)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-teal-100 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${calculatedAmount > availableBalance ? 'bg-rose-500' : 'bg-teal-500'}`}
                          style={{ width: `${Math.min(100, availableBalance > 0 ? (calculatedAmount / availableBalance) * 100 : 0)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Reason for Advance <span className="text-rose-500">*</span></label>
                  <textarea value={reason} onChange={(e) => { setReason(e.target.value); setErrors(p => ({ ...p, reason: null })); }}
                    rows={2} placeholder="e.g. Supplier requires 20% advance before shipment as per PO payment terms…"
                    className={inp(errors.reason) + ' resize-none'} />
                  {errors.reason && <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.reason}</p>}
                </div>

                {/* Payment mode + Bank */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Mode</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {['NEFT', 'RTGS', 'SWIFT', 'Cheque'].map(m => (
                        <button key={m} type="button" onClick={() => setPaymentMode(m)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all
                            ${paymentMode === m ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'}`}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Bank Name <span className="text-slate-400 font-normal">(optional)</span></label>
                    <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. HDFC Bank…" className={inp(false)} />
                  </div>
                </div>

                {/* GST */}
                <div className={`rounded-lg border transition-all ${withGst ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'}`}>
                  <button type="button" onClick={() => setWithGst(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Banknote className={`w-3.5 h-3.5 ${withGst ? 'text-amber-500' : 'text-slate-400'}`} />
                      <p className="text-xs font-bold text-slate-800">GST Applicable?</p>
                      <p className="text-[10px] text-slate-400">Toggle if this advance includes GST</p>
                    </div>
                    <div className={`w-9 h-4.5 rounded-full transition-all relative ${withGst ? 'bg-amber-400' : 'bg-slate-200'}`} style={{ height: '18px' }}>
                      <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all ${withGst ? 'left-[calc(100%-16px)]' : 'left-0.5'}`} />
                    </div>
                  </button>
                  {withGst && (
                    <div className="px-3 pb-3 space-y-2.5 border-t border-amber-200">
                      <div className="flex gap-4 pt-2">
                        {[{ v: 'inter', label: 'IGST (Inter-state)' }, { v: 'intra', label: 'CGST + SGST (Intra-state)' }].map(o => (
                          <label key={o.v} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer">
                            <input type="radio" name="gstType" checked={gstType === o.v} onChange={() => setGstType(o.v)} className="text-amber-500" />
                            {o.label}
                          </label>
                        ))}
                      </div>
                      <div className={`grid gap-2 ${gstType === 'intra' ? 'grid-cols-2' : 'grid-cols-1 max-w-[180px]'}`}>
                        {gstType === 'intra' ? (
                          <>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 mb-1">CGST %</label>
                              <input type="number" value={cgstPct} onChange={e => setCgstPct(e.target.value)} className={inp(false) + ' font-mono font-bold'} />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 mb-1">SGST %</label>
                              <input type="number" value={sgstPct} onChange={e => setSgstPct(e.target.value)} className={inp(false) + ' font-mono font-bold'} />
                            </div>
                          </>
                        ) : (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-1">IGST %</label>
                            <input type="number" value={igstPct} onChange={e => setIgstPct(e.target.value)} className={inp(false) + ' font-mono font-bold'} />
                          </div>
                        )}
                      </div>
                      {totalGstAmount > 0 && (
                        <div className="flex items-center justify-between text-[11px] bg-amber-100/60 rounded-lg px-3 py-1.5">
                          <span className="font-semibold text-amber-800">Total GST</span>
                          <span className="font-mono font-bold text-amber-700">+₹{fmt(totalGstAmount)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                <button onClick={goBack} className="h-8 px-3 rounded-lg border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all flex items-center gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <button onClick={goNext} className="h-8 px-5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5">
                  Continue <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ════ STEP 3: DOCUMENTS ════ */}
          {currentStep === 3 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">Supporting Documents</h2>
                  <p className="text-[10px] text-slate-400">Upload at least one document (invoice, quotation, PO copy, etc.)</p>
                </div>
                <span className="ml-auto text-[9px] font-bold bg-rose-50 text-rose-600 border border-rose-200 px-2 py-0.5 rounded-full uppercase">Required</span>
              </div>

              <div className="p-4 space-y-3">
                {errors.docs && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errors.docs}
                  </div>
                )}

                {/* Drop zone */}
                <label
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                  className={`flex flex-col items-center justify-center gap-2 py-7 rounded-xl border-2 border-dashed cursor-pointer transition-all
                    ${dragging ? 'border-teal-400 bg-teal-50' : 'border-slate-200 bg-slate-50/60 hover:border-teal-300 hover:bg-teal-50/20'}`}>
                  <input type="file" multiple onChange={(e) => addFiles(e.target.files)} className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx" />
                  <Upload className={`w-5 h-5 ${dragging ? 'text-teal-500' : 'text-slate-400'}`} />
                  <div className="text-center">
                    <p className="font-bold text-slate-700 text-xs">{dragging ? 'Drop files here' : 'Drag & drop or click to upload'}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">PDF, JPG, PNG, DOC, XLSX supported</p>
                  </div>
                </label>

                {documents.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{documents.length} File{documents.length > 1 ? 's' : ''} Attached</p>
                    {documents.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 text-xs truncate">{doc.name}</p>
                            <p className="text-[9px] text-slate-400">{doc.size}</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => setDocuments(docs => docs.filter((_, i) => i !== idx))}
                          className="w-6 h-6 rounded-md bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center shrink-0 transition-colors ml-2">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                <button onClick={goBack} className="h-8 px-3 rounded-lg border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all flex items-center gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <button onClick={goNext} className="h-8 px-5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5">
                  Review & Submit <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ════ STEP 4: REVIEW & SUBMIT ════ */}
          {currentStep === 4 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">Review & Submit</h2>
                  <p className="text-[10px] text-slate-400">Confirm all details before submitting for approval</p>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* PO + Vendor */}
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Purchase Order</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'PO Number', value: selectedPo?.poNumber,      mono: true },
                      { label: 'Vendor',    value: selectedPo?.supplierName,   mono: false },
                      { label: 'PO Value',  value: `₹${fmt(poValue)}`,         mono: true },
                      { label: 'Available', value: `₹${fmt(availableBalance)}`, mono: true, hi: true },
                    ].map(({ label, value, mono, hi }) => (
                      <div key={label} className={`rounded-lg p-2.5 border ${hi ? 'bg-teal-50 border-teal-200' : 'bg-slate-50 border-slate-200'}`}>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                        <p className={`text-xs font-bold mt-0.5 ${mono ? 'font-mono' : ''} ${hi ? 'text-teal-700' : 'text-slate-800'}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-100" />

                {/* Payment */}
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Payment</p>
                  <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 text-xs overflow-hidden">
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-slate-500">Advance Amount</span>
                      <span className="font-mono font-bold">₹{fmt(calculatedAmount)} <span className="text-slate-400">({calculatedPct.toFixed(1)}%)</span></span>
                    </div>
                    {withGst && <>
                      <div className="flex justify-between px-3 py-2 bg-amber-50/40">
                        <span className="text-slate-500">GST</span>
                        <span className="font-mono font-bold text-amber-700">+₹{fmt(totalGstAmount)}</span>
                      </div>
                      <div className="flex justify-between px-3 py-2 bg-slate-50">
                        <span className="font-bold text-slate-700">Grand Total</span>
                        <span className="font-mono font-bold text-slate-900">₹{fmt(grandTotal)}</span>
                      </div>
                    </>}
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-slate-500">Remaining Balance</span>
                      <span className={`font-mono font-bold ${remainingAfter < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>₹{fmt(remainingAfter)}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-slate-500">Payment Mode</span>
                      <span className="font-bold text-slate-800">{paymentMode}</span>
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Reason</p>
                  <p className="text-xs text-slate-700 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">{reason}</p>
                </div>

                {/* Documents */}
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Documents ({documents.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {documents.map((d, i) => (
                      <span key={i} className="flex items-center gap-1 text-[11px] bg-white border border-slate-200 px-2 py-1 rounded-md text-slate-700 font-medium">
                        <FileText className="w-3 h-3 text-teal-600" /> {d.name}
                      </span>
                    ))}
                    {documents.length === 0 && <span className="text-[11px] text-slate-400 italic">No documents attached</span>}
                  </div>
                </div>

                {/* Approval chain */}
                <div className="rounded-lg border border-teal-200 bg-teal-50/40 px-3 py-2.5">
                  <p className="text-[9px] font-bold text-teal-700 uppercase tracking-wider mb-2">
                    Approval Chain {dynamicWorkflow?.slab ? `(${dynamicWorkflow.slab})` : ''}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(dynamicWorkflow?.steps || [
                      { step: 1, title: 'Procurement Head Approval', roleName: 'Procurement Head' },
                      { step: 2, title: 'Finance Lead Approval',     roleName: 'Finance Lead' }
                    ]).map((st, i) => (
                      <React.Fragment key={st.step || i}>
                        <div className="flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-bold text-teal-700 bg-teal-100 border-teal-200">
                          <Clock className="w-3 h-3 text-teal-600" /> {st.roleName || st.title}
                        </div>
                        <ChevronRight className="w-3 h-3 text-slate-400" />
                      </React.Fragment>
                    ))}
                    <div className="flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-bold text-emerald-700 bg-emerald-50 border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" /> Payment Released
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                <button onClick={goBack} className="h-8 px-3 rounded-lg border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all flex items-center gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <button disabled={saving} onClick={handleSubmit}
                  className="h-9 px-6 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs shadow-md shadow-teal-200/60 transition-all disabled:opacity-50 flex items-center gap-2">
                  {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting…</> : <><Send className="w-3.5 h-3.5" /> Submit for Approval</>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <Sidebar />
      </div>
    </div>
  );
}
