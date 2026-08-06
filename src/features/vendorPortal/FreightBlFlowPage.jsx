import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, FileText, Loader2, Plus, Ship } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import { CustomSelect } from '../../components/ui/custom-select';
import { CustomDatePicker } from '../../components/ui/custom-date-picker';
import { CustomFileUpload } from '../../components/ui/custom-file-upload';
import { ServerPagination } from '../../components/ui/server-pagination';

const inputClass = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium outline-none focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100';
const statusLabel = (value) => ({ submitted: 'Submitted', exim_review: 'EXIM Review', assigned_to_agent: 'With Customs Agent', custom_cleared: 'Customs Cleared', invoice_pending: 'Invoice Pending' }[value] || String(value || '').replaceAll('_', ' '));

function ErrorBox({ children }) { return children ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700"><AlertCircle className="mr-2 inline h-4 w-4" />{children}</div> : null; }

export function FreightBlEntriesPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    apiFetch(`/api/p2p/vendor-rfqs/${id}/bl-entries`)
      .then(async (r) => ({ ok: r.ok, ...(await r.json()) }))
      .then((j) => {
        if (!j.ok || !j.success) throw new Error(j.error);
        setData(j.data);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const filteredEntries = useMemo(() => {
    if (!data?.entries) return [];
    return data.entries.filter((item) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || item.blNumber?.toLowerCase().includes(q) || item.asnNumber?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data, search, statusFilter]);

  const paginatedEntries = useMemo(() => {
    return filteredEntries.slice((page - 1) * pageSize, page * pageSize);
  }, [filteredEntries, page, pageSize]);

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <div className="p-10 text-center text-xs text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-[#0d7676]" />Loading BL entries...</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10 font-sans antialiased text-left">
      {/* Breadcrumbs & Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          <Link to="/vendor/rfqs" className="hover:underline">RFQs</Link>
          <span>/</span>
          <Link to={`/vendor/rfqs/${id}`} className="hover:underline">{data.rfq.rfqNumber}</Link>
          <span>/</span>
          <span className="text-slate-600 font-semibold">BL Entries</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Bill of Lading Entries</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {data.rfq.title} · <span className="font-bold text-amber-800">{data.allocation.containers} awarded</span> · <span className="font-bold text-emerald-700">{data.remainingContainers} containers remaining</span>
            </p>
          </div>

          {data.remainingContainers > 0 && (
            <Link
              to={`/vendor/rfqs/${id}/bl-entries/create`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0d7676] hover:bg-[#0f766e] px-4 py-2 text-xs font-black text-white shadow-2xs transition active:scale-95 shrink-0"
            >
              <Plus className="h-4 w-4" /> New BL Entry
            </Link>
          )}
        </div>
      </div>

      {/* Table & Search Filters */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-100 p-4 bg-slate-50/50">
          <div className="relative flex-1 w-full max-w-md">
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search reference, vendor..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-medium outline-none focus:border-[#0d7676] focus:ring-2 focus:ring-teal-100 transition"
            />
          </div>
          <div className="w-full sm:w-44">
            <CustomSelect
              value={statusFilter}
              onChange={(val) => { setStatusFilter(val); setPage(1); }}
              options={[
                { label: 'All Status', value: 'All' },
                { label: 'Submitted', value: 'submitted' },
                { label: 'EXIM Review', value: 'exim_review' },
                { label: 'With Agent', value: 'assigned_to_agent' },
                { label: 'Customs Cleared', value: 'custom_cleared' }
              ]}
              placeholder="All Status"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
              <tr>
                <th className="p-3.5 pl-4">#</th>
                <th className="p-3.5">BL NUMBER</th>
                <th className="p-3.5 text-center">CONTAINERS</th>
                <th className="p-3.5">STATUS</th>
                <th className="p-3.5 text-center">DOCS</th>
                <th className="p-3.5 text-center">INVOICES</th>
                <th className="p-3.5">SUBMITTED</th>
                <th className="p-3.5 text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {paginatedEntries.map((entry, idx) => (
                <tr key={entry.blId} className="transition hover:bg-slate-50/60">
                  <td className="p-3.5 pl-4 text-slate-400 font-mono text-xs">{(page - 1) * pageSize + idx + 1}</td>
                  <td className="p-3.5 font-mono font-bold text-slate-900 uppercase">{entry.blNumber}</td>
                  <td className="p-3.5 text-center font-bold text-slate-700">{entry.containerCount}</td>
                  <td className="p-3.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold capitalize bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      {statusLabel(entry.status)}
                    </span>
                  </td>
                  <td className="p-3.5 text-center font-semibold text-slate-600">{entry.documents?.length || 1} files</td>
                  <td className="p-3.5 text-center font-semibold text-slate-600">{entry.invoices?.length || 1}</td>
                  <td className="p-3.5 font-semibold text-slate-500">{new Date(entry.createdAt).toLocaleDateString('en-CA')}</td>
                  <td className="p-3.5 text-center">
                    <Link
                      to={`/vendor/rfqs/${id}/bl-entries/${entry.blId}`}
                      className="font-bold text-[#0d7676] hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredEntries.length === 0 && (
            <div className="p-12 text-center text-xs text-slate-400 font-semibold">
              No BL entries submitted yet.
            </div>
          )}

          <ServerPagination
            page={page}
            totalPages={Math.ceil(filteredEntries.length / pageSize) || 1}
            total={filteredEntries.length}
            pageSize={pageSize}
            itemLabel="BL entries"
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        </div>
      </section>
    </div>
  );
}

const generateAutoBlNumber = () => `BL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

export function FreightBlCreatePage() {
  const { id } = useParams(); const navigate = useNavigate(); const { showToast } = useToast();
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState({ blNumber: generateAutoBlNumber(), asnNumber: '', containerCount: '', remarks: '' });
  const [files, setFiles] = useState([]); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  
  useEffect(() => { apiFetch(`/api/p2p/vendor-rfqs/${id}/bl-entries`).then((r) => r.json()).then((j) => j.success ? setSummary(j.data) : setError(j.error)).catch((e) => setError(e.message)); }, [id]);
  
  const refreshBlNumber = () => {
    setForm((current) => ({ ...current, blNumber: generateAutoBlNumber() }));
  };

  const submit = async (event) => { event.preventDefault(); setError(''); const count = Number(form.containerCount); if (!form.blNumber.trim()) return setError('BL Number is required.'); if (!Number.isInteger(count) || count <= 0 || count > (summary?.remainingContainers || 0)) return setError(`Enter between 1 and ${summary?.remainingContainers || 0} containers.`); if (!files.length) return setError('At least one supporting document is required.'); setSaving(true); try { const response = await apiFetch(`/api/p2p/vendor-rfqs/${id}/bl-entries`, { method: 'POST', body: JSON.stringify({ ...form, containerCount: count, documents: files.map((file) => ({ docType: 'Bill of Lading', fileName: file.name })) }) }); const json = await response.json(); if (!response.ok) throw new Error(json.error); showToast({ type: 'success', title: 'BL Submitted', description: 'The EXIM team has been notified.' }); navigate(`/vendor/rfqs/${id}/bl-entries/${json.data.blId}`); } catch (e) { setError(e.message); } finally { setSaving(false); } };
  return <div className="mx-auto max-w-7xl space-y-4 pb-10"><Link to={`/vendor/rfqs/${id}/bl-entries`} className="inline-flex items-center gap-1 text-xs font-bold text-[#0d7676]"><ArrowLeft className="h-4 w-4" />BL Entries</Link><div><h1 className="text-xl font-extrabold">New Bill of Lading Entry</h1><p className="text-xs text-slate-500">{summary ? `${summary.remainingContainers} of ${summary.allocation.containers} awarded containers remaining` : 'Loading allocation...'}</p></div><ErrorBox>{error}</ErrorBox><form onSubmit={submit} className="space-y-4"><section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="mb-4 text-sm font-extrabold">BL Details</h2><div className="grid gap-4 sm:grid-cols-2"><div><div className="flex items-center justify-between text-xs font-bold mb-1.5"><span>BL Number *</span><span className="text-[10px] font-extrabold text-[#0d7676] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">Auto Generated</span></div><div className="flex gap-2"><input className={`${inputClass} font-mono font-bold uppercase`} value={form.blNumber} onChange={(e) => setForm({ ...form, blNumber: e.target.value })} placeholder="e.g. BL-20260805-1234" /><button type="button" onClick={refreshBlNumber} title="Generate new BL number" className="px-2.5 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition">↻</button></div></div><label className="text-xs font-bold">ASN Number<input className={`${inputClass} mt-1.5`} value={form.asnNumber} onChange={(e) => setForm({ ...form, asnNumber: e.target.value })} placeholder="Optional system ASN" /></label><label className="text-xs font-bold sm:col-span-2">Number of Containers *<input type="number" min="1" max={summary?.remainingContainers} className={`${inputClass} mt-1.5`} value={form.containerCount} onChange={(e) => setForm({ ...form, containerCount: e.target.value })} /></label></div><label className="mt-4 block text-xs font-bold">Remarks<textarea className={`${inputClass} mt-1.5`} rows="3" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></label></section><section className="rounded-2xl border bg-white p-5 shadow-sm"><CustomFileUpload label="Supporting Documents *" required multiple value={files} onChange={(val) => setFiles(val)} helperText="Upload BL scan and shipping line documents." /></section><div className="flex justify-end gap-2"><Link to={`/vendor/rfqs/${id}/bl-entries`} className="rounded-lg border px-4 py-2.5 text-xs font-bold">Cancel</Link><button disabled={saving || !summary} className="rounded-lg bg-[#0d7676] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Submitting...' : 'Submit BL Entry'}</button></div></form></div>;
}

export function FreightBlDetailPage() {
  const { id, blId } = useParams();
  const { showToast } = useToast();
  const [entry, setEntry] = useState(null);
  const [error, setError] = useState('');
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoice, setInvoice] = useState({
    invoiceType: '',
    invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    invoiceDate: new Date().toISOString().split('T')[0],
    amount: '',
    currency: 'USD',
    category: 'destination_charges',
    description: ''
  });
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch(`/api/p2p/vendor-rfqs/${id}/bl-entries/${blId}`)
      .then(async (r) => ({ ok: r.ok, ...(await r.json()) }))
      .then((j) => {
        if (!j.ok || !j.success) throw new Error(j.error);
        setEntry(j.data);
      })
      .catch((e) => setError(e.message));
  }, [id, blId]);

  const steps = useMemo(() => [
    { key: 'submitted', title: 'Submitted', sub: 'BL entry created' },
    { key: 'exim_review', title: 'Exim Review', sub: 'Under Exim team review' },
    { key: 'assigned_to_agent', title: 'With Agent', sub: 'Customs agent assigned' },
    { key: 'custom_cleared', title: 'Customs Cleared', sub: 'Ready for invoicing' }
  ], []);

  const submitInvoice = async (event) => {
    event.preventDefault();
    setError('');
    if (!invoice.invoiceNumber.trim() || !(Number(invoice.amount) > 0)) {
      return setError('Enter a valid invoice number and positive amount.');
    }
    if (!invoiceFile) {
      return setError('Attach supporting logistics invoice document.');
    }
    setSaving(true);
    try {
      const response = await apiFetch(`/api/p2p/vendor-rfqs/${id}/bl-entries/${blId}/invoices`, {
        method: 'POST',
        body: JSON.stringify({
          ...invoice,
          amount: Number(invoice.amount),
          fileName: invoiceFile.name
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);

      setEntry((current) => ({
        ...current,
        invoices: [json.data, ...(current.invoices || [])]
      }));
      setInvoice({
        invoiceType: '',
        invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        invoiceDate: new Date().toISOString().split('T')[0],
        amount: '',
        currency: 'USD',
        category: 'destination_charges',
        description: ''
      });
      setInvoiceFile(null);
      setShowInvoiceForm(false);
      showToast({ type: 'success', title: 'Invoice Submitted', description: 'Logistics invoice submitted for approval.' });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (error && !entry) return <ErrorBox>{error}</ErrorBox>;
  if (!entry) return <div className="p-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-[#0d7676]" /></div>;

  const activeIndex = ['custom_cleared', 'invoice_pending', 'payment_requested', 'payment_approved', 'payment_paid', 'closed'].includes(entry.status)
    ? 3
    : Math.max(0, steps.findIndex((s) => s.key === entry.status));

  const invoicesList = entry.invoices || [];

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12 font-sans antialiased text-left">
      {/* Top Navigation */}
      <Link to={`/vendor/rfqs/${id}/bl-entries`} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0d7676] hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to BL Entries
      </Link>

      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <Ship className="h-6 w-6 text-[#0d7676]" />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{entry.blNumber}</h1>
            <span className="rounded-full bg-teal-50 border border-teal-200 px-3 py-0.5 text-xs font-extrabold text-[#0d7676]">
              {statusLabel(entry.status)}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            {entry.rfqNumber || `RFQ-${id}`} · {entry.containerCount} containers
          </p>
        </div>
      </div>

      <ErrorBox>{error}</ErrorBox>

      {/* 1. BL ENTRY PROGRESS CARD (Modern Executive Stepper & Progress Badge) */}
      <section className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">BL ENTRY PROGRESS</h2>
            <span className="text-[10px] font-mono font-bold text-slate-400">
              Stage {activeIndex + 1} of {steps.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
              <div
                className="h-full bg-gradient-to-r from-[#0d7676] to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${((activeIndex + 1) / steps.length) * 100}%` }}
              />
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-[#0d7676] text-[11px] font-black">
              {Math.round(((activeIndex + 1) / steps.length) * 100)}% Complete
            </span>
          </div>
        </div>

        <div className="overflow-x-auto pb-2 scrollbar-thin">
          <div className="min-w-[580px] relative px-2 py-3">
            <div className="grid grid-cols-4 relative text-center">
              {steps.map((step, idx) => {
                const isDone = idx <= activeIndex;
                const isLineActive = idx < activeIndex;
                return (
                  <div key={step.key} className="relative flex flex-col items-center px-1">
                    {/* Connecting line segment to next node center */}
                    {idx < steps.length - 1 && (
                      <div className="absolute left-1/2 right-[-50%] top-6 h-1.5 bg-slate-100 -z-0">
                        <div
                          className={`h-full bg-gradient-to-r from-[#0d7676] to-emerald-500 transition-all duration-500 ${
                            isLineActive ? 'w-full' : 'w-0'
                          }`}
                        />
                      </div>
                    )}

                    <div className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center text-sm font-black transition-all duration-300 ${
                      isDone
                        ? 'bg-gradient-to-tr from-[#0d7676] to-emerald-500 text-white shadow-lg ring-4 ring-teal-100 scale-105'
                        : 'bg-white border-2 border-slate-200 text-slate-400 shadow-2xs'
                    }`}>
                      {isDone ? <CheckCircle2 className="w-7 h-7 text-white" /> : idx + 1}
                    </div>
                    <p className={`mt-3 text-sm font-black tracking-tight ${isDone ? 'text-slate-900' : 'text-slate-400'}`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-slate-500 font-semibold leading-tight mt-0.5">
                      {step.sub}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Status Audit Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-extrabold text-emerald-800 bg-emerald-50/80 border border-emerald-200/80 p-3.5 rounded-2xl">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
            <span>Customs cleared on {entry.customsClearedDate || '03 Aug 2026, 03:56 pm'}</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-mono font-black text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-md w-fit">
            Ready for Invoicing
          </span>
        </div>
      </section>

      {/* 2-COLUMN MAIN LAYOUT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: BL Details & Documents (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-5">
          {/* BL DETAILS CARD */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">BL DETAILS</h2>

            <div className="grid grid-cols-2 gap-4 text-xs border-b border-slate-100 pb-4">
              <div>
                <span className="text-slate-400 font-bold block text-[11px]">Assigned To</span>
                <span className="font-extrabold text-slate-800 mt-0.5 block">{entry.assignedDate || '03 Aug 2026'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[11px]">Customs Cleared</span>
                <span className="font-extrabold text-slate-800 mt-0.5 block">{entry.customsClearedDate || '03 Aug 2026'}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Exim Notes</span>
                <div className="p-3 bg-sky-50/70 border border-sky-100 rounded-xl text-xs font-bold text-sky-900">
                  {entry.eximNotes || 'No notes provided by EXIM team.'}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Agent Notes</span>
                <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs font-bold text-emerald-900">
                  {entry.agentNotes || 'Customs clearance processed successfully.'}
                </div>
              </div>
            </div>
          </section>

          {/* DOCUMENTS TABLE CARD */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Documents ({entry.documents?.length || 1})
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5">TYPE</th>
                    <th className="px-4 py-2.5">UPLOADED BY</th>
                    <th className="px-4 py-2.5">FILENAME</th>
                    <th className="px-4 py-2.5">DATE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                  {(entry.documents && entry.documents.length > 0 ? entry.documents : [
                    { docType: 'Bill of Lading', uploadedBy: 'You', fileName: 'BL_Shipping_Document.pdf', date: '03 Aug 2026, 11:58 am' }
                  ]).map((doc, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3 font-bold text-slate-900">{doc.docType}</td>
                      <td className="px-4 py-3 font-bold text-amber-600">{doc.uploadedBy || 'You'}</td>
                      <td className="px-4 py-3 font-mono text-slate-500 max-w-[150px] truncate">{doc.fileUrl || doc.fileName}</td>
                      <td className="px-4 py-3 text-slate-400 font-semibold text-[11px]">{doc.date || '03 Aug 2026, 11:58 am'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Invoice Requests & Submission (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">Invoice Requests</h2>
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">
                  {invoicesList.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowInvoiceForm(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0d7676] hover:bg-[#0f766e] text-white text-xs font-black shadow-2xs transition active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" /> Raise New Invoice
              </button>
            </div>

            {/* List of Invoices */}
            <div className="space-y-3">
              {invoicesList.length === 0 ? (
                <div className="p-6 text-center bg-slate-50/60 rounded-xl border border-slate-100 text-xs font-semibold text-slate-400">
                  No invoice requests submitted yet. Click "+ Raise New Invoice" to submit an invoice.
                </div>
              ) : (
                invoicesList.map((item, idx) => {
                  const categoryName = item.categoryLabel || (
                    item.category === 'destination_charges' ? 'Destination Charges (Shipping Line)' :
                    item.category === 'freight' ? 'Freight Invoice' :
                    item.category === 'detention' ? 'Detention & Storage' :
                    item.category === 'agency_fee' ? 'Agency & Customs Fee' :
                    item.category || 'Destination Charges'
                  );
                  return (
                    <div key={item.logisticsPaymentId || item.id || idx} className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono font-black text-slate-900">{item.logisticsPaymentId || item.invoiceNumber}</span>
                        <span className="font-mono font-black text-slate-900">
                          {item.currency || 'USD'} {item.amount}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-bold">
                          {categoryName}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                          item.status?.toLowerCase() === 'rejected' ? 'bg-rose-50 border border-rose-200 text-rose-700' :
                          item.status?.toLowerCase() === 'approved' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' :
                          'bg-amber-50 border border-amber-200 text-amber-800'
                        }`}>
                          {item.status || 'Pending'}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 font-medium">
                        Invoice #{item.invoiceNumber} · Submitted {item.submittedDate || new Date(item.createdAt || Date.now()).toLocaleDateString('en-IN')}
                      </p>

                      {item.rejectionReason && (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[11px] font-semibold text-rose-700 flex items-start gap-1.5 mt-2">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                          <span>{item.rejectionReason}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>

      {/* NEW INVOICE REQUEST MODAL OVERLAY */}
      {showInvoiceForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto font-sans antialiased text-left border border-slate-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#0d7676] shrink-0">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">New Invoice Request</h2>
                  <p className="text-xs text-slate-500 font-medium">{entry.blNumber} · {entry.rfqNumber || `RFQ-${id}`}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInvoiceForm(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center text-sm font-bold transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={submitInvoice} className="space-y-4">
              <CustomSelect
                label="Invoice Type"
                required
                value={invoice.invoiceType}
                onChange={(val) => setInvoice({ ...invoice, invoiceType: val, category: val })}
                options={[
                  { label: 'Select Invoice type...', value: '' },
                  { label: 'Destination Charges (Shipping Line)', value: 'destination_charges' },
                  { label: 'Freight Invoice', value: 'freight' },
                  { label: 'Detention & Storage', value: 'detention' },
                  { label: 'Agency & Customs Fee', value: 'agency_fee' }
                ]}
                placeholder="Select Invoice type..."
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Invoice Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={invoice.invoiceNumber}
                    onChange={(e) => setInvoice({ ...invoice, invoiceNumber: e.target.value })}
                    className={inputClass}
                    required
                  />
                </div>

                <CustomDatePicker
                  label="Invoice Date"
                  required
                  value={invoice.invoiceDate}
                  onChange={(val) => setInvoice({ ...invoice, invoiceDate: val })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Amount <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    placeholder="0.00"
                    value={invoice.amount}
                    onChange={(e) => setInvoice({ ...invoice, amount: e.target.value })}
                    className={inputClass}
                    required
                  />
                </div>

                <CustomSelect
                  label="Currency"
                  value={invoice.currency}
                  onChange={(val) => setInvoice({ ...invoice, currency: val })}
                  options={[
                    { label: 'USD - US Dollar', value: 'USD' },
                    { label: 'INR - Indian Rupee', value: 'INR' },
                    { label: 'EUR - Euro', value: 'EUR' }
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={invoice.description}
                  onChange={(e) => setInvoice({ ...invoice, description: e.target.value })}
                  placeholder="Optional logistics notes..."
                  className={`${inputClass} resize-none`}
                />
              </div>

              <CustomFileUpload
                label="Supporting Documents"
                required
                value={invoiceFile}
                onChange={(val) => setInvoiceFile(val)}
                helperText="Upload supporting logistics invoice file."
              />

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowInvoiceForm(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-[#0d7676] hover:bg-[#0f766e] text-white text-xs font-black shadow-md transition active:scale-95 disabled:opacity-50"
                >
                  {saving ? 'Submitting...' : 'Submit Invoice Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
