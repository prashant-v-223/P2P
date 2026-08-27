import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CalendarDays, CheckCircle2, Loader2, Ship, Clock, DollarSign, Navigation, ArrowRight } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import { CustomDatePicker } from '../../components/ui/custom-date-picker';
import RecordDbInfoDrawer from '../../components/common/RecordDbInfoDrawer';

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
        if (json.data.myQuote) {
          setForm((current) => ({
            ...current,
            ...json.data.myQuote,
            cutoffDate: dateValue(json.data.myQuote.cutoffDate),
            vesselEtd: dateValue(json.data.myQuote.vesselEtd),
            vesselEta: dateValue(json.data.myQuote.vesselEta)
          }));
        }
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
    if (!String(form.shippingLine).trim()) return setFormError('Shipping Line Name is required.');
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
      showToast({ type: 'success', title: rfq.myQuote ? 'Quote Updated' : 'Quote Submitted', description: 'Procurement team has been notified.' });
    } catch (error) {
      setFormError(error.message);
      showToast({ type: 'error', title: 'Quote Failed', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (loadError) return <div className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-bold text-rose-700"><AlertCircle className="mr-2 inline h-5 w-5" />{loadError}</div>;
  if (!rfq) return <div className="p-16 text-center text-xs font-semibold text-slate-500"><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-[#0d7676]" />Loading RFQ details...</div>;

  const cargo = rfq.cargoDetails || {};
  const deadline = rfq.closingDate ? new Date(rfq.closingDate) : null;
  if (deadline) {
    const utcMidnight = deadline.getUTCHours() === 0 && deadline.getUTCMinutes() === 0 && deadline.getUTCSeconds() === 0;
    const localMidnight = deadline.getHours() === 0 && deadline.getMinutes() === 0 && deadline.getSeconds() === 0;
    if (localMidnight) deadline.setHours(23, 59, 59, 999);
    else if (utcMidnight) deadline.setUTCHours(23, 59, 59, 999);
  }
  const status = String(rfq.status || '').toLowerCase();
  const isAwardedRfq = ['awarded', 'fully_awarded', 'partially_awarded'].includes(status) || Number(rfq.allocatedQuantity || 0) > 0;
  const awardedToMe = Boolean(rfq.myAllocation);
  const awardedToOther = isAwardedRfq && !awardedToMe;
  const deadlinePassed = Boolean(deadline && deadline < new Date());
  const closed = status !== 'published' || deadlinePassed;
  const closedReason = deadlinePassed ? 'The quotation deadline has passed.' : status === 'awarded' ? 'This RFQ has already been awarded.' : `This RFQ is ${rfq.status || 'not open'}.`;
  const fieldClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-900 outline-none transition focus:border-[#0d7676] focus:bg-white focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-60';
  const inrCharges = Number(form.stChargesInr || 0) + Number(form.otherChargesInr || 0);

  const badgeLabel = awardedToMe
    ? 'AWARDED'
    : awardedToOther
      ? 'AWARDED TO OTHER VENDOR'
      : status === 'pending_approval'
        ? 'PENDING APPROVAL'
        : closed
          ? 'CLOSED'
          : (rfq.status || 'PUBLISHED');

  const badgeClass = awardedToMe
    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
    : awardedToOther
      ? 'bg-amber-100 text-amber-800 border border-amber-300'
      : status === 'pending_approval'
        ? 'bg-amber-50 text-amber-800 border border-amber-300'
        : closed
          ? 'bg-slate-100 text-slate-700 border border-slate-300'
          : 'bg-teal-50 text-[#0d7676] border border-teal-200';

  const errors = {
    shippingLine: !String(form.shippingLine).trim() ? 'Enter shipping line name.' : '',
    oceanFreightUsd: !(Number(form.oceanFreightUsd) > 0) ? 'Enter amount > 0.' : '',
    stChargesInr: form.stChargesInr === '' || Number(form.stChargesInr) < 0 ? 'Enter valid charge amount.' : '',
    transitDays: !(Number(form.transitDays) > 0) ? 'Enter estimated transit days.' : '',
    vesselEta: form.vesselEtd && form.vesselEta && new Date(form.vesselEta) < new Date(form.vesselEtd) ? 'ETA cannot precede ETD.' : ''
  };
  const missingCount = Object.values(errors).filter(Boolean).length;

  const renderInputField = ({ label, name, type = 'text', required = false, min, placeholder }) => {
    const err = attempted ? errors[name] : '';
    return (
      <div className="space-y-1.5 font-sans">
        <label className="block text-xs font-bold text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        <input
          type={type}
          min={min}
          step={type === 'number' ? 'any' : undefined}
          required={required}
          value={form[name] ?? ''}
          onChange={change(name)}
          disabled={closed || saving}
          placeholder={placeholder}
          className={`${fieldClass} ${err ? 'border-rose-400 bg-rose-50/50 focus:border-rose-400' : ''}`}
        />
        {err && <p className="text-[11px] font-bold text-rose-600">{err}</p>}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16 font-sans antialiased text-left">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between">
        <Link to="/vendor/rfqs" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0d7676] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to RFQs
        </Link>
      </div>

      {/* Hero Header Card */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-3 py-0.5 text-xs font-black uppercase ${badgeClass}`}>
                {badgeLabel}
              </span>
              <span className="font-mono text-xs font-bold text-slate-400">
                {rfq.rfqNumber}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">{rfq.title}</h1>
          </div>

          <div className="flex flex-col sm:items-end gap-2 shrink-0">
            <div className="text-xs text-slate-500 font-medium">
              Closing Date : <strong className="text-slate-800 font-bold">{rfq.closingDate ? new Date(rfq.closingDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}</strong>
            </div>

            {rfq.myAllocation && (
              <Link
                to={`/vendor/rfqs/${id}/bl-entries`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0d7676] hover:bg-[#0f766e] px-4 py-2 text-xs font-bold text-white shadow-2xs transition active:scale-95"
              >
                Manage BL Entries →
              </Link>
            )}
          </div>
        </div>

        {/* SHIPMENT REQUIREMENTS (Soft Amber Box with 2-row x 3-col Grid) */}
        <div className="rounded-2xl bg-amber-50/50 border border-amber-200/60 p-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-amber-800">SHIPMENT REQUIREMENTS</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-4 gap-x-6 text-xs">
            <div>
              <span className="text-[11px] text-slate-400 font-semibold block">Shipping Terms</span>
              <span className="font-bold text-slate-800 mt-0.5 block">{cargo.shippingTerms || 'FOB'}</span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-semibold block">Port of Loading</span>
              <span className="font-bold text-slate-800 mt-0.5 block">{cargo.portOfOrigin || '—'}</span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-semibold block">Port of Discharge</span>
              <span className="font-bold text-slate-800 mt-0.5 block">{cargo.portOfDestination || 'NHAVA SHEVA'}</span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-semibold block">Cargo Type</span>
              <span className="font-bold text-slate-800 mt-0.5 block">{cargo.cargoType || '—'}</span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-semibold block">Container Type</span>
              <span className="font-bold text-slate-800 mt-0.5 block">{cargo.containerType || '40 FT'}</span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-semibold block">No. of Containers</span>
              <span className="font-bold text-slate-800 mt-0.5 block">{rfq.myAllocation?.containers || cargo.numberOfContainers || cargo.containerCount || '—'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Clean Awarded Green Banner (To You) */}
      {awardedToMe && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>🎉 RFQ Awarded to You! You have been awarded {rfq.myAllocation.containers} container(s). Use the BL Entries section to manage shipments.</span>
        </div>
      )}

      {/* Awarded to Other Vendor Banner */}
      {awardedToOther && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-900 shadow-2xs">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <span className="font-extrabold uppercase block text-[11px] text-amber-800">RFQ Awarded to Another Vendor</span>
            <span>Bidding for this RFQ is complete and container allocations have been awarded to another vendor. Quote editing is locked.</span>
          </div>
        </div>
      )}

      {rfq.awardPending && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-900 shadow-2xs">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <span>Your proposed allocation is awaiting internal approval. Current status: {rfq.awardApprovalStatus || 'Pending approval'}.</span>
        </div>
      )}

      {/* Prominent RFQ Closed Banner */}
      {closed && !awardedToMe && !awardedToOther && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800 shadow-2xs">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <div>
            <span className="font-extrabold uppercase block text-[11px] text-rose-700">RFQ Closed for Bidding</span>
            <span>{closedReason} New quote submissions and updates are locked.</span>
          </div>
        </div>
      )}

      {/* When RFQ Allocation Granted: Render Clean Awarded Quote Summary (Hides quote form) */}
      {Boolean(rfq.myAllocation) ? (
        <section className="rounded-3xl border border-slate-200 bg-white shadow-2xs overflow-hidden space-y-6 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
                <Ship className="h-5 w-5 text-[#0d7676]" /> AWARDED FREIGHT QUOTATION SUMMARY
              </h2>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Your submitted quote has been approved for this RFQ.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold w-fit">
              ✓ Awarded Quote
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-slate-400">Shipping Line</span>
              <p className="font-extrabold text-slate-900 text-sm">{form.shippingLine || rfq.myQuote?.shippingLine || '—'}</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-slate-400">Ocean Freight</span>
              <p className="font-mono font-black text-[#0d7676] text-sm">USD {Number(form.oceanFreightUsd || rfq.myQuote?.oceanFreightUsd || 0).toLocaleString()}</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-slate-400">Shipping Line Charges</span>
              <p className="font-mono font-black text-slate-900 text-sm">₹{Number(form.stChargesInr || rfq.myQuote?.stChargesInr || 0).toLocaleString('en-IN')}</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-slate-400">Port Transit Time</span>
              <p className="font-extrabold text-slate-900 text-sm">{form.transitDays || rfq.myQuote?.transitDays || '—'} days</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2 border-t border-slate-100">
            <div>
              <span className="text-slate-400 font-bold block text-[11px]">Cutoff Date</span>
              <span className="font-extrabold text-slate-800 mt-0.5 block">{form.cutoffDate || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 font-bold block text-[11px]">Vessel ETD / ETA</span>
              <span className="font-extrabold text-slate-800 mt-0.5 block">{form.vesselEtd || '—'} → {form.vesselEta || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 font-bold block text-[11px]">Rate Validity</span>
              <span className="font-extrabold text-slate-800 mt-0.5 block">{form.rateValidity || '—'}</span>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Link
              to={`/vendor/rfqs/${id}/bl-entries`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0d7676] hover:bg-[#0f766e] px-6 py-3 text-xs font-black text-white shadow-md transition"
            >
              <Ship className="h-4 w-4" /> Go to Bill of Lading Entries →
            </Link>
          </div>
        </section>
      ) : (
        /* Main Interactive Quotation Form (Only shown when RFQ is open for quoting) */
        <form onSubmit={submit} noValidate className="rounded-3xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 px-6 py-5 bg-slate-50/40">
            <div>
              <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
                <Ship className="h-5 w-5 text-[#0d7676]" /> YOUR FREIGHT QUOTATION
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {rfq.myQuote ? 'Update your submitted freight rates and shipping schedule before the deadline.' : 'Enter your freight rates and logistics schedules below.'}
              </p>
            </div>

            {!closed && (
              <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                missingCount ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              }`}>
                {missingCount ? `${missingCount} fields remaining` : '✓ Ready to submit'}
              </span>
            )}
          </div>

          {closed && status !== 'awarded' && (
            <div className="m-6 mb-0 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-900">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <span>{closedReason} Quote editing is disabled.</span>
            </div>
          )}

          {formError && (
            <div className="m-6 mb-0 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
              {formError}
            </div>
          )}

          <div className="space-y-6 p-6 sm:p-8">
            {/* Section 1: Shipping Line & Route */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                SHIPPING LINE & VESSEL ROUTE
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {renderInputField({ label: 'Shipping Line Name', name: 'shippingLine', required: true, placeholder: 'e.g. Maersk Line / MSC / CMA CGM' })}
                {renderInputField({ label: 'Vessel Route', name: 'vesselRoute', placeholder: 'e.g. Shanghai → Nhava Sheva Direct' })}
              </div>
            </div>

            {/* Section 2: Freight Cost Breakdown */}
            <div className="space-y-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 p-5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-200/60 pb-2">
                FREIGHT COSTS & SURCHARGES
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {renderInputField({ label: 'Ocean Freight (USD)', name: 'oceanFreightUsd', type: 'number', min: '1', required: true, placeholder: '0.00' })}
                {renderInputField({ label: 'Shipping Line Charges (INR)', name: 'stChargesInr', type: 'number', min: '0', required: true, placeholder: '0.00' })}
                {renderInputField({ label: 'Other Charges (INR)', name: 'otherChargesInr', type: 'number', min: '0', placeholder: '0.00' })}
              </div>
            </div>

            {/* Section 3: Schedules & Transit Times */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                SCHEDULES & PORT TRANSIT TIME
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <CustomDatePicker
                  label="Cutoff Date"
                  value={form.cutoffDate}
                  onChange={(val) => setForm((c) => ({ ...c, cutoffDate: val }))}
                />
                <CustomDatePicker
                  label="Vessel ETD (Estimated Departure)"
                  value={form.vesselEtd}
                  onChange={(val) => setForm((c) => ({ ...c, vesselEtd: val }))}
                />
                <CustomDatePicker
                  label="Vessel ETA (Estimated Arrival)"
                  value={form.vesselEta}
                  min={form.vesselEtd}
                  onChange={(val) => setForm((c) => ({ ...c, vesselEta: val }))}
                />
                {renderInputField({ label: 'Transit Time (Port to Port in Days)', name: 'transitDays', type: 'number', min: '1', required: true, placeholder: 'e.g. 18' })}
                {renderInputField({ label: 'Free Days at Port', name: 'freeDays', placeholder: 'e.g. 21 days detention free' })}
                {renderInputField({ label: 'Rate Validity', name: 'rateValidity', placeholder: 'e.g. Valid till 31 Mar 2027' })}
              </div>
            </div>

            {/* Section 4: Particulars & Remarks */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                COST PARTICULARS & ADDITIONAL REMARKS
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cost Particular</label>
                  <textarea
                    rows={2}
                    value={form.costParticular}
                    onChange={change('costParticular')}
                    disabled={closed || saving}
                    placeholder="Detailed cost breakdown, surcharges, or inclusion terms..."
                    className={`${fieldClass} resize-none`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Remarks</label>
                  <textarea
                    rows={2}
                    value={form.remarks}
                    onChange={change('remarks')}
                    disabled={closed || saving}
                    placeholder="Any additional freight conditions or notes..."
                    className={`${fieldClass} resize-none`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Action Footer */}
          <div className="sticky bottom-0 z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-200 bg-white/95 px-6 py-4 shadow-[0_-8px_20px_rgba(15,23,42,0.06)] backdrop-blur">
            <div>
              <p className="text-xs text-slate-500 font-semibold">
                Total Charges: <strong className="text-sm font-black text-slate-900">₹{inrCharges.toLocaleString('en-IN')}</strong>
                <span className="mx-2 text-slate-300 font-normal">+</span>
                <strong className="text-sm font-black text-[#0d7676]">USD {Number(form.oceanFreightUsd || 0).toLocaleString()}</strong> ocean freight
              </p>
              {missingCount > 0 && (
                <p className="mt-0.5 text-[11px] font-bold text-amber-700">
                  {missingCount} required field{missingCount === 1 ? '' : 's'} remaining.
                </p>
              )}
            </div>

            {closed ? (
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-500 bg-slate-100 px-5 py-2.5 rounded-xl border border-slate-200 cursor-not-allowed">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>RFQ Closed — Bidding Locked</span>
              </div>
            ) : (
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 rounded-xl bg-[#0d7676] hover:bg-[#0f766e] text-white text-xs font-black shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : rfq.myQuote ? 'Update Freight Quote' : 'Submit Freight Quote'}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
