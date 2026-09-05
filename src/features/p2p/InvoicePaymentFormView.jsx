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
  Globe,
  Lock
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import FileUploadZone from '../../components/shared/FileUploadZone';

const parseDaysFromPaymentTerms = (termsStr, fallbackDays = '') => {
  if (termsStr === null || termsStr === undefined || termsStr === '') return fallbackDays;
  if (typeof termsStr === 'number' && !isNaN(termsStr)) return termsStr;
  const str = String(termsStr).trim();
  if (str.toLowerCase().includes('immediate') || str.toLowerCase().includes('advance') || str.toLowerCase().includes('cod')) return 0;
  
  const matches = str.match(/\d+/g);
  if (matches && matches.length > 0) {
    for (const numStr of matches) {
      const parsed = parseInt(numStr, 10);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
  }
  return fallbackDays;
};
import { SearchableSelect } from '../../components/ui/searchable-select';
import { CustomInput } from '../../components/ui/custom-input';

const generateUniqueInvoiceNumber = () => {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `INV-${year}-${rand}`;
};

const toISODateString = (val) => {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return new Date(val.getTime() - val.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  }
  const str = String(val).trim();
  if (!str) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  const ddmmyyyyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (ddmmyyyyMatch) {
    const day = ddmmyyyyMatch[1].padStart(2, '0');
    const month = ddmmyyyyMatch[2].padStart(2, '0');
    const year = ddmmyyyyMatch[3];
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  }
  return '';
};

const fetchNextASN = async (vendorId = '') => {
  try {
    const res = await apiFetch(`/api/p2p/invoices/next-asn${vendorId ? `?vendorId=${encodeURIComponent(vendorId)}` : ''}`);
    const json = await res.json();
    if (json.success && json.data?.asnNumber) {
      return json.data.asnNumber;
    }
  } catch (_) {}
  const year = new Date().getFullYear();
  return `ASN-${year}-0001`;
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
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [duplicateError, setDuplicateError] = useState('');
  const [checkingUnique, setCheckingUnique] = useState(false);
  const [asnNumber, setAsnNumber] = useState('');
  const [blNumber, setBlNumber] = useState('');
  const [blDate, setBlDate] = useState('');
  const [boeNumber, setBoeNumber] = useState('');
  const [boeDate, setBoeDate] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [dueDays, setDueDays] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [grnNo, setGrnNo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [fxRates, setFxRates] = useState({ USD: 83.5, EUR: 90.0, GBP: 105.0, INR: 1 });

  // Live Invoice Number Uniqueness Validation
  useEffect(() => {
    const invNo = invoiceNumber.trim();
    if (!invNo || invNo.length < 3) {
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
  }, [invoiceNumber, id]);

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

  const activeFxRate = fxRates[currency] || (currency === 'USD' ? 83.5 : currency === 'EUR' ? 90.0 : 1);

  // GST, TDS & Adjustments
  const [invoiceType, setInvoiceType] = useState('With GST');
  const [gstSubtype, setGstSubtype] = useState('intra'); // 'intra' (CGST+SGST) | 'inter' (IGST)
  const [cgstAmount, setCgstAmount] = useState('0');
  const [sgstAmount, setSgstAmount] = useState('0');
  const [igstAmount, setIgstAmount] = useState('0');
  const [tdsPercentage, setTdsPercentage] = useState('0%');
  const [advanceAdjust, setAdvanceAdjust] = useState('');
  const [invoiceQuantity, setInvoiceQuantity] = useState('');

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

  const handleGstSubtypeChange = (targetSubtype) => {
    if (targetSubtype === gstSubtype) return;

    if (targetSubtype === 'inter') {
      const intraTotal = (Number(cgstAmount) || 0) + (Number(sgstAmount) || 0);
      if (intraTotal > 0) {
        setIgstAmount(intraTotal.toFixed(2));
      }
      setGstSubtype('inter');
    } else {
      const currentIgst = Number(igstAmount) || 0;
      if (currentIgst > 0) {
        const half = (currentIgst / 2).toFixed(2);
        setCgstAmount(half);
        setSgstAmount(half);
      }
      setGstSubtype('intra');
    }
  };

  // Upload - Changed from single file to multiple documents
  const [sendApprovalTo, setSendApprovalTo] = useState('');
  const [documents, setDocuments] = useState([]);

  const calculateDueDateISO = () => {
    const baseDate = (isImportVendor && blDate) ? blDate : invoiceDate;
    if (!baseDate || dueDays === '' || dueDays === null || dueDays === undefined) return undefined;
    const d = new Date(`${baseDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return undefined;
    d.setDate(d.getDate() + Number(dueDays || 0));
    return d.toISOString();
  };

  const calculateDueDate = () => {
    const iso = calculateDueDateISO();
    if (!iso) {
      if (!poNumber) return 'Select Purchase Order';
      if (isImportVendor && !blDate) return 'Enter BL Date to calculate due date';
      if (!invoiceDate && !isImportVendor) return 'Select Supplier Invoice Date';
      return isImportVendor ? 'Enter BL Date' : 'Select Supplier Invoice Date';
    }
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Fetch POs from API (server-side filtered when searching)
  const fetchPurchaseOrders = async (searchTerm = '') => {
    try {
      if (searchTerm) setSearching(true);
      else setLoading(true);

      const limit = 50;
      const query = searchTerm ? `?q=${encodeURIComponent(searchTerm)}&size=${limit}` : `?size=${limit}`;
      const res = await apiFetch(`/api/p2p/purchase-orders${query}`);
      const data = await res.json();
      if (res.ok && data.data) {
        setPurchaseOrders(data.data.filter((po) =>
          !['closed', 'cancelled', 'canceled', 'blocked'].includes(String(po.status || '').toLowerCase())
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
            setAsnNumber(inv.asnNumber || '');
            setBlNumber(inv.blNumber || '');
            setBlDate(toISODateString(inv.blDate));
            setBoeNumber(inv.boeNumber || '');
            setBoeDate(toISODateString(inv.boeDate));
            setInvoiceDate(toISODateString(inv.invoiceDate));
            setInvoiceAmount(inv.grossAmount || '');
            setGrnNo(inv.grnNumber || '');
            setCgstAmount(inv.cgstAmount != null ? String(inv.cgstAmount) : '0');
            setSgstAmount(inv.sgstAmount != null ? String(inv.sgstAmount) : '0');
            setIgstAmount(inv.igstAmount != null ? String(inv.igstAmount) : '0');
            if (inv.invoiceType) {
              setInvoiceType(inv.invoiceType);
            } else if ((Number(inv.cgstAmount) || Number(inv.sgstAmount) || Number(inv.igstAmount) || Number(inv.gstAmount)) > 0) {
              setInvoiceType('With GST');
            }
            if (inv.gstSubtype) {
              setGstSubtype(inv.gstSubtype);
            } else if (inv.igstAmount && Number(inv.igstAmount) > 0) {
              setGstSubtype('inter');
            } else {
              setGstSubtype('intra');
            }
            if (inv.threeWayMatch?.invoiceQuantity) setInvoiceQuantity(String(inv.threeWayMatch.invoiceQuantity));
            setTdsPercentage(`${inv.tdsPercentage || 0}%`);
            setAdvanceAdjust(inv.advanceAdjusted || '0');
            setSendApprovalTo(inv.approvalTo || '');

            // Load existing attached documents in Edit Mode
            apiFetch(`/api/documents?documentableType=InvoicePayment&documentableId=${id}`)
              .then(r => r.json())
              .then(docData => {
                const apiDocs = docData.success && Array.isArray(docData.data) ? docData.data : [];
                const invDocs = Array.isArray(inv.supportingDocuments) ? inv.supportingDocuments : [];
                const combined = [...invDocs, ...apiDocs];
                const unique = [];
                const seen = new Set();
                for (const d of combined) {
                  const key = d.documentId || d.fileUrl || d.fileName;
                  if (key && !seen.has(key)) {
                    seen.add(key);
                    unique.push(d);
                  }
                }
                setDocuments(unique);
              })
              .catch(() => {
                if (Array.isArray(inv.supportingDocuments) && inv.supportingDocuments.length > 0) {
                  setDocuments(inv.supportingDocuments);
                }
              });
          }
        })
        .catch(err => console.error(err));
    }
  }, [id]);

  useEffect(() => {
    if (!poNumber || selectedPoObj) return;
    const po = purchaseOrders.find((item) => (item.sapPoNumber || item.poNumber) === poNumber);
    if (po) {
      setSelectedPoObj(po);
      if (po.currency) setCurrency(po.currency);
      const terms = po.paymentTerms || po.creditDays;
      if (terms) {
        setDueDays(parseDaysFromPaymentTerms(terms, 30));
      }
    } else {
      apiFetch(`/api/p2p/purchase-orders?search=${encodeURIComponent(poNumber)}`)
        .then(res => res.json())
        .then(data => {
          if (data.data && data.data.length > 0) {
            const foundPo = data.data.find(item => (item.sapPoNumber || item.poNumber) === poNumber) || data.data[0];
            setSelectedPoObj(foundPo);
            if (foundPo.currency) setCurrency(foundPo.currency);
            const terms = foundPo.paymentTerms || foundPo.creditDays;
            if (terms) {
              setDueDays(parseDaysFromPaymentTerms(terms, 30));
            }
            setPurchaseOrders(prev => {
              const key = foundPo.sapPoNumber || foundPo.poNumber;
              if (prev.some(p => (p.sapPoNumber || p.poNumber) === key)) return prev;
              return [foundPo, ...prev];
            });
          }
        })
        .catch(() => {});
    }
  }, [poNumber, purchaseOrders, selectedPoObj]);

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
    const terms = po.paymentTerms || po.creditDays;
    if (terms) {
      const parsedDays = parseDaysFromPaymentTerms(terms, 30);
      setDueDays(parsedDays);
    }
    const isImport = String(po.vendorType || '').toLowerCase().includes('import');
    if (isImport && !asnNumber) {
      fetchNextASN(po.supplierId || po.vendorId).then((nextAsn) => setAsnNumber(nextAsn));
    } else if (!isImport) {
      setAsnNumber('');
    }
    if (!invoiceAmount) setInvoiceAmount(po.remainingInvoiceAmount ?? po.totalAmount ?? '');
  };

  const handleFilesSelected = (newFiles) => {
    setDocuments(prev => [...prev, ...newFiles]);
    setErrorMsg('');
  };

  const handleFileRemove = async (index, targetDoc) => {
    const doc = targetDoc || documents[index];
    if (doc?.documentId) {
      apiFetch(`/api/documents/${doc.documentId}`, { method: 'DELETE' }).catch(() => {});
    }
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
      const msg = 'Invoice Number is required. Enter vendor invoice number to continue.';
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
    if (!invoiceType) {
      const msg = 'Invoice Type is required.';
      setErrorMsg(msg);
      showToast({ title: 'Invoice Type Required', description: msg, type: 'error' });
      return;
    }
    const isImportPO = String(selectedPoObj?.vendorType || '').toLowerCase().includes('import');
    const cleanAsn = asnNumber.trim().toUpperCase();
    if (isImportPO && (!cleanAsn || cleanAsn.length < 3)) {
      const msg = 'Invalid ASN Number. ASN Number (Advance Shipping Notice) is required for import PO invoice requests.';
      setErrorMsg(msg);
      showToast({ title: 'Invalid ASN Number', description: msg, type: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      const numTdsPct = parseFloat(String(tdsPercentage).replace('%', '')) || 0;
      
      const payload = {
        poNumber,
        invoiceNumber: invoiceNumber.trim(),
        asnNumber: cleanAsn,
        blNumber: blNumber.trim(),
        blDate: blDate || undefined,
        boeNumber: boeNumber.trim(),
        boeDate: boeDate || undefined,
        invoiceDate,
        dueDays: Number(dueDays),
        paymentDueDate: calculateDueDateISO(),
        dueDate: calculateDueDateISO(),
        grossAmount: Number(invoiceAmount) || 0,
        currency,
        fxRate: activeFxRate,
        invoiceQuantity: Number(invoiceQuantity) || undefined,
        grnQuantity: 0,
        invoiceType,
        gstSubtype,
        cgstAmount: cgstNum.toString(),
        sgstAmount: sgstNum.toString(),
        igstAmount: igstNum.toString(),
        gstAmount: totalGst,
        tdsAmount: tdsDeduction,
        tdsPercentage: tdsPctNum,
        advanceAdjusted: advanceAdjNum,
        netPayable,
        grnNumber: grnNo || '',
        remarks: remarks.trim(),
        approvalTo: sendApprovalTo,
        vendorType: selectedPoObj?.vendorType || '',
        supportingDocuments: documents.filter(d => !d.file)
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
        const invoiceId = data.data?.invoicePaymentId || data.data?.invoiceId || id;

        // Step 2: Upload documents if any new files are attached (both Create and Edit mode)
        const newFiles = documents.filter(doc => doc.file);
        if (newFiles.length > 0 && invoiceId) {
          const formData = new FormData();
          newFiles.forEach(doc => {
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
  const shouldShowAsn = isImportVendor;

  return (
    <div className="w-full space-y-3 font-sans pb-10 text-left">
      <form onSubmit={handleSubmit} noValidate className="space-y-3 w-full">
        {/* ─── HEADER BAR ─── */}
        <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between flex-wrap gap-2">
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
          </h2>

          <div className="space-y-1.5 relative z-50" ref={dropdownRef}>
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
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in-50 zoom-in-95">
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
              </div>
              <CustomInput
                type="text"
                value={invoiceNumber}
                onChange={(e) => {
                  setInvoiceNumber(e.target.value);
                  setDuplicateError('');
                  setErrorMsg('');
                }}
                placeholder="Enter vendor invoice number (e.g. INV/2026/001)"
                size="md"
                inputClassName={`font-mono font-bold ${duplicateError ? 'border-rose-400 focus:ring-rose-500' : ''}`}
              />
              {checkingUnique && (
                <p className="text-[10px] text-teal-600 font-medium flex items-center gap-1 mt-0.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Checking invoice number uniqueness...
                </p>
              )}
              {duplicateError && (
                <p className="text-[11px] text-rose-600 font-bold mt-0.5">
                  ❌ {duplicateError}
                </p>
              )}
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
                    onClick={async () => {
                      const nextAsn = await fetchNextASN(selectedPoObj?.supplierId || selectedPoObj?.vendorId);
                      setAsnNumber(nextAsn);
                    }}
                    className="text-[10px] font-bold text-[#0d7676] hover:underline cursor-pointer"
                  >
                    ⚡ Regenerate
                  </button>
                </div>
                <input
                  type="text"
                  value={asnNumber}
                  onChange={(e) => setAsnNumber(e.target.value)}
                  placeholder="e.g. ASN-2026-001"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
                />
                <p className="text-[10px] text-slate-500 font-medium">Advance Shipment Notice for this Import vendor PO</p>
              </div>
            )}

            {/* BL Number & BL Date */}
            {/* <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                BL Number (Bill of Lading Number)
              </label>
              <CustomInput
                type="text"
                value={blNumber}
                onChange={(e) => setBlNumber(e.target.value)}
                placeholder="e.g. BL-2026-9901"
                size="md"
                inputClassName="font-mono font-bold"
              />
            </div> */}

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                BL Date (Bill of Lading Date)
              </label>
              <CustomInput
                type="date"
                value={blDate}
                onChange={(e) => setBlDate(e.target.value)}
                size="md"
              />
            </div>

            {/* Invoice Date */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Invoice Date <span className="text-rose-500">*</span>
              </label>
              <CustomInput
                type="date"
                value={invoiceDate}
                onChange={(e) => {
                  setInvoiceDate(e.target.value);
                  setErrorMsg('');
                }}
                size="md"
              />
            </div>

            {/* Currency */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Currency <span className="text-rose-500">*</span>
              </label>
              <SearchableSelect
                options={[
                  { label: 'INR', value: 'INR' },
                  { label: 'USD', value: 'USD' },
                  { label: 'EUR', value: 'EUR' }
                ]}
                value={currency}
                onChange={(val) => setCurrency(val)}
                size="md"
                searchable={false}
              />
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
                {dueDays !== '' ? (
                  isImportVendor
                    ? (blDate ? `Auto-calculated: BL Date (${blDate}) + ${dueDays} days` : 'Enter BL Date to compute due date')
                    : (invoiceDate ? `Auto-calculated: Invoice Date (${invoiceDate}) + ${dueDays} days` : 'Select Invoice Date to compute due date')
                ) : (
                  'Select a Purchase Order to compute due date'
                )}
              </p>
            </div>

            {/* Net Days */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Payment Credit Days (Net Days) <span className="text-rose-500">*</span>
                </label>
              </div>
              <input
                type="number"
                value={dueDays !== '' && dueDays !== null && dueDays !== undefined ? dueDays : ''}
                onChange={(e) => setDueDays(e.target.value)}
                placeholder="Enter credit days (e.g. 30, 60)"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 text-xs font-bold font-mono outline-none focus:border-[#0d7676] focus:ring-2 focus:ring-teal-100 transition"
              />
              <p className="text-[10px] text-slate-400 font-medium">
                {poNumber && dueDays !== '' ? (
                  `Auto-populated from Payment Terms. You can adjust credit days manually.`
                ) : (
                  'Select a Purchase Order or enter Payment Credit Days.'
                )}
              </p>
            </div>

            {/* Invoice Amount */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Invoice Amount ({currency}) <span className="text-rose-500">*</span>
              </label>
              <CustomInput
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
                size="md"
                inputClassName="font-mono font-bold"
              />
              {selectedPoObj && !isEditMode && (
                <p className="text-[10px] text-slate-500">Remaining: {currency} {Number(selectedPoObj.remainingInvoiceAmount || 0).toLocaleString('en-IN')}</p>
              )}
              {currency !== 'INR' && Number(invoiceAmount) > 0 && (
                <div className="mt-1.5 p-2 bg-teal-50/90 border border-teal-200 rounded-lg text-[11px] flex items-center justify-between font-mono">
                  <span className="text-teal-700 font-semibold">1 {currency} = ₹{activeFxRate}</span>
                  <span className="text-teal-900 font-extrabold">INR Equivalent: ₹{((Number(invoiceAmount) || 0) * activeFxRate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>

            {/* Delivered Quantity */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Delivered Quantity {Number(selectedPoObj?.totalQuantity) > 0 && <span className="text-rose-500">*</span>}
              </label>
              <CustomInput
                type="number"
                min="0.01"
                step="0.01"
                max={Number(selectedPoObj?.remainingQuantity) > 0 ? selectedPoObj.remainingQuantity : undefined}
                value={invoiceQuantity}
                onChange={(e) => { setInvoiceQuantity(e.target.value); setErrorMsg(''); }}
                placeholder="Enter quantity delivered"
                disabled={!poNumber && !selectedPoObj}
                size="md"
              />
              {Number(selectedPoObj?.totalQuantity) > 0 && (
                <p className="text-[10px] font-semibold text-slate-500">Remaining PO quantity: {selectedPoObj.remainingQuantity} units</p>
              )}
            </div>

            {/* Remarks */}
            <div className="space-y-1 md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">Remarks</label>
              <CustomInput
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Any additional information..."
                size="md"
              />
            </div>
          </div>
        </div>

        {/* Section 3: GST, TDS & ADJUSTMENTS */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs space-y-3 w-full">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 flex-wrap gap-2">
            <h2 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
              TAXES, TDS & ADVANCE ADJUSTMENT
            </h2>

            {/* Quick GST Preset Buttons */}
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Invoice Tax Category */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Invoice Tax Category <span className="text-rose-500">*</span>
              </label>
              <SearchableSelect
                options={[
                  { label: 'With GST (Taxable Purchase)', value: 'With GST' },
                  { label: 'Without GST (Exempt / Non-Taxable)', value: 'Without GST' },
                  { label: 'SEZ Export (Zero-Rated Tax)', value: 'SEZ Export' }
                ]}
                value={invoiceType}
                onChange={(val) => {
                  setInvoiceType(val);
                  if (val !== 'With GST') {
                    setCgstAmount('0');
                    setSgstAmount('0');
                    setIgstAmount('0');
                  }
                }}
                size="md"
                searchable={false}
              />
            </div>

            {/* GST Subtype Toggle (Intra vs Inter state) */}
            {invoiceType === 'With GST' ? (
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  GST Supply Type <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => handleGstSubtypeChange('intra')}
                    className={`flex-1 py-1.5 rounded-md font-bold text-center transition-all ${
                      gstSubtype === 'intra' ? 'bg-white text-[#0d7676] shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Intra-State (CGST + SGST)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGstSubtypeChange('inter')}
                    className={`flex-1 py-1.5 rounded-md font-bold text-center transition-all ${
                      gstSubtype === 'inter' ? 'bg-white text-[#0d7676] shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Inter-State (IGST)
                  </button>
                </div>
              </div>
            ) : (
              <div className="md:col-span-2 p-2 bg-slate-50 border border-slate-200/80 rounded-lg text-slate-500 text-xs font-medium flex items-center gap-2">
                <span>Exempt / Non-Taxable invoice selected. GST calculation disabled.</span>
              </div>
            )}

            {/* Intra State GST Amounts */}
            {invoiceType === 'With GST' && gstSubtype === 'intra' && (
              <>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">CGST Amount</label>
                  <CustomInput
                    type="number"
                    step="0.01"
                    value={cgstAmount}
                    onChange={(e) => setCgstAmount(e.target.value)}
                    size="md"
                    inputClassName="font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">SGST Amount</label>
                  <CustomInput
                    type="number"
                    step="0.01"
                    value={sgstAmount}
                    onChange={(e) => setSgstAmount(e.target.value)}
                    size="md"
                    inputClassName="font-mono font-bold"
                  />
                </div>
              </>
            )}

            {/* Inter State IGST Amount */}
            {invoiceType === 'With GST' && gstSubtype === 'inter' && (
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">IGST Amount</label>
                <CustomInput
                  type="number"
                  step="0.01"
                  value={igstAmount}
                  onChange={(e) => setIgstAmount(e.target.value)}
                  size="md"
                  inputClassName="font-mono font-bold"
                />
              </div>
            )}

            {/* TDS % */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                TDS % (Deduction Rate)
              </label>
              <SearchableSelect
                options={[
                  { label: '0% — No TDS Deduction', value: '0%' },
                  { label: '1% — Section 194C (Individual / HUF)', value: '1%' },
                  { label: '2% — Section 194C (Company / Others)', value: '2%' },
                  { label: '10% — Section 194J (Professional Services)', value: '10%' }
                ]}
                value={tdsPercentage}
                onChange={(val) => setTdsPercentage(val)}
                size="md"
                searchable={false}
              />
            </div>

            {/* Advance to Adjust */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Advance Adjustment
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={advanceAdjust}
                onChange={(e) => setAdvanceAdjust(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] focus:bg-white font-mono font-bold"
              />
            </div>
          </div>

          {/* Live Financial Calculation Breakdown Card */}
          <div className="mt-3 bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs space-y-2 font-sans">
            <div className="flex items-center justify-between text-slate-600 font-semibold border-b border-slate-200/60 pb-1.5">
              <span>Base Invoice Amount:</span>
              <span className="font-mono font-bold text-slate-900">{currency} {invoiceAmountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            {invoiceType === 'With GST' && (
              <div className="flex items-center justify-between text-slate-600 font-semibold border-b border-slate-200/60 pb-1.5">
                <span>Total GST Tax ({gstSubtype === 'intra' ? 'CGST + SGST' : 'IGST'}):</span>
                <span className="font-mono font-bold text-emerald-700">+ {currency} {totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-slate-700 font-bold border-b border-slate-200/60 pb-1.5">
              <span>Gross Total Amount:</span>
              <span className="font-mono font-extrabold text-slate-900">{currency} {grossTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            {tdsDeduction > 0 && (
              <div className="flex items-center justify-between text-slate-600 font-semibold border-b border-slate-200/60 pb-1.5">
                <span>TDS Deduction ({tdsPercentage}):</span>
                <span className="font-mono font-bold text-rose-600">- {currency} {tdsDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            )}

            {advanceAdjNum > 0 && (
              <div className="flex items-center justify-between text-slate-600 font-semibold border-b border-slate-200/60 pb-1.5">
                <span>Advance Adjustment:</span>
                <span className="font-mono font-bold text-amber-700">- {currency} {advanceAdjNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1 text-sm font-black">
              <span className="text-[#0d7676]">Net Payable Amount:</span>
              <span className="font-mono font-extrabold text-[#0d7676] bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                {currency} {netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
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
