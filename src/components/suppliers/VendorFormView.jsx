import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, KeyRound, Lightbulb, Loader2, RefreshCw, Save, Search, Sparkles } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../ui/toast';

const emptyForm = {
  supplierId: '', name: '', vendorType: 'Domestic', paymentTermsDays: 0, contactPerson: '',
  phone: '', email: '', status: 'Active', city: '', country: '', address: '', postalCode: '',
  region: '', gstin: '', pan: '', bankName: '', bankBranch: '', bankAccount: '', ifscCode: ''
};
const readJson = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new Error(`Vendor API returned ${response.status}. Restart the backend server and try again.`);
  return response.json();
};

export default function VendorFormView({ mode = 'create' }) {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const readOnly = mode === 'view';
  const [form, setForm] = useState(emptyForm);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(Boolean(vendorId));
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!vendorId) return;
    let active = true;
    const loadVendor = async () => {
      setLoading(true);
      setLoadError('');
      try {
        let response = await apiFetch(`/api/vendors/${vendorId}`);
        if (response.status === 404) {
          await new Promise((resolve) => window.setTimeout(resolve, 400));
          response = await apiFetch(`/api/vendors/${vendorId}`);
        }
        const data = await readJson(response);
        if (!response.ok) throw new Error(data.error || `Vendor request failed (${response.status}).`);
        if (!active) return;
        setForm({ ...emptyForm, ...data.vendor });
        setSelectedSupplierId(data.vendor.supplierId);
      } catch (error) {
        if (active) setLoadError(error.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadVendor();
    return () => { active = false; };
  }, [vendorId, showToast]);

  useEffect(() => {
    if (mode !== 'create' || query.trim().length < 2) { setMatches([]); return; }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await apiFetch(`/api/suppliers/search?q=${encodeURIComponent(query.trim())}`);
        const data = await readJson(response);
        if (!response.ok) throw new Error(data.error);
        setMatches(data.suppliers || []);
      } catch (error) {
        showToast({ type: 'error', title: 'SAP supplier search failed', description: error.message });
      } finally { setSearching(false); }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, mode, showToast]);

  const completion = useMemo(() => {
    const useful = ['supplierId', 'name', 'email', 'contactPerson', 'phone', 'country', 'gstin', 'pan', 'bankName', 'bankAccount'];
    return Math.round(useful.filter((key) => form[key]).length / useful.length * 100);
  }, [form]);

  const selectSupplier = (supplier) => {
    setForm({ ...emptyForm, ...supplier, vendorType: supplier.vendorType || (supplier.country === 'IN' ? 'Domestic' : 'Import') });
    setSelectedSupplierId(supplier.supplierId);
    setQuery('');
    setMatches([]);
    showToast({ title: 'SAP data applied', description: `${supplier.name} was used to auto-fill the form.` });
  };

  const refreshFromSap = async () => {
    if (!form.supplierId) return;
    setSearching(true);
    try {
      const response = await apiFetch(`/api/suppliers/${form.supplierId}`);
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error);
      const supplier = data.supplier;
      setForm((current) => ({
        ...current,
        name: supplier.name || current.name,
        vendorType: supplier.vendorType || current.vendorType,
        status: supplier.status || current.status,
        email: supplier.email || current.email,
        address: supplier.address || current.address,
        city: supplier.city || current.city,
        region: supplier.region || current.region,
        postalCode: supplier.postalCode || current.postalCode,
        country: supplier.country || current.country,
        gstin: supplier.gstin || current.gstin,
        pan: supplier.pan || current.pan,
        taxNumber: supplier.taxNumber || current.taxNumber
      }));
      showToast({ title: 'SAP details refreshed', description: 'Master fields were reloaded; vendor-only fields were preserved.' });
    } catch (error) {
      showToast({ type: 'error', title: 'SAP refresh failed', description: error.message });
    } finally {
      setSearching(false);
    }
  };

  const change = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.supplierId.trim() || !form.name.trim()) return showToast({ type: 'error', title: 'Required fields missing', description: 'SAP vendor code and company name are required.' });
    if (!form.email.trim()) return showToast({ type: 'error', title: 'Portal email required', description: 'Enter the email the vendor will use to sign in.' });
    if (!vendorId && password.length < 8) return showToast({ type: 'error', title: 'Portal password required', description: 'Create a password containing at least 8 characters.' });
    setSaving(true);
    try {
      const updating = Boolean(vendorId);
      const response = await apiFetch(updating ? `/api/vendors/${vendorId}` : '/api/vendors', {
        method: updating ? 'PUT' : 'POST',
        body: JSON.stringify({ ...form, password: password || undefined })
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error);
      showToast({ title: updating ? 'Vendor updated' : 'Vendor created', description: data.message });
      navigate('/admin/vendors');
    } catch (error) {
      showToast({ type: 'error', title: 'Vendor not saved', description: error.message });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="surface-card flex min-h-72 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading vendor…</div>;
  if (loadError) return <div className="surface-card mx-auto max-w-xl p-8 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600"><Search className="h-5 w-5" /></div><h2 className="mt-3 font-bold text-slate-900">Vendor could not be opened</h2><p className="mt-1 text-sm text-slate-500">{loadError === 'Vendor not found.' ? 'This vendor was deleted or the link is no longer valid.' : loadError}</p><div className="mt-5 flex justify-center gap-2"><Link to="/admin/vendors" className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold">Back to vendors</Link><button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-bold text-white">Try again</button></div></div>;

  return (
    <form onSubmit={submit} className="page-stack">
      <div className="page-toolbar">
        <div className="flex items-center gap-3"><Link to="/admin/vendors" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /></Link><div><h2 className="text-base font-bold text-slate-950">{readOnly ? 'Vendor details' : vendorId ? 'Edit vendor account' : 'Add new vendor'}</h2><p className="text-xs text-slate-500">{readOnly ? 'Review SAP and portal information.' : 'Search SAP to auto-fill, then review and complete portal details.'}</p></div></div>
        <div className="flex items-center gap-2"><span className="text-xs font-semibold text-slate-500">Profile {completion}% complete</span><div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-teal-600" style={{ width: `${completion}%` }} /></div></div>
      </div>

      {mode === 'create' && <section className="surface-card overflow-visible border-sky-200 bg-sky-50/40 p-4">
        <div className="mb-3 flex items-center gap-2 text-sky-800"><Sparkles className="h-4 w-4" /><div><h3 className="text-sm font-bold">Search synced SAP suppliers</h3><p className="text-[11px] text-sky-700">Type a company name, email, or SAP vendor code. Selecting a match fills all available data.</p></div></div>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by company name or vendor code…" className="h-10 w-full rounded-lg border border-sky-200 bg-white pl-9 pr-10 text-xs focus:border-sky-500" />
          {searching && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-sky-600" />}
          {!!matches.length && <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">{matches.map((supplier) => <button key={supplier._id} type="button" onClick={() => selectSupplier(supplier)} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-sky-50"><div><p className="text-xs font-bold text-slate-900">{supplier.name}</p><p className="text-[10px] text-slate-500">{supplier.email || supplier.city || supplier.country || 'No contact data'}</p></div><span className="font-mono text-[10px] text-sky-700">{supplier.supplierId}</span></button>)}</div>}
        </div>
      </section>}
      {mode === 'edit' && <section className="surface-card flex flex-col justify-between gap-3 border-sky-200 bg-sky-50/40 p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-sky-800"><RefreshCw className="h-4 w-4" /><div><h3 className="text-sm font-bold">Refresh from SAP S/4HANA</h3><p className="text-[11px] text-sky-700">Reload master fields for supplier {form.supplierId}. Contact, login, and bank details will be preserved.</p></div></div>
        <button type="button" disabled={searching} onClick={refreshFromSap} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-sky-300 bg-white px-4 text-xs font-bold text-sky-700 disabled:opacity-50">{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh SAP data</button>
      </section>}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <FormSection title="Company information">
            <Field label="SAP supplier code" required value={form.supplierId} onChange={change('supplierId')} disabled={readOnly || Boolean(selectedSupplierId)} />
            <Field label="Company name" required value={form.name} onChange={change('name')} disabled={readOnly} />
            <Select label="Vendor type" value={form.vendorType} onChange={change('vendorType')} disabled={readOnly} options={['Domestic', 'Import', 'Freight Forwarder', 'Service', 'Other']} />
            <Field label="Payment terms (days)" type="number" value={form.paymentTermsDays} onChange={change('paymentTermsDays')} disabled={readOnly} />
            <Field label="Contact person" value={form.contactPerson} onChange={change('contactPerson')} disabled={readOnly} />
            <Field label="Phone" value={form.phone} onChange={change('phone')} disabled={readOnly} />
            <Select label="Account status" value={form.status} onChange={change('status')} disabled={readOnly} options={['Active', 'Inactive']} />
          </FormSection>
          <FormSection title="Portal login credentials" description="The vendor uses these credentials at /vendor/login. Passwords are encrypted and never displayed again.">
            <Field label="Email address" required type="email" value={form.email} onChange={change('email')} disabled={readOnly} placeholder="vendor@company.com" />
            <Field label={vendorId ? 'New password' : 'Password'} required={!vendorId} type="password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={readOnly} placeholder={vendorId ? (form.hasPortalPassword ? 'Leave blank to keep current password' : 'Set an 8+ character password') : 'Minimum 8 characters'} />
          </FormSection>
          <FormSection title="Address">
            <Field label="Street address" value={form.address} onChange={change('address')} disabled={readOnly} wide />
            <Field label="City" value={form.city} onChange={change('city')} disabled={readOnly} />
            <Field label="State / region" value={form.region} onChange={change('region')} disabled={readOnly} />
            <Field label="Postal code" value={form.postalCode} onChange={change('postalCode')} disabled={readOnly} />
            <Field label="Country code" value={form.country} onChange={change('country')} disabled={readOnly} />
          </FormSection>
          <FormSection title="Tax information"><Field label="GSTIN" value={form.gstin} onChange={change('gstin')} disabled={readOnly} /><Field label="PAN" value={form.pan} onChange={change('pan')} disabled={readOnly} /></FormSection>
          <FormSection title="Bank details">
            <Field label="Bank name" value={form.bankName} onChange={change('bankName')} disabled={readOnly} />
            <Field label="Branch" value={form.bankBranch} onChange={change('bankBranch')} disabled={readOnly} />
            <Field label="Account number" value={form.bankAccount} onChange={change('bankAccount')} disabled={readOnly} />
            <Field label="IFSC / SWIFT code" value={form.ifscCode} onChange={change('ifscCode')} disabled={readOnly} />
          </FormSection>
        </div>
        <aside className="space-y-4 xl:sticky xl:top-20">
          <section className="surface-card border-blue-200 bg-blue-50/60 p-4"><div className="flex items-center gap-2 text-blue-800"><Lightbulb className="h-4 w-4" /><h3 className="text-sm font-bold">Simple setup guide</h3></div><ol className="mt-3 space-y-3 text-xs leading-5 text-blue-800"><li><b>1. Search SAP first</b><br />Choose the matching supplier to auto-fill master data.</li><li><b>2. Review the details</b><br />Complete email, contact, tax, and bank information.</li><li><b>3. Save the account</b><br />The vendor appears in the central management list.</li><li><b>4. Generate access</b><br />Use the key button in the list to create a one-time password.</li></ol></section>
          <section className="surface-card p-4"><h3 className="text-xs font-bold text-slate-800">Data source</h3><div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4" />{selectedSupplierId ? 'Linked to SAP supplier master' : 'Select an SAP supplier above'}</div><p className="mt-3 text-[11px] leading-5 text-slate-500">The supplier remains in SAP master data. Submitting creates a separate portal vendor record that administrators can edit or delete.</p></section>
          <section className="surface-card p-4"><div className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-slate-500" /><h3 className="text-xs font-bold text-slate-800">SAP field mapping</h3></div><dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-[11px]"><dt className="text-slate-500">SAP code</dt><dd className="font-mono text-slate-700">Supplier</dd><dt className="text-slate-500">Company name</dt><dd className="font-mono text-slate-700">BPSupplierName</dd><dt className="text-slate-500">Email</dt><dd className="font-mono text-slate-700">EmailAddress</dd><dt className="text-slate-500">GSTIN</dt><dd className="font-mono text-slate-700">TaxNumber3</dd><dt className="text-slate-500">PAN</dt><dd className="font-mono text-slate-700">BusinessPartnerPanNumber</dd><dt className="text-slate-500">Address</dt><dd className="font-mono text-slate-700">BPAddrStreetName</dd><dt className="text-slate-500">Bank</dt><dd className="text-right text-slate-400">Vendor managed</dd></dl></section>
        </aside>
      </div>

      <div className="flex justify-end gap-2"><Link to="/admin/vendors" className="inline-flex h-10 items-center rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-600">{readOnly ? 'Back to vendors' : 'Cancel'}</Link>{!readOnly && <button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-5 text-xs font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save vendor account</button>}</div>
    </form>
  );
}

function FormSection({ title, description, children }) { return <section className="surface-card"><header className="border-b border-slate-100 px-4 py-3"><h3 className="text-sm font-bold text-slate-900">{title}</h3>{description && <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>}</header><div className="grid gap-3 p-4 md:grid-cols-2">{children}</div></section>; }
function Field({ label, required, wide, ...props }) { return <label className={wide ? 'md:col-span-2' : ''}><span className="mb-1.5 block text-xs font-semibold text-slate-700">{label}{required && <span className="text-rose-500"> *</span>}</span><input {...props} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs disabled:bg-slate-50 disabled:text-slate-500" /></label>; }
import { SearchableSelect } from '../ui/searchable-select';

function Select({ label, options, value, onChange, disabled }) {
  const normalizedOptions = options.map((opt) => typeof opt === 'string' ? { label: opt, value: opt } : opt);
  return (
    <label>
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</span>
      <SearchableSelect
        options={normalizedOptions}
        value={value}
        onChange={(val) => onChange && onChange({ target: { value: val } })}
        disabled={disabled}
        size="md"
        searchable={false}
      />
    </label>
  );
}
