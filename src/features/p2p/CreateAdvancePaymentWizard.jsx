import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import FileUploadZone from '../../components/shared/FileUploadZone';
import { SearchableSelect } from '../../components/ui/searchable-select';
import {
  Search, Check, Upload, X, FileText, Loader2, AlertCircle,
  ChevronRight, Building2, IndianRupee, Percent, ArrowLeft, Send,
  ShieldCheck, Banknote, TrendingUp, Info, CheckCircle2, Clock,
  Receipt, DollarSign, Globe
} from 'lucide-react';

const fmt = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getCurrencySymbol = (curr) => {
  const code = String(curr || '').trim().toUpperCase();
  switch (code) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'JPY': return '¥';
    case 'AED': return 'AED ';
    default: return '₹';
  }
};

const formatRoleName = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
};

const STEPS = [
  { id: 1, label: 'Select PO', icon: Building2 },
  { id: 2, label: 'Payment Details', icon: IndianRupee },
  { id: 3, label: 'Documents', icon: FileText },
  { id: 4, label: 'Review & Submit', icon: ShieldCheck },
];

export default function CreateAdvancePaymentWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlPoId = useMemo(() => {
    return (searchParams.get('poId') || searchParams.get('poNumber') || searchParams.get('po') || '').trim();
  }, [searchParams]);

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
  const [advanceAdjust, setAdvanceAdjust] = useState('');
  const [withGst, setWithGst] = useState(false);
  const [gstType, setGstType] = useState('inter');
  const [cgstPct, setCgstPct] = useState('');
  const [sgstPct, setSgstPct] = useState('');
  const [igstPct, setIgstPct] = useState('');
  const [documents, setDocuments] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [dynamicWorkflow, setDynamicWorkflow] = useState(null);

  // Multi-currency & FX Rate state
  const [fxRates, setFxRates] = useState({ USD: 83.5, EUR: 90.0, GBP: 105.0, INR: 1 });
  const [customFxRate, setCustomFxRate] = useState('');

  useEffect(() => {
    apiFetch('/api/exchange-rates')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.rates) {
          const rateMap = {};
          data.rates.forEach(r => { rateMap[r.currency] = Number(r.rate) || 1; });
          setFxRates(prev => ({ ...prev, ...rateMap }));
        }
      })
      .catch(() => {});
  }, []);

  const poCurrency = selectedPo?.currency || 'INR';
  const currSymbol = getCurrencySymbol(poCurrency);

  const activeFxRate = useMemo(() => {
    if (customFxRate && Number(customFxRate) > 0) return Number(customFxRate);
    return fxRates[poCurrency] || (poCurrency === 'USD' ? 83.5 : poCurrency === 'EUR' ? 90.0 : 1);
  }, [customFxRate, fxRates, poCurrency]);

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
      if (requestId !== searchRequestId.current) return;
      const normalized = normalizePos(json.data || []);
      setLivePos(normalized);
      setSelectedPo(prev => {
        if (urlPoId) {
          const match = normalized.find(p => String(p.poNumber).toLowerCase() === urlPoId.toLowerCase());
          if (match) return match;
        }
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
  }, [urlPoId]);

  useEffect(() => {
    if (urlPoId) {
      fetchPos(urlPoId);
    } else {
      fetchPos('');
    }
  }, [fetchPos, urlPoId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPos(searchPo);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchPo, fetchPos]);

  const poOptions = useMemo(() => {
    return (livePos || []).map(p => {
      const avail = Math.max(0, Number(p.remainingAdvanceAmount) || 0);
      const sym = getCurrencySymbol(p.currency);
      return {
        value: p.poNumber,
        label: `${p.poNumber} — ${p.supplierName} (${sym}${fmt(avail)} available)`
      };
    });
  }, [livePos]);

  const filteredPos = useMemo(() => {
    if (!searchPo.trim()) {
      if (selectedPo && !livePos.slice(0, 8).some(p => p.poNumber === selectedPo.poNumber)) {
        return [selectedPo, ...livePos.filter(p => p.poNumber !== selectedPo.poNumber)].slice(0, 8);
      }
      return livePos.slice(0, 8);
    }
    return livePos;
  }, [searchPo, livePos, selectedPo]);

  const poValue = selectedPo?.totalAmount || 0;
  const availableBalance = selectedPo ? Number(selectedPo.remainingAdvanceAmount) : 0;

  const calculatedAmount = useMemo(() => {
    if (!selectedPo) return 0;
    return amountMode === 'pct' ? availableBalance * (Number(pctValue) / 100) : Number(amountValue) || 0;
  }, [selectedPo, amountMode, pctValue, amountValue, availableBalance]);

  const calculatedPct = useMemo(() => {
    if (!selectedPo || availableBalance === 0) return 0;
    return amountMode === 'pct' ? Number(pctValue) || 0 : (calculatedAmount / availableBalance) * 100;
  }, [selectedPo, availableBalance, amountMode, pctValue, calculatedAmount]);

  const advanceAdjustVal = Math.max(0, Number(advanceAdjust) || 0);
  const netAmountAfterAdjust = Math.max(0, calculatedAmount - advanceAdjustVal);

  const amountINR = useMemo(() => {
    return netAmountAfterAdjust * activeFxRate;
  }, [netAmountAfterAdjust, activeFxRate]);

  const remainingAfter = availableBalance - calculatedAmount + advanceAdjustVal;
  const cgstAmount = withGst && gstType === 'intra' ? netAmountAfterAdjust * (Number(cgstPct) / 100) : 0;
  const sgstAmount = withGst && gstType === 'intra' ? netAmountAfterAdjust * (Number(sgstPct) / 100) : 0;
  const igstAmount = withGst && gstType === 'inter' ? netAmountAfterAdjust * (Number(igstPct) / 100) : 0;
  const totalGstAmount = cgstAmount + sgstAmount + igstAmount;
  const grandTotal = netAmountAfterAdjust + totalGstAmount;

  useEffect(() => {
    const amt = (grandTotal || calculatedAmount || 0) * activeFxRate;
    let active = true;
    apiFetch(`/api/p2p/workflows/preview?module=Advance Payment&amount=${amt}`)
      .then(res => res.json())
      .then(data => {
        if (active) {
          if (data.success && data.workflow) {
            setDynamicWorkflow(data.workflow);
          }
        }
      })
      .catch((err) => {
        console.log('[Workflow Preview] Failed to fetch:', err.message);
      });
    return () => { active = false; };
  }, [grandTotal, calculatedAmount, activeFxRate]);

  const validate = (step) => {
    const e = {};
    if (step === 1 && !selectedPo) {
      e.po = 'Please select a Purchase Order.';
      showToast({ type: 'error', title: 'PO Selection Required', description: 'Select a Purchase Order before proceeding.' });
    }
    if (step === 2 && calculatedAmount <= 0) {
      e.amount = `Amount must be greater than ${currSymbol}0.`;
      showToast({ type: 'error', title: 'Invalid Amount', description: `Advance amount must be greater than ${currSymbol}0.` });
    }
    if (step === 2 && calculatedAmount > availableBalance) {
      e.amount = `Exceeds available balance ${currSymbol}${fmt(availableBalance)}.`;
      showToast({ type: 'error', title: 'Amount Exceeded', description: `Advance amount exceeds PO balance of ${currSymbol}${fmt(availableBalance)}.` });
    }
    if (step === 2 && amountMode === 'pct' && (!Number.isFinite(Number(pctValue)) || Number(pctValue) <= 0 || Number(pctValue) > 100)) {
      e.amount = 'Percentage must be between 0.01% and 100%.';
    }
    if (step === 2 && (!reason.trim() || reason.trim().length < 10)) {
      e.reason = 'Please enter a reason (min 10 chars).';
      showToast({ type: 'error', title: 'Reason Required', description: 'Enter a detailed reason for the advance request (min 10 chars).' });
    }
    if (step === 2 && withGst) {
      const gstRates = gstType === 'intra' ? [Number(cgstPct), Number(sgstPct)] : [Number(igstPct)];
      if (gstRates.some((rate) => !Number.isFinite(rate) || rate <= 0 || rate > 100)) {
        e.gst = 'Enter valid GST percentages between 0.01% and 100%.';
        showToast({ type: 'error', title: 'Invalid GST', description: e.gst });
      }
    }
    if (step === 3 && documents.length === 0) {
      e.docs = 'At least one supporting document is required.';
      showToast({ type: 'error', title: 'Document Required', description: 'Upload at least one supporting document before submitting.' });
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSelectPo = (p) => {
    setSelectedPo(p);
    setErrors(prev => ({ ...prev, po: null }));
  };

  const goNext = () => {
    if (validate(currentStep)) {
      const nextStep = Math.min(currentStep + 1, 4);
      setCurrentStep(nextStep);
    }
  };

  const goBack = () => {
    setErrors({});
    const prevStep = Math.max(currentStep - 1, 1);
    setCurrentStep(prevStep);
  };

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
          poNumber: selectedPo.poNumber,
          vendorName: selectedPo.supplierName,
          vendorCode: selectedPo.supplierId,
          amount: calculatedAmount,
          amountINR,
          fxRate: activeFxRate,
          percentageOfPo: calculatedPct,
          currency: poCurrency,
          advanceAdjust: advanceAdjustVal,
          adjustedAmount: advanceAdjustVal,
          cgst: cgstAmount,
          sgst: sgstAmount,
          igst: igstAmount,
          totalGst: totalGstAmount,
          grandTotal,
          paymentMode,
          bankName,
          remarks: reason,
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
              description: `${advanceId} created, but document upload failed.`,
              duration: 5000
            });
          } else {
            showToast({
              type: 'success',
              title: 'Advance Payment Submitted!',
              description: `${advanceId} (${poCurrency} ${currSymbol}${fmt(grandTotal)}) sent for approval with ${docJson.data?.uploaded?.length || documents.length} document(s).`
            });
          }
        } catch (docError) {
          console.error('Document upload error:', docError);
          showToast({
            type: 'warning',
            title: 'Advance Payment Submitted',
            description: `${advanceId} created but documents failed to upload.`,
            duration: 5000
          });
        }
      } else {
        showToast({
          type: 'success',
          title: 'Advance Payment Submitted!',
          description: `${advanceId} (${poCurrency} ${currSymbol}${fmt(grandTotal)}) sent for approval.`
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
    <aside className="w-full lg:w-[380px] xl:w-[420px] shrink-0 flex flex-col gap-6 sticky top-6">
      {/* Payment Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
        <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-50/60 to-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Receipt className="w-5 h-5 text-[#0d7676]" />
            <span className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Payment Summary</span>
          </div>
          {selectedPo && (
            <span className="text-xs font-mono font-extrabold bg-teal-100 text-[#0d7676] px-2.5 py-1 rounded-full border border-teal-200">
              {poCurrency}
            </span>
          )}
        </div>

        <div className="p-5 space-y-4">
          {selectedPo ? (
            <>
              <div className="space-y-1.5 pb-3 border-b border-slate-100">
                <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Target PO & Vendor</p>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-mono font-extrabold text-slate-900 text-base">{selectedPo.poNumber}</span>
                  <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase">
                    {selectedPo.status || 'Open'}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-800 break-words leading-relaxed mt-1">
                  {selectedPo.supplierName}
                </p>
                {selectedPo.supplierId && (
                  <p className="font-mono text-xs text-slate-500 font-semibold mt-0.5">Code: {selectedPo.supplierId}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <p className="text-[11px] text-slate-500 font-extrabold uppercase tracking-wider">PO Total ({poCurrency})</p>
                  <p className="font-mono font-extrabold text-slate-900 text-base mt-1 whitespace-nowrap">
                    {currSymbol}{fmt(poValue)}
                  </p>
                </div>
                <div className="bg-teal-50/80 rounded-xl p-3 border border-teal-200">
                  <p className="text-[11px] text-[#0d7676] font-extrabold uppercase tracking-wider">Available ({poCurrency})</p>
                  <p className="font-mono font-extrabold text-[#0d7676] text-base mt-1 whitespace-nowrap">
                    {currSymbol}{fmt(availableBalance)}
                  </p>
                </div>
              </div>

              {poCurrency !== 'INR' && (
                <div className="bg-gradient-to-r from-slate-50 to-teal-50/40 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between items-center font-semibold text-slate-600">
                    <span>FX Rate ({poCurrency} → INR):</span>
                    <span className="font-mono font-extrabold text-teal-700 whitespace-nowrap">₹{activeFxRate}</span>
                  </div>
                  <div className="flex justify-between items-center font-bold text-slate-900 pt-1 border-t border-slate-200/60">
                    <span>Available in INR:</span>
                    <span className="font-mono font-extrabold text-teal-800 text-sm whitespace-nowrap">₹{fmt(availableBalance * activeFxRate)}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-6 text-center text-slate-400 space-y-2">
              <Building2 className="w-8 h-8 mx-auto opacity-30 text-teal-600" />
              <p className="text-sm font-bold text-slate-600">No Purchase Order Selected</p>
              <p className="text-xs text-slate-400 max-w-[220px] mx-auto">Select a PO in Step 1 to calculate advance amounts and approval routes</p>
            </div>
          )}

          {calculatedAmount > 0 && (
            <div className="border-t-2 border-slate-100 pt-4 space-y-3">
              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span className="text-slate-600 font-semibold">Gross Advance</span>
                <span className="font-mono font-extrabold text-teal-700 text-base whitespace-nowrap">{currSymbol}{fmt(calculatedAmount)}</span>
              </div>
              {advanceAdjustVal > 0 && (
                <div className="flex justify-between items-center text-xs text-amber-800 font-semibold bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
                  <span>Advance Adjust</span>
                  <span className="font-mono font-extrabold">-{currSymbol}{fmt(advanceAdjustVal)}</span>
                </div>
              )}
              {poCurrency !== 'INR' && (
                <div className="flex justify-between items-center text-xs bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-100">
                  <span className="text-teal-800 font-semibold">INR Equivalent</span>
                  <span className="font-mono font-extrabold text-teal-900 whitespace-nowrap">₹{fmt(amountINR)}</span>
                </div>
              )}
              {totalGstAmount > 0 && (
                <div className="flex justify-between items-center text-xs sm:text-sm">
                  <span className="text-slate-600 font-semibold">GST Breakdown</span>
                  <span className="font-mono font-extrabold text-amber-600 whitespace-nowrap">+{currSymbol}{fmt(totalGstAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center bg-[#0d7676] text-white px-4 py-3 rounded-xl shadow-xs">
                <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider">Grand Total</span>
                <span className="font-mono font-extrabold text-base sm:text-lg whitespace-nowrap">{currSymbol}{fmt(grandTotal)}</span>
              </div>
              <div className="flex justify-between items-center bg-emerald-50/90 border border-emerald-200 px-4 py-2.5 rounded-xl text-xs sm:text-sm">
                <span className="text-emerald-900 font-bold">Remaining Balance</span>
                <span className={`font-mono font-extrabold text-sm sm:text-base whitespace-nowrap ${remainingAfter < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {currSymbol}{fmt(remainingAfter)}
                </span>
              </div>
            </div>
          )}

          {documents.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center gap-2 text-xs text-slate-700 font-bold bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                <FileText className="w-4 h-4 text-[#0d7676]" />
                <span>{documents.length} document{documents.length > 1 ? 's' : ''} attached</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Approval Workflow Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4.5 h-4.5 text-[#0d7676]" />
            <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Approval Workflow</span>
          </div>
          {dynamicWorkflow?.slab && (
            <span className="text-[10px] font-extrabold text-[#0d7676] bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
              {dynamicWorkflow.slab}
            </span>
          )}
        </div>
        <div className="p-4 space-y-3">
          {(dynamicWorkflow?.steps || [
            { step: 1, title: 'Purchase Manager Review', roleName: 'Purchase Manager' },
            { step: 2, title: 'Purchase Head Approval', roleName: 'Purchase Head' },
            { step: 3, title: 'CFO Approval', roleName: 'CFO' }
          ]).map((st, i) => (
            <div key={st.step || i} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-teal-50 text-[#0d7676] text-xs font-extrabold flex items-center justify-center shrink-0 border border-teal-200">
                {st.step || i + 1}
              </div>
              <span className="text-xs sm:text-sm font-bold text-slate-800">
                {formatRoleName(st.roleName || st.title)}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <span className="text-xs sm:text-sm font-extrabold text-emerald-700">Payment Dispatched</span>
          </div>
        </div>
      </div>

      {/* Info Notice Card */}
      <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4 flex gap-3 shadow-2xs">
        <Info className="w-5 h-5 shrink-0 text-sky-600 mt-0.5" />
        <p className="text-xs text-sky-900 leading-relaxed font-medium">
          Multi-currency payment requests auto-convert to INR using live FX rates for threshold approval routing.
        </p>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-slate-50/90 font-sans text-slate-800 pb-12 text-left">

        {/* Unified Header & Stepper Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-5 overflow-hidden">
          {/* Top Action Bar Row */}
          <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex min-w-0 items-center gap-2 text-xs sm:text-sm text-slate-500 font-semibold">
              <Link to="/p2p/advances" className="hover:text-[#0d7676] transition-colors flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" />
                Advance Payments
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
              <span className="text-slate-900 font-extrabold truncate">New Advance Payment Request</span>
            </div>

            <button
              onClick={() => navigate('/p2p/advances')}
              className="shrink-0 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          </div>

          {/* Compact Stepper Row */}
          <div className="px-4 sm:px-10 py-2.5 bg-slate-50/30">
            <div className="flex items-center justify-between relative">
              <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200" />
              <div
                className="absolute left-8 top-1/2 -translate-y-1/2 h-0.5 bg-[#0d7676] transition-all duration-500"
                style={{ width: `calc(${((currentStep - 1) / (STEPS.length - 1)) * 100}% - 64px / ${STEPS.length})` }}
              />
              {STEPS.map((step) => {
                const done = currentStep > step.id;
                const active = currentStep === step.id;
                const Icon = step.icon;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => {
                      if (step.id < currentStep) {
                        setErrors({});
                        setCurrentStep(step.id);
                      }
                    }}
                    className={`relative z-10 flex items-center gap-2 px-3 py-1 rounded-full border transition-all bg-white shadow-2xs ${
                      done
                        ? 'border-teal-500 bg-teal-50/90 text-[#0d7676]'
                        : active
                        ? 'border-teal-600 bg-teal-50 text-[#0d7676] ring-2 ring-teal-500/20'
                        : 'border-slate-200 text-slate-400 hover:border-slate-300'
                    } ${step.id < currentStep ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className={`
                      w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors
                      ${done ? 'bg-[#0d7676] text-white' :
                        active ? 'bg-[#0d7676] text-white' :
                          'bg-slate-100 text-slate-400'}
                    `}>
                      {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                    </div>
                    <span className={`hidden sm:block text-xs font-extrabold whitespace-nowrap ${done || active ? 'text-[#0d7676]' : 'text-slate-500'}`}>
                      {step.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Layout: Steps + Sidebar */}
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="flex-1 min-w-0 w-full">

            {/* ════ STEP 1: SELECT PO ════ */}
            {currentStep === 1 && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/50 to-white flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">Select Purchase Order</h2>
                    <p className="text-sm text-slate-400">Search and select the PO to raise an advance against (supports USD, EUR, GBP, INR)</p>
                  </div>
                </div>

                <div className="p-4 sm:p-6 space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                      Select Purchase Order <span className="text-rose-500">*</span>
                    </label>
                    <SearchableSelect
                      options={poOptions}
                      value={selectedPo?.poNumber || ''}
                      onChange={(val) => {
                        const found = livePos.find((p) => String(p.poNumber) === String(val));
                        if (found) {
                          handleSelectPo(found);
                        }
                      }}
                      placeholder={loadingPos ? 'Loading purchase orders…' : 'Search & select purchase order…'}
                      searchPlaceholder="Type PO number, vendor name or code…"
                      error={errors.po}
                      disabled={loadingPos}
                      size="md"
                    />
                  </div>

                  {/* Selected PO Card */}
                  {selectedPo && (
                    <div className="p-6 rounded-2xl bg-gradient-to-br from-teal-50/90 to-emerald-50/40 border-2 border-teal-200/90 shadow-sm space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <CheckCircle2 className="w-6 h-6 text-teal-600 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="font-mono font-extrabold text-slate-900 text-lg sm:text-xl">{selectedPo.poNumber}</span>
                              <span className={`text-xs font-bold px-3 py-0.5 rounded-full uppercase ${selectedPo.status === 'open' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600'}`}>
                                {selectedPo.status || 'Open'}
                              </span>
                              <span className="text-xs font-extrabold bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded-md font-mono border border-slate-200">
                                {poCurrency}
                              </span>
                            </div>
                            <p className="text-base font-bold text-slate-800 mt-1.5 break-words leading-relaxed">
                              {selectedPo.supplierName}
                            </p>
                            {selectedPo.supplierId && (
                              <span className="inline-block mt-1 font-mono text-xs font-semibold text-slate-500 bg-white/80 px-2.5 py-1 rounded-md border border-slate-200">
                                Code: {selectedPo.supplierId}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-extrabold text-teal-700 uppercase tracking-wider">Available Balance</p>
                          <p className="font-mono font-extrabold text-teal-700 text-xl sm:text-2xl mt-0.5 whitespace-nowrap">{currSymbol}{fmt(availableBalance)}</p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-teal-200/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                        <div className="bg-white/80 p-3.5 rounded-xl border border-teal-100">
                          <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider">Total PO Amount</span>
                          <span className="font-mono font-extrabold text-slate-900 text-base sm:text-lg whitespace-nowrap mt-0.5 block">{currSymbol}{fmt(poValue)}</span>
                        </div>
                        <div className="bg-white/80 p-3.5 rounded-xl border border-teal-100">
                          <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider">Advance Paid</span>
                          <span className="font-mono font-extrabold text-slate-800 text-base sm:text-lg whitespace-nowrap mt-0.5 block">{currSymbol}{fmt(selectedPo.advancePaid || 0)}</span>
                        </div>
                        <div className="bg-white/80 p-3.5 rounded-xl border border-teal-100">
                          <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider">PO Currency</span>
                          <span className="font-mono font-extrabold text-slate-800 text-base sm:text-lg mt-0.5 block">{poCurrency}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="sticky bottom-0 z-20 px-4 sm:px-6 py-3.5 border-t border-slate-200 bg-white/95 backdrop-blur flex justify-end shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
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
                <div className="px-4 sm:px-6 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/50 to-white flex flex-wrap items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                    <IndianRupee className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">Payment Details ({poCurrency})</h2>
                    <p className="text-sm text-slate-400">Set advance amount and currency breakdown</p>
                  </div>
                  <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap items-center gap-2 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-xl">
                    <span className="text-[10px] font-bold text-teal-700 uppercase">PO</span>
                    <span className="font-mono font-bold text-sm text-slate-800">{selectedPo?.poNumber}</span>
                    <span className="text-teal-300">·</span>
                    <span className="font-mono font-bold text-sm text-teal-700">{currSymbol}{fmt(availableBalance)} {poCurrency}</span>
                  </div>
                </div>

                <div className="p-4 sm:p-5 space-y-4">
                  
                  {/* Amount Inputs */}
                  <div className="space-y-2.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      Advance Amount ({poCurrency}) <span className="text-rose-500">*</span>
                    </label>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-slate-400 font-semibold mr-1">Quick %:</span>
                      {[10, 20, 25, 30, 50].map(pct => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => {
                            setAmountMode('pct');
                            setPctValue(pct.toString());
                            setErrors(p => ({ ...p, amount: null }));
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${amountMode === 'pct' && Number(pctValue) === pct
                            ? 'bg-[#0d7676] text-white border-[#0d7676] shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-teal-400 hover:shadow-2xs'
                            }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>

                    <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)] gap-4">
                      <div className="space-y-2.5">
                        <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-slate-50 p-1 gap-1">
                          <button
                            type="button"
                            onClick={() => setAmountMode('pct')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${amountMode === 'pct' ? 'bg-[#0d7676] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                              }`}
                          >
                            <Percent className="w-3.5 h-3.5" /> Percentage
                          </button>
                          <button
                            type="button"
                            onClick={() => setAmountMode('amount')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${amountMode === 'amount' ? 'bg-[#0d7676] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                              }`}
                          >
                            <span>{currSymbol}</span> Amount ({poCurrency})
                          </button>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                            {amountMode === 'pct' ? '%' : currSymbol}
                          </span>
                          <input
                            type="number"
                            min="0.01"
                            max={amountMode === 'pct' ? 100 : availableBalance}
                            step="0.01"
                            value={amountMode === 'amount' ? amountValue : pctValue}
                            onChange={(e) => {
                              if (amountMode === 'amount') setAmountValue(e.target.value);
                              else setPctValue(e.target.value);
                              setErrors(p => ({ ...p, amount: null }));
                            }}
                            placeholder="0.00"
                            className={inp(errors.amount) + ' pl-10 font-mono font-bold text-sm py-2'}
                          />
                        </div>
                        {errors.amount && (
                          <p className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> {errors.amount}
                          </p>
                        )}

                        {/* Reason */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Reason for Advance <span className="text-rose-500">*</span>
                          </label>
                          <textarea
                            value={reason}
                            onChange={(e) => { setReason(e.target.value); setErrors(p => ({ ...p, reason: null })); }}
                            rows={2}
                            maxLength={500}
                            placeholder="e.g. Vendor requires 20% advance before shipment as per PO payment terms…"
                            className={inp(errors.reason) + ' resize-none py-2 text-xs'}
                          />
                          <div className="mt-0.5 flex items-center justify-between gap-3">
                            <span className="text-[10px] font-medium text-slate-400">Minimum 10 characters</span>
                            <span className={`text-[10px] font-bold ${reason.trim().length >= 10 ? 'text-emerald-600' : 'text-slate-400'}`}>{reason.length}/500</span>
                          </div>
                          {errors.reason && (
                            <p className="text-xs text-rose-600 font-semibold mt-0.5 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" /> {errors.reason}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Live calc box */}
                      <div className="bg-gradient-to-br from-teal-50/70 to-emerald-50/70 rounded-xl border border-teal-200/80 p-4 space-y-2.5 shadow-2xs flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-600">Gross Requesting ({poCurrency})</span>
                            <span className="font-mono font-bold text-teal-800 text-base">{currSymbol}{fmt(calculatedAmount)}</span>
                          </div>
                          {advanceAdjustVal > 0 && (
                            <div className="flex justify-between items-center text-xs text-amber-800 font-bold bg-amber-50/80 px-2 py-1 rounded-lg border border-amber-200/80">
                              <span>Advance Adjust</span>
                              <span className="font-mono">-{currSymbol}{fmt(advanceAdjustVal)}</span>
                            </div>
                          )}
                          {poCurrency !== 'INR' && (
                            <div className="flex justify-between items-center text-xs border-b border-teal-200/60 pb-1.5">
                              <span className="font-semibold text-slate-600">INR Equivalent</span>
                              <span className="font-mono font-bold text-teal-900">₹{fmt(amountINR)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-600">Of available PO balance</span>
                            <span className="font-mono font-bold text-slate-700">{calculatedPct.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-teal-100/80 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${calculatedAmount > availableBalance ? 'bg-rose-500' : 'bg-[#0d7676]'}`}
                              style={{ width: `${Math.min(100, availableBalance > 0 ? (calculatedAmount / availableBalance) * 100 : 0)}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex justify-between items-center border-t border-teal-200/80 pt-2 text-xs">
                          <span className="font-bold text-slate-700">Remaining Balance ({poCurrency})</span>
                          <span className={`font-mono font-extrabold text-sm ${remainingAfter < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {currSymbol}{fmt(remainingAfter)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment mode + Bank + Advance Adjust */}
                  <div className="grid md:grid-cols-3 gap-3.5 items-start">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Payment Mode</label>
                      <SearchableSelect
                        options={[
                          { label: 'NEFT', value: 'NEFT' },
                          { label: 'RTGS', value: 'RTGS' },
                          { label: 'SWIFT (Foreign Wire)', value: 'SWIFT' },
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
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Bank Name <span className="text-slate-400 font-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="e.g. HDFC Bank / Citibank…"
                        className={inp(false) + ' h-10 py-2.5 text-sm'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Advance Adjust <span className="text-slate-400 font-normal">(optional)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                          {currSymbol}
                        </span>
                        <input
                          type="number"
                          min="0"
                          max={calculatedAmount}
                          step="0.01"
                          value={advanceAdjust}
                          onChange={(e) => setAdvanceAdjust(e.target.value)}
                          placeholder="0.00 (prior advance/credit)"
                          className={inp(false) + ' h-10 pl-8 py-2.5 text-sm font-mono font-bold text-slate-900'}
                        />
                      </div>
                    </div>
                  </div>

                  {/* GST */}
                  <div className={`rounded-xl border-2 transition-all ${withGst ? 'border-amber-300 bg-gradient-to-br from-amber-50/80 to-orange-50/80' : 'border-slate-200 bg-white'}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setWithGst(prev => !prev);
                        setErrors(prev => ({ ...prev, gst: null }));
                      }}
                      className="w-full flex items-center justify-between px-5 py-3.5"
                    >
                      <div className="flex items-center gap-3">
                        <Banknote className={`w-5 h-5 ${withGst ? 'text-amber-500' : 'text-slate-400'}`} />
                        <div className="text-left">
                          <p className="text-sm font-bold text-slate-800">GST Applicable?</p>
                          <p className="text-xs text-slate-500 mt-0.5">Toggle if this advance includes GST</p>
                        </div>
                      </div>
                      <div className={`w-12 h-7 rounded-full transition-all relative ${withGst ? 'bg-amber-500' : 'bg-slate-300'}`}>
                        <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all ${withGst ? 'left-[calc(100%-24px)]' : 'left-1'}`} />
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
                                  min="0.01"
                                  max="100"
                                  step="0.01"
                                  value={cgstPct}
                                  onChange={e => { setCgstPct(e.target.value); setErrors(prev => ({ ...prev, gst: null })); }}
                                  placeholder="9.00"
                                  className={inp(false) + ' font-mono font-bold py-2.5'}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">SGST %</label>
                                <input
                                  type="number"
                                  min="0.01"
                                  max="100"
                                  step="0.01"
                                  value={sgstPct}
                                  onChange={e => { setSgstPct(e.target.value); setErrors(prev => ({ ...prev, gst: null })); }}
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
                                min="0.01"
                                max="100"
                                step="0.01"
                                value={igstPct}
                                onChange={e => { setIgstPct(e.target.value); setErrors(prev => ({ ...prev, gst: null })); }}
                                placeholder="18.00"
                                className={inp(false) + ' font-mono font-bold py-2.5'}
                              />
                            </div>
                          )}
                        </div>
                        {totalGstAmount > 0 && (
                          <div className="flex items-center justify-between text-sm bg-amber-100 rounded-xl px-4 py-2.5 border-2 border-amber-200">
                            <span className="font-bold text-amber-900">Total GST</span>
                            <span className="font-mono font-bold text-amber-700 text-base">+{currSymbol}{fmt(totalGstAmount)}</span>
                          </div>
                        )}
                        {errors.gst && (
                          <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-600"><AlertCircle className="h-4 w-4" />{errors.gst}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="sticky bottom-0 z-20 px-4 sm:px-6 py-3.5 border-t border-slate-200 bg-white/95 backdrop-blur flex items-center justify-between shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
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
                <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/50 to-white flex flex-wrap items-center gap-3">
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

                <div className="p-4 sm:p-6 space-y-4">
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

                <div className="sticky bottom-0 z-20 px-4 sm:px-6 py-3.5 border-t border-slate-200 bg-white/95 backdrop-blur flex items-center justify-between shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
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
                <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/50 to-white flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">Review & Submit</h2>
                    <p className="text-sm text-slate-400">Confirm all details before submitting for approval</p>
                  </div>
                </div>

                <div className="p-4 sm:p-6 space-y-4">
                  {/* PO + Vendor */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Purchase Order Details</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {[
                        { label: 'PO Number', value: selectedPo?.poNumber, mono: true },
                        { label: 'Vendor', value: selectedPo?.supplierName, mono: false },
                        { label: `PO Value (${poCurrency})`, value: `${currSymbol}${fmt(poValue)}`, mono: true },
                        { label: `Available (${poCurrency})`, value: `${currSymbol}${fmt(availableBalance)}`, mono: true, hi: true },
                      ].map(({ label, value, mono, hi }) => (
                        <div key={label} className={`rounded-xl p-3 border ${hi ? 'bg-teal-50/80 border-teal-200' : 'bg-slate-50/80 border-slate-200'}`}>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                          <p className={`text-sm font-bold mt-0.5 ${mono ? 'font-mono' : ''} ${hi ? 'text-teal-700' : 'text-slate-800'}`}>
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-100" />

                  {/* Payment */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Payment Details ({poCurrency})</p>
                    <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 text-sm overflow-hidden">
                      <div className="flex justify-between px-4 py-3">
                        <span className="text-slate-600 font-medium">Gross Advance Amount</span>
                        <span className="font-mono font-bold">{currSymbol}{fmt(calculatedAmount)} <span className="text-slate-400 font-normal">({calculatedPct.toFixed(1)}%)</span></span>
                      </div>
                      {advanceAdjustVal > 0 && (
                        <div className="flex justify-between px-4 py-3 bg-amber-50/70">
                          <span className="text-amber-900 font-bold">Advance Adjust</span>
                          <span className="font-mono font-bold text-amber-800">-{currSymbol}{fmt(advanceAdjustVal)}</span>
                        </div>
                      )}
                      {poCurrency !== 'INR' && (
                        <div className="flex justify-between px-4 py-3 bg-teal-50/70">
                          <span className="text-teal-900 font-bold">INR Equivalent (Rate: 1 {poCurrency} = ₹{activeFxRate})</span>
                          <span className="font-mono font-bold text-teal-800">₹{fmt(amountINR)} INR</span>
                        </div>
                      )}
                      {withGst && (
                        <>
                          <div className="flex justify-between px-4 py-3 bg-amber-50/60">
                            <span className="text-slate-600 font-medium">GST Breakdown</span>
                            <span className="font-mono font-bold text-amber-700">+{currSymbol}{fmt(totalGstAmount)}</span>
                          </div>
                          <div className="flex justify-between px-4 py-3 bg-slate-50">
                            <span className="font-bold text-slate-700">Grand Total</span>
                            <span className="font-mono font-bold text-slate-900">{currSymbol}{fmt(grandTotal)}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between px-4 py-3">
                        <span className="text-slate-600 font-medium">Remaining Balance</span>
                        <span className={`font-mono font-bold ${remainingAfter < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {currSymbol}{fmt(remainingAfter)}
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
                            <Clock className="w-4 h-4 text-teal-600" /> {formatRoleName(st.roleName || st.title)}
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

                <div className="sticky bottom-0 z-20 px-4 sm:px-6 py-3.5 border-t border-slate-200 bg-white/95 backdrop-blur flex items-center justify-between shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
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

          {/* Sidebar */}
          <Sidebar />
      </div>
    </div>
  );
}
