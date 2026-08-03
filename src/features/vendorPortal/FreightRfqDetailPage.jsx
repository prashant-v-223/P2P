import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CalendarDays, CheckCircle2, Loader2, Ship } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';

const empty = { shippingLine: '', vesselRoute: '', oceanFreightUsd: '', stChargesInr: '', otherChargesInr: '0', transitDays: '', cutoffDate: '', vesselEtd: '', vesselEta: '', freeDays: '', rateValidity: '', costParticular: '', remarks: '' };
const dateValue = (value) => value?.slice?.(0, 10) || '';

export default function FreightRfqDetailPage() {
  const { id } = useParams();
  const { showToast } = useToast();
  const [rfq, setRfq] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    apiFetch(`/api/p2p/vendor-rfqs/${id}`)
      .then((response) => response.json().then((json) => ({ ok: response.ok, ...json })))
      .then((json) => {
        if (!json.ok || !json.success) throw new Error(json.error || 'Unable to load this assigned RFQ.');
        setRfq(json.data);
        if (json.data.myQuote) setForm((current) => ({ ...current, ...json.data.myQuote, cutoffDate: dateValue(json.data.myQuote.cutoffDate), vesselEtd: dateValue(json.data.myQuote.vesselEtd), vesselEta: dateValue(json.data.myQuote.vesselEta) }));
      })
      .catch((error) => setLoadError(error.message));
  }, [id]);

  const change = (key) => (event) => {
    setFormError('');
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setAttempted(true);
    if (!String(form.shippingLine).trim()) return setFormError('Shipping Line is required.');
    if (!(Number(form.oceanFreightUsd) > 0)) return setFormError('Ocean Freight must be greater than zero.');
    if (form.stChargesInr === '' || Number(form.stChargesInr) < 0) return setFormError('Shipping Line Charges must be zero or greater.');
    if (!(Number(form.transitDays) > 0)) return setFormError('Transit Days must be greater than zero.');
    if (form.vesselEtd && form.vesselEta && new Date(form.vesselEta) < new Date(form.vesselEtd)) return setFormError('Vessel ETA cannot be earlier than Vessel ETD.');
    setSaving(true);
    try {
      const response = await apiFetch(`/api/p2p/vendor-rfqs/${id}/quote`, { method: 'POST', body: JSON.stringify(form) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Quote submission failed.');
      setRfq((current) => ({ ...current, myQuote: json.data }));
      setAttempted(false);
      showToast({ type: 'success', title: rfq.myQuote ? 'Quote Updated' : 'Quote Submitted', description: 'Procurement has been notified.' });
    } catch (error) {
      setFormError(error.message);
      showToast({ type: 'error', title: 'Quote Failed', description: error.message });
    } finally { setSaving(false); }
  };

  if (loadError) return <div className="mx-auto max-w-3xl rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700"><AlertCircle className="mr-2 inline h-4 w-4" />{loadError}</div>;
  if (!rfq) return <div className="p-10 text-center text-xs text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading assigned RFQ...</div>;

  const cargo = rfq.cargoDetails || {};
  const deadline = rfq.closingDate ? new Date(rfq.closingDate) : null;
  if (deadline) {
    const utcMidnight = deadline.getUTCHours() === 0 && deadline.getUTCMinutes() === 0 && deadline.getUTCSeconds() === 0;
    const localMidnight = deadline.getHours() === 0 && deadline.getMinutes() === 0 && deadline.getSeconds() === 0;
    if (localMidnight) deadline.setHours(23, 59, 59, 999);
    else if (utcMidnight) deadline.setUTCHours(23, 59, 59, 999);
  }
  const status = String(rfq.status || '').toLowerCase();
  const deadlinePassed = Boolean(deadline && deadline < new Date());
  const closed = status !== 'published' || deadlinePassed;
  const closedReason = deadlinePassed ? 'The quotation deadline has passed.' : status === 'awarded' ? 'This RFQ has already been awarded.' : `This RFQ is ${rfq.status || 'not open'}.`;
  const fieldClass = 'block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-60';
  const inrCharges = Number(form.stChargesInr || 0) + Number(form.otherChargesInr || 0);

  const errors = {
    shippingLine: !String(form.shippingLine).trim() ? 'Enter the shipping line name.' : '',
    oceanFreightUsd: !(Number(form.oceanFreightUsd) > 0) ? 'Enter an amount greater than zero.' : '',
    stChargesInr: form.stChargesInr === '' || Number(form.stChargesInr) < 0 ? 'Enter zero if there are no shipping-line charges.' : '',
    transitDays: !(Number(form.transitDays) > 0) ? 'Enter the estimated port-to-port transit days.' : '',
    vesselEta: form.vesselEtd && form.vesselEta && new Date(form.vesselEta) < new Date(form.vesselEtd) ? 'ETA cannot be earlier than ETD.' : ''
  };
  const missingCount = Object.values(errors).filter(Boolean).length;

  const renderField = ({ label, name, type = 'text', required = false, min, placeholder }) => {
    const error = attempted ? errors[name] : '';
    return <label className="space-y-1.5 text-[11px] font-bold text-slate-700"><span>{label}{required && <span className="text-rose-500"> *</span>}</span><input type={type} min={min} step={type === 'number' ? 'any' : undefined} required={required} aria-invalid={Boolean(error)} value={form[name] ?? ''} onChange={change(name)} disabled={closed || saving} placeholder={placeholder} className={`${fieldClass} ${error ? 'border-rose-400 bg-rose-50/50 focus:border-rose-400 focus:ring-rose-100' : ''}`} />{error && <span className="block text-[10px] font-semibold text-rose-600">{error}</span>}</label>;
  };

  return <div className="mx-auto max-w-4xl space-y-4 pb-10">
    <Link to="/vendor/rfqs" className="inline-flex items-center gap-1 text-xs font-bold text-[#0d7676] hover:underline"><ArrowLeft className="h-4 w-4" />Back to RFQs</Link>

    <section className="rounded-2xl border border-teal-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="flex items-center gap-2"><span className="rounded-md bg-teal-50 px-2 py-1 text-[9px] font-extrabold uppercase text-[#0d7676]">{rfq.status}</span><span className="font-mono text-[10px] text-slate-400">{rfq.rfqNumber}</span></div><h1 className="mt-2 text-lg font-extrabold text-slate-900">{rfq.title}</h1><p className="mt-1 font-mono text-[10px] text-slate-500">PO {rfq.poId || '—'}</p></div>
        <div className="flex items-center gap-3">{rfq.myAllocation && <Link to={`/vendor/rfqs/${id}/bl-entries`} className="rounded-lg bg-[#0d7676] px-3 py-2 text-[10px] font-bold text-white">Manage BL Entries</Link>}<div className="flex items-center gap-2 text-right text-[10px] text-slate-500"><CalendarDays className="h-4 w-4 text-[#0d7676]" /><span>Closing Date<br/><strong className="text-slate-800">{rfq.closingDate ? new Date(rfq.closingDate).toLocaleString('en-IN') : 'No deadline'}</strong></span></div></div>
      </div>
      <div className="mt-4 grid gap-4 rounded-xl border border-teal-100 bg-teal-50/60 p-4 text-[11px] sm:grid-cols-3"><div><p className="text-slate-400">Shipping Terms</p><strong>{cargo.shippingTerms || '—'}</strong></div><div><p className="text-slate-400">Route</p><strong>{cargo.portOfOrigin || '—'} → {cargo.portOfDestination || '—'}</strong></div><div><p className="text-slate-400">Cargo</p><strong>{cargo.cargoType || '—'} · {cargo.containerCount || 0} × {cargo.containerType || '—'}</strong></div></div>
    </section>

    {rfq.myAllocation && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" />RFQ award approved. You have been awarded {rfq.myAllocation.containers} container(s). Continue with Bill of Lading entries.</div>}
    {rfq.awardPending && <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800"><AlertCircle className="h-4 w-4" />Your proposed allocation is awaiting internal approval. Bill of Lading access will open only after final approval. Current status: {rfq.awardApprovalStatus || 'Pending approval'}.</div>}

    <form onSubmit={submit} noValidate className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 className="flex items-center gap-2 text-sm font-extrabold"><Ship className="h-4 w-4 text-[#0d7676]" />Your Freight Quote</h2><p className="mt-0.5 text-[10px] text-slate-500">{rfq.myQuote ? 'Update your existing freight rates and shipping details before the deadline.' : 'Fill in your freight rates and shipping details below.'}</p></div>{!closed && <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${missingCount ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{missingCount ? `${missingCount} fields remaining` : 'Ready to submit'}</span>}</div>
      {closed && <div className="m-5 mb-0 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800"><AlertCircle className="h-4 w-4" />{closedReason} Quote editing is disabled.</div>}
      {!closed && rfq.myQuote && <div className="m-5 mb-0 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" />Quote submitted. You can update it until the RFQ closes.</div>}
      {formError && <div className="m-5 mb-0 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{formError}</div>}

      <div className="space-y-5 p-5">
        <div className="grid gap-4 sm:grid-cols-2">{renderField({ label: 'Shipping Line Name', name: 'shippingLine', required: true })}{renderField({ label: 'Vessel Route', name: 'vesselRoute', placeholder: 'e.g. Shanghai → Nhava Sheva' })}</div>
        <section className="rounded-xl bg-slate-50/80 p-4"><h3 className="mb-3 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Freight Costs</h3><div className="grid gap-4 sm:grid-cols-3">{renderField({ label: 'Ocean Freight (USD)', name: 'oceanFreightUsd', type: 'number', min: '1', required: true })}{renderField({ label: 'Shipping Line Charges (INR)', name: 'stChargesInr', type: 'number', min: '0', required: true })}{renderField({ label: 'Other Charges (INR)', name: 'otherChargesInr', type: 'number', min: '0' })}</div></section>
        <div className="grid gap-4 sm:grid-cols-2">{renderField({ label: 'Cutoff Date', name: 'cutoffDate', type: 'date' })}{renderField({ label: 'Free Days', name: 'freeDays', placeholder: 'e.g. 21 days' })}{renderField({ label: 'Vessel ETD', name: 'vesselEtd', type: 'date' })}{renderField({ label: 'Vessel ETA', name: 'vesselEta', type: 'date' })}{renderField({ label: 'Transit Time (Port to Port)', name: 'transitDays', type: 'number', min: '1', required: true, placeholder: 'e.g. 18' })}{renderField({ label: 'Rate Validity', name: 'rateValidity', placeholder: 'e.g. Valid till 31 Mar 2027' })}</div>
        <label className="space-y-1.5 text-[11px] font-bold text-slate-700">Cost Particular<textarea rows="2" value={form.costParticular} onChange={change('costParticular')} disabled={closed || saving} placeholder="Breakdown of costs, surcharges, etc." className={fieldClass} /></label>
        <label className="space-y-1.5 text-[11px] font-bold text-slate-700">Remarks<textarea rows="2" value={form.remarks} onChange={change('remarks')} disabled={closed || saving} placeholder="Any additional notes or conditions" className={fieldClass} /></label>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-5 py-4 shadow-[0_-8px_20px_rgba(15,23,42,0.06)] backdrop-blur"><div><p className="text-[10px] text-slate-500">Total INR charges: <strong className="text-sm text-slate-900">₹{inrCharges.toLocaleString('en-IN')}</strong><span className="mx-2 text-slate-300">+</span>USD {Number(form.oceanFreightUsd || 0).toLocaleString()} ocean freight</p>{missingCount > 0 && <p className="mt-1 text-[10px] font-semibold text-amber-700">{missingCount} required or invalid field{missingCount === 1 ? '' : 's'} remaining.</p>}</div><button type="submit" disabled={saving || closed} className="rounded-lg bg-[#0d7676] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#0f6666] disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving...' : rfq.myQuote ? 'Update Quote' : 'Submit Quote'}</button></div>
    </form>
  </div>;
}
