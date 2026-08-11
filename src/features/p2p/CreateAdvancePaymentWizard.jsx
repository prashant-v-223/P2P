import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import FileUploadZone from '../../components/shared/FileUploadZone';
import { SearchableSelect } from '../../components/ui/searchable-select';
import {
  Search, Check, Upload, X, FileText, Loader2, AlertCircle,
  ChevronRight, Building2, IndianRupee, Percent, ArrowLeft, Send,
  ShieldCheck, Banknote, TrendingUp, Info, CheckCircle2, Clock,
  Receipt, ChevronDown, Home, Package, CreditCard, Truck, Briefcase,
  User, LogOut, Settings, Bell, Menu
} from 'lucide-react';

const fmt = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STEPS = [
  { id: 1, label: 'Select PO', icon: Building2 },
  { id: 2, label: 'Payment Details', icon: IndianRupee },
  { id: 3, label: 'Documents', icon: FileText },
  { id: 4, label: 'Review & Submit', icon: ShieldCheck },
];

export default function CreateAdvancePaymentWizard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useSelector((s) => s.auth);

  const [currentStep, setCurrentStep] = useState(1);
  const [livePos, setLivePos] = useState([]);
  const [searchPo, setSearchPo] = useState('');
  const [loadingPos, setLoadingPos] = useState(false);
  const [selectedPo, setSelectedPo] = useState(null);
  const [amountMode, setAmountMode] = useState('pct');
  const [amountValue, setAmountValue] = useState('');
  const [pctValue, setPctValue] = useState('');
  const [reason, setReason] = useState('');
  const [paymentMode, setPaymentMode] = useState('NEFT');
  const [bankName, setBankName] = useState('');
  const [withGst, setWithGst] = useState(false);
  const [gstType, setGstType] = useState('inter');
  const [cgstPct, setCgstPct] = useState('');
  const [sgstPct, setSgstPct] = useState('');
  const [igstPct, setIgstPct] = useState('');
  const [documents, setDocuments] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [dynamicWorkflow, setDynamicWorkflow] = useState(null);

  // Normalize raw PO API response into the shape used by the wizard
  const normalizePos = (data = []) => data.map(p => ({
    poNumber: p.sapPoNumber || p.poNumber,
    supplierName: p.supplierName || 'Vendor',
    supplierId: p.supplierId || '',
    totalAmount: p.totalAmount || 0,
    advancePaid: p.advancePaid || 0,
    advanceCommitted: p.advanceCommitted || 0,
    remainingAdvanceAmount: Number(p.remainingAdvanceAmount ?? p.totalAmount) || 0,
    currency: p.currency || 'INR',
    status: p.status || 'open',
  })).filter((p) => !['closed', 'cancelled', 'canceled', 'blocked'].includes(String(p.status).toLowerCase()));

  const searchRequestId = useRef(0);

  const fetchPos = useMemo(() => async (query = '') => {
    const requestId = ++searchRequestId.current;
    setLoadingPos(true);
    try {
      const params = new URLSearchParams({ size: '100' });
      if (String(query).trim()) params.set('q', String(query).trim());
      const res = await apiFetch(`/api/p2p/purchase-orders?${params.toString()}`);
      const json = await res.json();
      // Ignore stale responses from earlier keystrokes
      if (requestId !== searchRequestId.current) return;
      const normalized = normalizePos(json.data || []);
      setLivePos(normalized);
      // Clear the selected PO if it no longer appears in the search results
      setSelectedPo(prev => {
        if (prev && !normalized.some(p => p.poNumber === prev.poNumber)) return null;
        return prev;
      });
    } catch (e) {
      if (requestId !== searchRequestId.current) return;
      console.error('Error fetching purchase orders:', e);
      setLivePos([]);
    } finally {
      if (requestId === searchRequestId.current) setLoadingPos(false);
    }
  }, []);

  // Load initial open POs on mount
  useEffect(() => {
    fetchPos('');
  }, [fetchPos]);

  // Debounced server-side search as the user types in the search box
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPos(searchPo);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchPo, fetchPos]);

  const filteredPos = useMemo(() => {
    if (!searchPo.trim()) return livePos.slice(0, 8);
    return livePos;
  }, [searchPo, livePos]);

  const poValue = selectedPo?.totalAmount || 0;
  const advancePaid = selectedPo?.advancePaid || 0;
  const availableBalance = selectedPo ? Number(selectedPo.remainingAdvanceAmount) : 0;

  const calculatedAmount = useMemo(() => {
    if (!selectedPo) return 0;
    return amountMode === 'pct' ? availableBalance * (Number(pctValue) / 100) : Number(amountValue) || 0;
  }, [selectedPo, amountMode, pctValue, amountValue, availableBalance]);

  const calculatedPct = useMemo(() => {
    if (!selectedPo || availableBalance === 0) return 0;
    return amountMode === 'pct' ? Number(pctValue) || 0 : (calculatedAmount / availableBalance) * 100;
  }, [selectedPo, availableBalance, amountMode, pctValue, calculatedAmount]);

  const remainingAfter = availableBalance - calculatedAmount;
  const cgstAmount = withGst && gstType === 'intra' ? calculatedAmount * (Number(cgstPct) / 100) : 0;
  const sgstAmount = withGst && gstType === 'intra' ? calculatedAmount * (Number(sgstPct) / 100) : 0;
  const igstAmount = withGst && gstType === 'inter' ? calculatedAmount * (Number(igstPct) / 100) : 0;
  const totalGstAmount = cgstAmount + sgstAmount + igstAmount;
  const grandTotal = calculatedAmount + totalGstAmount;

  useEffect(() => {
    const amt = grandTotal || calculatedAmount || 0;
    let active = true;
    apiFetch(`/api/p2p/workflows/preview?module=Advance Payment&amount=${amt}`)
      .then(res => res.json())
      .then(data => {
        if (active) {
          if (data.success && data.workflow) {
            setDynamicWorkflow(data.workflow);
          } else {
            // Silently fail - workflow preview is optional
            console.log('[Workflow Preview] Not available:', data.error || 'No workflow data');
          }
        }
      })
      .catch((err) => {
        // Silently handle errors - workflow preview is not critical
        console.log('[Workflow Preview] Failed to fetch:', err.message);
      });
    return () => { active = false; };
  }, [grandTotal, calculatedAmount]);

  const validate = (step) => {
    const e = {};
    if (step === 1 && !selectedPo) e.po = 'Please select a Purchase Order.';
    if (step === 2 && calculatedAmount <= 0) e.amount = 'Amount must be greater than ₹0.';
    if (step === 2 && calculatedAmount > availableBalance) e.amount = `Exceeds available balance ₹${fmt(availableBalance)}.`;
    if (step === 2 && (!reason.trim() || reason.trim().length < 10)) e.reason = 'Please enter a reason (min 10 chars).';
    if (step === 3 && documents.length === 0) e.docs = 'At least one supporting document is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goNext = () => { if (validate(currentStep)) setCurrentStep(s => Math.min(s + 1, 4)); };
  const goBack = () => { setErrors({}); setCurrentStep(s => Math.max(s - 1, 1)); };

  const handleFilesSelected = (newFiles) => {
    setDocuments(prev => [...prev, ...newFiles]);
    setErrors(p => ({ ...p, docs: null }));
  };

  const handleFileRemove = (index) => {
    setDocuments(docs => docs.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!validate(2)) { setCurrentStep(2); return; }
    if (!validate(3)) { setCurrentStep(3); return; }

    setSaving(true);
    try {
      const res = await apiFetch('/api/p2p/advances/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poNumber: selectedPo.poNumber, vendorName: selectedPo.supplierName,
          vendorCode: selectedPo.supplierId, amount: calculatedAmount, percentageOfPo: calculatedPct,
          currency: selectedPo.currency,
          cgst: cgstAmount, sgst: sgstAmount, igst: igstAmount, totalGst: totalGstAmount,
          grandTotal, paymentMode, bankName, remarks: reason,
          requestedBy: user?.name || user?.email || 'Finance Team'
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast({ type: 'error', title: 'Submission failed', description: data.error || 'Server error.' });
        return;
      }

      const advanceId = data.data?.advanceId;
      if (!advanceId) {
        showToast({ type: 'error', title: 'Submission failed', description: 'Advance payment created but ID missing.' });
        return;
      }

      if (documents.length > 0) {
        const formData = new FormData();
        documents.forEach(doc => {
          formData.append('files', doc.file);
        });
        formData.append('documentType', 'advance_request');
        formData.append('documentableType', 'AdvancePayment');
        formData.append('documentableId', advanceId);

        try {
          const docRes = await apiFetch('/api/documents/upload-multiple', {
            method: 'POST',
            body: formData
          });
          const docJson = await docRes.json();
          if (!docRes.ok) {
            console.error('Document upload failed:', docJson.error);
            showToast({
              type: 'warning',
              title: 'Advance Payment Submitted',
              description: `${advanceId} created but documents failed to upload. You can add them later.`,
              duration: 5000
            });
          } else {
            showToast({
              type: 'success',
              title: 'Advance Payment Submitted',
              description: `${advanceId} with ${docJson.data?.uploaded?.length || documents.length} document(s) sent for approval.`
            });
          }
        } catch (docError) {
          console.error('Document upload error:', docError);
          showToast({
            type: 'warning',
            title: 'Advance Payment Submitted',
            description: `${advanceId} created but documents failed to upload. You can add them later.`,
            duration: 5000
          });
        }
      } else {
        showToast({
          type: 'success',
          title: 'Advance Payment Submitted',
          description: `${advanceId} sent for Procurement Head approval.`
        });
      }

      navigate('/p2p/advances');
    } catch (e) {
      showToast({ type: 'error', title: 'Network error', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const inp = (err) => `w-full px-4 py-2.5 text-sm border rounded-xl outline-none transition-all font-normal ${err
    ? 'border-rose-300 bg-rose-50/40 focus:ring-2 focus:ring-rose-200 focus:border-rose-400'
    : 'border-slate-200 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-100 hover:border-slate-300'
    }`;

  const Sidebar = () => (
    <aside className="hidden lg:flex flex-col gap-3.5 w-[320px] xl:w-[360px] shrink-0 sticky top-4">
      {/* Summary Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-teal-50/50 to-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#0d7676]" />
            <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">Payment Summary</span>
          </div>
          {selectedPo && (
            <span className="text-[10px] font-extrabold bg-teal-100 text-[#0d7676] px-2 py-0.5 rounded-full font-mono">
              {selectedPo.currency || 'INR'}
            </span>
          )}
        </div>
        <div className="p-4 space-y-3">
          {selectedPo ? (
            <>
              <div className="space-y-0.5 pb-1 border-b border-slate-100">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Target PO & Vendor</p>
                <p className="font-mono font-extrabold text-slate-900 text-sm flex items-center justify-between">
                  <span>{selectedPo.poNumber}</span>
                  <span className="text-xs text-sky-600 font-bold font-sans">Open</span>
                </p>
                <p className="text-xs text-slate-600 font-semibold truncate">{selectedPo.supplierName}</p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                  <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">PO Total</p>
                  <p className="font-mono font-extrabold text-slate-800 text-sm mt-0.5">₹{fmt(poValue)}</p>
                </div>
                <div className="bg-teal-50/70 rounded-xl p-2.5 border border-teal-200">
                  <p className="text-[10px] text-[#0d7676] font-extrabold uppercase tracking-wider">Available</p>
                  <p className="font-mono font-extrabold text-[#0d7676] text-sm mt-0.5">₹{fmt(availableBalance)}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="py-5 text-center text-slate-400">
              <Building2 className="w-7 h-7 mx-auto mb-1.5 opacity-30 text-teal-600" />
              <p className="text-xs font-semibold text-slate-500">No Purchase Order selected</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Select a PO in Step 1 to calculate advance</p>
            </div>
          )}

          {calculatedAmount > 0 && (
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600 font-medium">Advance Amount</span>
                <span className="font-mono font-extrabold text-teal-700">₹{fmt(calculatedAmount)}</span>
              </div>
              {totalGstAmount > 0 && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-medium">GST Breakdown</span>
                  <span className="font-mono font-extrabold text-amber-600">+₹{fmt(totalGstAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center bg-[#0d7676]/10 px-3 py-2 rounded-xl border border-teal-200">
                <span className="text-xs font-extrabold text-[#0d7676]">Grand Total</span>
                <span className="font-mono font-extrabold text-[#0d7676] text-sm">₹{fmt(grandTotal)}</span>
              </div>
              <div className="flex justify-between items-center text-xs pt-0.5">
                <span className="text-slate-500 font-medium">Remaining Balance</span>
                <span className={`font-mono font-extrabold ${remainingAfter < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  ₹{fmt(remainingAfter)}
                </span>
              </div>
            </div>
          )}

          {documents.length > 0 && (
            <div className="border-t border-slate-100 pt-2.5">
              <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                <FileText className="w-3.5 h-3.5 text-[#0d7676]" />
                <span>{documents.length} document{documents.length > 1 ? 's' : ''} attached</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Approval Flow Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#0d7676]" />
            <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">Approval Workflow</span>
          </div>
          {dynamicWorkflow?.slab && (
            <span className="text-[10px] font-extrabold text-[#0d7676] bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
              {dynamicWorkflow.slab}
            </span>
          )}
        </div>
        <div className="p-3.5 space-y-2">
          {(dynamicWorkflow?.steps || [
            { step: 1, title: 'Purchase Manager Review', roleName: 'Purchase Manager' },
            { step: 2, title: 'Purchase Head Approval', roleName: 'Purchase Head' },
            { step: 3, title: 'CFO Approval', roleName: 'CFO' }
          ]).map((st, i) => (
            <div key={st.step || i} className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-teal-50 text-[#0d7676] text-[10px] font-extrabold flex items-center justify-center shrink-0 border border-teal-200">
                {st.step || i + 1}
              </div>
              <span className="text-xs font-semibold text-slate-700">
                {st.roleName || st.title}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2.5 pt-2 border-t border-slate-100">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-xs font-bold text-emerald-700">Payment Dispatched</span>
          </div>
        </div>
      </div>

      {/* Info Notice Card */}
      <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 flex gap-2.5">
        <Info className="w-4 h-4 shrink-0 text-sky-600 mt-0.5" />
        <p className="text-[11px] text-sky-800 leading-snug font-semibold">
          Advance payment is capped at the PO value. Submissions trigger automated hierarchy approval routing.
        </p>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-slate-50/90 font-sans text-slate-800 pb-8 text-left">
      {/* ── Main Container Optimized for Laptop Use ── */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4">

        {/* Top Action Bar */}
        <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
            <Link to="/p2p/advances" className="hover:text-[#0d7676] transition-colors flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Advance Payments
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-slate-900 font-extrabold">New Advance Payment Request</span>
          </div>

          <button
            onClick={() => navigate('/p2p/advances')}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs transition-colors flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        </div>

        {/* Compact Stepper */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs px-6 py-3.5 mb-4">
          <div className="flex items-center justify-between relative">
            <div className="absolute inset-x-12 top-4 h-0.5 bg-slate-100" />
            <div
              className="absolute left-12 top-4 h-0.5 bg-[#0d7676] transition-all duration-500"
              style={{ width: `calc(${((currentStep - 1) / (STEPS.length - 1)) * 100}% - 90px / ${STEPS.length})` }}
            />
            {STEPS.map((step) => {
              const done = currentStep > step.id;
              const active = currentStep === step.id;
              const Icon = step.icon;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => { if (step.id < currentStep) { setErrors({}); setCurrentStep(step.id); } }}
                  className={`relative flex flex-col items-center gap-1 z-10 ${step.id < currentStep ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all text-xs font-bold
                    ${done ? 'bg-[#0d7676] border-[#0d7676] text-white shadow-2xs' :
                      active ? 'bg-white border-[#0d7676] text-[#0d7676] shadow-2xs' :
                        'bg-white border-slate-200 text-slate-400'}
                  `}>
                    {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <span className={`text-[11px] font-extrabold whitespace-nowrap ${done || active ? 'text-[#0d7676]' : 'text-slate-400'}`}>
                    {step.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Layout: Steps + Sidebar */}
        <div className="flex gap-4 items-start">
          <div className="flex-1 min-w-0">

            {/* ════ STEP 1: SELECT PO ════ */}
            {currentStep === 1 && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/50 to-white flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">Select Purchase Order</h2>
                    <p className="text-sm text-slate-400">Search and select the PO to raise an advance against</p>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {/* Search */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                      Search Purchase Order <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      {loadingPos && <Loader2 className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-teal-500 animate-spin" />}
                      <input
                        type="text"
                        placeholder="Type PO number, vendor name or code…"
                        value={searchPo}
                        onChange={(e) => { setSearchPo(e.target.value); setErrors(p => ({ ...p, po: null })); }}
                        className={inp(errors.po) + ' pl-10 pr-10'}
                      />
                    </div>
                    {errors.po && (
                      <p className="text-sm font-semibold text-rose-600 mt-1.5 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4" /> {errors.po}
                      </p>
                    )}
                  </div>

                  {/* Selected PO banner */}
                  {selectedPo && (
                    <div className="flex items-center justify-between p-4 rounded-xl bg-teal-50/80 border-2 border-teal-200">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
                        <div>
                          <p className="font-mono font-bold text-slate-900 text-sm">{selectedPo.poNumber}</p>
                          <p className="text-sm text-slate-600">{selectedPo.supplierName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">Available</p>
                        <p className="font-mono font-bold text-teal-700 text-base">₹{fmt(availableBalance)}</p>
                      </div>
                    </div>
                  )}

                  {/* PO list */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50/70 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Purchase Orders</span>
                      {!loadingPos && <span className="text-xs text-slate-400">{filteredPos.length} result{filteredPos.length !== 1 ? 's' : ''}</span>}
                    </div>
                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                      {loadingPos ? (
                        <div className="flex items-center justify-center py-10 gap-3 text-slate-500 text-sm">
                          <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                          Loading purchase orders…
                        </div>
                      ) : filteredPos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
                          <Search className="w-6 h-6 opacity-40" />
                          <p className="text-sm font-semibold text-slate-500">
                            {searchPo ? `No results for "${searchPo}"` : 'No POs found'}
                          </p>
                        </div>
                      ) : (
                        filteredPos.map((p) => {
                          const avail = Math.max(0, p.totalAmount - (p.advancePaid || 0));
                          const isSel = selectedPo?.poNumber === p.poNumber;
                          return (
                            <button
                              key={p.poNumber}
                              onClick={() => { setSelectedPo(p); setErrors(prev => ({ ...prev, po: null })); }}
                              className={`w-full px-4 py-3.5 flex items-center justify-between text-left transition-all border-l-4 ${isSel
                                ? 'bg-teal-50/60 border-l-teal-500'
                                : 'hover:bg-slate-50/80 border-l-transparent'
                                }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-sm text-slate-900">{p.poNumber}</span>
                                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${p.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                    {p.status}
                                  </span>
                                  {isSel && (
                                    <span className="text-[10px] font-bold bg-teal-600 text-white px-2.5 py-0.5 rounded-full uppercase">
                                      Selected
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-slate-500 mt-0.5 truncate">
                                  {p.supplierName} · <span className="font-mono text-slate-400">{p.supplierId}</span>
                                </p>
                              </div>
                              <div className="text-right shrink-0 ml-4">
                                <p className="font-mono font-bold text-sm text-slate-800">₹{fmt(avail)}</p>
                                <p className="text-[10px] text-slate-400">{p.currency}</p>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/30 flex justify-end">
                  <button
                    onClick={goNext}
                    disabled={!selectedPo}
                    className="h-10 px-6 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-sm shadow-teal-200/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    Continue <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ════ STEP 2: PAYMENT DETAILS ════ */}
            {currentStep === 2 && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-6 py-2 border-b border-slate-100 bg-gradient-to-r from-slate-50/50 to-white flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                    <IndianRupee className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">Payment Details</h2>
                    <p className="text-sm text-slate-400">Set the advance amount and payment information</p>
                  </div>
                  <div className="ml-auto flex items-center gap-2 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-xl">
                    <span className="text-[10px] font-bold text-teal-700 uppercase">PO</span>
                    <span className="font-mono font-bold text-sm text-slate-800">{selectedPo?.poNumber}</span>
                    <span className="text-teal-300">·</span>
                    <span className="font-mono font-bold text-sm text-teal-700">₹{fmt(availableBalance)}</span>
                  </div>
                </div>

                <div className="p-6 space-y-5">

                  {/* Amount */}
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wider block">
                      Advance Amount <span className="text-rose-500">*</span>
                    </label>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-slate-400 font-medium">Quick %:</span>
                      {[10, 20, 25, 30, 50].map(pct => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => { setAmountMode('pct'); setPctValue(pct.toString()); setErrors(p => ({ ...p, amount: null })); }}
                          className={`px-3.5 py-1.5 rounded-xl text-sm font-bold border-2 transition-all ${amountMode === 'pct' && Number(pctValue) === pct
                            ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-teal-400 hover:shadow-sm'
                            }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>

                    <div className="grid lg:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <div className="flex rounded-xl border-2 border-slate-200 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setAmountMode('pct')}
                            className={`flex-1 py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-2 ${amountMode === 'pct' ? 'bg-teal-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                              }`}
                          >
                            <Percent className="w-4 h-4" /> Percentage
                          </button>
                          <button
                            type="button"
                            onClick={() => setAmountMode('amount')}
                            className={`flex-1 py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-2 ${amountMode === 'amount' ? 'bg-teal-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                              }`}
                          >
                            <IndianRupee className="w-4 h-4" /> Amount
                          </button>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-slate-400">
                            {amountMode === 'pct' ? '%' : '₹'}
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={amountMode === 'amount' ? amountValue : pctValue}
                            onChange={(e) => {
                              if (amountMode === 'amount') setAmountValue(e.target.value);
                              else setPctValue(e.target.value);
                              setErrors(p => ({ ...p, amount: null }));
                            }}
                            placeholder="0.00"
                            className={inp(errors.amount) + ' pl-10 font-mono font-bold text-base py-3'}
                          />
                        </div>
                        {errors.amount && (
                          <p className="text-sm text-rose-600 font-semibold flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4" /> {errors.amount}
                          </p>
                        )}

                        {/* Reason */}
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1.5">
                            Reason for Advance <span className="text-rose-500">*</span>
                          </label>
                          <textarea
                            value={reason}
                            onChange={(e) => { setReason(e.target.value); setErrors(p => ({ ...p, reason: null })); }}
                            rows={1}
                            placeholder="e.g. Supplier requires 20% advance before shipment as per PO payment terms…"
                            className={inp(errors.reason) + ' resize-none'}
                          />
                          <div className="flex items-center justify-between mt-1.5">
                            {errors.reason ? (
                              <p className="text-sm text-rose-600 font-semibold flex items-center gap-1.5">
                                <AlertCircle className="w-4 h-4" /> {errors.reason}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Live calc box */}
                      <div className="bg-gradient-to-br from-teal-50/80 to-emerald-50/80 rounded-xl border-2 border-teal-200 p-5 space-y-3 shadow-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-slate-600">Requesting</span>
                          <span className="font-mono font-bold text-teal-700 text-lg">₹{fmt(calculatedAmount)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-slate-600">Of available</span>
                          <span className="font-mono font-bold text-slate-700 text-base">{calculatedPct.toFixed(1)}%</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-teal-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${calculatedAmount > availableBalance ? 'bg-rose-500' : 'bg-teal-500'}`}
                            style={{ width: `${Math.min(100, availableBalance > 0 ? (calculatedAmount / availableBalance) * 100 : 0)}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center border-t-2 border-teal-200 pt-3">
                          <span className="text-sm font-semibold text-slate-600">Remaining</span>
                          <span className={`font-mono font-bold text-base ${remainingAfter < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                            ₹{fmt(remainingAfter)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>


                  {/* Payment mode + Bank */}
                  <div className="grid lg:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Payment Mode</label>
                      <SearchableSelect
                        options={[
                          { label: 'NEFT', value: 'NEFT' },
                          { label: 'RTGS', value: 'RTGS' },
                          { label: 'SWIFT', value: 'SWIFT' },
                          { label: 'Cheque', value: 'Cheque' },
                          { label: 'Cash', value: 'Cash' },
                          { label: 'Bank Transfer', value: 'Bank Transfer' }
                        ]}
                        value={paymentMode}
                        onChange={(val) => setPaymentMode(val)}
                        size="md"
                        searchable={false}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">
                        Bank Name <span className="text-slate-400 font-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="e.g. HDFC Bank…"
                        className={inp(false) + ' py-2.5'}
                      />
                    </div>
                  </div>

                  {/* GST */}
                  <div className={`rounded-xl border-2 transition-all ${withGst ? 'border-amber-300 bg-gradient-to-br from-amber-50/80 to-orange-50/80' : 'border-slate-200 bg-white'
                    }`}>
                    <button
                      type="button"
                      onClick={() => setWithGst(v => !v)}
                      className="w-full flex items-center justify-between px-5 py-3.5"
                    >
                      <div className="flex items-center gap-3">
                        <Banknote className={`w-5 h-5 ${withGst ? 'text-amber-500' : 'text-slate-400'}`} />
                        <div className="text-left">
                          <p className="text-sm font-bold text-slate-800">GST Applicable?</p>
                          <p className="text-xs text-slate-500 mt-0.5">Toggle if this advance includes GST</p>
                        </div>
                      </div>
                      <div className={`w-12 h-7 rounded-full transition-all relative ${withGst ? 'bg-amber-500' : 'bg-slate-300'
                        }`}>
                        <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all ${withGst ? 'left-[calc(100%-24px)]' : 'left-1'
                          }`} />
                      </div>
                    </button>
                    {withGst && (
                      <div className="px-5 pb-5 space-y-3.5 border-t-2 border-amber-200">
                        <div className="flex gap-5 pt-3.5">
                          {[
                            { v: 'inter', label: 'IGST (Inter-state)' },
                            { v: 'intra', label: 'CGST + SGST (Intra-state)' }
                          ].map(o => (
                            <label key={o.v} className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                              <input
                                type="radio"
                                name="gstType"
                                checked={gstType === o.v}
                                onChange={() => setGstType(o.v)}
                                className="w-4 h-4 text-amber-500"
                              />
                              {o.label}
                            </label>
                          ))}
                        </div>
                        <div className={`grid gap-3 ${gstType === 'intra' ? 'grid-cols-2' : 'grid-cols-1 max-w-[240px]'}`}>
                          {gstType === 'intra' ? (
                            <>
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">CGST %</label>
                                <input
                                  type="number"
                                  value={cgstPct}
                                  onChange={e => setCgstPct(e.target.value)}
                                  placeholder="9.00"
                                  className={inp(false) + ' font-mono font-bold py-2.5'}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">SGST %</label>
                                <input
                                  type="number"
                                  value={sgstPct}
                                  onChange={e => setSgstPct(e.target.value)}
                                  placeholder="9.00"
                                  className={inp(false) + ' font-mono font-bold py-2.5'}
                                />
                              </div>
                            </>
                          ) : (
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1.5">IGST %</label>
                              <input
                                type="number"
                                value={igstPct}
                                onChange={e => setIgstPct(e.target.value)}
                                placeholder="18.00"
                                className={inp(false) + ' font-mono font-bold py-2.5'}
                              />
                            </div>
                          )}
                        </div>
                        {totalGstAmount > 0 && (
                          <div className="flex items-center justify-between text-sm bg-amber-100 rounded-xl px-4 py-2.5 border-2 border-amber-200">
                            <span className="font-bold text-amber-900">Total GST</span>
                            <span className="font-mono font-bold text-amber-700 text-base">+₹{fmt(totalGstAmount)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
                  <button
                    onClick={goBack}
                    className="h-10 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    onClick={goNext}
                    className="h-10 px-6 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-sm shadow-teal-200/50 transition-all flex items-center gap-2"
                  >
                    Continue <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ════ STEP 3: DOCUMENTS ════ */}
            {currentStep === 3 && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/50 to-white flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">Supporting Documents</h2>
                    <p className="text-sm text-slate-400">Upload at least one document (invoice, quotation, PO copy, etc.)</p>
                  </div>
                  <span className="ml-auto text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 px-3 py-1 rounded-full uppercase">
                    Required
                  </span>
                </div>

                <div className="p-6 space-y-4">
                  {errors.docs && (
                    <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold">
                      <AlertCircle className="w-4 h-4 shrink-0" /> {errors.docs}
                    </div>
                  )}

                  <FileUploadZone
                    multiple={true}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx,.xls,.csv,.zip"
                    maxSize={25}
                    onFilesSelected={handleFilesSelected}
                    selectedFiles={documents}
                    onFileRemove={handleFileRemove}
                  />
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
                  <button
                    onClick={goBack}
                    className="h-10 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    onClick={goNext}
                    className="h-10 px-6 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-sm shadow-teal-200/50 transition-all flex items-center gap-2"
                  >
                    Review & Submit <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ════ STEP 4: REVIEW & SUBMIT ════ */}
            {currentStep === 4 && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/50 to-white flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">Review & Submit</h2>
                    <p className="text-sm text-slate-400">Confirm all details before submitting for approval</p>
                  </div>
                </div>

                <div className="p-6 space-y-2">
                  {/* PO + Vendor */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Purchase Order</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'PO Number', value: selectedPo?.poNumber, mono: true },
                        { label: 'Vendor', value: selectedPo?.supplierName, mono: false },
                        { label: 'PO Value', value: `₹${fmt(poValue)}`, mono: true },
                        { label: 'Available', value: `₹${fmt(availableBalance)}`, mono: true, hi: true },
                      ].map(({ label, value, mono, hi }) => (
                        <div key={label} className={`rounded-xl p-2 border ${hi ? 'bg-teal-50/80 border-teal-200' : 'bg-slate-50/80 border-slate-200'
                          }`}>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                          <p className={`text-sm font-bold mt-0.5 ${mono ? 'font-mono' : ''} ${hi ? 'text-teal-700' : 'text-slate-800'
                            }`}>
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-100" />

                  {/* Payment */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Payment</p>
                    <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 text-sm overflow-hidden">
                      <div className="flex justify-between px-4 py-3">
                        <span className="text-slate-600 font-medium">Advance Amount</span>
                        <span className="font-mono font-bold">₹{fmt(calculatedAmount)} <span className="text-slate-400 font-normal">({calculatedPct.toFixed(1)}%)</span></span>
                      </div>
                      {withGst && (
                        <>
                          <div className="flex justify-between px-4 py-3 bg-amber-50/60">
                            <span className="text-slate-600 font-medium">GST</span>
                            <span className="font-mono font-bold text-amber-700">+₹{fmt(totalGstAmount)}</span>
                          </div>
                          <div className="flex justify-between px-4 py-3 bg-slate-50">
                            <span className="font-bold text-slate-700">Grand Total</span>
                            <span className="font-mono font-bold text-slate-900">₹{fmt(grandTotal)}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between px-4 py-3">
                        <span className="text-slate-600 font-medium">Remaining Balance</span>
                        <span className={`font-mono font-bold ${remainingAfter < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          ₹{fmt(remainingAfter)}
                        </span>
                      </div>
                      <div className="flex justify-between px-4 py-3">
                        <span className="text-slate-600 font-medium">Payment Mode</span>
                        <span className="font-bold text-slate-800">{paymentMode}</span>
                      </div>
                    </div>
                  </div>

                  {/* Reason */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Reason</p>
                    <p className="text-sm text-slate-700 bg-slate-50/80 rounded-xl px-4 py-3 border border-slate-200">
                      {reason}
                    </p>
                  </div>

                  {/* Documents */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Documents ({documents.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {documents.map((d, i) => (
                        <span key={i} className="flex items-center gap-1.5 text-sm bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-slate-700 font-medium">
                          <FileText className="w-4 h-4 text-teal-500" /> {d.name}
                        </span>
                      ))}
                      {documents.length === 0 && (
                        <span className="text-sm text-slate-400 italic">No documents attached</span>
                      )}
                    </div>
                  </div>

                  {/* Approval chain */}
                  <div className="rounded-xl border border-teal-200 bg-teal-50/50 px-4 py-3.5">
                    <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wider mb-2.5">
                      Approval Chain {dynamicWorkflow?.slab ? `(${dynamicWorkflow.slab})` : ''}
                    </p>
                    <div className="flex items-center gap-1 flex-wrap">
                      {(dynamicWorkflow?.steps || [
                        { step: 1, title: 'Purchase Manager Review', roleName: 'Purchase Manager' },
                        { step: 2, title: 'Purchase Head Approval', roleName: 'Purchase Head' },
                        { step: 3, title: 'CFO Approval', roleName: 'CFO' }
                      ]).map((st, i) => (
                        <React.Fragment key={st.step || i}>
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold text-teal-700 bg-teal-100 border-teal-200">
                            <Clock className="w-4 h-4 text-teal-600" /> {st.roleName || st.title}
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </React.Fragment>
                      ))}
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold text-emerald-700 bg-emerald-50 border-emerald-200">
                        <CheckCircle2 className="w-4 h-4" /> Payment Released
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
                  <button
                    onClick={goBack}
                    className="h-10 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    disabled={saving}
                    onClick={handleSubmit}
                    className="h-11 px-7 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm shadow-md shadow-teal-200/60 transition-all disabled:opacity-50 flex items-center gap-2.5"
                  >
                    {saving ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                    ) : (
                      <><Send className="w-4 h-4" /> Submit for Approval</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <Sidebar />
        </div>
      </div>
    </div>
  );
}