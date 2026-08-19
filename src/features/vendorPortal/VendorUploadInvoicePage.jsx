import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useVendor } from './vendorContext';
import { useToast } from '../../components/ui/toast';
import { apiFetch } from '../../services/api';
import {
  CloudUpload, FileText, CheckCircle2, AlertCircle, X, Search, ChevronDown, Check,
  Calculator, Info, ArrowLeft, ShieldCheck, Banknote, Sparkles, Building2, Calendar,
  Receipt, DollarSign, ChevronRight
} from 'lucide-react';
import { CustomSelect } from '../../components/ui/custom-select';
import { CustomDatePicker } from '../../components/ui/custom-date-picker';
import { CustomFileUpload } from '../../components/ui/custom-file-upload';
import { formatCurrency } from '../../utils/formatCurrency';

const getLocalISODate = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
};

export default function VendorUploadInvoicePage() {
  const { vendorProfile, purchaseOrders, invoices, addInvoice } = useVendor();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const initialPO = location.state?.selectedPO || '';

  const [poNumber, setPoNumber] = useState(initialPO);
  const [poSearch, setPoSearch] = useState('');
  const [isPoOpen, setIsPoOpen] = useState(false);
  const poContainerRef = useRef(null);

  const [apiSearchResults, setApiSearchResults] = useState([]);

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [asnNumber, setAsnNumber] = useState('');
  const isImportVendor = String(vendorProfile?.vendorType || '').trim().toLowerCase().includes('import');
  const [invoiceDate, setInvoiceDate] = useState(getLocalISODate());
  const [currency, setCurrency] = useState('INR');
  const [dueDays, setDueDays] = useState(30);
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

  useEffect(() => {
    const handleOutside = (e) => {
      if (poContainerRef.current && !poContainerRef.current.contains(e.target)) {
        setIsPoOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Live backend PO search whenever vendor types in the search box
  useEffect(() => {
    if (!isPoOpen) return;
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
  }, [poSearch, isPoOpen]);

  const combinedPOs = useMemo(() => {
    const map = new Map();
    (purchaseOrders || []).forEach(p => {
      if (p.id) map.set(String(p.id).toLowerCase(), p);
    });
    (apiSearchResults || []).forEach(p => {
      if (p.id) map.set(String(p.id).toLowerCase(), p);
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
    return combinedPOs.find((p) => p.id === poNumber) || null;
  }, [combinedPOs, poNumber]);

  useEffect(() => {
    if (!isImportVendor) return;
    const year = new Date().getFullYear();
    const currentMax = (invoices || []).reduce((max, invoice) => {
      const match = String(invoice.asnNumber || '').match(new RegExp(`^ASN-${year}-(\\d+)$`));
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0);
    setAsnNumber(`ASN-${year}-${String(currentMax + 1).padStart(3, '0')}`);
  }, [isImportVendor, invoices]);

  const calculateDueDateISO = () => {
    const d = new Date(`${invoiceDate || getLocalISODate()}T00:00:00`);
    d.setDate(d.getDate() + Number(dueDays || 30));
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  };

  const calculateDueDate = () => new Date(`${calculateDueDateISO()}T00:00:00`).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  // Financial Auto-Calculations
  const invoiceAmountNum = Number(invoiceAmount) || 0;
  const cgstNum = invoiceType === 'With GST' && gstSubtype === 'intra' ? (Number(cgstAmount) || 0) : 0;
  const sgstNum = invoiceType === 'With GST' && gstSubtype === 'intra' ? (Number(sgstAmount) || 0) : 0;
  const igstNum = invoiceType === 'With GST' && gstSubtype === 'inter' ? (Number(igstAmount) || 0) : 0;
  const totalGst = cgstNum + sgstNum + igstNum;
  const grossTotal = invoiceAmountNum + totalGst;
  const tdsPctNum = parseFloat(tdsPercentage) || 0;
  const tdsDeduction = (invoiceAmountNum * tdsPctNum) / 100;
  const advanceAdjNum = Number(advanceAdjust) || 0;
  const netPayable = Math.max(0, grossTotal - tdsDeduction - advanceAdjNum);

  // Helper function to auto-compute GST based on standard percentage presets
  const applyGstPresetRate = (ratePercent) => {
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

    // CUSTOM TOAST VALIDATIONS
    if (!poNumber) {
      const msg = 'Please select a Purchase Order to continue.';
      setErrorMsg(msg);
      showToast({ title: 'Purchase Order Required', description: msg, type: 'error' });
      return;
    }
    if (!selectedPOObj) {
      const msg = 'Please select a valid open Purchase Order from the list.';
      setErrorMsg(msg);
      showToast({ title: 'Invalid Purchase Order', description: msg, type: 'error' });
      return;
    }
    if (!['open', 'partially_delivered'].includes(String(selectedPOObj.status || '').toLowerCase())) {
      const msg = `Invoices cannot be submitted against a ${selectedPOObj.status || 'closed'} Purchase Order.`;
      setErrorMsg(msg);
      showToast({ title: 'Purchase Order Not Open', description: msg, type: 'error' });
      return;
    }
    if (!invoiceNumber.trim()) {
      const msg = 'Invoice Number is required.';
      setErrorMsg(msg);
      showToast({ title: 'Invoice Number Required', description: msg, type: 'error' });
      return;
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9/_-]{2,49}$/.test(invoiceNumber.trim())) {
      const msg = 'Invoice Number must be 3–50 characters and may contain letters, numbers, /, _ and - only.';
      setErrorMsg(msg);
      showToast({ title: 'Invalid Invoice Number', description: msg, type: 'error' });
      return;
    }
    if (!invoiceDate) {
      const msg = 'Invoice Date is required.';
      setErrorMsg(msg);
      showToast({ title: 'Invoice Date Required', description: msg, type: 'error' });
      return;
    }
    if (new Date(`${invoiceDate}T23:59:59`).getTime() > Date.now()) {
      const msg = 'Invoice date cannot be in the future.';
      setErrorMsg(msg);
      showToast({ title: 'Invalid Invoice Date', description: msg, type: 'error' });
      return;
    }
    if (!currency) {
      const msg = 'Currency is required.';
      setErrorMsg(msg);
      showToast({ title: 'Currency Required', description: msg, type: 'error' });
      return;
    }
    if (selectedPOObj?.currency && currency !== selectedPOObj.currency) {
      const msg = `Invoice currency must match the Purchase Order (${selectedPOObj.currency}). Convert the invoice before submitting.`;
      setErrorMsg(msg);
      showToast({ title: 'Currency Mismatch', description: msg, type: 'error' });
      return;
    }
    if (!Number.isInteger(Number(dueDays)) || Number(dueDays) < 1 || Number(dueDays) > 365) {
      const msg = 'Net Days must be a whole number between 1 and 365.';
      setErrorMsg(msg);
      showToast({ title: 'Net Days Required', description: msg, type: 'error' });
      return;
    }
    if (!invoiceAmount || Number(invoiceAmount) <= 0) {
      const msg = 'Please enter a valid positive invoice amount.';
      setErrorMsg(msg);
      showToast({ title: 'Invoice Amount Required', description: msg, type: 'error' });
      return;
    }
    if (selectedPOObj?.remainingInvoiceAmount !== undefined && Number(invoiceAmount) > Number(selectedPOObj.remainingInvoiceAmount)) {
      const msg = `Invoice amount cannot exceed the remaining PO balance (${selectedPOObj?.currency || currency} ${Number(selectedPOObj.remainingInvoiceAmount || 0).toLocaleString('en-IN')}).`;
      setErrorMsg(msg);
      showToast({ title: 'Amount Exceeds PO Balance', description: msg, type: 'error' });
      return;
    }
    if (Number(selectedPOObj?.totalQuantity) > 0 && (!invoiceQuantity || Number(invoiceQuantity) <= 0)) {
      const msg = 'Invoice quantity is required and must be greater than zero.';
      setErrorMsg(msg);
      showToast({ title: 'Quantity Required', description: msg, type: 'error' });
      return;
    }
    if (Number(selectedPOObj?.totalQuantity) > 0 && Number(invoiceQuantity) > Number(selectedPOObj?.remainingQuantity)) {
      const msg = `Invoice quantity cannot exceed the remaining PO quantity (${selectedPOObj.remainingQuantity}).`;
      setErrorMsg(msg);
      showToast({ title: 'Quantity Exceeds PO', description: msg, type: 'error' });
      return;
    }
    if ([cgstNum, sgstNum, igstNum].some((v) => v < 0) || advanceAdjNum < 0) {
      const msg = 'GST amounts and advance adjustment cannot be negative.';
      setErrorMsg(msg);
      showToast({ title: 'Invalid Adjustment', description: msg, type: 'error' });
      return;
    }
    if (advanceAdjNum > grossTotal) {
      const msg = 'Advance adjustment cannot exceed the total invoice gross amount.';
      setErrorMsg(msg);
      showToast({ title: 'Invalid Advance Adjustment', description: msg, type: 'error' });
      return;
    }
    if (!invoiceType) {
      const msg = 'Invoice Type is required.';
      setErrorMsg(msg);
      showToast({ title: 'Invoice Type Required', description: msg, type: 'error' });
      return;
    }
    if (!Array.isArray(selectedFiles) || selectedFiles.length === 0) {
      const msg = 'At least one invoice supporting document is required.';
      setErrorMsg(msg);
      showToast({ title: 'Invoice File Required', description: msg, type: 'error' });
      return;
    }
    if (selectedFiles.length > 10) {
      const msg = 'A maximum of 10 supporting documents can be uploaded.';
      setErrorMsg(msg);
      showToast({ title: 'Too Many Documents', description: msg, type: 'error' });
      return;
    }

    // ASN validation for Import vendors
    const cleanAsn = asnNumber.trim().toUpperCase();
    if (isImportVendor && !/^ASN-\d{4}-\d{3,}$/.test(cleanAsn)) {
      const msg = 'Invalid ASN Number. ASN Number (Advance Shipping Notice) is required for import invoice entries.';
      setErrorMsg(msg);
      showToast({ title: 'Invalid ASN Number', description: msg, type: 'error' });
      return;
    }
    const finalAsn = isImportVendor ? cleanAsn : cleanAsn;

    setIsSubmitting(true);
    try {
      const createdInvoice = await addInvoice({
        poNumber,
        invoiceNumber: invoiceNumber.trim(),
        asnNumber: finalAsn,
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
        fileName: selectedFiles[0].name,
        supportingDocuments: selectedFiles.map((file) => ({
          fileName: file.s3Key || file.name,
          originalName: file.name,
          fileUrl: file.fileUrl,
          size: file.size,
          mimeType: file.type
        }))
      });
      if (createdInvoice?.asnNumber) setAsnNumber(createdInvoice.asnNumber);
      setIsSubmitting(false);
      setShowSuccessModal(true);
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Invoice submission failed.');
      showToast({ title: 'Submission Error', description: err.message || 'Failed to submit invoice.', type: 'error' });
    }
  };

  return (
    <div className="font-sans max-w-6xl mx-auto pb-16 antialiased text-left space-y-6">
      {/* Top Header Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
            <Link to="/vendor/invoices" className="hover:text-[#0d7676] transition-colors">Invoices</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-700 font-bold">New Invoice Entry</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Receipt className="w-6 h-6 text-[#0d7676]" />
            Upload & Submit Invoice
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Submit your invoice against an open Purchase Order for 3-Way Match validation & Purchase Manager approval.
          </p>
        </div>

        {/* Right Vendor Badge */}
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
                  value={isPoOpen ? poSearch : (selectedPOObj ? `${selectedPOObj.id} — ${selectedPOObj.amount}` : poSearch)}
                  onFocus={() => {
                    setIsPoOpen(true);
                    setPoSearch('');
                  }}
                  onChange={(e) => {
                    setPoSearch(e.target.value);
                    setIsPoOpen(true);
                    setErrorMsg('');
                  }}
                  placeholder="Type PO number or amount to search (e.g. 4300001510)..."
                  className="w-full pl-10 pr-20 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white transition-all shadow-2xs"
                />

                <div className="absolute right-2.5 flex items-center gap-1">
                  {poNumber && (
                    <button
                      type="button"
                      onClick={() => {
                        setPoNumber('');
                        setPoSearch('');
                        setIsPoOpen(false);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Clear selection"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsPoOpen(!isPoOpen)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${isPoOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Floating Dropdown List */}
              {isPoOpen && (
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
                      const isSelected = po.id === poNumber;
                      return (
                        <div
                          key={po.id}
                          onClick={() => {
                            setPoNumber(po.id);
                            setPoSearch(String(po.id));
                            setIsPoOpen(false);
                            setErrorMsg('');
                            if (po.currency) setCurrency(po.currency);
                            if (po.paymentTerms) {
                              const match = String(po.paymentTerms).match(/\d+/);
                              if (match) setDueDays(Number(match[0]));
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
            {selectedPOObj && (
              <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mt-3 shadow-2xs">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold text-[#0d7676] uppercase tracking-wider block">Selected PO Number</span>
                  <div className="font-mono font-bold text-slate-900 text-sm">{selectedPOObj.id}</div>
                  <span className="text-[10px] text-slate-500 font-medium">Issue Date: {selectedPOObj.date}</span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Total PO Value</span>
                  <div className="font-mono font-bold text-slate-900 text-sm">{selectedPOObj.amount}</div>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full inline-block border border-emerald-200">
                    Status: {selectedPOObj.status}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold text-[#0d7676] uppercase tracking-wider block">Remaining Invoice Balance</span>
                  <div className="font-mono font-extrabold text-[#0d7676] text-sm">
                    {selectedPOObj.currency || currency} {Number(selectedPOObj.remainingInvoiceAmount ?? selectedPOObj.numericAmount ?? 0).toLocaleString('en-IN')}
                  </div>
                  {Number(selectedPOObj.remainingQuantity) > 0 && (
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
                value={invoiceNumber}
                onChange={(e) => {
                  setInvoiceNumber(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="e.g. INV-2026-0091"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              />
            </div>

            {/* Sequential ASN Number - Import vendors only */}
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

            {/* Invoice Date */}
            <CustomDatePicker
              label="Invoice Date"
              required
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
              <label className="block text-xs font-semibold text-slate-700">
                Payment Credit Days (Net Days) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                value={dueDays}
                onChange={(e) => setDueDays(e.target.value)}
                placeholder="30"
                min="1"
                max="365"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              />
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
                Auto-computed: Invoice Date ({invoiceDate}) + {dueDays} days
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
                max={selectedPOObj?.remainingInvoiceAmount || undefined}
                value={invoiceAmount}
                onChange={(e) => {
                  setInvoiceAmount(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white font-mono font-bold"
              />
              {selectedPOObj && (
                <p className="text-[10px] font-semibold text-slate-500">
                  Remaining PO balance: {selectedPOObj.currency || currency} {Number(selectedPOObj.remainingInvoiceAmount || selectedPOObj.numericAmount || 0).toLocaleString('en-IN')}
                </p>
              )}
            </div>

            {/* Invoice Quantity */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Delivered Quantity {Number(selectedPOObj?.totalQuantity) > 0 && <span className="text-rose-500">*</span>}
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={Number(selectedPOObj?.remainingQuantity) > 0 ? selectedPOObj.remainingQuantity : undefined}
                value={invoiceQuantity}
                onChange={(e) => { setInvoiceQuantity(e.target.value); setErrorMsg(''); }}
                placeholder="Enter quantity delivered"
                disabled={!selectedPOObj}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] disabled:opacity-60"
              />
              {Number(selectedPOObj?.totalQuantity) > 0 && (
                <p className="text-[10px] font-semibold text-slate-500">Remaining PO quantity: {selectedPOObj.remainingQuantity} units</p>
              )}
            </div>

            {/* Remarks */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">Remarks & Item Descriptions</label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add special notes, delivery batch details, or payment terms notes..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white resize-none"
              />
              <p className="text-[10px] text-slate-400">Include any details explaining variations between PO and invoice amount.</p>
            </div>
          </div>
        </div>

        {/* SECTION 3: GST, TDS & ADJUSTMENTS (CLEAN & INTUITIVE) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#0d7676] text-white font-extrabold text-xs flex items-center justify-center">3</span>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                TAXES, TDS & ADVANCE ADJUSTMENT
              </h2>
            </div>

            {/* Preset Rate Quick Buttons */}
            {invoiceType === 'With GST' && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase hidden sm:inline">Quick GST Rate:</span>
                {[5, 12, 18, 28].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => applyGstPresetRate(rate)}
                    className="px-2 py-0.5 rounded-md border border-teal-200 bg-teal-50 hover:bg-teal-100 text-[#0d7676] text-[10px] font-bold transition-colors cursor-pointer"
                  >
                    {rate}%
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Invoice Tax Type */}
            <CustomSelect
              label="Invoice Tax Category"
              required
              value={invoiceType}
              onChange={(val) => {
                setInvoiceType(val);
                if (val !== 'With GST') {
                  setCgstAmount('0');
                  setSgstAmount('0');
                  setIgstAmount('0');
                }
              }}
              options={[
                { label: 'With GST (Taxable Purchase)', value: 'With GST' },
                { label: 'Without GST (Exempt / Non-Taxable)', value: 'Without GST' },
                { label: 'SEZ Export (Zero-Rated Tax)', value: 'SEZ Export' }
              ]}
              placeholder="Select invoice tax type"
            />

            {/* GST Subtype Toggle (Intra vs Inter state) */}
            {invoiceType === 'With GST' ? (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  GST Supply Type <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => { setGstSubtype('intra'); setIgstAmount('0'); }}
                    className={`flex-1 py-1.5 rounded-lg font-bold text-center transition-all ${
                      gstSubtype === 'intra' ? 'bg-white text-[#0d7676] shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Intra-State (CGST + SGST)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setGstSubtype('inter'); setCgstAmount('0'); setSgstAmount('0'); }}
                    className={`flex-1 py-1.5 rounded-lg font-bold text-center transition-all ${
                      gstSubtype === 'inter' ? 'bg-white text-[#0d7676] shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Inter-State (IGST)
                  </button>
                </div>
              </div>
            ) : (
              <div className="md:col-span-2 p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-slate-500 text-xs font-medium flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Exempt / Non-Taxable invoice selected. GST amount calculation is disabled.</span>
              </div>
            )}

            {/* Intra State GST Amounts */}
            {invoiceType === 'With GST' && gstSubtype === 'intra' && (
              <>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">CGST Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cgstAmount}
                    onChange={(e) => setCgstAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">SGST Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={sgstAmount}
                    onChange={(e) => setSgstAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
                  />
                </div>
              </>
            )}

            {/* Inter State IGST Amount */}
            {invoiceType === 'With GST' && gstSubtype === 'inter' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">IGST Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={igstAmount}
                  onChange={(e) => setIgstAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
                />
              </div>
            )}

            {/* TDS % */}
            <CustomSelect
              label="TDS % (Deduction Rate)"
              required
              value={tdsPercentage}
              onChange={(val) => setTdsPercentage(val)}
              options={[
                { label: '0% — No TDS Deduction', value: '0%' },
                { label: '1% — Section 194C (Individual / HUF)', value: '1%' },
                { label: '2% — Section 194C (Company / Others)', value: '2%' },
                { label: '10% — Section 194J (Professional Services)', value: '10%' }
              ]}
              placeholder="Select TDS percentage"
            />

            {/* Advance to Adjust */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Advance Adjustment <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={advanceAdjust}
                onChange={(e) => setAdvanceAdjust(e.target.value)}
                min="0"
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: REAL-TIME FINANCIAL SUMMARY BREAKDOWN CARD */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-teal-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-teal-300">
                LIVE FINANCIAL SUMMARY BREAKDOWN
              </h2>
            </div>
            <span className="text-[10px] font-mono font-extrabold bg-teal-500/20 text-teal-300 px-2.5 py-1 rounded-full border border-teal-400/30">
              {currency} Breakdown
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-sans">
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Base Amount</span>
              <span className="font-mono font-bold text-sm text-white block mt-0.5">
                {currency} {invoiceAmountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">+ Total GST Tax</span>
              <span className="font-mono font-bold text-sm text-emerald-400 block mt-0.5">
                + {currency} {totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">- TDS Deduction ({tdsPercentage})</span>
              <span className="font-mono font-bold text-sm text-amber-400 block mt-0.5">
                - {currency} {tdsDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">- Advance Adjusted</span>
              <span className="font-mono font-bold text-sm text-sky-400 block mt-0.5">
                - {currency} {advanceAdjNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-700/80">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Estimated Net Payable</span>
              <p className="text-[11px] text-slate-300">Final payout after tax addition and advance/TDS deductions.</p>
            </div>
            <div className="font-mono font-black text-2xl text-teal-300 tracking-tight">
              {currency} {netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* SECTION 5: SUPPORTING DOCUMENT UPLOAD */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <span className="w-6 h-6 rounded-full bg-[#0d7676] text-white font-extrabold text-xs flex items-center justify-center">4</span>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              INVOICE SUPPORTING DOCUMENTS
            </h2>
          </div>

          <CustomFileUpload
            label="Upload Invoice Copy & Supporting PDFs / Images"
            required
            accept=".pdf,.jpg,.jpeg,.png"
            multiple
            value={selectedFiles}
            onChange={(files) => {
              setSelectedFiles(files);
              setErrorMsg('');
            }}
            onError={(message) => setErrorMsg(message)}
            helperText="Upload up to 10 supporting documents (PDF, JPG, or PNG; maximum 25 MB each)."
          />
        </div>

        {/* BOTTOM ACTION BUTTONS */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3.5 bg-[#0d7676] hover:bg-[#0f766e] text-white font-extrabold text-xs rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer uppercase tracking-wider"
          >
            {isSubmitting ? (
              'SUBMITTING INVOICE...'
            ) : (
              <>
                <Receipt className="w-4 h-4" />
                <span>SUBMIT INVOICE ({currency} {netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })})</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate('/vendor/invoices')}
            className="px-6 py-3.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* EXECUTIVE SUCCESS MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-5 shadow-2xl animate-in zoom-in-95 border border-slate-100">
            {/* Header Icon */}
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto ring-8 ring-emerald-50/50">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            {/* Title & Description */}
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Invoice Submitted Successfully</h3>
              <p className="text-xs text-slate-500 font-medium">
                Your invoice has been submitted and queued for Purchase Manager review & 3-Way Match validation.
              </p>
            </div>

            {/* Invoice Breakdown Details Card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-left text-xs space-y-2.5 font-sans">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-semibold">Invoice Number</span>
                <span className="font-mono font-bold text-slate-900">{invoiceNumber}</span>
              </div>
              {/* ASN Number highlight - Import vendors only */}
              {isImportVendor && (
                <div className="flex items-center justify-between border-b border-amber-200/60 pb-2 bg-amber-50/60 -mx-4 px-4 py-2">
                  <span className="text-amber-700 font-extrabold flex items-center gap-1">📦 ASN Number</span>
                  <span className="font-mono font-bold text-amber-800 text-sm">{asnNumber}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-semibold">Purchase Order</span>
                <span className="font-mono font-bold text-[#0d7676]">{poNumber}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-semibold">Estimated Net Payable</span>
                <span className="font-mono font-bold text-slate-900">{currency} {netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Approval Stage</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Purchase Manager Review
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowSuccessModal(false);
                  navigate('/vendor/invoices');
                }}
                className="w-full py-3 bg-[#0d7676] hover:bg-[#0f766e] text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                View Invoices List →
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowSuccessModal(false);
                  setInvoiceNumber('');
                  setAsnNumber((current) => {
                    const year = new Date().getFullYear();
                    const sequence = Number(String(current).split('-').pop()) || 0;
                    return `ASN-${year}-${String(sequence + 1).padStart(3, '0')}`;
                  });
                  setInvoiceAmount('');
                  setRemarks('');
                  setSelectedFiles([]);
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Submit Another Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
