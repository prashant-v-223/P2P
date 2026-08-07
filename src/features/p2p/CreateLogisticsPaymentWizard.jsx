// CreateLogisticsPaymentWizard.jsx - Styled with Custom UI Components
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import { CustomInput } from '../../components/ui/custom-input';
import { Button } from '../../components/ui/button';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { Building2, FileText, Paperclip, Send, ChevronLeft, MapPin, Calendar, DollarSign, ShieldCheck } from 'lucide-react';

export default function CreateLogisticsPaymentWizard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useSelector((state) => state.auth);

  const [providers, setProviders] = useState([]);
  const [blEntries, setBlEntries] = useState([]);

  const [providerId, setProviderId] = useState('');
  const [providerName, setProviderName] = useState('');
  const [blId, setBlId] = useState('');
  const [sourceLocation, setSourceLocation] = useState('');
  const [destinationLocation, setDestinationLocation] = useState('');

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [paymentMode, setPaymentMode] = useState('NEFT');
  const [hsnCode, setHsnCode] = useState('');
  const [remarks, setRemarks] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [pRes, bRes] = await Promise.all([
          apiFetch('/api/p2p/vendors'),
          apiFetch('/api/p2p/bl-invoices')
        ]);
        if (pRes.ok) {
          const json = await pRes.json();
          setProviders(json.vendors || []);
        }
        if (bRes.ok) {
          const json = await bRes.json();
          setBlEntries(json.invoices || []);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadData();
  }, []);

  const handleProviderChange = (val) => {
    setProviderId(val);
    const target = providers.find(p => p.id === val || p.vendorId === val);
    if (target) {
      setProviderName(target.companyName || target.name);
    } else if (val === 'dhl') {
      setProviderName('Fast Forward Logistics India Privat');
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!invoiceNumber || !amount || Number(amount) <= 0) {
      showToast({ title: 'Validation Error', description: 'Please enter Invoice Number and Amount.', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/p2p/logistics-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blNumber: blId || 'BL-LOGISTICS',
          category: 'freight',
          typeDisplay: 'Logistics Freight Payment',
          source: 'Logistics',
          invoiceNumber,
          vendorName: providerName || 'Logistics Provider',
          amount: Number(amount),
          currency,
          remarks: `${remarks} ${sourceLocation ? `[${sourceLocation} -> ${destinationLocation}]` : ''}`.trim(),
          documents: files.map(f => ({ name: f.name, size: f.size }))
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast({ title: 'Success', description: 'Logistics Payment invoice submitted for approval.', type: 'success' });
        navigate('/p2p/logistics-payments');
      } else {
        throw new Error(json.error || 'Submission failed');
      }
    } catch (err) {
      showToast({ title: 'Submission Failed', description: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const providerOptions = providers.length > 0
    ? providers.map(p => ({ label: p.companyName || p.name, value: p.id || p.vendorId }))
    : [{ label: 'Fast Forward Logistics India Privat', value: 'dhl' }];

  const blOptions = [
    { label: 'Optional link with BL entry', value: '' },
    ...blEntries.map(b => ({ label: `${b.blNumber} — ${b.vendorName || 'Logistics Vendor'}`, value: b.blNumber || b.id }))
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] py-6 px-4 font-sans text-slate-800 antialiased text-left pb-24">
      
      {/* Top Header Navigation */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/p2p/logistics-payments')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Rayzon P2P</span>
        </button>

        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-teal-50 text-[#0d7676] border border-teal-200">
          <ShieldCheck className="w-3 h-3" />
          Logistics Payout Form
        </span>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
        
        {/* CARD 1: PROVIDER & ROUTE */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-bold text-slate-900">Provider & Route</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Logistics Provider <span className="text-rose-500">*</span>
              </label>
              <SearchableSelect
                options={providerOptions}
                value={providerId}
                onChange={handleProviderChange}
                placeholder="Select logistics provider..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">BL Entry</label>
              <SearchableSelect
                options={blOptions}
                value={blId}
                onChange={(val) => setBlId(val)}
                placeholder="Optional link with BL entry..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CustomInput
                label="Source Location"
                required={true}
                value={sourceLocation}
                onChange={(e) => setSourceLocation(e.target.value)}
                placeholder="Plant / warehouse / port"
                leftIcon={MapPin}
              />

              <CustomInput
                label="Destination Location"
                required={true}
                value={destinationLocation}
                onChange={(e) => setDestinationLocation(e.target.value)}
                placeholder="Plant / branch / delivery point"
                leftIcon={MapPin}
              />
            </div>
          </div>
        </div>

        {/* CARD 2: INVOICE & PAYMENT DETAILS */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <FileText className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-bold text-slate-900">Invoice & Payment Details</h2>
          </div>

          <div className="space-y-4">
            <CustomInput
              label="Invoice Number"
              required={true}
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Enter transporter invoice number"
              leftIcon={FileText}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CustomInput
                type="date"
                label="Invoice Date"
                required={true}
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />

              <CustomInput
                type="date"
                label="Payment Due Date"
                required={true}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CustomInput
                type="number"
                label="Amount"
                required={true}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter invoice amount"
                leftIcon={DollarSign}
              />

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Currency <span className="text-rose-500">*</span>
                </label>
                <SearchableSelect
                  options={[
                    { label: '🇮🇳 INR (Indian Rupee)', value: 'INR' },
                    { label: '🇺🇸 USD (US Dollar)', value: 'USD' },
                    { label: '🇪🇺 EUR (Euro)', value: 'EUR' }
                  ]}
                  value={currency}
                  onChange={(val) => setCurrency(val)}
                  searchable={false}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Payment Mode <span className="text-rose-500">*</span>
              </label>
              <SearchableSelect
                options={[
                  { label: 'NEFT / RTGS', value: 'NEFT' },
                  { label: 'Wire Transfer', value: 'Wire' },
                  { label: 'Cheque', value: 'Cheque' }
                ]}
                value={paymentMode}
                onChange={(val) => setPaymentMode(val)}
                searchable={false}
              />
            </div>

            <CustomInput
              label="HSN / SAC Code"
              value={hsnCode}
              onChange={(e) => setHsnCode(e.target.value)}
              placeholder="Select house base or HSN code..."
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Remarks</label>
              <textarea
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add transport remarks, loading details, or billing notes..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:border-[#0d7676] focus:ring-2 focus:ring-teal-500/20 outline-none resize-none transition shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* CARD 3: SUPPORTING DOCUMENTS */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Paperclip className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-bold text-slate-900">Supporting Documents</h2>
          </div>

          <div className="relative border-2 border-dashed border-slate-200/90 rounded-2xl p-6 text-center bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <Paperclip className="w-5 h-5 text-slate-400" />
              <p className="text-xs font-semibold text-slate-600">Upload invoice and supporting logistics documents.</p>
              <p className="text-[11px] text-slate-400">PDF, JPG, PNG — max 10MB each (Stored via AWS S3)</p>
            </div>
          </div>

          {files.length > 0 && (
            <div className="space-y-1 pt-1">
              {files.map((f, i) => (
                <p key={i} className="text-xs text-teal-700 font-medium truncate">✓ Attached: {f.name}</p>
              ))}
            </div>
          )}
        </div>

        {/* BOTTOM ACTION BUTTONS */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/p2p/logistics-payments')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={submitting}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit for Approval</span>
          </Button>
        </div>

      </form>
    </div>
  );
}
