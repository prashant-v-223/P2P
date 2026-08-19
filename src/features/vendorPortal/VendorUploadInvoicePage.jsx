import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Link, useParams } from 'react-router-dom';
import { useVendor } from './vendorContext';
import { useToast } from '../../components/ui/toast';
import { apiFetch } from '../../services/api';
import {
  CloudUpload, FileText, CheckCircle2, AlertCircle, X, Search, ChevronDown, Check,
  Calculator, Info, ArrowLeft, ShieldCheck, Banknote, Sparkles, Building2, Calendar,
  Receipt, DollarSign, ChevronRight, Loader2, Lock, ExternalLink, Pencil, Eye
} from 'lucide-react';
import { CustomSelect } from '../../components/ui/custom-select';
import { CustomDatePicker } from '../../components/ui/custom-date-picker';
import { CustomFileUpload } from '../../components/ui/custom-file-upload';
import { formatCurrency } from '../../utils/formatCurrency';

const parseDaysFromPaymentTerms = (termsStr, fallbackDays = 30) => {
  if (!termsStr && termsStr !== 0) return fallbackDays;
  const str = String(termsStr).trim();
  const match = str.match(/\d+/);
  if (match) {
    const parsed = parseInt(match[0], 10);
    if (!isNaN(parsed) && parsed >= 0) return parsed;
  }
  if (str.toLowerCase().includes('immediate')) return 0;
  return fallbackDays;
};

const getLocalISODate = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
};

const resolveDocumentHref = (doc) => {
  const url = doc?.fileUrl || doc?.url || doc?.fileName || '';
  if (!url) return '#';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/uploads/')) {
    return url;
  }
  const token = (typeof window !== 'undefined' && (
    localStorage.getItem('rayzon_vendor_token') ||
    localStorage.getItem('rayzon_access_token') ||
    localStorage.getItem('rayzon_token')
  )) || '';
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
  return `/api/documents/resolve-url?fileUrl=${encodeURIComponent(url)}&redirect=true${tokenParam}`;
};

export default function VendorUploadInvoicePage({ mode: propMode }) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const isViewMode = propMode === 'view' || location.pathname.includes('/view/');
  const isEditMode = propMode === 'edit' || location.pathname.includes('/edit/') || Boolean(id && !isViewMode);
  const isCreateMode = !id && !isViewMode && !isEditMode;

  const { vendorProfile, purchaseOrders, invoices, addInvoice, updateInvoice } = useVendor();
  const { showToast } = useToast();

  const initialPO = location.state?.selectedPO || '';

  const [loadingInvoice, setLoadingInvoice] = useState(Boolean(id));
  const [existingInvoiceObj, setExistingInvoiceObj] = useState(null);

  const [poNumber, setPoNumber] = useState(initialPO);
  const [poSearch, setPoSearch] = useState('');
  const [isPoOpen, setIsPoOpen] = useState(false);
  const poContainerRef = useRef(null);

  const [apiSearchResults, setApiSearchResults] = useState([]);

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [duplicateError, setDuplicateError] = useState('');
  const [checkingUnique, setCheckingUnique] = useState(false);
  const isImportVendor = String(vendorProfile?.vendorType || '').trim().toLowerCase().includes('import');
  const [asnNumber, setAsnNumber] = useState('');
  const [blNumber, setBlNumber] = useState('');
  const [blDate, setBlDate] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [dueDays, setDueDays] = useState(initialPO ? 30 : '');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceQuantity, setInvoiceQuantity] = useState('');
  const [remarks, setRemarks] = useState('');

  // GST & Tax State
  const [invoiceType, setInvoiceType] = useState('With GST');
  const [gstSubtype, setGstSubtype] = useState('intra'); // 'intra' (CGST+SGST) | 'inter' (IGST)
  const [cgstAmount, setCgstAmount] = useState('0');
  const [sgstAmount, setSgstAmount] = useState('0');
  const [igstAmount, setIgstAmount] = useState('0');
  const [tdsPercentage, setTdsPercentage] = useState('0%');
  const [advanceAdjust, setAdvanceAdjust] = useState('');

  // File & Form state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Load existing invoice data if in Edit or View mode
  useEffect(() => {
    if (!id) return;
    let active = true;
    const fetchInvoiceDetails = async () => {
      try {
        setLoadingInvoice(true);
        const localInv = (invoices || []).find(i =>
          String(i.id) === String(id) ||
          String(i.invoicePaymentId) === String(id) ||
          String(i.invoiceNumber) === String(id)
        );
        let fetchedData = localInv?.rawInvoice || localInv;

        try {
          const res = await apiFetch(`/api/p2p/invoices/${encodeURIComponent(id)}`);
          const json = await res.json();
          if (res.ok && json.data) {
            fetchedData = json.data;
          }
        } catch (_) {}

        if (active && fetchedData) {
          setExistingInvoiceObj(fetchedData);
          setPoNumber(fetchedData.sapPoNumber || fetchedData.poId || fetchedData.poNumber || '');
          setInvoiceNumber(fetchedData.invoiceNumber || '');
          setAsnNumber(fetchedData.asnNumber || '');
          setBlNumber(fetchedData.blNumber || '');

          let bDate = '';
          if (fetchedData.blDate) {
            try { bDate = new Date(fetchedData.blDate).toISOString().split('T')[0]; } catch (_) {}
          }
          setBlDate(bDate);

          let iDate = '';
          if (fetchedData.invoiceDate) {
            try { iDate = new Date(fetchedData.invoiceDate).toISOString().split('T')[0]; } catch (_) {}
          }
          setInvoiceDate(iDate);

          setCurrency(fetchedData.currency || 'INR');
          setDueDays(fetchedData.dueDays || parseDaysFromPaymentTerms(vendorProfile?.paymentTerms, 30));
          setInvoiceAmount(String(fetchedData.grossAmount || fetchedData.invoiceAmount || ''));
          if (fetchedData.threeWayMatch?.invoiceQuantity || fetchedData.invoiceQuantity) {
            setInvoiceQuantity(String(fetchedData.threeWayMatch?.invoiceQuantity || fetchedData.invoiceQuantity));
          }
          setRemarks(fetchedData.remarks || '');
          setInvoiceType(fetchedData.invoiceType || 'With GST');
          setGstSubtype(fetchedData.gstSubtype || (fetchedData.igstAmount > 0 ? 'inter' : 'intra'));
          setCgstAmount(String(fetchedData.cgstAmount || '0'));
          setSgstAmount(String(fetchedData.sgstAmount || '0'));
          setIgstAmount(String(fetchedData.igstAmount || '0'));
          setTdsPercentage(`${fetchedData.tdsPercentage || 0}%`);
          setAdvanceAdjust(String(fetchedData.advanceAdjusted || fetchedData.advanceAdjust || '0'));

          if (Array.isArray(fetchedData.supportingDocuments)) {
            setSelectedFiles(fetchedData.supportingDocuments.map(d => ({
              name: d.originalName || d.fileName || 'Document.pdf',
              originalName: d.originalName || d.fileName,
              fileName: d.fileName || d.s3Key,
              s3Key: d.s3Key || d.fileName,
              fileUrl: d.fileUrl || d.url,
              size: d.size || d.fileSize || 1024,
              type: d.mimeType || 'application/pdf',
              uploaded: true
            })));
          }
        }
      } catch (err) {
        console.error('Fetch invoice details error:', err);
      } finally {
        if (active) setLoadingInvoice(false);
      }
    };
    fetchInvoiceDetails();
    return () => { active = false; };
  }, [id, invoices, vendorProfile]);

  // Live Invoice Number Uniqueness Validation
  useEffect(() => {
    if (isViewMode) return;
    const invNo = invoiceNumber.trim();
    if (!invNo || (existingInvoiceObj && invNo === existingInvoiceObj.invoiceNumber) || invNo.length < 3) {
      setDuplicateError('');
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setCheckingUnique(true);
        const queryId = id ? `&currentId=${encodeURIComponent(id)}` : '';
        const res = await apiFetch(`/api/p2p/invoices/check-unique?invoiceNumber=${encodeURIComponent(invNo)}${queryId}`);
        const data = await res.json();
        if (res.ok && !data.unique) {
          setDuplicateError(data.error || `Invoice Number "${invNo}" already exists in the system.`);
        } else {
          setDuplicateError('');
        }
      } catch (err) {
        setDuplicateError('');
      } finally {
        setCheckingUnique(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [invoiceNumber, id, existingInvoiceObj, isViewMode]);

  useEffect(() => {
    const handleOutside = (e) => {
      if (poContainerRef.current && !poContainerRef.current.contains(e.target)) {
        setIsPoOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Live backend PO search whenever vendor types in search box
  useEffect(() => {
    if (!isPoOpen || isViewMode) return;
    const q = poSearch.trim();
    if (!q || q.length < 2) {
      setApiSearchResults([]);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/p2p/purchase-orders?q=${encodeURIComponent(q)}&size=20`);
        const data = await res.json();
        if (active && data.data?.length) {
          const formatted = data.data.map(p => ({
            id: p.sapPoNumber || p.poNumber,
            poNumber: p.poNumber,
            sapPoNumber: p.sapPoNumber,
            date: p.documentDate ? new Date(p.documentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Open',
            amount: formatCurrency(p.totalAmount, p.currency || 'INR'),
            status: p.status || 'Open',
            currency: p.currency || 'INR',
            paymentTerms: p.paymentTerms || p.creditDays || '',
            creditDays: p.creditDays || p.paymentTerms || '',
            numericAmount: p.totalAmount || 0,
            remainingInvoiceAmount: p.remainingInvoiceAmount,
            remainingQuantity: p.remainingQuantity,
            totalQuantity: p.totalQuantity
          }));
          setApiSearchResults(formatted);
        }
      } catch (e) {}
    }, 150);
    return () => { active = false; clearTimeout(timer); };
  }, [poSearch, isPoOpen, isViewMode]);

  const combinedPOs = useMemo(() => {
    const map = new Map();
    (purchaseOrders || []).forEach(p => {
      const mainKey = String(p.sapPoNumber || p.poNumber || p.id || '').toLowerCase();
      if (mainKey) map.set(mainKey, p);
      if (p.id) map.set(String(p.id).toLowerCase(), p);
      if (p.poNumber) map.set(String(p.poNumber).toLowerCase(), p);
      if (p.sapPoNumber) map.set(String(p.sapPoNumber).toLowerCase(), p);
    });
    (apiSearchResults || []).forEach(p => {
      const mainKey = String(p.sapPoNumber || p.poNumber || p.id || '').toLowerCase();
      if (mainKey) map.set(mainKey, p);
      if (p.id) map.set(String(p.id).toLowerCase(), p);
      if (p.poNumber) map.set(String(p.poNumber).toLowerCase(), p);
      if (p.sapPoNumber) map.set(String(p.sapPoNumber).toLowerCase(), p);
    });
    return Array.from(map.values());
  }, [purchaseOrders, apiSearchResults]);

  const filteredPOs = useMemo(() => {
    const q = poSearch.trim().toLowerCase();
    if (!q) return combinedPOs;
    return combinedPOs.filter((po) => {
      return (
        String(po.id || '').toLowerCase().includes(q) ||
        String(po.poNumber || '').toLowerCase().includes(q) ||
        String(po.sapPoNumber || '').toLowerCase().includes(q) ||
        String(po.amount || '').toLowerCase().includes(q) ||
        String(po.date || '').toLowerCase().includes(q) ||
        String(po.status || '').toLowerCase().includes(q)
      );
    });
  }, [combinedPOs, poSearch]);

  const selectedPOObj = useMemo(() => {
    if (!poNumber) return null;
    const target = String(poNumber).trim().toLowerCase();
    return combinedPOs.find((p) => 
      String(p.id || '').toLowerCase() === target ||
      String(p.poNumber || '').toLowerCase() === target ||
      String(p.sapPoNumber || '').toLowerCase() === target
    ) || null;
  }, [combinedPOs, poNumber]);

  useEffect(() => {
    if (!isImportVendor || isViewMode || isEditMode) return;
    const year = new Date().getFullYear();
    const currentMax = (invoices || []).reduce((max, invoice) => {
      const match = String(invoice.asnNumber || '').match(new RegExp(`^ASN-${year}-(\\d+)$`));
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0);
    setAsnNumber(`ASN-${year}-${String(currentMax + 1).padStart(3, '0')}`);
  }, [isImportVendor, invoices, isViewMode, isEditMode]);

  // Auto-set Payment Credit Days based on Vendor / PO Payment Terms
  useEffect(() => {
    if (isViewMode) return;
    if (poNumber) {
      const terms = selectedPOObj?.paymentTerms || selectedPOObj?.creditDays || vendorProfile?.paymentTerms || vendorProfile?.creditDays;
      const parsedDays = parseDaysFromPaymentTerms(terms, 30);
      setDueDays(parsedDays);
    } else if (!id && !initialPO) {
      setDueDays('');
    }
  }, [poNumber, selectedPOObj, vendorProfile, isViewMode, id, initialPO]);

  const calculateDueDateISO = () => {
    if (!invoiceDate || dueDays === '' || dueDays === null || dueDays === undefined) return null;
    const d = new Date(`${invoiceDate}T00:00:00`);
    d.setDate(d.getDate() + Number(dueDays || 0));
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  };

  const calculateDueDate = () => {
    if (!poNumber) return 'Select Purchase Order';
    if (!invoiceDate) return 'Select Supplier Invoice Date';
    const iso = calculateDueDateISO();
    if (!iso) return 'Select Supplier Invoice Date';
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  // Financial Calculations
  const invoiceAmountNum = Number(invoiceAmount) || 0;
  const cgstNum = invoiceType === 'With GST' && gstSubtype === 'intra' ? (Number(cgstAmount) || 0) : 0;
  const sgstNum = invoiceType === 'With GST' && gstSubtype === 'intra' ? (Number(sgstAmount) || 0) : 0;
  const igstNum = invoiceType === 'With GST' && gstSubtype === 'inter' ? (Number(igstAmount) || 0) : 0;
  const totalGst = cgstNum + sgstNum + igstNum;
  const grossTotal = invoiceAmountNum + totalGst;
  const tdsPctNum = parseFloat(tdsPercentage) || 0;
  const tdsDeduction = (invoiceAmountNum * tdsPctNum) / 100;
  const advanceAdjNum = Number(advanceAdjust) || 0;
  const netPayable = Math.max(0, grossTotal - advanceAdjNum);

  // Apply GST rate presets
  const applyGstPresetRate = (ratePercent) => {
    if (isViewMode) return;
    if (!invoiceAmountNum || invoiceAmountNum <= 0) {
      showToast({ title: 'Enter Base Amount', description: 'Please enter invoice base amount first.', type: 'info' });
      return;
    }
    const totalTax = (invoiceAmountNum * ratePercent) / 100;
    if (gstSubtype === 'intra') {
      const half = (totalTax / 2).toFixed(2);
      setCgstAmount(half);
      setSgstAmount(half);
      setIgstAmount('0');
    } else {
      setIgstAmount(totalTax.toFixed(2));
      setCgstAmount('0');
      setSgstAmount('0');
    }
    showToast({
      title: `${ratePercent}% GST Applied`,
      description: `Calculated ${gstSubtype === 'intra' ? 'CGST & SGST' : 'IGST'} on ${currency} ${invoiceAmountNum.toLocaleString('en-IN')}`,
      type: 'success'
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isViewMode) return;

    if (!poNumber) {
      const msg = 'Please select a Purchase Order to continue.';
      setErrorMsg(msg);
      showToast({ title: 'Purchase Order Required', description: msg, type: 'error' });
      return;
    }
    if (!invoiceNumber.trim()) {
      const msg = 'Invoice Number is required. Please enter your vendor invoice number.';
      setErrorMsg(msg);
      showToast({ title: 'Invoice Number Required', description: msg, type: 'error' });
      return;
    }
    if (duplicateError) {
      setErrorMsg(duplicateError);
      showToast({ title: 'Duplicate Invoice Number', description: duplicateError, type: 'error' });
      return;
    }
    if (!invoiceDate) {
      const msg = 'Invoice Date is required.';
      setErrorMsg(msg);
      showToast({ title: 'Invoice Date Required', description: msg, type: 'error' });
      return;
    }
    if (invoiceDate > getLocalISODate()) {
      const msg = 'Invoice date cannot be in the future.';
      setErrorMsg(msg);
      showToast({ title: 'Invalid Invoice Date', description: msg, type: 'error' });
      return;
    }
    if (!invoiceAmount || Number(invoiceAmount) <= 0) {
      const msg = 'Please enter a valid positive invoice amount.';
      setErrorMsg(msg);
      showToast({ title: 'Invoice Amount Required', description: msg, type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode && id) {
        await updateInvoice(id, {
          poNumber,
          invoiceNumber: invoiceNumber.trim(),
          asnNumber: asnNumber.trim(),
          blNumber: blNumber.trim(),
          blDate: blDate || undefined,
          invoiceDate,
          currency,
          dueDays,
          paymentDueDate: calculateDueDateISO(),
          invoiceAmount,
          invoiceQuantity: Number(invoiceQuantity) || undefined,
          remarks: remarks.trim(),
          invoiceType,
          gstSubtype,
          cgstAmount: cgstNum.toString(),
          sgstAmount: sgstNum.toString(),
          igstAmount: igstNum.toString(),
          tdsPercentage,
          advanceAdjust,
          supportingDocuments: (selectedFiles || []).map((file) => ({
            fileName: file.s3Key || file.fileName || file.name,
            originalName: file.originalName || file.name,
            fileUrl: file.fileUrl || file.url || '',
            size: file.size || file.fileSize || 1024,
            mimeType: file.type || file.mimeType || 'application/pdf'
          }))
        });
        setIsSubmitting(false);
        showToast({ title: 'Invoice Updated', description: `Invoice "${invoiceNumber}" saved successfully.`, type: 'success' });
        navigate('/vendor/invoices');
      } else {
        const createdInvoice = await addInvoice({
          poNumber,
          invoiceNumber: invoiceNumber.trim(),
          asnNumber: asnNumber.trim(),
          blNumber: blNumber.trim(),
          blDate: blDate || undefined,
          invoiceDate,
          currency,
          dueDays,
          paymentDueDate: calculateDueDateISO(),
          invoiceAmount,
          invoiceQuantity: Number(invoiceQuantity) || undefined,
          remarks: remarks.trim(),
          invoiceType,
          cgstAmount: cgstNum.toString(),
          sgstAmount: sgstNum.toString(),
          igstAmount: igstNum.toString(),
          tdsPercentage,
          advanceAdjust,
          fileName: selectedFiles[0]?.name || selectedFiles[0]?.fileName || 'Invoice.pdf',
          supportingDocuments: (selectedFiles || []).map((file) => ({
            fileName: file.s3Key || file.fileName || file.name,
            originalName: file.originalName || file.name,
            fileUrl: file.fileUrl || file.url || '',
            size: file.size || file.fileSize || 1024,
            mimeType: file.type || file.mimeType || 'application/pdf'
          }))
        });
        if (createdInvoice?.asnNumber) setAsnNumber(createdInvoice.asnNumber);
        setIsSubmitting(false);
        setShowSuccessModal(true);
      }
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Invoice submission failed.');
      showToast({ title: 'Submission Error', description: err.message || 'Failed to submit invoice.', type: 'error' });
    }
  };

  if (loadingInvoice) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-500 text-xs font-semibold gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-[#0d7676]" />
        <span>Loading invoice entry details...</span>
      </div>
    );
  }

  return (
    <div className="font-sans max-w-6xl mx-auto pb-16 antialiased text-left space-y-6">
      {/* Top Header Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
            <Link to="/vendor/invoices" className="hover:text-[#0d7676] transition-colors">Invoices</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-700 font-bold">
              {isViewMode ? 'Invoice Entry Details' : isEditMode ? 'Edit Invoice Entry' : 'New Invoice Entry'}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            {isViewMode ? <Eye className="w-6 h-6 text-[#0d7676]" /> : isEditMode ? <Pencil className="w-6 h-6 text-[#0d7676]" /> : <Receipt className="w-6 h-6 text-[#0d7676]" />}
            {isViewMode ? 'View Submitted Invoice' : isEditMode ? 'Edit & Resubmit Invoice' : 'Upload & Submit Invoice'}
            {isViewMode && (
              <span className="ml-2 px-2.5 py-0.5 text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200 rounded-full uppercase tracking-wider">
                Read-Only Entry
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {isViewMode
              ? `Inspecting complete submitted invoice details against Purchase Order ${poNumber || ''}.`
              : isEditMode
              ? 'Update invoice details and resubmit for 3-Way Match validation & Purchase Manager approval.'
              : 'Submit your invoice against an open Purchase Order for 3-Way Match validation & Purchase Manager approval.'}
          </p>
        </div>

        {/* Right Vendor Badge & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs self-start sm:self-auto">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-[#0d7676] font-black text-xs flex items-center justify-center">
              {vendorProfile?.companyName ? vendorProfile.companyName.slice(0, 2).toUpperCase() : 'VN'}
            </div>
            <div className="text-left pr-2">
              <span className="block text-[10px] font-extrabold uppercase text-slate-400">Vendor Account</span>
              <span className="block text-xs font-bold text-slate-900 truncate max-w-[180px]">
                {vendorProfile?.companyName || 'Vendor Company'}
              </span>
              <span className="block text-[10px] font-mono font-semibold text-[#0d7676]">
                Code: {vendorProfile?.sapVendorCode || '30000111'}
              </span>
            </div>
          </div>

          {isViewMode && ['pending', 'in progress', 'in_progress', 'draft'].includes(String(existingInvoiceObj?.status || '').toLowerCase()) && (
            <Link
              to={`/vendor/invoices/edit/${encodeURIComponent(id)}`}
              className="px-4 py-2 bg-[#0d7676] hover:bg-[#0f766e] text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <Pencil className="w-4 h-4" />
              <span>Edit Invoice</span>
            </Link>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in-50">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg('')} className="text-rose-400 hover:text-rose-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">

        {/* SECTION 1: SELECT PURCHASE ORDER */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#0d7676] text-white font-extrabold text-xs flex items-center justify-center">1</span>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                SELECT PURCHASE ORDER
              </h2>
            </div>
            {selectedPOObj && (
              <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Open PO Verified
              </span>
            )}
          </div>

          <div className="space-y-1.5" ref={poContainerRef}>
            <label className="block text-xs font-semibold text-slate-700">
              Purchase Order Number <span className="text-rose-500">*</span>
            </label>

            <div className="relative">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  disabled={isViewMode}
                  readOnly={isViewMode}
                  value={isPoOpen ? poSearch : (selectedPOObj ? `${selectedPOObj.id || selectedPOObj.sapPoNumber || selectedPOObj.poNumber} — ${selectedPOObj.amount}` : (poNumber || poSearch))}
                  onFocus={() => {
                    if (isViewMode) return;
                    setIsPoOpen(true);
                    setPoSearch(poNumber || '');
                  }}
                  onChange={(e) => {
                    if (isViewMode) return;
                    setPoSearch(e.target.value);
                    setIsPoOpen(true);
                    setErrorMsg('');
                  }}
                  placeholder="Type PO number or amount to search (e.g. 4300001510)..."
                  className={`w-full pl-10 pr-20 py-2.5 border rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] transition-all shadow-2xs ${
                    isViewMode ? 'bg-slate-100 cursor-not-allowed text-slate-600 border-slate-200' : 'bg-slate-50 border-slate-200 focus:bg-white'
                  }`}
                />

                {!isViewMode && (
                  <div className="absolute right-2.5 flex items-center gap-1">
                    {poNumber && (
                      <button
                        type="button"
                        onClick={() => {
                          setPoNumber('');
                          setPoSearch('');
                          setIsPoOpen(false);
                          setDueDays('');
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Clear selection"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (!isPoOpen) setPoSearch(poNumber || '');
                        setIsPoOpen(!isPoOpen);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${isPoOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                )}
              </div>

              {/* Floating Dropdown List */}
              {isPoOpen && !isViewMode && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-64 overflow-y-auto divide-y divide-slate-100 animate-in fade-in-50">
                  {filteredPOs.length === 0 ? (
                    <div className="p-4 text-center space-y-1">
                      <p className="text-xs text-slate-600 font-semibold">
                        No pre-registered open PO found matching "{poSearch}"
                      </p>
                      <p className="text-[11px] text-slate-400">Only registered active purchase orders can be selected.</p>
                    </div>
                  ) : (
                    filteredPOs.map((po) => {
                      const poVal = po.id || po.sapPoNumber || po.poNumber;
                      const isSelected = String(poVal).toLowerCase() === String(poNumber).toLowerCase();
                      return (
                        <div
                          key={poVal}
                          onClick={() => {
                            setPoNumber(poVal);
                            setPoSearch(String(poVal));
                            setIsPoOpen(false);
                            setErrorMsg('');
                            if (po.currency) setCurrency(po.currency);
                            const terms = po.paymentTerms || po.creditDays || vendorProfile?.paymentTerms || vendorProfile?.creditDays;
                            if (terms) {
                              setDueDays(parseDaysFromPaymentTerms(terms, 30));
                            }
                          }}
                          className={`p-3 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                            isSelected ? 'bg-teal-50/90 text-[#0d7676] font-bold' : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div>
                            <div className="font-mono font-bold text-xs text-slate-900">{po.id}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">Document Date: {po.date}</div>
                          </div>

                          <div className="text-right flex items-center gap-3">
                            <div>
                              <div className="font-mono font-bold text-slate-900">{po.amount}</div>
                              <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-sky-50 text-sky-700 border border-sky-200">
                                {po.status}
                              </span>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-[#0d7676] shrink-0" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Active Selected PO Summary Card */}
            {(selectedPOObj || poNumber) && (
              <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mt-3 shadow-2xs">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold text-[#0d7676] uppercase tracking-wider block">Selected PO Number</span>
                  <div className="font-mono font-bold text-slate-900 text-sm">{poNumber}</div>
                  <span className="text-[10px] text-slate-500 font-medium">Issue Date: {selectedPOObj?.date || 'Registered'}</span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Total PO Value</span>
                  <div className="font-mono font-bold text-slate-900 text-sm">{selectedPOObj?.amount || `${currency} ${Number(invoiceAmount || 0).toLocaleString('en-IN')}`}</div>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full inline-block border border-emerald-200">
                    Status: {selectedPOObj?.status || 'Open'}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold text-[#0d7676] uppercase tracking-wider block">Remaining Invoice Balance</span>
                  <div className="font-mono font-extrabold text-[#0d7676] text-sm">
                    {selectedPOObj?.currency || currency} {Number(selectedPOObj?.remainingInvoiceAmount ?? selectedPOObj?.numericAmount ?? 0).toLocaleString('en-IN')}
                  </div>
                  {Number(selectedPOObj?.remainingQuantity) > 0 && (
                    <span className="text-[10px] text-slate-500 font-semibold block">
                      Remaining Qty: {selectedPOObj.remainingQuantity} units
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: INVOICE DETAILS */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <span className="w-6 h-6 rounded-full bg-[#0d7676] text-white font-extrabold text-xs flex items-center justify-center">2</span>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              INVOICE & DELIVERY DETAILS
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Invoice Number */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Invoice Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                disabled={isViewMode}
                readOnly={isViewMode}
                value={invoiceNumber}
                onChange={(e) => {
                  setInvoiceNumber(e.target.value);
                  setDuplicateError('');
                  setErrorMsg('');
                }}
                placeholder="Enter vendor invoice number (e.g. INV/2026/001)"
                className={`w-full px-3.5 py-2.5 border rounded-xl text-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0d7676] ${
                  isViewMode ? 'bg-slate-100 cursor-not-allowed text-slate-700 border-slate-200' : duplicateError ? 'border-rose-400 focus:ring-rose-500 bg-slate-50' : 'bg-slate-50 border-slate-200 focus:bg-white'
                }`}
              />
              {checkingUnique && (
                <p className="text-[10px] text-teal-600 font-medium flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Checking invoice number uniqueness...
                </p>
              )}
              {duplicateError && (
                <p className="text-[11px] text-rose-600 font-bold mt-0.5">❌ {duplicateError}</p>
              )}
            </div>

            {/* Sequential ASN Number */}
            {isImportVendor && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  ASN Number (Advance Shipping Notice) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={asnNumber}
                  readOnly
                  aria-readonly="true"
                  placeholder={`ASN-${new Date().getFullYear()}-001`}
                  className="w-full px-3.5 py-2.5 bg-amber-50/50 border border-amber-200 rounded-xl text-amber-900 text-xs font-mono font-bold cursor-not-allowed"
                />
                <p className="text-[10px] text-amber-700 font-medium">Auto-generated import ASN tracking number</p>
              </div>
            )}

            <CustomDatePicker
              label="BL Date (Bill of Lading Date)"
              disabled={isViewMode}
              value={blDate}
              onChange={(val) => setBlDate(val)}
            />

            {/* Invoice Date */}
            <CustomDatePicker
              label="Invoice Date"
              required
              disabled={isViewMode}
              max={getLocalISODate()}
              value={invoiceDate}
              onChange={(val) => {
                setInvoiceDate(val);
                setErrorMsg('');
              }}
            />

            {/* Currency */}
            <CustomSelect
              label="Currency"
              required
              disabled={isViewMode}
              value={currency}
              onChange={(val) => setCurrency(val)}
              options={[
                { label: 'INR — Indian Rupee', value: 'INR' },
                { label: 'USD — US Dollar', value: 'USD' },
                { label: 'EUR — Euro', value: 'EUR' }
              ]}
              placeholder="Select currency"
            />

            {/* Net Days */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Payment Credit Days (Net Days) <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" /> Locked
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={dueDays !== '' && dueDays !== null && dueDays !== undefined ? dueDays : ''}
                  readOnly
                  aria-readonly="true"
                  placeholder="Select PO to display credit days"
                  className="w-full px-3.5 py-2.5 bg-slate-100/90 border border-slate-200 rounded-xl text-slate-800 text-xs font-bold font-mono cursor-not-allowed select-none"
                />
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                {poNumber && dueDays !== '' ? (
                  `Auto-set to ${dueDays} days based on Payment Terms (${selectedPOObj?.paymentTerms || vendorProfile?.paymentTerms || `${dueDays} Days`}).`
                ) : (
                  'Select a Purchase Order to view Payment Credit Days.'
                )}
              </p>
            </div>

            {/* Calculated Payment Due Date */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Calculated Payment Due Date
              </label>
              <input
                type="text"
                readOnly
                value={calculateDueDate()}
                className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-xs font-bold font-mono cursor-not-allowed"
              />
              <p className="text-[10px] text-[#0d7676] font-semibold">
                {dueDays !== '' ? (
                  `Auto-computed: Invoice Date (${invoiceDate || 'Selected'}) + ${dueDays} days`
                ) : (
                  'Select a Purchase Order to compute due date'
                )}
              </p>
            </div>

            {/* Base Invoice Amount */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Base Invoice Amount ({currency}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                disabled={isViewMode}
                readOnly={isViewMode}
                value={invoiceAmount}
                onChange={(e) => {
                  setInvoiceAmount(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="0.00"
                className={`w-full px-3.5 py-2.5 border rounded-xl text-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0d7676] ${
                  isViewMode ? 'bg-slate-100 cursor-not-allowed text-slate-700 border-slate-200' : 'bg-slate-50 border-slate-200 focus:bg-white'
                }`}
              />
            </div>

            {/* Delivered Quantity */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Delivered Quantity
              </label>
              <input
                type="number"
                disabled={isViewMode}
                readOnly={isViewMode}
                value={invoiceQuantity}
                onChange={(e) => setInvoiceQuantity(e.target.value)}
                placeholder="Enter quantity delivered"
                className={`w-full px-3.5 py-2.5 border rounded-xl text-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0d7676] ${
                  isViewMode ? 'bg-slate-100 cursor-not-allowed text-slate-700 border-slate-200' : 'bg-slate-50 border-slate-200 focus:bg-white'
                }`}
              />
            </div>

            {/* Remarks */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                Remarks & Item Descriptions
              </label>
              <textarea
                rows={2}
                disabled={isViewMode}
                readOnly={isViewMode}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add special notes, delivery batch details, or payment terms notes..."
                className={`w-full p-3 border rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] ${
                  isViewMode ? 'bg-slate-100 cursor-not-allowed text-slate-700 border-slate-200' : 'bg-slate-50 border-slate-200 focus:bg-white'
                }`}
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: FINANCIAL & GST TAX DETAILS */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#0d7676] text-white font-extrabold text-xs flex items-center justify-center">3</span>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                TAX & FINANCIAL CALCULATIONS
              </h2>
            </div>
            {!isViewMode && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400">Apply GST Rate:</span>
                {[5, 12, 18, 28].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => applyGstPresetRate(rate)}
                    className="px-2 py-0.5 bg-slate-50 border border-slate-200 hover:border-[#0d7676] hover:text-[#0d7676] rounded text-[10px] font-bold text-slate-700 transition-all cursor-pointer"
                  >
                    {rate}%
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CustomSelect
              label="Invoice Type"
              disabled={isViewMode}
              value={invoiceType}
              onChange={(val) => setInvoiceType(val)}
              options={[
                { label: 'With GST', value: 'With GST' },
                { label: 'Without GST (Exempt/Export)', value: 'Without GST' }
              ]}
            />

            {invoiceType === 'With GST' && (
              <CustomSelect
                label="GST Subtype"
                disabled={isViewMode}
                value={gstSubtype}
                onChange={(val) => setGstSubtype(val)}
                options={[
                  { label: 'Intra-state (CGST + SGST)', value: 'intra' },
                  { label: 'Inter-state (IGST)', value: 'inter' }
                ]}
              />
            )}

            {invoiceType === 'With GST' && gstSubtype === 'intra' ? (
              <>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">CGST Amount ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    disabled={isViewMode}
                    readOnly={isViewMode}
                    value={cgstAmount}
                    onChange={(e) => setCgstAmount(e.target.value)}
                    className={`w-full px-3.5 py-2.5 border rounded-xl text-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0d7676] ${
                      isViewMode ? 'bg-slate-100 cursor-not-allowed text-slate-700 border-slate-200' : 'bg-slate-50 border-slate-200 focus:bg-white'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">SGST Amount ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    disabled={isViewMode}
                    readOnly={isViewMode}
                    value={sgstAmount}
                    onChange={(e) => setSgstAmount(e.target.value)}
                    className={`w-full px-3.5 py-2.5 border rounded-xl text-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0d7676] ${
                      isViewMode ? 'bg-slate-100 cursor-not-allowed text-slate-700 border-slate-200' : 'bg-slate-50 border-slate-200 focus:bg-white'
                    }`}
                  />
                </div>
              </>
            ) : invoiceType === 'With GST' ? (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">IGST Amount ({currency})</label>
                <input
                  type="number"
                  step="0.01"
                  disabled={isViewMode}
                  readOnly={isViewMode}
                  value={igstAmount}
                  onChange={(e) => setIgstAmount(e.target.value)}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0d7676] ${
                    isViewMode ? 'bg-slate-100 cursor-not-allowed text-slate-700 border-slate-200' : 'bg-slate-50 border-slate-200 focus:bg-white'
                  }`}
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Advance Adjustment ({currency})</label>
              <input
                type="number"
                step="0.01"
                disabled={isViewMode}
                readOnly={isViewMode}
                value={advanceAdjust}
                onChange={(e) => setAdvanceAdjust(e.target.value)}
                className={`w-full px-3.5 py-2.5 border rounded-xl text-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0d7676] ${
                  isViewMode ? 'bg-slate-100 cursor-not-allowed text-slate-700 border-slate-200' : 'bg-slate-50 border-slate-200 focus:bg-white'
                }`}
              />
            </div>
          </div>

          {/* Financial Calculation Summary Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Base Amount</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{formatCurrency(invoiceAmountNum, currency)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">+ Total GST Tax</span>
              <span className="font-mono font-bold text-[#0d7676] text-sm">{formatCurrency(totalGst, currency)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">- Advance Adjustment</span>
              <span className="font-mono font-bold text-rose-700 text-sm">{formatCurrency(advanceAdjNum, currency)}</span>
            </div>
            <div>
              <span className="text-[10px] text-emerald-700 font-extrabold uppercase tracking-wider block">= Net Payable</span>
              <span className="font-mono font-extrabold text-emerald-700 text-base">{formatCurrency(netPayable, currency)}</span>
            </div>
          </div>
        </div>

        {/* SECTION 4: SUPPORTING DOCUMENTS */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <span className="w-6 h-6 rounded-full bg-[#0d7676] text-white font-extrabold text-xs flex items-center justify-center">4</span>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              ATTACH SUPPORTING DOCUMENTS
            </h2>
          </div>

          {isViewMode ? (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 block">Uploaded Supporting Files ({selectedFiles.length})</span>
              {selectedFiles.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No files attached to this invoice.</p>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {selectedFiles.map((doc, idx) => {
                    const fileHref = resolveDocumentHref(doc);
                    return (
                      <a
                        key={idx}
                        href={fileHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 text-xs font-bold text-[#0d7676] transition-colors"
                      >
                        <FileText className="w-4 h-4 text-[#0d7676]" />
                        <span>{doc.name || doc.originalName || doc.fileName || `Document ${idx + 1}`}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <CustomFileUpload
              value={selectedFiles}
              onChange={(files) => setSelectedFiles(files)}
              multiple={true}
              maxFiles={10}
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xlsx"
            />
          )}
        </div>

        {/* Bottom Form Actions Bar */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-200">
          <button
            type="button"
            onClick={() => navigate('/vendor/invoices')}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-400" />
            <span>Back to Invoices</span>
          </button>

          {!isViewMode && (
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-[#0d7676] hover:bg-[#0f766e] text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{isSubmitting ? 'SAVING...' : isEditMode ? 'SAVE & UPDATE INVOICE' : 'SUBMIT INVOICE ENTRY'}</span>
            </button>
          )}

          {isViewMode && ['pending', 'in progress', 'in_progress', 'draft'].includes(String(existingInvoiceObj?.status || '').toLowerCase()) && (
            <button
              type="button"
              onClick={() => navigate(`/vendor/invoices/edit/${encodeURIComponent(id)}`)}
              className="px-6 py-2.5 bg-[#0d7676] hover:bg-[#0f766e] text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <Pencil className="w-4 h-4" />
              <span>Edit Invoice Details</span>
            </button>
          )}
        </div>
      </form>

      {/* Success Submission Modal for New Invoices */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl text-center space-y-4 border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-teal-50 text-[#0d7676] flex items-center justify-center mx-auto border border-teal-200">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Invoice Submitted Successfully!</h3>
              <p className="text-xs text-slate-500 font-medium">
                Invoice <span className="font-mono font-bold text-slate-800">{invoiceNumber}</span> against PO <span className="font-mono font-bold text-slate-800">{poNumber}</span> has been created.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/vendor/invoices')}
              className="w-full py-2.5 bg-[#0d7676] text-white font-bold text-xs rounded-xl shadow-xs hover:bg-[#0f766e] transition-all"
            >
              View Invoices List
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
