import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import FileUploadZone from '../../components/shared/FileUploadZone';
import { SearchableSelect } from '../../components/ui/searchable-select';
import {
  Search, Check, Upload, X, FileText, Loader2, AlertCircle,
  ChevronRight, ChevronDown, Building2, IndianRupee, Percent, ArrowLeft, Send,
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
    .replace(/[-_]/g, ' ')
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
  const [isPoDropdownOpen, setIsPoDropdownOpen] = useState(false);
  const poDropdownRef = useRef(null);
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
  const [fxRates, setFxRates] = useState({ INR: 1 });
  const [customFxRate, setCustomFxRate] = useState('');

  useEffect(() => {
    apiFetch('/api/exchange-rates')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.rates) {
          const rateMap = { INR: 1 };
          data.rates.forEach(r => { rateMap[r.currency] = Number(r.rate) || 1; });
          setFxRates(rateMap);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (poDropdownRef.current && !poDropdownRef.current.contains(e.target)) {
        setIsPoDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const poCurrency = selectedPo?.currency || 'INR';
  const currSymbol = getCurrencySymbol(poCurrency);

  const activeFxRate = useMemo(() => {
    if (customFxRate && Number(customFxRate) > 0) return Number(customFxRate);
    return fxRates[poCurrency] || (poCurrency === 'USD' ? 83.5 : poCurrency === 'EUR' ? 90.0 : 1);
  }, [customFxRate, fxRates, poCurrency]);

  // Strict deduplication by PO Number
  const normalizePos = (data = []) => {
    const map = new Map();
    data.forEach(p => {
      const poNo = p.sapPoNumber || p.poNumber;
      if (!poNo) return;
      if (['closed', 'cancelled', 'canceled', 'blocked'].includes(String(p.status).toLowerCase())) return;
      if (!map.has(poNo)) {
        map.set(poNo, {
          poNumber: poNo,
          supplierName: p.supplierName || 'Vendor',
          supplierId: p.supplierId || '',
          totalAmount: p.totalAmount || 0,
          advancePaid: p.advancePaid || 0,
          advanceCommitted: p.advanceCommitted || 0,
          remainingAdvanceAmount: p.remainingAdvanceAmount !== undefined && p.remainingAdvanceAmount !== null ? Number(p.remainingAdvanceAmount) : Number(p.totalAmount || 0),
          currency: p.currency || 'INR',
          status: p.status || 'open',
        });
      }
    });
    return Array.from(map.values());
  };

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

  // Unique PO options for dropdown
  const filteredPos = useMemo(() => {
    const seen = new Set();
    const list = [];
    
    let source = livePos;
    if (!searchPo.trim() && selectedPo && !livePos.slice(0, 8).some(p => p.poNumber === selectedPo.poNumber)) {
      source = [selectedPo, ...livePos.filter(p => p.poNumber !== selectedPo.poNumber)];
    }
    
    for (const p of source) {
      if (!p || !p.poNumber) continue;
      if (!seen.has(p.poNumber)) {
        seen.add(p.poNumber);
        list.push(p);
      }
    }

    if (!searchPo.trim()) {
      return list.slice(0, 8);
    }
    return list;
  }, [searchPo, livePos, selectedPo]);

  // Unique Workflow Steps
  const workflowSteps = useMemo(() => {
    const rawSteps = dynamicWorkflow?.steps || [
      { step: 1, title: 'Purchase Manager Review', roleName: 'Purchase Manager' },
      { step: 2, title: 'Purchase Head Approval', roleName: 'Purchase Head' },
      { step: 3, title: 'CFO Approval', roleName: 'CFO' }
    ];
    const seenRoles = new Set();
    return rawSteps.filter((st) => {
      const roleKey = (st.roleName || st.title || '').trim().toLowerCase();
      if (seenRoles.has(roleKey)) return false;
      seenRoles.add(roleKey);
      return true;
    });
  }, [dynamicWorkflow]);

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
    // Simple required validation without minimum length enforcement
    if (step === 2 && !reason.trim()) {
      e.reason = 'Please enter a reason for advance.';
      showToast({ type: 'error', title: 'Reason Required', description: 'Please enter a reason for the advance request.' });
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

  // Unique document attachment filtering
  const handleFilesSelected = (newFiles) => {
    setDocuments(prev => {
      const existingNames = new Set(prev.map(d => d.name));
      const filtered = newFiles.filter(d => !existingNames.has(d.name));
      return [...prev, ...filtered];
    });
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

  const inp = (err) => `w-full px-3.5 py-2 text-xs sm:text-sm font-semibold border rounded-lg outline-none transition-all ${err
    ? 'border-rose-400 bg-rose-50/40 focus:ring-2 focus:ring-rose-200 text-rose-900'
    : 'border-slate-300 bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 text-slate-900 hover:border-slate-400'
    }`;

  const Sidebar = () => (
    <aside className="w-full lg:w-[380px] xl:w-[400px] shrink-0 flex flex-col gap-4">
      {/* Payment Summary Card */}
      <div className="bg-white rounded-xl border border-slate-300/90 shadow-2xs overflow-hidden transition-all">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <Receipt className="w-4 h-4 text-teal-700" />
            <span className="font-bold text-slate-900 text-xs tracking-wider uppercase whitespace-nowrap">Payment Summary</span>
          </div>
          {selectedPo && (
            <span className="text-[11px] font-mono font-bold bg-teal-100 text-teal-900 px-2 py-0.5 rounded border border-teal-300 whitespace-nowrap shrink-0">
              {poCurrency}
            </span>
          )}
        </div>

        <div className="p-4 space-y-3">
          {selectedPo ? (
            <>
              <div className="space-y-1.5 pb-2.5 border-b border-slate-200">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-slate-900 text-sm whitespace-nowrap">{selectedPo.poNumber}</span>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded uppercase tracking-wider whitespace-nowrap shrink-0">
                    {selectedPo.status || 'Open'}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-700 truncate">
                  {selectedPo.supplierName}
                </p>

                {poCurrency !== 'INR' && (
                  <div className="flex items-center justify-between text-[11px] bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-md text-slate-600 font-medium mt-1">
                    <span>1 {poCurrency} = <strong className="text-slate-900">₹{activeFxRate}</strong></span>
                    <span>Avail: <strong className="font-mono text-teal-900">₹{fmt(availableBalance * activeFxRate)}</strong></span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-6 text-center text-slate-500 space-y-1.5">
              <Building2 className="w-8 h-8 mx-auto opacity-40 text-teal-700" />
              <p className="text-xs font-bold text-slate-800">No Purchase Order Selected</p>
              <p className="text-[11px] text-slate-500 max-w-[220px] mx-auto leading-relaxed">
                Select a PO in Step 1 to calculate advance amounts
              </p>
            </div>
          )}

          {calculatedAmount > 0 && (
            <div className="border-t border-slate-200 pt-3 space-y-2.5">
              <div className="flex justify-between items-center text-xs gap-2">
                <span className="text-slate-700 font-medium whitespace-nowrap">Gross Advance ({poCurrency})</span>
                <span className="font-mono font-bold text-slate-900 text-sm whitespace-nowrap">{currSymbol}{fmt(calculatedAmount)}</span>
              </div>

              {poCurrency !== 'INR' && (
                <div className="flex justify-between items-center text-xs bg-teal-50/70 px-3 py-1.5 rounded-lg border border-teal-200 gap-2">
                  <span className="text-slate-700 font-semibold whitespace-nowrap">INR Equivalent</span>
                  <span className="font-mono font-bold text-teal-900 whitespace-nowrap">₹{fmt(amountINR)}</span>
                </div>
              )}

              {advanceAdjustVal > 0 && (
                <div className="flex justify-between items-center text-xs text-amber-900 font-semibold bg-amber-50 px-2.5 py-1 rounded border border-amber-200 gap-2">
                  <span className="whitespace-nowrap">Advance Adjust</span>
                  <span className="font-mono font-bold whitespace-nowrap">-{currSymbol}{fmt(advanceAdjustVal)}</span>
                </div>
              )}

              {totalGstAmount > 0 && (
                <div className="flex justify-between items-center text-xs gap-2">
                  <span className="text-slate-700 font-medium whitespace-nowrap">GST Breakdown</span>
                  <span className="font-mono font-bold text-amber-700 whitespace-nowrap">+{currSymbol}{fmt(totalGstAmount)}</span>
                </div>
              )}

              <div className="flex justify-between items-center bg-[#0d7676] text-white px-3.5 py-2.5 rounded-lg shadow-2xs gap-2">
                <span className="text-xs font-bold uppercase tracking-wider whitespace-nowrap">Grand Total</span>
                <span className="font-mono font-bold text-base whitespace-nowrap">{currSymbol}{fmt(grandTotal)}</span>
              </div>

              <div className="flex justify-between items-center bg-emerald-50 border border-emerald-300 px-3.5 py-2 rounded-lg text-xs gap-2">
                <span className="text-emerald-950 font-bold whitespace-nowrap">Remaining Balance</span>
                <span className={`font-mono font-bold text-sm whitespace-nowrap ${remainingAfter < 0 ? 'text-rose-600' : 'text-emerald-800'}`}>
                  {currSymbol}{fmt(remainingAfter)}
                </span>
              </div>

              <div className="space-y-1 pt-1">
                <div className="flex justify-between items-center text-[11px] font-semibold text-slate-600">
                  <span>Of available PO balance</span>
                  <span className="font-mono font-bold text-slate-800">{calculatedPct.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-teal-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${calculatedAmount > availableBalance ? 'bg-rose-500' : 'bg-[#0d7676]'}`}
                    style={{ width: `${Math.min(100, availableBalance > 0 ? (calculatedAmount / availableBalance) * 100 : 0)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {documents.length > 0 && (
            <div className="border-t border-slate-200 pt-2.5">
              <div className="flex items-center gap-2 text-xs text-slate-800 font-medium bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                <FileText className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <span className="truncate">{documents.length} document{documents.length > 1 ? 's' : ''} attached</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Approval Workflow Card */}
      <div className="bg-white rounded-xl border border-slate-300/90 shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <TrendingUp className="w-4 h-4 text-teal-700" />
            <span className="font-bold text-slate-900 text-xs uppercase tracking-wider whitespace-nowrap">Approval Workflow</span>
          </div>
          {dynamicWorkflow?.slab && (
            <span className="text-[10px] font-bold text-teal-900 bg-teal-100 px-2.5 py-1 rounded-md border border-teal-300 whitespace-nowrap shrink-0" title={dynamicWorkflow.slab}>
              {dynamicWorkflow.slab}
            </span>
          )}
        </div>
        <div className="p-3.5 space-y-2.5">
          {workflowSteps.map((st, i) => (
            <div key={st.step || i} className="flex items-center gap-2.5 text-xs">
              <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-900 text-[11px] font-bold flex items-center justify-center shrink-0 border border-teal-300">
                {st.step || i + 1}
              </div>
              <span className="font-semibold text-slate-800 truncate">
                {formatRoleName(st.roleName || st.title)}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2.5 pt-2 border-t border-slate-200 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold text-emerald-800 whitespace-nowrap">Payment Dispatched</span>
          </div>
        </div>
      </div>

      {/* Info Notice Card */}
      <div className="rounded-xl border border-sky-300 bg-sky-50 p-3 flex gap-2.5 shadow-2xs text-xs">
        <Info className="w-4 h-4 shrink-0 text-sky-700 mt-0.5" />
        <p className="text-sky-950 leading-relaxed font-medium">
          Multi-currency payment requests auto-convert to INR using live FX rates.
        </p>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-16 text-left">
      <div className="mx-auto  space-y-5">

        {/* Unified Header & Stepper Card */}
        <div className="bg-white rounded-xl border border-slate-300/90 shadow-2xs overflow-hidden">
          {/* Top Action Bar Row */}
          <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-slate-200 bg-slate-50/60">
            <div className="flex min-w-0 items-center gap-2 text-xs sm:text-sm text-slate-600 font-semibold">
              <Link to="/p2p/advances" className="hover:text-teal-700 transition-colors flex items-center gap-1 text-slate-700 font-bold shrink-0">
                <ArrowLeft className="w-3.5 h-3.5" />
                Advance Payments
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <h1 className="text-slate-900 font-bold text-sm sm:text-base tracking-tight truncate">New Advance Payment Request</h1>
            </div>

            <button
              onClick={() => navigate('/p2p/advances')}
              className="shrink-0 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all flex items-center gap-1 shadow-2xs whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          </div>

          {/* Stepper Row */}
          <div className="px-6 sm:px-10 py-3.5 bg-slate-50/30">
            <div className="flex items-center justify-between relative">
              <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200" />
              <div
                className="absolute left-8 top-1/2 -translate-y-1/2 h-0.5 bg-teal-700 transition-all duration-500"
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
                    className={`relative z-10 flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all bg-white shadow-2xs ${
                      done
                        ? 'border-teal-700 bg-teal-50 text-teal-900 font-semibold text-xs'
                        : active
                        ? 'border-teal-700 bg-teal-50 text-teal-900 ring-2 ring-teal-600/20 font-bold text-xs'
                        : 'border-slate-300 text-slate-500 hover:border-slate-400 text-xs'
                    } ${step.id < currentStep ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className={`
                      w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors
                      ${done ? 'bg-[#0d7676] text-white' :
                        active ? 'bg-[#0d7676] text-white' :
                          'bg-slate-200 text-slate-600'}
                    `}>
                      {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                    </div>
                    <span className={`hidden sm:block text-xs font-semibold whitespace-nowrap ${done || active ? 'text-teal-950 font-bold' : 'text-slate-600'}`}>
                      {step.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Layout: Steps + Sidebar */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="flex-1 min-w-0 w-full">

            {/* ════ STEP 1: SELECT PO ════ */}
            {currentStep === 1 && (
              <div className="bg-white rounded-xl border border-slate-300/90 shadow-2xs overflow-visible">
                <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center gap-3 rounded-t-xl">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center border border-teal-200 shrink-0">
                    <Building2 className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-sm sm:text-base">Select Purchase Order</h2>
                    <p className="text-xs text-slate-500 font-medium">Search and select the PO to raise an advance against</p>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Purchase Order <span className="text-rose-500">*</span>
                    </label>

                    <div className="relative z-50" ref={poDropdownRef}>
                      <div
                        onClick={() => setIsPoDropdownOpen(!isPoDropdownOpen)}
                        className={`w-full px-3.5 py-2.5 bg-white border rounded-lg flex items-center justify-between cursor-pointer transition-all ${
                          isPoDropdownOpen ? 'border-teal-700 ring-2 ring-teal-500/20' : errors.po ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <Search className="w-4 h-4 text-slate-400 shrink-0" />
                          {selectedPo ? (
                            <div className="flex items-center gap-2 font-sans overflow-hidden text-xs sm:text-sm">
                              <span className="font-mono font-bold text-slate-900 shrink-0">{selectedPo.poNumber}</span>
                              <span className="text-slate-300 font-normal">|</span>
                              <span className="font-bold text-slate-800 truncate">{selectedPo.supplierName}</span>
                              <span className="text-teal-700 font-bold font-mono text-xs shrink-0 whitespace-nowrap">({currSymbol}{fmt(availableBalance)} available)</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500 font-medium">
                              Type PO number or vendor name to search...
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {loadingPos && <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700" />}
                          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isPoDropdownOpen ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      {errors.po && <p className="mt-1 text-xs font-bold text-rose-600">{errors.po}</p>}

                      {/* Floating Dropdown Menu */}
                      {isPoDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-lg shadow-xl z-[100] overflow-hidden">
                          <div className="p-2 border-b border-slate-200 bg-slate-50">
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                              <input
                                type="text"
                                autoFocus
                                placeholder="Type PO number or vendor name..."
                                value={searchPo}
                                onChange={(e) => setSearchPo(e.target.value)}
                                className="w-full pl-8 pr-8 py-1.5 text-xs font-semibold border border-slate-300 rounded bg-white outline-none focus:ring-2 focus:ring-teal-600"
                              />
                              {loadingPos ? (
                                <Loader2 className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-teal-700 animate-spin" />
                              ) : searchPo ? (
                                <button
                                  type="button"
                                  onClick={() => setSearchPo('')}
                                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              ) : null}
                            </div>
                          </div>

                          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                            {loadingPos ? (
                              <div className="p-3 text-center text-xs font-semibold text-slate-500 flex items-center justify-center gap-2">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700" />
                                <span>Loading Purchase Orders...</span>
                              </div>
                            ) : filteredPos.length === 0 ? (
                              <div className="p-3 text-center text-xs font-semibold text-slate-500">
                                No Purchase Orders found matching "{searchPo}".
                              </div>
                            ) : (
                              filteredPos.map((po) => {
                                const isSelected = selectedPo?.poNumber === po.poNumber;
                                const avail = Math.max(0, Number(po.remainingAdvanceAmount) || 0);
                                const sym = getCurrencySymbol(po.currency);
                                return (
                                  <div
                                    key={po.poNumber}
                                    onClick={() => {
                                      handleSelectPo(po);
                                      setIsPoDropdownOpen(false);
                                    }}
                                    className={`p-3 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                                      isSelected ? 'bg-teal-50 text-teal-900 font-bold' : 'hover:bg-slate-50 text-slate-900'
                                    }`}
                                  >
                                    <div className="min-w-0 pr-2">
                                      <div className="font-mono font-bold text-slate-900 text-xs truncate">{po.poNumber}</div>
                                      <div className="text-[11px] text-slate-600 font-medium truncate">{po.supplierName}</div>
                                    </div>
                                    <div className="text-right flex items-center gap-2.5 shrink-0">
                                      <div>
                                        <div className="font-mono font-bold text-slate-900 text-xs whitespace-nowrap">
                                          {sym}{fmt(avail)} available
                                        </div>
                                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                                          {po.status || 'Open'}
                                        </span>
                                      </div>
                                      {isSelected && <Check className="w-4 h-4 text-teal-700 shrink-0" />}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selected PO Card */}
                  {selectedPo && (
                    <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <CheckCircle2 className="w-5 h-5 text-[#0d7676] shrink-0 mt-0.5" />
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-slate-900 text-base whitespace-nowrap">{selectedPo.poNumber}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider whitespace-nowrap bg-emerald-100 text-emerald-800 border border-emerald-300">
                                {selectedPo.status || 'Open'}
                              </span>
                              <span className="text-[10px] font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-mono border border-slate-200 whitespace-nowrap">
                                {poCurrency}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm sm:text-base font-bold text-slate-900">
                                {selectedPo.supplierName}
                              </p>
                              {selectedPo.supplierId && (
                                <span className="text-[11px] font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                                  Code: {selectedPo.supplierId}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Available Advance Balance</p>
                          <p className="font-mono font-bold text-teal-800 text-lg sm:text-xl mt-0.5 whitespace-nowrap">{currSymbol}{fmt(availableBalance)}</p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200/80 grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200">
                          <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">Total PO Amount</span>
                          <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm whitespace-nowrap mt-0.5 block">{currSymbol}{fmt(poValue)}</span>
                        </div>
                        <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200">
                          <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">Advance Paid to Date</span>
                          <span className="font-mono font-bold text-slate-800 text-xs sm:text-sm whitespace-nowrap mt-0.5 block">{currSymbol}{fmt(selectedPo.advancePaid || 0)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="sticky bottom-0 z-20 px-5 py-3 border-t border-slate-200 bg-white flex justify-end">
                  <button
                    onClick={goNext}
                    disabled={!selectedPo}
                    className="h-10 px-5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs sm:text-sm shadow-2xs transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
                  >
                    Continue <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ════ STEP 2: PAYMENT DETAILS ════ */}
            {currentStep === 2 && (
              <div className="bg-white rounded-xl border border-slate-300/90 shadow-2xs overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center border border-teal-200 shrink-0">
                      <IndianRupee className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs sm:text-base">Payment Details ({poCurrency})</h4>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 px-3 py-1 rounded-lg shrink-0 text-xs">
                    <span className="font-bold text-teal-800 uppercase">PO</span>
                    <span className="font-mono font-bold text-slate-900">{selectedPo?.poNumber}</span>
                    <span className="text-teal-300">·</span>
                    <span className="font-mono font-bold text-teal-800 whitespace-nowrap">{currSymbol}{fmt(availableBalance)} {poCurrency}</span>
                  </div>
                </div>

                <div className="p-3 space-y-2">
                  {/* Amount Specification */}
                  <div className="space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                        Advance Amount ({poCurrency}) <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-slate-500 font-semibold mr-0.5">Quick %:</span>
                        {[10, 20, 25, 30, 50].map(pct => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => {
                              setAmountMode('pct');
                              setPctValue(pct.toString());
                              setErrors(p => ({ ...p, amount: null }));
                            }}
                            className={`px-2.5 py-1 rounded-md text-xs font-bold border transition-all ${amountMode === 'pct' && Number(pctValue) === pct
                              ? 'bg-[#0d7676] text-white border-[#0d7676] shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:border-teal-500 hover:bg-teal-50'
                              }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setAmountMode('pct')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${amountMode === 'pct' ? 'bg-[#0d7676] text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                          <Percent className="w-3.5 h-3.5" /> Percentage
                        </button>
                        <button
                          type="button"
                          onClick={() => setAmountMode('amount')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${amountMode === 'amount' ? 'bg-[#0d7676] text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                          <span>{currSymbol}</span> Direct Amount
                        </button>
                      </div>

                      <div className="relative flex-1 min-w-[200px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
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
                          placeholder={amountMode === 'pct' ? 'Enter percentage (e.g. 50)' : 'Enter amount (e.g. 10000)'}
                          className={inp(errors.amount) + ' pl-8 font-mono font-bold text-sm h-10'}
                        />
                      </div>
                    </div>

                    {calculatedAmount > 0 && (
                      <div className="space-y-1.5 pt-1.5 border-t border-slate-200/80">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-700 font-medium">
                            Calculated Advance: <span className="font-mono font-bold text-teal-900">{currSymbol}{fmt(calculatedAmount)} {poCurrency}</span> <span className="text-slate-500 font-normal">({calculatedPct.toFixed(1)}% of PO)</span>
                          </span>
                          <span className="text-slate-500 text-[11px] font-medium">Available: {currSymbol}{fmt(availableBalance)} {poCurrency}</span>
                        </div>
                        {poCurrency !== 'INR' && (
                          <div className="flex items-center justify-between text-xs text-teal-900 bg-teal-50/80 px-3 py-1.5 rounded-lg border border-teal-200 font-semibold">
                            <span>INR Equivalent (at 1 {poCurrency} = ₹{activeFxRate} INR):</span>
                            <span className="font-mono font-bold">₹{fmt(amountINR)} INR</span>
                          </div>
                        )}
                      </div>
                    )}

                    {errors.amount && (
                      <p className="text-xs text-rose-600 font-bold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errors.amount}
                      </p>
                    )}
                  </div>

                  {/* Reason for Advance & Payment Specifications Grid */}
                  <div className="grid lg:grid-cols-2 gap-5 items-start">
                    {/* Left Column: Reason for Advance */}
                    <div className="flex flex-col">
                      <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 whitespace-nowrap">
                        Reason for Advance <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        value={reason}
                        onChange={(e) => { setReason(e.target.value); setErrors(p => ({ ...p, reason: null })); }}
                        rows={2.5}
                        maxLength={500}
                        placeholder="e.g. Vendor requires advance before shipment as per PO terms…"
                        className={inp(errors.reason) + ' resize-none p-2.5 pr-8 text-xs sm:text-sm font-medium leading-normal h-[92px]'}
                      />
                      {errors.reason && (
                        <p className="text-xs text-rose-600 font-bold mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errors.reason}
                        </p>
                      )}
                    </div>

                    {/* Right Column: Payment Specifications */}
                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 whitespace-nowrap">
                          Payment Mode
                        </label>
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

                      {/* 2 Fields in 1 Row */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="min-w-0">
                          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 whitespace-nowrap truncate" title="Bank Name (optional)">
                            Bank Name 
                          </label>
                          <input
                            type="text"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            placeholder="e.g. HDFC / Citi…"
                            className={inp(false) + ' h-9 py-1.5 px-2.5 text-xs font-semibold'}
                          />
                        </div>

                        <div className="min-w-0">
                          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 whitespace-nowrap truncate" title="Advance Adjust (optional)">
                            Advance Adjust 
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                              {currSymbol}
                            </span>
                            <input
                              type="number"
                              min="0"
                              max={calculatedAmount}
                              step="0.01"
                              value={advanceAdjust}
                              onChange={(e) => setAdvanceAdjust(e.target.value)}
                              placeholder="0.00"
                              className={inp(false) + ' h-9 pl-6 pr-2 py-1.5 text-xs font-mono font-bold text-slate-900'}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* GST */}
                  <div className={`rounded-xl border transition-all ${withGst ? 'border-amber-300 bg-amber-50/70' : 'border-slate-200 bg-white'}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setWithGst(prev => !prev);
                        setErrors(prev => ({ ...prev, gst: null }));
                      }}
                      className="w-full flex items-center justify-between px-4 py-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <Banknote className={`w-5 h-5 ${withGst ? 'text-amber-600' : 'text-slate-400'}`} />
                        <div className="text-left">
                          <p className="text-xs font-bold text-slate-900">GST Applicable?</p>
                          <p className="text-[11px] text-slate-500 font-medium">Toggle if this advance includes GST</p>
                        </div>
                      </div>
                      <div className={`w-10 h-6 rounded-full transition-all relative ${withGst ? 'bg-amber-500' : 'bg-slate-300'}`}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${withGst ? 'left-[calc(100%-20px)]' : 'left-1'}`} />
                      </div>
                    </button>
                    {withGst && (
                      <div className="px-4 pb-4 space-y-3 border-t border-amber-200">
                        <div className="flex gap-5 pt-3">
                          {[
                            { v: 'inter', label: 'IGST (Inter-state)' },
                            { v: 'intra', label: 'CGST + SGST (Intra-state)' }
                          ].map(o => (
                            <label key={o.v} className="flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer">
                              <input
                                type="radio"
                                name="gstType"
                                checked={gstType === o.v}
                                onChange={() => setGstType(o.v)}
                                className="w-3.5 h-3.5 text-amber-600"
                              />
                              {o.label}
                            </label>
                          ))}
                        </div>
                        <div className={`grid gap-3 ${gstType === 'intra' ? 'grid-cols-2' : 'grid-cols-1 max-w-[220px]'}`}>
                          {gstType === 'intra' ? (
                            <>
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">CGST %</label>
                                <input
                                  type="number"
                                  min="0.01"
                                  max="100"
                                  step="0.01"
                                  value={cgstPct}
                                  onChange={e => { setCgstPct(e.target.value); setErrors(prev => ({ ...prev, gst: null })); }}
                                  placeholder="9.00"
                                  className={inp(false) + ' font-mono font-bold py-1.5'}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">SGST %</label>
                                <input
                                  type="number"
                                  min="0.01"
                                  max="100"
                                  step="0.01"
                                  value={sgstPct}
                                  onChange={e => { setSgstPct(e.target.value); setErrors(prev => ({ ...prev, gst: null })); }}
                                  placeholder="9.00"
                                  className={inp(false) + ' font-mono font-bold py-1.5'}
                                />
                              </div>
                            </>
                          ) : (
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">IGST %</label>
                              <input
                                type="number"
                                min="0.01"
                                max="100"
                                step="0.01"
                                value={igstPct}
                                onChange={e => { setIgstPct(e.target.value); setErrors(prev => ({ ...prev, gst: null })); }}
                                placeholder="18.00"
                                className={inp(false) + ' font-mono font-bold py-1.5'}
                              />
                            </div>
                          )}
                        </div>
                        {totalGstAmount > 0 && (
                          <div className="flex items-center justify-between text-xs bg-amber-100/80 rounded-lg px-4 py-2 border border-amber-300">
                            <span className="font-bold text-amber-950">Total GST</span>
                            <span className="font-mono font-bold text-amber-800">+{currSymbol}{fmt(totalGstAmount)}</span>
                          </div>
                        )}
                        {errors.gst && (
                          <p className="flex items-center gap-1 text-xs font-bold text-rose-600"><AlertCircle className="h-3.5 w-3.5" />{errors.gst}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="sticky bottom-0 z-20 px-5 py-3 border-t border-slate-200 bg-white flex items-center justify-between">
                  <button
                    onClick={goBack}
                    className="h-10 px-4 rounded-lg border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    onClick={goNext}
                    className="h-10 px-6 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs sm:text-sm shadow-2xs transition-all flex items-center gap-1.5 whitespace-nowrap"
                  >
                    Continue <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ════ STEP 3: DOCUMENTS ════ */}
            {currentStep === 3 && (
              <div className="bg-white rounded-xl border border-slate-300/90 shadow-2xs overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center border border-teal-200 shrink-0">
                    <FileText className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-sm sm:text-base">Supporting Documents</h2>
                    <p className="text-xs text-slate-500 font-medium">Upload at least one document (invoice, quotation, PO copy, etc.)</p>
                  </div>
                  <span className="ml-auto text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full uppercase shrink-0 whitespace-nowrap">
                    Required
                  </span>
                </div>

                <div className="p-5 space-y-4">
                  {errors.docs && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
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

                <div className="sticky bottom-0 z-20 px-5 py-3 border-t border-slate-200 bg-white flex items-center justify-between">
                  <button
                    onClick={goBack}
                    className="h-10 px-4 rounded-lg border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    onClick={goNext}
                    className="h-10 px-6 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs sm:text-sm shadow-2xs transition-all flex items-center gap-1.5 whitespace-nowrap"
                  >
                    Review & Submit <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ════ STEP 4: REVIEW & SUBMIT ════ */}
            {currentStep === 4 && (
              <div className="bg-white rounded-xl border border-slate-300/90 shadow-2xs overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center border border-teal-200 shrink-0">
                    <ShieldCheck className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-sm sm:text-base">Review & Submit</h2>
                    <p className="text-xs text-slate-500 font-medium">Confirm all details before submitting for approval</p>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {/* PO + Vendor */}
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Purchase Order Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      {[
                        { label: 'PO Number', value: selectedPo?.poNumber, mono: true },
                        { label: 'Vendor', value: selectedPo?.supplierName, mono: false },
                        { label: `PO Value (${poCurrency})`, value: `${currSymbol}${fmt(poValue)}`, mono: true },
                        { label: `Available (${poCurrency})`, value: `${currSymbol}${fmt(availableBalance)}`, mono: true, hi: true },
                      ].map(({ label, value, mono, hi }) => (
                        <div key={label} className={`rounded-lg p-3 border ${hi ? 'bg-teal-50 border-teal-300' : 'bg-slate-50 border-slate-200'}`}>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{label}</p>
                          <p className={`text-xs sm:text-sm font-bold mt-0.5 ${mono ? 'font-mono' : ''} ${hi ? 'text-teal-900' : 'text-slate-900'}`}>
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-200" />

                  {/* Payment Details Table */}
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Payment Details ({poCurrency})</p>
                    <div className="rounded-lg border border-slate-300 divide-y divide-slate-200 text-xs overflow-hidden">
                      <div className="flex justify-between px-4 py-2.5 bg-white">
                        <span className="text-slate-700 font-medium">Gross Advance Amount</span>
                        <span className="font-mono font-bold text-slate-900 whitespace-nowrap">{currSymbol}{fmt(calculatedAmount)} <span className="text-slate-500 font-normal">({calculatedPct.toFixed(1)}%)</span></span>
                      </div>
                      {advanceAdjustVal > 0 && (
                        <div className="flex justify-between px-4 py-2.5 bg-amber-50">
                          <span className="text-amber-950 font-bold">Advance Adjust</span>
                          <span className="font-mono font-bold text-amber-900 whitespace-nowrap">-{currSymbol}{fmt(advanceAdjustVal)}</span>
                        </div>
                      )}
                      {poCurrency !== 'INR' && (
                        <div className="flex justify-between px-4 py-2.5 bg-teal-50">
                          <span className="text-teal-950 font-bold">INR Equivalent (Rate: 1 {poCurrency} = ₹{activeFxRate})</span>
                          <span className="font-mono font-bold text-teal-950 whitespace-nowrap">₹{fmt(amountINR)} INR</span>
                        </div>
                      )}
                      {withGst && (
                        <>
                          <div className="flex justify-between px-4 py-2.5 bg-amber-50">
                            <span className="text-slate-700 font-bold">GST Breakdown</span>
                            <span className="font-mono font-bold text-amber-800 whitespace-nowrap">+{currSymbol}{fmt(totalGstAmount)}</span>
                          </div>
                          <div className="flex justify-between px-4 py-2.5 bg-slate-50">
                            <span className="font-bold text-slate-900">Grand Total</span>
                            <span className="font-mono font-bold text-slate-900 whitespace-nowrap">{currSymbol}{fmt(grandTotal)}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between px-4 py-2.5 bg-white">
                        <span className="text-slate-700 font-medium">Remaining Balance</span>
                        <span className={`font-mono font-bold whitespace-nowrap ${remainingAfter < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {currSymbol}{fmt(remainingAfter)}
                        </span>
                      </div>
                      <div className="flex justify-between px-4 py-2.5 bg-slate-50">
                        <span className="text-slate-700 font-medium">Payment Mode</span>
                        <span className="font-bold text-slate-900 whitespace-nowrap">{paymentMode}</span>
                      </div>
                    </div>
                  </div>

                  {/* Reason */}
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Reason for Advance</p>
                    <p className="text-xs sm:text-sm font-medium text-slate-900 bg-slate-50 rounded-lg p-3 border border-slate-200 leading-relaxed">
                      {reason}
                    </p>
                  </div>

                  {/* Documents */}
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Attached Documents ({documents.length})</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {documents.map((d, i) => (
                        <span key={i} className="flex items-center gap-1.5 bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-slate-900 font-semibold shadow-2xs">
                          <FileText className="w-3.5 h-3.5 text-teal-700 shrink-0" /> <span className="truncate max-w-[200px]">{d.name}</span>
                        </span>
                      ))}
                      {documents.length === 0 && (
                        <span className="text-slate-500 italic">No documents attached</span>
                      )}
                    </div>
                  </div>

                  {/* Approval chain */}
                  <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-4 space-y-2.5 text-xs">
                    <p className="font-bold text-teal-900 uppercase tracking-wider">
                      Approval Chain {dynamicWorkflow?.slab ? `(${dynamicWorkflow.slab})` : ''}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {workflowSteps.map((st, i) => (
                        <React.Fragment key={st.step || i}>
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold text-teal-900 bg-teal-100 border-teal-300 whitespace-nowrap">
                            <Clock className="w-3.5 h-3.5 text-teal-700 shrink-0" /> {formatRoleName(st.roleName || st.title)}
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </React.Fragment>
                      ))}
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold text-emerald-900 bg-emerald-100 border-emerald-300 whitespace-nowrap">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" /> Payment Released
                      </div>
                    </div>
                  </div>
                </div>

                <div className="sticky bottom-0 z-20 px-5 py-3 border-t border-slate-200 bg-white flex items-center justify-between">
                  <button
                    onClick={goBack}
                    className="h-10 px-4 rounded-lg border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    disabled={saving}
                    onClick={handleSubmit}
                    className="h-10 px-6 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs sm:text-sm shadow-2xs transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
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
    </div>
  );
}
