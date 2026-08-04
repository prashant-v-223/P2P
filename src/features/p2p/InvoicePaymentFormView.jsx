import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeft,
  CloudUpload,
  FileCheck2,
  AlertCircle,
  X,
  Loader2,
  FileText,
  Search,
  Check,
  ChevronDown,
  Building2,
  DollarSign,
  Globe
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import FileUploadZone from '../../components/shared/FileUploadZone';

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

export default function InvoicePaymentFormView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isEditMode = !!id;

  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Searchable PO Selector Dropdown state
  const [poSearch, setPoSearch] = useState('');
  const [isPoDropdownOpen, setIsPoDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Form Fields
  const [poNumber, setPoNumber] = useState('');
  const [selectedPoObj, setSelectedPoObj] = useState(null);
  const [invoiceNumber, setInvoiceNumber] = useState(generateUniqueInvoiceNumber());
  const [asnNumber, setAsnNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [currency, setCurrency] = useState('INR');
  const [dueDays, setDueDays] = useState(30);
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [grnNo, setGrnNo] = useState('');
  const [remarks, setRemarks] = useState('');

  // GST, TDS & Adjustments
  const [invoiceType, setInvoiceType] = useState('With GST');
  const [cgstAmount, setCgstAmount] = useState('0');
  const [sgstAmount, setSgstAmount] = useState('0');
  const [igstAmount, setIgstAmount] = useState('0');
  const [tdsPercentage, setTdsPercentage] = useState('0%');
  const [advanceAdjust, setAdvanceAdjust] = useState('0');

  // Upload - Changed from single file to multiple documents
  const [sendApprovalTo, setSendApprovalTo] = useState('');
  const [documents, setDocuments] = useState([]);

  const calculateDueDate = () => {
    const d = new Date(invoiceDate || Date.now());
    d.setDate(d.getDate() + Number(dueDays || 30));
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Fetch POs from API (10 records initially, server-side filtered when searching)
  const fetchPurchaseOrders = async (searchTerm = '') => {
    try {
      if (searchTerm) setSearching(true);
      else setLoading(true);

      const limit = searchTerm ? 20 : 10;
      const query = searchTerm ? `?search=${encodeURIComponent(searchTerm)}&pageSize=${limit}` : `?pageSize=${limit}`;
      const res = await apiFetch(`/api/p2p/purchase-orders${query}`);
      const data = await res.json();
      if (res.ok && data.data) {
        setPurchaseOrders(data.data.filter((po) =>
          !['closed', 'cancelled', 'canceled', 'blocked'].includes(String(po.status || '').toLowerCase()) &&
          Number(po.remainingInvoiceAmount ?? po.totalAmount) > 0
        ));
      }
    } catch (e) {
      console.error('Fetch POs error:', e);
    } finally {
      setLoading(false);
      setSearching(false);
    }
  };

  // Initial load (10 records)
  useEffect(() => {
    fetchPurchaseOrders('');
    if (isEditMode) {
      apiFetch(`/api/p2p/invoices/${id}`)
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            const inv = data.data;
            const pId = inv.poId || inv.sapPoNumber || '';
            setPoNumber(pId);
            setInvoiceNumber(inv.invoiceNumber || '');
            setAsnNumber(inv.asnNumber || generateASNNumber());
            setInvoiceDate(inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().split('T')[0] : '');
            setInvoiceAmount(inv.grossAmount || '');
            setGrnNo(inv.grnNumber || '');
            setCgstAmount(inv.cgstAmount || '0');
            setSgstAmount(inv.sgstAmount || '0');
            setIgstAmount(inv.igstAmount || '0');
            setTdsPercentage(`${inv.tdsPercentage || 0}%`);
            setAdvanceAdjust(inv.advanceAdjusted || '0');
            setSendApprovalTo(inv.approvalTo || '');
          }
        })
        .catch(err => console.error(err));
    }
  }, [id]);

  useEffect(() => {
    if (!poNumber || selectedPoObj || purchaseOrders.length === 0) return;
    const po = purchaseOrders.find((item) => (item.sapPoNumber || item.poNumber) === poNumber);
    if (!po) return;
    setSelectedPoObj(po);
    if (po.currency) setCurrency(po.currency);
    if (String(po.vendorType || '').toLowerCase().includes('import') && !asnNumber) {
      setAsnNumber(generateASNNumber());
    }
  }, [poNumber, purchaseOrders, selectedPoObj, asnNumber]);

  // Debounced API search when user types in search box
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPurchaseOrders(poSearch.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [poSearch]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsPoDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectPo = (po) => {
    const pNo = po.sapPoNumber || po.poNumber;
    setPoNumber(pNo);
    setSelectedPoObj(po);
    setIsPoDropdownOpen(false);
    setErrorMsg('');

    if (po.currency) setCurrency(po.currency);
    if (String(po.vendorType || '').toLowerCase().includes('import')) {
      setAsnNumber((current) => current || generateASNNumber());
    } else {
      setAsnNumber('');
    }
    if (!invoiceAmount) setInvoiceAmount(po.remainingInvoiceAmount ?? po.totalAmount ?? '');
    if (po.paymentTerms) {
      const match = String(po.paymentTerms).match(/\d+/);
      if (match) setDueDays(Number(match[0]));
    }
  };

  const handleFilesSelected = (newFiles) => {
    setDocuments(prev => [...prev, ...newFiles]);
    setErrorMsg('');
  };

  const handleFileRemove = (index) => {
    setDocuments(docs => docs.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

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
    if (!currency) {
      const msg = 'Currency is required.';
      setErrorMsg(msg);
      showToast({ title: 'Currency Required', description: msg, type: 'error' });
      return;
    }
    if (selectedPoObj?.currency && currency !== selectedPoObj.currency) {
      const msg = `Currency must match the Purchase Order (${selectedPoObj.currency}).`;
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
    if (!isEditMode && Number(invoiceAmount) > Number(selectedPoObj?.remainingInvoiceAmount ?? selectedPoObj?.totalAmount)) {
      const msg = `Invoice exceeds the remaining PO balance (${currency} ${Number(selectedPoObj?.remainingInvoiceAmount || 0).toLocaleString('en-IN')}).`;
      setErrorMsg(msg);
      showToast({ title: 'Amount Exceeds PO', description: msg, type: 'error' });
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
    if (!documents.length && !isEditMode) {
      const msg = 'At least one invoice document is required.';
      setErrorMsg(msg);
      showToast({ title: 'Invoice Document Required', description: msg, type: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      const numTdsPct = parseFloat(String(tdsPercentage).replace('%', '')) || 0;
      
      const payload = {
        poNumber,
        invoiceNumber: invoiceNumber.trim(),
        asnNumber: asnNumber.trim() || generateASNNumber(),
        invoiceDate,
        dueDays: Number(dueDays),
        dueDate: calculateDueDate(),
        grossAmount: Number(invoiceAmount) || 0,
        currency,
        grnQuantity: 0,
        gstAmount: (Number(cgstAmount) || 0) + (Number(sgstAmount) || 0) + (Number(igstAmount) || 0),
        tdsAmount: ((Number(invoiceAmount) || 0) * numTdsPct) / 100,
        tdsPercentage: numTdsPct,
        advanceAdjusted: Number(advanceAdjust) || 0,
        grnNumber: grnNo.trim(),
        remarks: remarks.trim(),
        approvalTo: sendApprovalTo,
        vendorType: selectedPoObj?.vendorType || ''
      };

      const url = isEditMode ? `/api/p2p/invoices/${id}` : '/api/p2p/invoices/create';
      const method = isEditMode ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const invoiceId = data.data?.invoicePaymentId || data.data?.invoiceId;

        // Step 2: Upload documents if any are attached (only for new invoices)
        if (!isEditMode && documents.length > 0 && invoiceId) {
          const formData = new FormData();
          documents.forEach(doc => {
            formData.append('files', doc.file);
          });
          formData.append('documentType', 'vendor_invoice');
          formData.append('documentableType', 'InvoicePayment');
          formData.append('documentableId', invoiceId);

          try {
            const docRes = await apiFetch('/api/documents/upload-multiple', {
              method: 'POST',
              body: formData
            });
            const docJson = await docRes.json();
            
            if (!docRes.ok) {
              console.error('Document upload failed:', docJson.error);
              showToast({
                title: isEditMode ? 'Invoice Updated' : 'Invoice Created',
                description: `Invoice "${invoiceNumber}" saved but documents failed to upload. You can add them later.`,
                type: 'warning',
                duration: 5000
              });
            } else {
              showToast({
                title: isEditMode ? 'Invoice Updated' : 'Invoice Payment Created',
                description: `Invoice "${invoiceNumber}" with ${docJson.data?.uploaded?.length || documents.length} document(s) saved successfully.`,
                type: 'success'
              });
            }
          } catch (docError) {
            console.error('Document upload error:', docError);
            showToast({
              title: isEditMode ? 'Invoice Updated' : 'Invoice Created',
              description: `Invoice "${invoiceNumber}" saved but documents failed to upload. You can add them later.`,
              type: 'warning',
              duration: 5000
            });
          }
        } else {
          showToast({
            title: isEditMode ? 'Invoice Updated' : 'Invoice Payment Created',
            description: `Invoice "${invoiceNumber}" saved successfully.`,
            type: 'success'
          });
        }

        navigate('/admin/invoice-payments');
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to save invoice payment.');
        showToast({ title: 'Save Failed', description: err.error || 'Failed to save invoice.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error saving invoice payment.');
      showToast({ title: 'Network Error', description: 'Error saving invoice payment.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Vendor type is resolved from the selected PO's supplier record.
  const isImportVendor = String(selectedPoObj?.vendorType || '').toLowerCase().includes('import');
  const shouldShowAsn = isImportVendor || (isEditMode && Boolean(asnNumber));

  return (
    <div className="w-full space-y-3 font-sans pb-10 text-left">
      <form onSubmit={handleSubmit} noValidate className="space-y-3 w-full">
        {/* ─── STICKY HEADER BAR ─── */}
        <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between flex-wrap gap-2 sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <Link to="/admin/invoice-payments" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 leading-tight flex items-center gap-2">
                {isEditMode ? 'Edit Invoice Payment' : 'Create New Invoice Payment'}
                {isImportVendor && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold bg-amber-100 text-amber-700 border border-amber-200 rounded uppercase tracking-wider flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    Import Vendor
                  </span>
                )}
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                Submit invoice against an open Purchase Order. Both domestic and Import POs are supported.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/admin/invoice-payments')}
              className="px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 bg-[#0d7676] hover:bg-[#0f766e] text-white font-extrabold text-xs rounded-lg shadow-2xs transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCheck2 className="w-3.5 h-3.5" />}
              {submitting ? 'SUBMITTING...' : isEditMode ? 'SAVE CHANGES' : 'CREATE INVOICE PAYMENT'}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button type="button" onClick={() => setErrorMsg('')} className="text-rose-400 hover:text-rose-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Selected PO Vendor Banner */}
        {selectedPoObj && (
          <div className="bg-gradient-to-r from-teal-50/80 to-white p-3 rounded-xl border border-teal-200 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 text-[#0d7676]" />
                <span className="text-xs font-bold text-slate-900">{selectedPoObj.supplierName || 'Vendor'}</span>
                <span className="text-[10px] text-slate-500">|</span>
                <span className="text-xs font-mono text-[#0d7676] font-bold">Code: {selectedPoObj.supplierId || '—'}</span>
                {isImportVendor && (
                  <span className="px-2 py-0.5 text-[9px] font-extrabold bg-amber-100 text-amber-700 border border-amber-200 rounded uppercase tracking-wider flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    Import
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  <span className="text-slate-400">GST:</span>
                  <span className="font-mono font-semibold">{selectedPoObj.vendorGstin || 'N/A'}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-slate-400">PAN:</span>
                  <span className="font-mono font-semibold">{selectedPoObj.vendorPan || 'N/A'}</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Section 1: SEARCHABLE PURCHASE ORDER SELECTOR */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs space-y-2 w-full">
          <h2 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center justify-between">
            <span>SELECT PURCHASE ORDER</span>
            <span className="text-[10px] font-semibold text-slate-400 normal-case">
              {purchaseOrders.length} POs loaded
            </span>
          </h2>

          <div className="space-y-1.5 relative" ref={dropdownRef}>
            <label className="block text-xs font-semibold text-slate-700">
              Purchase Order <span className="text-rose-500">*</span>
            </label>

            {/* Custom Searchable Trigger Box */}
            <div
              onClick={() => setIsPoDropdownOpen(!isPoDropdownOpen)}
              className={`w-full px-3 py-2 bg-slate-50 border rounded-lg flex items-center justify-between cursor-pointer transition-all ${
                isPoDropdownOpen ? 'border-[#0d7676] ring-2 ring-teal-500/20 bg-white' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                {poNumber ? (
                  <span className="text-xs font-bold text-slate-900 font-mono truncate">
                    {poNumber} {selectedPoObj ? `— ${selectedPoObj.supplierName || ''}` : ''}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 font-medium">
                    Type PO number to search...
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {(loading || searching) && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0d7676]" />}
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isPoDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>

            {/* Dropdown Menu */}
            {isPoDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden animate-in fade-in-50 zoom-in-95">
                <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Type PO number or vendor name to search API..."
                      value={poSearch}
                      onChange={(e) => setPoSearch(e.target.value)}
                      className="w-full pl-8 pr-8 py-1.5 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#0d7676]"
                    />
                    {searching ? (
                      <Loader2 className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-[#0d7676] animate-spin" />
                    ) : poSearch ? (
                      <button
                        type="button"
                        onClick={() => setPoSearch('')}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {loading ? (
                    <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#0d7676]" />
                      <span>Loading Purchase Orders...</span>
                    </div>
                  ) : purchaseOrders.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No Purchase Orders found matching "{poSearch}".
                    </div>
                  ) : (
                    purchaseOrders.map((po) => {
                      const pNo = po.sapPoNumber || po.poNumber;
                      const isSelected = poNumber === pNo;
                      return (
                        <div
                          key={pNo}
                          onClick={() => handleSelectPo(po)}
                          className={`p-2.5 hover:bg-teal-50/60 cursor-pointer transition-colors flex items-center justify-between text-xs ${
                            isSelected ? 'bg-teal-50/80 text-[#0d7676] font-bold' : 'text-slate-700'
                          }`}
                        >
                          <div className="space-y-0.5 max-w-md">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-extrabold text-slate-900">{pNo}</span>
                              <span className="px-1.5 py-0.2 text-[9px] font-extrabold uppercase rounded bg-sky-50 text-sky-700 border border-sky-200">
                                {po.status || 'Open'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium truncate">
                              {po.supplierName || 'Rayzon Vendor'}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-slate-900 block">
                              {(po.totalAmount || 2467980).toLocaleString('en-IN')} {po.currency || 'INR'}
                            </span>
                            {isSelected && <Check className="w-4 h-4 text-[#0d7676] ml-auto inline mt-0.5" />}
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

        {/* Section 2: INVOICE DETAILS */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs space-y-3 w-full">
          <h2 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-1.5">
            INVOICE DETAILS
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Invoice Number */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Invoice Number <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setInvoiceNumber(generateUniqueInvoiceNumber())}
                  className="text-[10px] font-bold text-[#0d7676] hover:underline cursor-pointer"
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
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              />
            </div>

            {/* ASN Number - Import vendor POs only */}
            {shouldShowAsn && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                    ASN Number
                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200 rounded uppercase tracking-wider">Auto</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setAsnNumber(generateASNNumber())}
                    className="text-[10px] font-bold text-[#0d7676] hover:underline cursor-pointer"
                  >
                    ⚡ Regenerate
                  </button>
                </div>
                <input
                  type="text"
                  value={asnNumber}
                  onChange={(e) => setAsnNumber(e.target.value)}
                  placeholder="e.g. ASN-2026-48291"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
                />
                <p className="text-[10px] text-slate-500 font-medium">Advance Shipment Notice for this Import vendor PO</p>
              </div>
            )}

            {/* Invoice Date */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Invoice Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => {
                  setInvoiceDate(e.target.value);
                  setErrorMsg('');
                }}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              />
            </div>

            {/* Currency */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Currency <span className="text-rose-500">*</span>
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            {/* Payment Due Date */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Payment Due Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                readOnly
                value={calculateDueDate()}
                className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 text-xs font-medium cursor-not-allowed"
              />
              <p className="text-[10px] text-[#0d7676] font-semibold">
                Auto-calculated from today's date
              </p>
            </div>

            {/* Net Days */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Net Days <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                value={dueDays}
                onChange={(e) => setDueDays(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              />
            </div>

            {/* Invoice Amount */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Invoice Amount ({currency}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={selectedPoObj?.remainingInvoiceAmount || undefined}
                value={invoiceAmount}
                onChange={(e) => {
                  setInvoiceAmount(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="0.00"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white font-mono font-bold"
              />
              {selectedPoObj && !isEditMode && (
                <p className="text-[10px] text-slate-500">Remaining: {currency} {Number(selectedPoObj.remainingInvoiceAmount || 0).toLocaleString('en-IN')}</p>
              )}
            </div>

            {/* GRN / Delivery Note No */}
            <div className="space-y-1">
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
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              />
            </div>

            {/* Remarks */}
            <div className="space-y-1 md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">Remarks</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Any additional information..."
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Section 3: GST, TDS & ADJUSTMENTS */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs space-y-3 w-full">
          <h2 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-1.5">
            GST, TDS & ADJUSTMENTS
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Invoice Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={invoiceType}
                onChange={(e) => setInvoiceType(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              >
                <option value="With GST">With GST</option>
                <option value="Without GST">Without GST</option>
                <option value="SEZ Export">SEZ Export</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                CGST Amount <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={cgstAmount}
                onChange={(e) => setCgstAmount(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                SGST Amount <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={sgstAmount}
                onChange={(e) => setSgstAmount(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                IGST Amount <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={igstAmount}
                onChange={(e) => setIgstAmount(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                TDS % (base) <span className="text-rose-500">*</span>
              </label>
              <select
                value={tdsPercentage}
                onChange={(e) => setTdsPercentage(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
              >
                <option value="0%">0%</option>
                <option value="1%">1%</option>
                <option value="2%">2%</option>
                <option value="10%">10%</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Advance Adjust <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={advanceAdjust}
                onChange={(e) => setAdvanceAdjust(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white font-mono"
              />
            </div>
          </div>
        </div>

        {/* Section 4: INVOICE DOCUMENTS */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs space-y-2 w-full">
          <h2 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-1.5">
            INVOICE DOCUMENTS {!isEditMode && <span className="text-rose-500">*</span>}
          </h2>

          <FileUploadZone
            multiple={true}
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx,.xls,.csv,.zip"
            maxSize={25}
            onFilesSelected={handleFilesSelected}
            selectedFiles={documents}
            onFileRemove={handleFileRemove}
          />
          
          {!isEditMode && (
            <p className="text-[10px] text-slate-500 font-medium">
              Upload invoice copy, delivery note, GRN copy, or other supporting documents
            </p>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => navigate('/admin/invoice-payments')}
            className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 bg-[#0d7676] hover:bg-[#0f766e] text-white font-extrabold text-xs rounded-lg shadow-2xs transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck2 className="w-4 h-4" />}
            {submitting ? 'SUBMITTING...' : isEditMode ? 'SAVE CHANGES' : 'CREATE INVOICE PAYMENT'}
          </button>
        </div>
      </form>
    </div>
  );
}
