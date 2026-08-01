import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { 
  Building2, 
  Search, 
  CheckCircle2, 
  HelpCircle,
  X,
  Loader2,
  AlertCircle,
  MapPin,
  FileText,
  CreditCard,
  ShieldCheck,
  Zap,
  Lock,
  Mail,
  Check,
  Info
} from 'lucide-react';

export default function VendorFormView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [sapSearch, setSapSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sapSuggestions, setSapSuggestions] = useState([]);
  const [searchingSap, setSearchingSap] = useState(false);
  const [selectedSupplierPreview, setSelectedSupplierPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Unified Floating Toast Notification State
  const [toast, setToast] = useState({ show: false, type: 'error', title: '', message: '' });

  const showToast = (type, title, message) => {
    setToast({ show: true, type, title, message });
    if (type === 'error') {
      setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, 4000);
    }
  };

  // Clean empty initial state - zero dummy data
  const [sapVendorCode, setSapVendorCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [vendorType, setVendorType] = useState('DOMESTIC');
  const [paymentTerms, setPaymentTerms] = useState('30 Days');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [accountStatus, setAccountStatus] = useState('Active');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [bankName, setBankName] = useState('');
  const [branch, setBranch] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');


  // Trigger search loader immediately upon typing
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSapSearch(val);
    if (val.trim()) {
      setSearchingSap(true);
    } else {
      setSearchingSap(false);
      setSapSuggestions([]);
    }
  };

  // Debounce input search (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(sapSearch.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [sapSearch]);

  // Load Initial Vendor Details if Edit Mode
  useEffect(() => {
    if (isEditMode) {
      apiFetch(`/api/vendors/${id}`)
        .then(res => res.json())
        .then(data => {
          if (data.vendor) {
            const v = data.vendor;
            setSapVendorCode(v.sapVendorCode || '');
            setCompanyName(v.companyName || '');
            setVendorType(v.vendorType || 'DOMESTIC');
            setPaymentTerms(v.paymentTerms || '30 Days');
            setContactPerson(v.contactPerson || '');
            setPhone(v.phone || '');
            setAccountStatus(v.status || 'Active');
            setEmail(v.email || '');
            setPassword(v.password || 'Rayzon@2026');
            setGstin(v.gstin || '');
            setPan(v.pan || '');
            setBankName(v.bankName || '');
            setBranch(v.branch || '');
            setAccountNumber(v.accountNumber || '');
            setIfscCode(v.ifscCode || '');
          }
        })
        .catch(() => {});
    }
  }, [id, isEditMode]);

  // Query SAP Suppliers API dynamically with normalized record mapping
  useEffect(() => {
    if (!debouncedSearch) {
      setSapSuggestions([]);
      setSearchingSap(false);
      return;
    }

    const searchLower = debouncedSearch.toLowerCase();
    setSearchingSap(true);

    apiFetch(`/api/suppliers?q=${encodeURIComponent(debouncedSearch)}`)
      .then(res => res.json())
      .then(data => {
        let rawList = [];
        if (Array.isArray(data.suppliers)) {
          rawList = data.suppliers;
        } else if (data.suppliers && typeof data.suppliers === 'object') {
          rawList = [data.suppliers];
        }

        const normalizedList = rawList.map(s => {
          const code = s.sapVendorCode || s.supplierId || s.sapPayload?.Supplier || '';
          const nameStr = s.companyName || s.name || s.sapPayload?.SupplierName || s.sapPayload?.BPSupplierName || s.sapPayload?.BPSupplierFullName || '';
          const gstinStr = s.gstin || s.taxNumber || s.sapPayload?.TaxNumber3 || '';
          const panStr = s.pan || s.sapPayload?.BusinessPartnerPanNumber || '';
          const cityStr = s.city || s.sapPayload?.CityName || s.sapPayload?.BPAddrCityName || '';
          const countryStr = s.country || s.sapPayload?.Country || '';
          const addressStr = s.address || s.sapPayload?.BPAddrStreetName || s.sapPayload?.StreetName || '';

          const sanitizedName = nameStr.toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanEmail = (s.email && s.email.includes('@')) 
            ? s.email 
            : (s.sapPayload?.EmailAddress && s.sapPayload.EmailAddress.includes('@'))
            ? s.sapPayload.EmailAddress
            : `${sanitizedName || 'vendor'}@rayzonsolar.one`;

          const acctGrp = s.sapPayload?.SupplierAccountGroup || s.accountGroup || 'Z006';

          return {
            ...s,
            sapVendorCode: code,
            supplierId: code,
            companyName: nameStr,
            name: nameStr,
            gstin: gstinStr,
            pan: panStr,
            city: cityStr,
            country: countryStr,
            address: addressStr,
            email: cleanEmail,
            contactPerson: s.contactPerson || nameStr,
            phone: s.phone || '+91 9800000000',
            bankName: s.bankName || '',
            branch: s.branch || '',
            accountNumber: s.accountNumber || '',
            ifscCode: s.ifscCode || '',
            vendorType: countryStr && countryStr !== 'IN' ? 'IMPORT' : 'DOMESTIC',
            paymentTerms: s.paymentTerms || '30 Days',
            accountGroup: acctGrp
          };
        });

        setSapSuggestions(normalizedList);
      })
      .catch(() => {
        setSapSuggestions([]);
      })
      .finally(() => setSearchingSap(false));
  }, [debouncedSearch]);

  const handleSapSearchSelect = (record) => {
    const code = record.sapVendorCode || record.supplierId || '10000071';
    const nameStr = record.companyName || record.name || 'Vendor Company';
    const gstinStr = record.gstin || '';
    const panStr = record.pan || '';

    const sanitizedName = nameStr.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanEmail = (record.email && record.email.includes('@')) 
      ? record.email 
      : `${sanitizedName || 'supplier' + code}@rayzonsolar.one`;

    const initialTempPassword = `Rayzon@${code.slice(-4) || '2026'}`;

    setSapVendorCode(code);
    setCompanyName(nameStr);
    setContactPerson(record.contactPerson || nameStr);
    setPhone(record.phone || '+91 9800000000');
    setEmail(cleanEmail);
    setPassword(initialTempPassword);
    setGstin(gstinStr);
    setPan(panStr);
    setBankName(record.bankName || 'State Bank of India');
    setBranch(record.branch || 'Main Branch');
    setAccountNumber(record.accountNumber || `**** ${code.slice(-4) || '1000'}`);
    setIfscCode(record.ifscCode || 'SBIN0000300');
    setVendorType(record.vendorType || (record.country && record.country !== 'IN' ? 'IMPORT' : 'DOMESTIC'));
    setPaymentTerms(record.paymentTerms || '30 Days');
    
    setSelectedSupplierPreview({
      code,
      name: nameStr,
      email: cleanEmail,
      password: initialTempPassword,
      gstin: gstinStr,
      pan: panStr,
      city: record.city,
      country: record.country,
      accountGroup: record.accountGroup || 'Z006'
    });

    setSapSearch('');
    setSapSuggestions([]);
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!sapVendorCode.trim()) {
      showToast('error', 'SAP Vendor Code Missing', 'SAP Vendor Code is required. Please enter a code or select a supplier from SAP S/4HANA search.');
      return;
    }
    if (!companyName.trim()) {
      showToast('error', 'Company Name Missing', 'Company Name is required. Please enter a valid company name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      showToast('error', 'Email Address Missing', 'A valid Email Address is required for portal login access.');
      return;
    }
    if (!password.trim()) {
      showToast('error', 'Password Missing', 'Password is required for vendor portal login.');
      return;
    }

    setSubmitting(true);

    const payload = {
      sapVendorCode: sapVendorCode.trim(),
      companyName: companyName.trim(),
      vendorType: vendorType || 'DOMESTIC',
      paymentTerms: paymentTerms || '30 Days',
      contactPerson: contactPerson.trim() || companyName.trim(),
      phone: phone.trim() || '+91 9800000000',
      status: accountStatus || 'Active',
      email: email.trim(),
      password: password.trim(),
      gstin: gstin.trim(),
      pan: pan.trim(),
      bankName: bankName.trim(),
      branch: branch.trim(),
      accountNumber: accountNumber.trim(),
      ifscCode: ifscCode.trim()
    };

    try {
      const url = isEditMode ? `/api/vendors/${id}` : '/api/vendors';
      const method = isEditMode ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(
          'success',
          isEditMode ? 'Vendor Account Updated' : 'Vendor Account Created',
          isEditMode
            ? `Vendor account "${companyName}" updated successfully!`
            : `Vendor account "${companyName}" created successfully! Redirecting...`
        );

        setTimeout(() => {
          navigate('/management/vendors');
        }, 1200);
      } else {
        const errData = await res.json();
        showToast('error', 'Save Failed', errData.error || 'Failed to save vendor account. Please check inputs.');
        setSubmitting(false);
      }
    } catch (err) {
      console.error('Error saving vendor account:', err);
      showToast('error', 'Network Error', 'Network error while saving vendor account.');
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full pb-16 font-sans relative">
      
      {/* Floating Toast Notification */}
      {toast.show && (
        <div className={`fixed top-5 right-5 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3.5 border transition-all duration-300 max-w-md ${
          toast.type === 'error'
            ? 'bg-rose-600 border-rose-400 text-white'
            : 'bg-[#0d7676] border-teal-300 text-white'
        }`}>
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            {toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-white" />
            ) : (
              <Check className="w-5 h-5 text-white" />
            )}
          </div>
          <div className="flex-1 pr-2">
            <p className="font-bold text-xs">{toast.title}</p>
            <p className="text-[11px] opacity-90 leading-tight">{toast.message}</p>
          </div>
          <button onClick={() => setToast(prev => ({ ...prev, show: false }))} className="text-white/80 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* COMBINED SINGLE UNIFIED TOP CARD */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm sticky top-0 z-30 space-y-4">
        
        {/* Page Title & Top Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0d7676] flex items-center justify-center border border-teal-100 flex-shrink-0 shadow-2xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
                {isEditMode ? 'Edit Vendor Account' : 'Add New Vendor Account'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Search SAP S/4HANA Master Data to auto-fill vendor credentials, email, password, and tax details.
              </p>
            </div>
          </div>

          {/* TOP ACTION BUTTONS */}
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/management/vendors')} className="text-xs font-bold">
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleSubmit} 
              loading={submitting} 
              className="bg-[#0d7676] hover:bg-[#0a5c5c] text-white font-bold shadow-sm text-xs px-4"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white mr-1.5" />
                  <span>{isEditMode ? 'Updating Vendor...' : 'Creating Vendor...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white mr-1.5" />
                  <span>{isEditMode ? 'Update Vendor Account' : 'Create Vendor Account'}</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Integrated SAP Search Bar */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-[#0d7676] flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#0d7676]" />
              Search SAP S/4HANA Master Data
            </label>
            {searchingSap && (
              <span className="text-[11px] text-teal-700 flex items-center gap-1.5 font-semibold">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0d7676]" /> Searching SAP Database...
              </span>
            )}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <Input
              type="text"
              placeholder="Type vendor name or SAP code (e.g. 30000112, 13000280, WIZ LOGTEC, Waaree)..."
              value={sapSearch}
              onChange={handleSearchChange}
              className="pl-9 bg-slate-50/60 focus:bg-white border-slate-200"
            />
            {sapSearch && (
              <button onClick={() => { setSapSearch(''); setSapSuggestions([]); setSearchingSap(false); }} className="absolute right-3 top-2.5 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Rich SAP Suggestions Dropdown */}
          {sapSearch.trim() !== '' && (
            <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-xl space-y-1.5 z-20 relative max-h-80 overflow-y-auto">
              {searchingSap ? (
                <div className="p-4 flex items-center justify-center gap-2.5 text-xs text-[#0d7676] font-semibold bg-teal-50/30 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin text-[#0d7676]" />
                  <span>Searching SAP S/4HANA Master Database for "<strong className="font-bold">{sapSearch}</strong>"...</span>
                </div>
              ) : sapSuggestions.length > 0 ? (
                sapSuggestions.map(r => (
                  <button
                    key={r.sapVendorCode || r.supplierId}
                    type="button"
                    onClick={() => handleSapSearchSelect(r)}
                    className="w-full text-left p-3 hover:bg-teal-50 rounded-xl text-xs flex justify-between items-start transition border border-slate-100 hover:border-teal-200 space-x-4"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900">{r.companyName || r.name}</p>
                        {r.accountGroup && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-semibold">
                            {r.accountGroup}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                        {r.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" /> {r.city}{r.country ? `, ${r.country}` : ''}</span>}
                        {r.email && <span className="flex items-center gap-1 text-teal-700 font-medium"><Mail className="w-3 h-3 text-teal-600" /> {r.email}</span>}
                      </div>

                      {(r.gstin || r.pan) && (
                        <div className="flex items-center gap-2 pt-1 text-[10px] font-mono text-slate-600">
                          {r.gstin && <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">GST: {r.gstin}</span>}
                          {r.pan && <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">PAN: {r.pan}</span>}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="font-mono text-teal-800 font-bold bg-teal-50 px-2 py-1 rounded-lg border border-teal-200">
                        Code: {r.sapVendorCode || r.supplierId}
                      </span>
                      <span className="text-[10px] text-teal-600 font-semibold flex items-center gap-1">
                        Click to Auto-fill <CheckCircle2 className="w-3 h-3" />
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-3.5 text-xs text-slate-500 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span>No SAP master supplier matches "<span className="font-bold text-slate-800">{sapSearch}</span>". You can enter custom details below.</span>
                </div>
              )}
            </div>
          )}

          {/* Selected SAP Supplier Banner Callout */}
          {selectedSupplierPreview && (
            <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
              <div className="flex items-center justify-between font-bold text-slate-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Auto-filled from SAP S/4HANA: <span className="text-[#0d7676]">{selectedSupplierPreview.name}</span> (Code: <code className="font-mono font-bold">{selectedSupplierPreview.code}</code>)</span>
                </div>
                <button onClick={() => setSelectedSupplierPreview(null)} className="text-emerald-700 hover:text-emerald-900 text-[11px] font-bold">Dismiss</button>
              </div>
              <div className="flex flex-wrap gap-4 text-[11px] pt-1 text-slate-600">
                <span className="flex items-center gap-1 font-semibold text-slate-800">
                  <Mail className="w-3 h-3 text-teal-600" /> Auto-filled Email: <code className="font-mono text-teal-800 bg-white px-1.5 py-0.5 rounded border">{selectedSupplierPreview.email}</code>
                </span>
                <span className="flex items-center gap-1 font-semibold text-slate-800">
                  <Lock className="w-3 h-3 text-emerald-600" /> Auto-filled Password: <code className="font-mono text-emerald-800 bg-white px-1.5 py-0.5 rounded border">{selectedSupplierPreview.password}</code>
                </span>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* 2-Column Main Form & Setup Guide Layout */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT COLUMN: Main Form Sections */}
        <div className="lg:col-span-2 space-y-6">

          {/* Section 1: Company Information */}
          <Card className="border-slate-200">
            <CardHeader className="p-5 border-b border-slate-100">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#0d7676]" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    SAP Vendor Code <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. 10000071"
                    value={sapVendorCode}
                    onChange={(e) => setSapVendorCode(e.target.value)}
                    className="font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Company Name <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. Genx Pv India Pvt. Ltd."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor Type</label>
                  <select
                    value={vendorType}
                    onChange={(e) => setVendorType(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-slate-50 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0d7676]"
                  >
                    <option value="DOMESTIC">DOMESTIC</option>
                    <option value="IMPORT">IMPORT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Terms</label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-slate-50 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0d7676]"
                  >
                    <option value="30 Days">30 Days</option>
                    <option value="60 Days">60 Days</option>
                    <option value="Advance">Advance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
                  <Input
                    type="text"
                    placeholder="Contact name"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <Input
                    type="text"
                    placeholder="+91 9000000000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Status</label>
                <select
                  value={accountStatus}
                  onChange={(e) => setAccountStatus(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-slate-50 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0d7676]"
                >
                  <option value="Active">ACTIVE — Can Sign In</option>
                  <option value="Inactive">INACTIVE</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Portal Login Credentials */}
          <Card className="border-slate-200">
            <CardHeader className="p-5 border-b border-slate-100">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0d7676]" />
                Portal Login Credentials
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
                Auto-filled when selecting a vendor from SAP. Share these with the vendor so they can log in at <span className="font-mono font-bold">/vendor/login</span>.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="email"
                    required
                    placeholder="vendor@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Tax Information */}
          <Card className="border-slate-200">
            <CardHeader className="p-5 border-b border-slate-100">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0d7676]" />
                Tax Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN / Tax Number</label>
                <Input
                  type="text"
                  placeholder="24AAAAA0000A1Z5"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  className="font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">PAN Number</label>
                <Input
                  type="text"
                  placeholder="AAAAA0000A"
                  value={pan}
                  onChange={(e) => setPan(e.target.value)}
                  className="font-mono uppercase"
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Bank Details */}
          <Card className="border-slate-200">
            <CardHeader className="p-5 border-b border-slate-100">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#0d7676]" />
                Bank Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Name</label>
                  <Input
                    type="text"
                    placeholder="State Bank of India"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Branch</label>
                  <Input
                    type="text"
                    placeholder="Mumbai Main"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Account Number</label>
                  <Input
                    type="text"
                    placeholder="000000000000"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">IFSC Code</label>
                  <Input
                    type="text"
                    placeholder="SBIN0000300"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value)}
                    className="font-mono uppercase"
                  />
                </div>
              </div>

              {/* Form Bottom Action Buttons */}
              <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => navigate('/management/vendors')}>
                  Cancel
                </Button>
                <Button type="submit" loading={submitting} variant="default" className="bg-[#0d7676] hover:bg-[#0a5c5c] text-white font-semibold">
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white mr-1.5" />
                      <span>{isEditMode ? 'Updating Vendor...' : 'Creating Vendor...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-white mr-1.5" />
                      <span>{isEditMode ? 'Update Vendor Account' : 'Create Vendor Account'}</span>
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Setup Guide & Live SAP Field Mapping */}
        <div className="space-y-6">

          {/* Setup Guide Card */}
          <Card className="border-teal-200 bg-teal-50/20">
            <CardHeader className="p-5 border-b border-teal-100">
              <CardTitle className="text-xs font-bold text-[#0d7676] flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-[#0d7676]" />
                Setup Guide
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 text-xs text-slate-600 space-y-3 leading-relaxed">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-teal-100 text-[#0d7676] font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                <p><span className="font-bold text-slate-900">Type to Search SAP</span> — search to auto-populate vendor details from 500+ master suppliers.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-teal-100 text-[#0d7676] font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                <p><span className="font-bold text-slate-900">Auto-filled Credentials</span> — portal email & temporary password are generated automatically upon selection.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-teal-100 text-[#0d7676] font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                <p><span className="font-bold text-slate-900">Portal Access</span> — vendor can log in to submit invoices at <span className="font-mono font-bold text-slate-800">/vendor/login</span>.</p>
              </div>
            </CardContent>
          </Card>

          {/* Live SAP Field Mapping Summary Card */}
          <Card className="border-slate-200">
            <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#0d7676]" /> Live SAP Field Mapping
              </CardTitle>
              <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold">LIVE</span>
            </CardHeader>
            <CardContent className="p-5 text-[11px] font-mono text-slate-600 space-y-2.5">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span>SAP Code</span>
                <span className="font-bold text-[#0d7676] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">{sapVendorCode || '—'}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span>Company Name</span>
                <span className="font-bold text-slate-900 truncate max-w-[150px]">{companyName || '—'}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span>Portal Email</span>
                <span className="font-bold text-slate-900 truncate max-w-[150px]">{email || '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Password</span>
                <span className="font-bold text-slate-900">{password ? '••••••••' : '—'}</span>
              </div>
            </CardContent>
          </Card>

        </div>
      </form>
    </div>
  );
}
