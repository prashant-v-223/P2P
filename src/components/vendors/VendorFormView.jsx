import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Info,
  User,
  Phone,
  Banknote,
  Globe,
  Calendar
} from 'lucide-react';

// ============================================
// CUSTOM HOOKS
// ============================================

/**
 * Custom hook for managing toast notifications
 */
const useToast = () => {
  const [toast, setToast] = useState({ 
    show: false, 
    type: 'error', 
    title: '', 
    message: '' 
  });

  const showToast = useCallback((type, title, message) => {
    setToast({ show: true, type, title, message });
    if (type === 'error') {
      const timer = setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, []);

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, show: false }));
  }, []);

  return { toast, showToast, hideToast };
};

/**
 * Custom hook for debouncing search input
 */
const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value.trim());
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const normalizeSupplierData = (supplier) => {
  const code = supplier.sapVendorCode || supplier.supplierId || supplier.sapPayload?.Supplier || '';
  const nameStr = supplier.companyName || supplier.name || 
                  supplier.sapPayload?.SupplierName || 
                  supplier.sapPayload?.BPSupplierName || 
                  supplier.sapPayload?.BPSupplierFullName || '';
  
  const sanitizedName = nameStr.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanEmail = (supplier.email && supplier.email.includes('@')) 
    ? supplier.email 
    : (supplier.sapPayload?.EmailAddress && supplier.sapPayload.EmailAddress.includes('@'))
      ? supplier.sapPayload.EmailAddress
      : `${sanitizedName || 'vendor'}@rayzonsolar.one`;

  return {
    ...supplier,
    sapVendorCode: code,
    supplierId: code,
    companyName: nameStr,
    name: nameStr,
    gstin: supplier.gstin || supplier.taxNumber || supplier.sapPayload?.TaxNumber3 || '',
    pan: supplier.pan || supplier.sapPayload?.BusinessPartnerPanNumber || '',
    city: supplier.city || supplier.sapPayload?.CityName || supplier.sapPayload?.BPAddrCityName || '',
    country: supplier.country || supplier.sapPayload?.Country || '',
    address: supplier.address || supplier.sapPayload?.BPAddrStreetName || supplier.sapPayload?.StreetName || '',
    email: cleanEmail,
    contactPerson: supplier.contactPerson || nameStr,
    phone: supplier.phone || '+91 9800000000',
    bankName: supplier.bankName || '',
    branch: supplier.branch || '',
    accountNumber: supplier.accountNumber || '',
    ifscCode: supplier.ifscCode || '',
    vendorType: supplier.country && supplier.country !== 'IN' ? 'IMPORT' : 'DOMESTIC',
    paymentTerms: supplier.paymentTerms || '30 Days',
    accountGroup: supplier.accountGroup || supplier.sapPayload?.SupplierAccountGroup || 'Z006'
  };
};

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * Toast Notification Component
 */
const ToastNotification = ({ toast, onClose }) => {
  if (!toast.show) return null;

  const isError = toast.type === 'error';
  const bgColor = isError ? 'bg-rose-600 border-rose-400' : 'bg-[#0d7676] border-teal-300';
  const Icon = isError ? AlertCircle : Check;

  return (
    <div className={`fixed top-5 right-5 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3.5 border transition-all duration-300 max-w-md ${bgColor} text-white`}>
      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 pr-2">
        <p className="font-bold text-xs">{toast.title}</p>
        <p className="text-[11px] opacity-90 leading-tight">{toast.message}</p>
      </div>
      <button 
        onClick={onClose} 
        className="text-white/80 hover:text-white transition-colors"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

/**
 * SAP Search Suggestions Dropdown
 */
const SuggestionItem = ({ supplier, onSelect, searchTerm }) => {
  const handleSelect = useCallback(() => {
    onSelect(supplier);
  }, [supplier, onSelect]);

  return (
    <button
      type="button"
      onClick={handleSelect}
      className="w-full text-left p-3 hover:bg-teal-50 rounded-xl text-xs flex justify-between items-start transition border border-slate-100 hover:border-teal-200 space-x-4"
    >
      <div className="space-y-1 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-slate-900 truncate">{supplier.companyName || supplier.name}</p>
          {supplier.accountGroup && (
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-semibold whitespace-nowrap">
              {supplier.accountGroup}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium flex-wrap">
          {supplier.city && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400" /> 
              {supplier.city}{supplier.country ? `, ${supplier.country}` : ''}
            </span>
          )}
          {supplier.email && (
            <span className="flex items-center gap-1 text-teal-700 font-medium truncate">
              <Mail className="w-3 h-3 text-teal-600 flex-shrink-0" /> 
              <span className="truncate">{supplier.email}</span>
            </span>
          )}
        </div>

        {(supplier.gstin || supplier.pan) && (
          <div className="flex items-center gap-2 pt-1 text-[10px] font-mono text-slate-600 flex-wrap">
            {supplier.gstin && (
              <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                GST: {supplier.gstin}
              </span>
            )}
            {supplier.pan && (
              <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                PAN: {supplier.pan}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="font-mono text-teal-800 font-bold bg-teal-50 px-2 py-1 rounded-lg border border-teal-200 text-[10px]">
          Code: {supplier.sapVendorCode || supplier.supplierId}
        </span>
        <span className="text-[10px] text-teal-600 font-semibold flex items-center gap-1">
          Click to Auto-fill <CheckCircle2 className="w-3 h-3" />
        </span>
      </div>
    </button>
  );
};

/**
 * SAP Search Component
 */
const SapiSearch = ({ 
  searchValue, 
  onSearchChange, 
  suggestions, 
  isLoading, 
  onSelect,
  selectedSupplier,
  onDismiss
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  const handleClear = useCallback(() => {
    onSearchChange('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [onSearchChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-[#0d7676] flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-[#0d7676]" />
          Search SAP S/4HANA Master Data
        </label>
        {isLoading && (
          <span className="text-[11px] text-teal-700 flex items-center gap-1.5 font-semibold">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0d7676]" /> 
            Searching SAP Database...
          </span>
        )}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Type vendor name or SAP code (e.g. 30000112, 13000280, WIZ LOGTEC, Waaree)..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          className="pl-9 bg-slate-50/60 focus:bg-white border-slate-200"
          aria-label="Search SAP vendors"
        />
        {searchValue && (
          <button 
            onClick={handleClear} 
            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {searchValue.trim() !== '' && isFocused && (
        <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-xl space-y-1.5 z-20 relative max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 flex items-center justify-center gap-2.5 text-xs text-[#0d7676] font-semibold bg-teal-50/30 rounded-lg">
              <Loader2 className="w-4 h-4 animate-spin text-[#0d7676]" />
              <span>
                Searching SAP S/4HANA Master Database for "<strong className="font-bold">{searchValue}</strong>"...
              </span>
            </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((supplier, index) => (
              <SuggestionItem
                key={supplier.sapVendorCode || supplier.supplierId || index}
                supplier={supplier}
                onSelect={onSelect}
                searchTerm={searchValue}
              />
            ))
          ) : (
            <div className="p-3.5 text-xs text-slate-500 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span>
                No SAP master supplier matches "<span className="font-bold text-slate-800">{searchValue}</span>". 
                You can enter custom details below.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Selected Supplier Preview */}
      {selectedSupplier && (
        <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
          <div className="flex items-center justify-between font-bold text-slate-900">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="truncate">
                Auto-filled from SAP S/4HANA: <span className="text-[#0d7676]">{selectedSupplier.name}</span> 
                (Code: <code className="font-mono font-bold">{selectedSupplier.code}</code>)
              </span>
            </div>
            <button 
              onClick={onDismiss} 
              className="text-emerald-700 hover:text-emerald-900 text-[11px] font-bold flex-shrink-0 ml-2"
            >
              Dismiss
            </button>
          </div>
          <div className="flex flex-wrap gap-4 text-[11px] pt-1 text-slate-600">
            <span className="flex items-center gap-1 font-semibold text-slate-800">
              <Mail className="w-3 h-3 text-teal-600 flex-shrink-0" /> 
              Auto-filled Email: <code className="font-mono text-teal-800 bg-white px-1.5 py-0.5 rounded border truncate max-w-[150px]">
                {selectedSupplier.email}
              </code>
            </span>
            <span className="flex items-center gap-1 font-semibold text-slate-800">
              <Lock className="w-3 h-3 text-emerald-600 flex-shrink-0" /> 
              Auto-filled Password: <code className="font-mono text-emerald-800 bg-white px-1.5 py-0.5 rounded border">
                {selectedSupplier.password}
              </code>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Form Field Component
 */
const FormField = ({ 
  label, 
  required, 
  error, 
  icon: Icon, 
  wide, 
  children,
  className = '' 
}) => {
  return (
    <div className={`${wide ? 'md:col-span-2' : ''} ${className}`}>
      <label className="block text-xs font-semibold text-slate-700 mb-1">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-rose-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
};

/**
 * Form Section Component
 */
const FormSection = ({ title, icon: Icon, description, children }) => {
  return (
    <Card className="border-slate-200">
      <CardHeader className="p-5 border-b border-slate-100">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-[#0d7676]" />}
          {title}
        </CardTitle>
        {description && (
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        )}
      </CardHeader>
      <CardContent className="p-6">
        {children}
      </CardContent>
    </Card>
  );
};

/**
 * Setup Guide Component
 */
const SetupGuide = () => {
  const steps = [
    {
      number: 1,
      title: 'Type to Search SAP',
      description: 'Search to auto-populate vendor details from 500+ master suppliers.'
    },
    {
      number: 2,
      title: 'Auto-filled Credentials',
      description: 'Portal email & temporary password are generated automatically upon selection.'
    },
    {
      number: 3,
      title: 'Portal Access',
      description: 'Vendor can log in to submit invoices at /vendor/login.'
    }
  ];

  return (
    <Card className="border-teal-200 bg-teal-50/20">
      <CardHeader className="p-5 border-b border-teal-100">
        <CardTitle className="text-xs font-bold text-[#0d7676] flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-[#0d7676]" />
          Setup Guide
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 text-xs text-slate-600 space-y-3 leading-relaxed">
        {steps.map((step) => (
          <div key={step.number} className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-teal-100 text-[#0d7676] font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
              {step.number}
            </span>
            <p>
              <span className="font-bold text-slate-900">{step.title}</span> — {step.description}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

/**
 * Live SAP Field Mapping Summary
 */
const FieldMappingSummary = ({ fields }) => {
  const fieldItems = useMemo(() => [
    { label: 'SAP Code', value: fields.sapVendorCode || '—', highlight: true },
    { label: 'Company Name', value: fields.companyName || '—', truncate: true },
    { label: 'Portal Email', value: fields.email || '—', truncate: true },
    { label: 'Password', value: fields.password ? '••••••••' : '—' }
  ], [fields]);

  return (
    <Card className="border-slate-200">
      <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-bold flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-[#0d7676]" /> Live SAP Field Mapping
        </CardTitle>
        <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold">LIVE</span>
      </CardHeader>
      <CardContent className="p-5 text-[11px] font-mono text-slate-600 space-y-2.5">
        {fieldItems.map((item, index) => (
          <div 
            key={item.label} 
            className={`flex justify-between items-center ${index < fieldItems.length - 1 ? 'pb-2 border-b border-slate-100' : ''}`}
          >
            <span>{item.label}</span>
            <span className={`font-bold ${item.highlight ? 'text-[#0d7676] bg-teal-50 px-2 py-0.5 rounded border border-teal-200' : 'text-slate-900'} ${item.truncate ? 'truncate max-w-[150px]' : ''}`}>
              {item.value}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function VendorFormView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  // Toast notification
  const { toast, showToast, hideToast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    sapVendorCode: '',
    companyName: '',
    vendorType: 'DOMESTIC',
    paymentTerms: '30 Days',
    contactPerson: '',
    phone: '',
    accountStatus: 'Active',
    email: '',
    password: '',
    gstin: '',
    pan: '',
    bankName: '',
    branch: '',
    accountNumber: '',
    ifscCode: ''
  });

  // SAP search state
  const [sapSearch, setSapSearch] = useState('');
  const [sapSuggestions, setSapSuggestions] = useState([]);
  const [searchingSap, setSearchingSap] = useState(false);
  const [selectedSupplierPreview, setSelectedSupplierPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEditMode);

  // Debounced search
  const debouncedSearch = useDebounce(sapSearch);

  // ============================================
  // EFFECTS
  // ============================================

  // Load initial vendor data for edit mode
  useEffect(() => {
    if (!isEditMode) return;

    const loadVendor = async () => {
      try {
        setLoading(true);
        const response = await apiFetch(`/api/vendors/${id}`);
        const data = await response.json();

        if (data.vendor) {
          const v = data.vendor;
          setFormData({
            sapVendorCode: v.sapVendorCode || '',
            companyName: v.companyName || '',
            vendorType: v.vendorType || 'DOMESTIC',
            paymentTerms: v.paymentTerms || '30 Days',
            contactPerson: v.contactPerson || '',
            phone: v.phone || '',
            accountStatus: v.status || 'Active',
            email: v.email || '',
            password: v.password || 'Rayzon@2026',
            gstin: v.gstin || '',
            pan: v.pan || '',
            bankName: v.bankName || '',
            branch: v.branch || '',
            accountNumber: v.accountNumber || '',
            ifscCode: v.ifscCode || ''
          });
        }
      } catch (error) {
        console.error('Error loading vendor:', error);
        showToast('error', 'Load Failed', 'Failed to load vendor data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadVendor();
  }, [id, isEditMode, showToast]);

  // Search SAP suppliers
  useEffect(() => {
    if (!debouncedSearch) {
      setSapSuggestions([]);
      setSearchingSap(false);
      return;
    }

    const searchSuppliers = async () => {
      try {
        setSearchingSap(true);
        const response = await apiFetch(`/api/suppliers?q=${encodeURIComponent(debouncedSearch)}`);
        const data = await response.json();

        let rawList = [];
        if (Array.isArray(data.suppliers)) {
          rawList = data.suppliers;
        } else if (data.suppliers && typeof data.suppliers === 'object') {
          rawList = [data.suppliers];
        }

        const normalizedList = rawList.map(normalizeSupplierData);
        setSapSuggestions(normalizedList);
      } catch (error) {
        console.error('Error searching suppliers:', error);
        setSapSuggestions([]);
      } finally {
        setSearchingSap(false);
      }
    };

    searchSuppliers();
  }, [debouncedSearch]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleFormChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSapSearchSelect = useCallback((record) => {
    const code = record.sapVendorCode || record.supplierId || '10000071';
    const nameStr = record.companyName || record.name || 'Vendor Company';
    const sanitizedName = nameStr.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanEmail = (record.email && record.email.includes('@')) 
      ? record.email 
      : `${sanitizedName || 'supplier' + code}@rayzonsolar.one`;
    const initialTempPassword = `Rayzon@${code.slice(-4) || '2026'}`;

    setFormData({
      sapVendorCode: code,
      companyName: nameStr,
      contactPerson: record.contactPerson || nameStr,
      phone: record.phone || '+91 9800000000',
      email: cleanEmail,
      password: initialTempPassword,
      gstin: record.gstin || '',
      pan: record.pan || '',
      bankName: record.bankName || 'State Bank of India',
      branch: record.branch || 'Main Branch',
      accountNumber: record.accountNumber || `**** ${code.slice(-4) || '1000'}`,
      ifscCode: record.ifscCode || 'SBIN0000300',
      vendorType: record.vendorType || (record.country && record.country !== 'IN' ? 'IMPORT' : 'DOMESTIC'),
      paymentTerms: record.paymentTerms || '30 Days',
      accountStatus: 'Active'
    });

    setSelectedSupplierPreview({
      code,
      name: nameStr,
      email: cleanEmail,
      password: initialTempPassword,
      gstin: record.gstin || '',
      pan: record.pan || '',
      city: record.city,
      country: record.country,
      accountGroup: record.accountGroup || 'Z006'
    });

    setSapSearch('');
    setSapSuggestions([]);
  }, []);

  const handleDismissPreview = useCallback(() => {
    setSelectedSupplierPreview(null);
  }, []);

  const validateForm = useCallback(() => {
    const errors = [];

    if (!formData.sapVendorCode.trim()) {
      errors.push('SAP Vendor Code is required');
    }
    if (!formData.companyName.trim()) {
      errors.push('Company Name is required');
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      errors.push('Valid Email Address is required');
    }
    if (!formData.password.trim()) {
      errors.push('Password is required');
    }

    if (errors.length > 0) {
      showToast('error', 'Validation Error', errors[0]);
      return false;
    }
    return true;
  }, [formData, showToast]);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);

    const payload = {
      sapVendorCode: formData.sapVendorCode.trim(),
      companyName: formData.companyName.trim(),
      vendorType: formData.vendorType || 'DOMESTIC',
      paymentTerms: formData.paymentTerms || '30 Days',
      contactPerson: formData.contactPerson.trim() || formData.companyName.trim(),
      phone: formData.phone.trim() || '+91 9800000000',
      status: formData.accountStatus || 'Active',
      email: formData.email.trim(),
      password: formData.password.trim(),
      gstin: formData.gstin.trim(),
      pan: formData.pan.trim(),
      bankName: formData.bankName.trim(),
      branch: formData.branch.trim(),
      accountNumber: formData.accountNumber.trim(),
      ifscCode: formData.ifscCode.trim()
    };

    try {
      const url = isEditMode ? `/api/vendors/${id}` : '/api/vendors';
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await apiFetch(url, {
        method,
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        showToast(
          'success',
          isEditMode ? 'Vendor Account Updated' : 'Vendor Account Created',
          `${formData.companyName} ${isEditMode ? 'updated' : 'created'} successfully!`
        );

        setTimeout(() => {
          navigate('/management/vendors');
        }, 1200);
      } else {
        const errorData = await response.json();
        showToast('error', 'Save Failed', errorData.error || 'Failed to save vendor account.');
      }
    } catch (error) {
      console.error('Error saving vendor:', error);
      showToast('error', 'Network Error', 'Network error while saving vendor account.');
    } finally {
      setSubmitting(false);
    }
  }, [formData, isEditMode, id, navigate, validateForm, showToast]);

  // ============================================
  // RENDER HELPERS
  // ============================================

  const renderCompanyInfo = useMemo(() => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <FormField label="SAP Vendor Code" required>
        <Input
          type="text"
          placeholder="e.g. 10000071"
          value={formData.sapVendorCode}
          onChange={(e) => handleFormChange('sapVendorCode', e.target.value)}
          className="font-mono"
        />
      </FormField>

      <FormField label="Company Name" required>
        <Input
          type="text"
          placeholder="e.g. Genx Pv India Pvt. Ltd."
          value={formData.companyName}
          onChange={(e) => handleFormChange('companyName', e.target.value)}
        />
      </FormField>

      <FormField label="Vendor Type">
        <select
          value={formData.vendorType}
          onChange={(e) => handleFormChange('vendorType', e.target.value)}
          className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-slate-50 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0d7676]"
        >
          <option value="DOMESTIC">DOMESTIC</option>
          <option value="IMPORT">IMPORT</option>
          <option value="Freight Forwarder">Freight Forwarder</option>
          <option value="Service">Service</option>
          <option value="Other">Other</option>
        </select>
        
      </FormField>

      <FormField label="Payment Terms">
        <select
          value={formData.paymentTerms}
          onChange={(e) => handleFormChange('paymentTerms', e.target.value)}
          className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-slate-50 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0d7676]"
        >
          <option value="30 Days">30 Days</option>
          <option value="60 Days">60 Days</option>
          <option value="Advance">Advance</option>
        </select>
      </FormField>

      <FormField label="Contact Person">
        <Input
          type="text"
          placeholder="Contact name"
          value={formData.contactPerson}
          onChange={(e) => handleFormChange('contactPerson', e.target.value)}
        />
      </FormField>

      <FormField label="Phone">
        <Input
          type="text"
          placeholder="+91 9000000000"
          value={formData.phone}
          onChange={(e) => handleFormChange('phone', e.target.value)}
        />
      </FormField>

      <FormField label="Account Status" wide>
        <select
          value={formData.accountStatus}
          onChange={(e) => handleFormChange('accountStatus', e.target.value)}
          className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-slate-50 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0d7676]"
        >
          <option value="Active">ACTIVE — Can Sign In</option>
          <option value="Inactive">INACTIVE</option>
        </select>
      </FormField>
    </div>
  ), [formData, handleFormChange]);

  const renderLoginCredentials = useMemo(() => (
    <div className="space-y-4">
      <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
        Auto-filled when selecting a vendor from SAP. Share these with the vendor so they can log in at{' '}
        <span className="font-mono font-bold">/vendor/login</span>.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Email Address" required>
          <Input
            type="email"
            placeholder="vendor@company.com"
            value={formData.email}
            onChange={(e) => handleFormChange('email', e.target.value)}
          />
        </FormField>

        <FormField label="Password" required>
          <Input
            type="password"
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => handleFormChange('password', e.target.value)}
          />
        </FormField>
      </div>
    </div>
  ), [formData, handleFormChange]);

  const renderTaxInfo = useMemo(() => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <FormField label="GSTIN / Tax Number">
        <Input
          type="text"
          placeholder="24AAAAA0000A1Z5"
          value={formData.gstin}
          onChange={(e) => handleFormChange('gstin', e.target.value)}
          className="font-mono uppercase"
        />
      </FormField>

      <FormField label="PAN Number">
        <Input
          type="text"
          placeholder="AAAAA0000A"
          value={formData.pan}
          onChange={(e) => handleFormChange('pan', e.target.value)}
          className="font-mono uppercase"
        />
      </FormField>
    </div>
  ), [formData, handleFormChange]);

  const renderBankDetails = useMemo(() => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Bank Name">
          <Input
            type="text"
            placeholder="State Bank of India"
            value={formData.bankName}
            onChange={(e) => handleFormChange('bankName', e.target.value)}
          />
        </FormField>

        <FormField label="Branch">
          <Input
            type="text"
            placeholder="Mumbai Main"
            value={formData.branch}
            onChange={(e) => handleFormChange('branch', e.target.value)}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Account Number">
          <Input
            type="text"
            placeholder="000000000000"
            value={formData.accountNumber}
            onChange={(e) => handleFormChange('accountNumber', e.target.value)}
            className="font-mono"
          />
        </FormField>

        <FormField label="IFSC Code">
          <Input
            type="text"
            placeholder="SBIN0000300"
            value={formData.ifscCode}
            onChange={(e) => handleFormChange('ifscCode', e.target.value)}
            className="font-mono uppercase"
          />
        </FormField>
      </div>
    </div>
  ), [formData, handleFormChange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0d7676]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full pb-16 font-sans relative">
      <ToastNotification toast={toast} onClose={hideToast} />

      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm sticky top-0 z-30 space-y-4">
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

          <div className="flex items-center gap-3 flex-shrink-0">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate('/management/vendors')} 
              className="text-xs font-bold"
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleSubmit} 
              loading={submitting} 
              className="bg-[#0d7676] hover:bg-[#0a5c5c] text-white font-bold shadow-sm text-xs px-4"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white mr-1.5" />
                  <span>{isEditMode ? 'Updating...' : 'Creating...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white mr-1.5" />
                  <span>{isEditMode ? 'Update Vendor' : 'Create Vendor'}</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* SAP Search */}
        <div className="pt-4 border-t border-slate-100">
          <SapiSearch
            searchValue={sapSearch}
            onSearchChange={setSapSearch}
            suggestions={sapSuggestions}
            isLoading={searchingSap}
            onSelect={handleSapSearchSelect}
            selectedSupplier={selectedSupplierPreview}
            onDismiss={handleDismissPreview}
          />
        </div>
      </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <FormSection title="Company Information" icon={Building2}>
            {renderCompanyInfo}
          </FormSection>

          <FormSection title="Portal Login Credentials" icon={ShieldCheck}>
            {renderLoginCredentials}
          </FormSection>

          <FormSection title="Tax Information" icon={FileText}>
            {renderTaxInfo}
          </FormSection>

          <FormSection title="Bank Details" icon={CreditCard}>
            {renderBankDetails}
            
            <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3 mt-4">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => navigate('/management/vendors')}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                loading={submitting} 
                variant="default" 
                className="bg-[#0d7676] hover:bg-[#0a5c5c] text-white font-semibold"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white mr-1.5" />
                    <span>{isEditMode ? 'Updating...' : 'Creating...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white mr-1.5" />
                    <span>{isEditMode ? 'Update Vendor' : 'Create Vendor'}</span>
                  </>
                )}
              </Button>
            </div>
          </FormSection>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <SetupGuide />
          <FieldMappingSummary fields={formData} />
        </div>
      </form>
    </div>
  );
}