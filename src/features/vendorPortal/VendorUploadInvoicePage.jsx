import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useVendor } from './vendorContext';
import { useToast } from '../../components/ui/toast';
import { apiFetch } from '../../services/api';
import { CloudUpload, FileText, CheckCircle2, AlertCircle, X, Search, ChevronDown, Check } from 'lucide-react';

const generateUniqueInvoiceNumber = () => {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `INV-${year}-${rand}`;
};

const generateASNNumber = () => {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `ASN-${year}-${rand}`;
};

const getLocalISODate = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
};

export default function VendorUploadInvoicePage() {
  const { vendorProfile, purchaseOrders, addInvoice } = useVendor();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const initialPO = location.state?.selectedPO || '';

  const [poNumber, setPoNumber] = useState(initialPO);
  const [poSearch, setPoSearch] = useState('');
  const [isPoOpen, setIsPoOpen] = useState(false);
  const poContainerRef = useRef(null);

  const [apiSearchResults, setApiSearchResults] = useState([]);

  const [invoiceNumber, setInvoiceNumber] = useState(generateUniqueInvoiceNumber());
  const [asnNumber, setAsnNumber] = useState(generateASNNumber());
  const isImportVendor = String(vendorProfile?.vendorType || '').trim().toLowerCase().includes('import');
  const [invoiceDate, setInvoiceDate] = useState(getLocalISODate());
  const [currency, setCurrency] = useState('INR');
  const [dueDays, setDueDays] = useState(30);
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceQuantity, setInvoiceQuantity] = useState('');
  const [grnNo, setGrnNo] = useState('');
  const [remarks, setRemarks] = useState('');

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
            amount: `₹${(p.totalAmount || 0).toLocaleString('en-IN')}`,
            status: p.status || 'Open',
            currency: p.currency || 'INR',
            numericAmount: p.totalAmount || 0
          }));
          setApiSearchResults(formatted);
        }
      } catch (e) {}
    }, 150);
    return () => { active = false; clearTimeout(timer); };
  }, [poSearch]);

  const combinedPOs = useMemo(() => {
    return purchaseOrders;
  }, [purchaseOrders]);

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
    return combinedPOs.find((p) => p.id === poNumber) || (poNumber ? { id: poNumber, amount: 'PO Selected', date: 'Active', status: 'Open' } : null);
  }, [combinedPOs, poNumber]);

  // GST & Adjustments
  const [invoiceType, setInvoiceType] = useState('With GST');
  const [cgstAmount, setCgstAmount] = useState('0');
  const [sgstAmount, setSgstAmount] = useState('0');
  const [igstAmount, setIgstAmount] = useState('0');
  const [tdsPercentage, setTdsPercentage] = useState('0%');
  const [advanceAdjust, setAdvanceAdjust] = useState('0');

  // File state
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const calculateDueDate = () => {
    const d = new Date(invoiceDate || Date.now());
    d.setDate(d.getDate() + Number(dueDays || 30));
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };



  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setErrorMsg('');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setErrorMsg('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // PROPER CUSTOM TOAST VALIDATIONS (No default browser popups)
    if (!poNumber) {
      const msg = 'Please select a Purchase Order to continue.';
      setErrorMsg(msg);
      showToast({ title: 'Purchase Order Required', description: msg, type: 'error' });
      return;
    }
    if (!invoiceNumber.trim()) {
      const msg = 'Invoice Number is required.';
      setErrorMsg(msg);
      showToast({ title: 'Invoice Number Required', description: msg, type: 'error' });
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
    if (!dueDays && dueDays !== 0) {
      const msg = 'Net Days is required.';
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
    if (Number(invoiceAmount) > Number(selectedPOObj?.remainingInvoiceAmount)) {
      const msg = `Invoice amount cannot exceed the remaining PO balance (${selectedPOObj?.currency || currency} ${Number(selectedPOObj?.remainingInvoiceAmount || 0).toLocaleString('en-IN')}).`;
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
    if ([cgstAmount, sgstAmount, igstAmount, advanceAdjust].some((value) => Number(value) < 0)) {
      const msg = 'GST amounts and advance adjustment cannot be negative.';
      setErrorMsg(msg);
      showToast({ title: 'Invalid Adjustment', description: msg, type: 'error' });
      return;
    }
    if (!grnNo.trim()) {
      const msg = 'GRN / Delivery Note No is required.';
      setErrorMsg(msg);
      showToast({ title: 'GRN / Delivery Note Required', description: msg, type: 'error' });
      return;
    }
    if (!invoiceType) {
      const msg = 'Invoice Type is required.';
      setErrorMsg(msg);
      showToast({ title: 'Invoice Type Required', description: msg, type: 'error' });
      return;
    }
    if (!selectedFile) {
      const msg = 'Invoice document file is required. Please drag & drop or upload your invoice file (PDF, JPG, PNG).';
      setErrorMsg(msg);
      showToast({ title: 'Invoice File Required', description: msg, type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      // ASN applies only to Import vendors.
      const finalAsn = isImportVendor ? (asnNumber.trim() || generateASNNumber()) : '';
      if (isImportVendor && !asnNumber.trim()) setAsnNumber(finalAsn);

      await addInvoice({
        poNumber,
        invoiceNumber: invoiceNumber.trim(),
        asnNumber: finalAsn,
        invoiceDate,
        currency,
        dueDays,
        paymentDueDate: calculateDueDate(),
        invoiceAmount,
        invoiceQuantity: Number(invoiceQuantity) || undefined,
        grnNo: grnNo.trim(),
        remarks: remarks.trim(),
        invoiceType,
        cgstAmount,
        sgstAmount,
        igstAmount,
        tdsPercentage,
        advanceAdjust,
        fileName: selectedFile ? selectedFile.name : 'Invoice-Document.pdf'
      });
      setIsSubmitting(false);
      setShowSuccessModal(true);
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Invoice submission failed.');
      showToast({ title: 'Submission Error', description: err.message || 'Failed to submit invoice.', type: 'error' });
    }
  };

  const handleInvoiceTypeChange = (e) => {
    const val = e.target.value;
    setInvoiceType(val);
    if (val === 'Without GST') {
      setCgstAmount('0');
      setSgstAmount('0');
      setIgstAmount('0');
    }
  };

  return (
    <div className=" font-sans max-w-4xl mx-auto pb-12 antialiased text-left">
      {/* Page Title & Subtitle */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Upload Invoice</h1>
        <p className="text-xs text-slate-500 font-medium mt-1">
          Submit your invoice against an open Purchase Order. Both domestic and Import POs are supported.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4.5 h-4.5 text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg('')} className="text-rose-400 hover:text-rose-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* Section 1: Select Purchase Order */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              SELECT PURCHASE ORDER
            </h2>
            {selectedPOObj && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                ✓ PO Selected
              </span>
            )}
          </div>

          <div className="space-y-1.5" ref={poContainerRef}>
            <label className="block text-xs font-semibold text-slate-700">
              Purchase Order <span className="text-rose-500">*</span>
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
                  placeholder="Type PO number to search (e.g. 4300001510)..."
                  className="w-full pl-10 pr-20 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white transition-all"
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
                <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {filteredPOs.length === 0 ? (
                    <div className="p-4 text-center space-y-2">
                      <p className="text-xs text-slate-500 font-medium">
                        No pre-registered PO found matching "{poSearch}"
                      </p>
                      {false && poSearch.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            const customPo = poSearch.trim().toUpperCase();
                            setPoNumber(customPo);
                            setPoSearch(customPo);
                            setIsPoOpen(false);
                            setErrorMsg('');
                          }}
                          className="px-3 py-1.5 bg-[#0d7676] text-white text-xs font-bold rounded-lg hover:bg-teal-700 transition shadow-2xs cursor-pointer"
                        >
                          Use "{poSearch.trim().toUpperCase()}" as Purchase Order
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredPOs.map((po) => {
                      const isSelected = po.id === poNumber;
                      return (
                        <div
                          key={po.id}
                          onClick={() => {
                            setPoNumber(po.id);
                            setPoSearch(`${po.id} — ${po.amount}`);
                            setIsPoOpen(false);
                            setErrorMsg('');
                            if (po.currency) setCurrency(po.currency);
                            if (po.paymentTerms) {
                              const match = String(po.paymentTerms).match(/\d+/);
                              if (match) setDueDays(Number(match[0]));
                            }
                          }}
                          className={`p-3 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                            isSelected ? 'bg-teal-50/80 text-[#0d7676] font-bold' : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div>
                            <div className="font-mono font-bold text-sm text-slate-900">{po.id}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">Issue Date: {po.date}</div>
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

            {/* Active Selected PO Card Summary */}
            {selectedPOObj && (
              <div className="p-3.5 bg-teal-50/60 border border-teal-200/80 rounded-xl flex items-center justify-between text-xs mt-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold text-[#0d7676] uppercase tracking-wider block">Selected Purchase Order</span>
                  <div className="font-mono font-bold text-slate-900 text-sm">{selectedPOObj.id}</div>
                  <span className="text-[11px] text-slate-600 font-medium">Issue Date: {selectedPOObj.date}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">PO Amount</span>
                  <div className="font-mono font-bold text-[#0d7676] text-sm">{selectedPOObj.amount}</div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full inline-block mt-0.5 border border-emerald-200">
                    {selectedPOObj.status}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Invoice Details */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
            INVOICE DETAILS
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Invoice Number */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Invoice Number <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setInvoiceNumber(generateUniqueInvoiceNumber())}
                  className="text-[11px] font-bold text-[#0d7676] hover:underline cursor-pointer"
                >
                  ⚡ Auto-Generate
                </button>
              </div>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => {
                  setInvoiceNumber(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="e.g. INV-2026-891204"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              />
            </div>

            {/* ASN Number - Import vendors only */}
            {isImportVendor && <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  ASN Number
                  <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-extrabold bg-amber-100 text-amber-700 border border-amber-200 rounded uppercase tracking-wider">Auto</span>
                </label>
                <button
                  type="button"
                  onClick={() => setAsnNumber(generateASNNumber())}
                  className="text-[11px] font-bold text-amber-600 hover:underline cursor-pointer"
                >
                  ⚡ Regenerate
                </button>
              </div>
              <input
                type="text"
                value={asnNumber}
                onChange={(e) => setAsnNumber(e.target.value)}
                placeholder="e.g. ASN-2026-48291"
                className="w-full px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white"
              />
              <p className="text-[10px] text-amber-600 font-semibold">Auto-generated Advance Shipment Notice number</p>
            </div>}

            {/* Invoice Date */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Invoice Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                max={getLocalISODate()}
                value={invoiceDate}
                onChange={(e) => {
                  setInvoiceDate(e.target.value);
                  setErrorMsg('');
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              />
            </div>

            {/* Currency */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Currency <span className="text-rose-500">*</span>
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            {/* Payment Due Date */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Payment Due Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                readOnly
                value={calculateDueDate()}
                className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium cursor-not-allowed"
              />
              <p className="text-[10px] text-[#0d7676] font-semibold">
                Auto-calculated from today's date when you submit the invoice
              </p>
            </div>

            {/* Net Days */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Net Days <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                value={dueDays}
                onChange={(e) => setDueDays(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              />
            </div>

            {/* Invoice Amount */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Invoice Amount ({currency}) <span className="text-rose-500">*</span>
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
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white font-mono font-bold"
              />
              {selectedPOObj && (
                <p className="text-[10px] font-semibold text-slate-500">
                  Remaining PO balance: {selectedPOObj.currency || currency} {Number(selectedPOObj.remainingInvoiceAmount || 0).toLocaleString('en-IN')}
                </p>
              )}
            </div>

            {/* Invoice Quantity */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Invoice Quantity {Number(selectedPOObj?.totalQuantity) > 0 && <span className="text-rose-500">*</span>}
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={selectedPOObj?.remainingQuantity || undefined}
                value={invoiceQuantity}
                onChange={(e) => { setInvoiceQuantity(e.target.value); setErrorMsg(''); }}
                placeholder="Enter delivered quantity"
                disabled={!selectedPOObj || Number(selectedPOObj.totalQuantity) <= 0}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] disabled:opacity-60"
              />
              {Number(selectedPOObj?.totalQuantity) > 0 && (
                <p className="text-[10px] font-semibold text-slate-500">Remaining PO quantity: {selectedPOObj.remainingQuantity}</p>
              )}
            </div>

            {/* GRN / Delivery Note No */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                GRN / Delivery Note No <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={grnNo}
                onChange={(e) => {
                  setGrnNo(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="e.g. GRN-001"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              />
            </div>

            {/* Remarks */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">Remarks</label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Any additional information..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white resize-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: GST, TDS & ADJUSTMENTS */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
            GST, TDS & ADJUSTMENTS
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Invoice Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={invoiceType}
                onChange={handleInvoiceTypeChange}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              >
                <option value="With GST">With GST</option>
                <option value="Without GST">Without GST</option>
                <option value="SEZ Export">SEZ Export</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                CGST Amount <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                disabled={invoiceType === 'Without GST'}
                value={cgstAmount}
                onChange={(e) => setCgstAmount(e.target.value)}
                className={`w-full px-3.5 py-2.5 border rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] font-mono ${
                  invoiceType === 'Without GST' ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-50 border-slate-200 focus:bg-white'
                }`}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                SGST Amount <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                disabled={invoiceType === 'Without GST'}
                value={sgstAmount}
                onChange={(e) => setSgstAmount(e.target.value)}
                className={`w-full px-3.5 py-2.5 border rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] font-mono ${
                  invoiceType === 'Without GST' ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-50 border-slate-200 focus:bg-white'
                }`}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                IGST Amount <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                disabled={invoiceType === 'Without GST'}
                value={igstAmount}
                onChange={(e) => setIgstAmount(e.target.value)}
                className={`w-full px-3.5 py-2.5 border rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] font-mono ${
                  invoiceType === 'Without GST' ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-50 border-slate-200 focus:bg-white'
                }`}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                TDS % (on base amount) <span className="text-rose-500">*</span>
              </label>
              <select
                value={tdsPercentage}
                onChange={(e) => setTdsPercentage(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              >
                <option value="0%">0%</option>
                <option value="1%">1%</option>
                <option value="2%">2%</option>
                <option value="10%">10%</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Advance to Adjust <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={advanceAdjust}
                onChange={(e) => setAdvanceAdjust(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white font-mono"
              />
            </div>
          </div>
        </div>

        {/* Section 4: INVOICE FILE * */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
            INVOICE FILE <span className="text-rose-500">*</span>
          </h2>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-slate-200 hover:border-[#0d7676] rounded-2xl p-8 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <input
              type="file"
              id="invoice-file"
              onChange={handleFileChange}
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
            />
            <label htmlFor="invoice-file" className="cursor-pointer block space-y-2">
              <div className="w-12 h-12 bg-teal-50 text-[#0d7676] rounded-full flex items-center justify-center mx-auto border border-teal-100">
                <CloudUpload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700">
                  Drag & drop your invoice here <span className="text-rose-500">*</span>
                </p>
                <p className="text-[11px] text-[#0d7676] font-semibold mt-0.5 underline">
                  or click to browse
                </p>
              </div>
              <p className="text-[10px] text-slate-400">PDF, JPG, PNG ... max 10MB</p>
            </label>

            {selectedFile && (
              <div className="mt-4 p-3 bg-white border border-teal-200 rounded-xl inline-flex items-center gap-3 text-xs shadow-2xs">
                <FileText className="w-4 h-4 text-[#0d7676]" />
                <span className="font-bold text-slate-800">{selectedFile.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="text-slate-400 hover:text-rose-500 ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-[#0d7676] hover:bg-[#0f766e] text-white font-extrabold text-xs rounded-xl shadow-2xs transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'SUBMITTING...' : 'SUBMIT INVOICE'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/vendor/invoices')}
            className="px-5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-all"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Executive Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-5 shadow-2xl animate-in zoom-in-95 border border-slate-100">
            {/* Header Icon */}
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto ring-8 ring-emerald-50/50">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            {/* Title & Description */}
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Invoice Uploaded Successfully</h3>
              <p className="text-xs text-slate-500 font-medium">
                Your invoice has been submitted and queued for 3-Way Match validation.
              </p>
            </div>

            {/* Invoice Breakdown Details Card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-left text-xs space-y-2.5 font-sans">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-semibold">Invoice Number</span>
                <span className="font-mono font-bold text-slate-900">{invoiceNumber}</span>
              </div>
              {/* ASN Number highlight - Import vendors only */}
              {isImportVendor && <div className="flex items-center justify-between border-b border-amber-200/60 pb-2 bg-amber-50/60 -mx-4 px-4 py-2">
                <span className="text-amber-700 font-extrabold flex items-center gap-1">📦 ASN Number</span>
                <span className="font-mono font-bold text-amber-800 text-sm">{asnNumber}</span>
              </div>}
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-semibold">Purchase Order</span>
                <span className="font-mono font-bold text-[#0d7676]">{poNumber || 'PO-4100005580'}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-semibold">Invoice Amount</span>
                <span className="font-mono font-bold text-slate-900">{currency} {Number(invoiceAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">3-Way Match Status</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Pending Validation
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
                  setInvoiceNumber(generateUniqueInvoiceNumber());
                  setAsnNumber(generateASNNumber());
                  setInvoiceAmount('');
                  setGrnNo('');
                  setRemarks('');
                  setSelectedFile(null);
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
