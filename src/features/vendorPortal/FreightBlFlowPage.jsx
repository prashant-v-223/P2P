import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, FileText, Loader2, Plus, Ship, Search, Filter, FileCheck, Download } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import { CustomSelect } from '../../components/ui/custom-select';
import { CustomDatePicker } from '../../components/ui/custom-date-picker';
import { CustomFileUpload } from '../../components/ui/custom-file-upload';
import { ServerPagination } from '../../components/ui/server-pagination';
import { downloadDocumentFile } from '../../utils/downloadHelper';
import { formatCurrencyINR } from '../../utils/currencyHelper';

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

export function FreightBlCreatePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState({
    blNumber: '',
    asnNumber: '',
    containerCount: '',
    remarks: ''
  });
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch(`/api/p2p/vendor-rfqs/${id}/bl-entries`)
      .then((r) => r.json())
      .then((j) => (j.success ? setSummary(j.data) : setError(j.error)))
      .catch((e) => setError(e.message));
  }, [id]);

  const [fieldErrors, setFieldErrors] = useState({});
  const [asnValidating, setAsnValidating] = useState(false);
  const [asnValidatedSuccess, setAsnValidatedSuccess] = useState(false);
  const requiresAsn = summary?.requiresAsn !== false;

  const handleAsnBlur = async () => {
    if (!requiresAsn) return;
    const cleanAsn = form.asnNumber.trim().toUpperCase();
    if (requiresAsn && !cleanAsn) {
      setFieldErrors((prev) => ({ ...prev, asnNumber: 'ASN Number is required.' }));
      setAsnValidatedSuccess(false);
      return;
    }
    if (cleanAsn.length < 3 || cleanAsn.length > 30) {
      setFieldErrors((prev) => ({ ...prev, asnNumber: 'ASN Number must be between 3 and 30 characters.' }));
      setAsnValidatedSuccess(false);
      return;
    }
    if (!/^[A-Z0-9\-_/]+$/i.test(cleanAsn)) {
      setFieldErrors((prev) => ({ ...prev, asnNumber: 'ASN Number can only contain letters, numbers, hyphens, and slashes.' }));
      setAsnValidatedSuccess(false);
      return;
    }

    setAsnValidating(true);
    try {
      const res = await apiFetch(`/api/p2p/validate-asn?asnNumber=${encodeURIComponent(cleanAsn)}&rfqId=${encodeURIComponent(id || '')}`);
      const j = await res.json();
      if (!j.valid) {
        setFieldErrors((prev) => ({ ...prev, asnNumber: j.error || `ASN Number "${cleanAsn}" has already been used for a BL entry.` }));
        setAsnValidatedSuccess(false);
      } else {
        setFieldErrors((prev) => ({ ...prev, asnNumber: '' }));
        setAsnValidatedSuccess(true);
      }
    } catch (e) {
      setFieldErrors((prev) => ({ ...prev, asnNumber: e.message }));
      setAsnValidatedSuccess(false);
    } finally {
      setAsnValidating(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const errors = {};

    const cleanBl = form.blNumber.trim().toUpperCase();
    const cleanAsn = form.asnNumber.trim().toUpperCase();
    const count = Number(form.containerCount);
    const remaining = summary?.remainingContainers || 0;

    if (!cleanBl) {
      errors.blNumber = 'BL Number is required.';
    } else if (cleanBl.length < 3) {
      errors.blNumber = 'BL Number must be at least 3 characters.';
    } else if (!/^[A-Z0-9\-_/]+$/i.test(cleanBl)) {
      errors.blNumber = 'BL Number can only contain letters, numbers, hyphens, and slashes.';
    }

    if (!cleanAsn) {
      errors.asnNumber = 'ASN Number is required to link with RFQ & PO records.';
    } else if (cleanAsn && cleanAsn.length < 3) {
      errors.asnNumber = 'ASN Number must be at least 3 characters.';
    } else if (cleanAsn && !/^[A-Z0-9\-_/]+$/i.test(cleanAsn)) {
      errors.asnNumber = 'ASN Number can only contain letters, numbers, hyphens, and slashes.';
    }

    if (!form.containerCount || !Number.isInteger(count) || count <= 0) {
      errors.containerCount = 'Enter a valid positive integer count of containers.';
    } else if (count > remaining) {
      errors.containerCount = `Container count (${count}) exceeds remaining allocation (${remaining} containers).`;
    }

    if (!files || files.length === 0) {
      errors.files = 'At least one supporting document (BL Scan / Shipping Document) is required.';
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      const firstErr = Object.values(errors)[0];
      return setError(firstErr);
    }

    setSaving(true);
    try {
      const response = await apiFetch(`/api/p2p/vendor-rfqs/${id}/bl-entries`, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          blNumber: cleanBl,
          asnNumber: cleanAsn,
          containerCount: count,
          documents: files.map((file) => ({ docType: 'Bill of Lading', fileName: file.name }))
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);

      showToast({ type: 'success', title: 'BL Entry Submitted', description: 'The EXIM team and Customs Agent have been notified.' });
      navigate(`/vendor/rfqs/${id}/bl-entries/${json.data.blId}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-12 font-sans antialiased text-left">
      {/* Top Navigation */}
      <div>
        <Link
          to={`/vendor/rfqs/${id}/bl-entries`}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-50/80 hover:bg-teal-100 text-[#0d7676] border border-teal-200/80 text-xs font-extrabold transition shadow-2xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to BL Entries
        </Link>
      </div>

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">New Bill of Lading Entry</h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {summary ? (
              <>
                <span className="font-extrabold text-teal-700">{summary.remainingContainers}</span> of{' '}
                <span className="font-extrabold text-slate-800">{summary.allocation.containers}</span> awarded containers remaining for allocation
              </>
            ) : (
              'Loading allocation details...'
            )}
          </p>
        </div>

        {summary && (
          <span className="px-3 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-extrabold shadow-2xs self-start sm:self-auto">
            Remaining: {summary.remainingContainers} Containers
          </span>
        )}
      </div>

      <ErrorBox>{error}</ErrorBox>

      {/* Form Content */}
      <form onSubmit={submit} className="space-y-4">
        {/* Card 1: BL & Shipment Reference Details */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
              BL Details & Shipment Reference
            </h2>
            <span className="text-[10px] font-mono text-slate-400 font-bold">Required Fields marked *</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* BL Number Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                BL Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.blNumber}
                onChange={(e) => {
                  setForm({ ...form, blNumber: e.target.value });
                  if (fieldErrors.blNumber) setFieldErrors({ ...fieldErrors, blNumber: '' });
                }}
                placeholder="Enter BL Number (e.g. BL-20260805-1234)"
                className={`${inputClass} font-mono font-bold uppercase ${
                  fieldErrors.blNumber ? 'border-rose-400 bg-rose-50/30 focus:border-rose-500 focus:ring-rose-100' : ''
                }`}
                required
              />
              {fieldErrors.blNumber && (
                <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" /> {fieldErrors.blNumber}
                </p>
              )}
            </div>

            {/* ASN Number Field - import BL only */}
            {requiresAsn && <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ASN Number (Advance Shipping Notice) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={form.asnNumber}
                  onChange={(e) => {
                    setForm({ ...form, asnNumber: e.target.value });
                    setAsnValidatedSuccess(false);
                    if (fieldErrors.asnNumber) setFieldErrors({ ...fieldErrors, asnNumber: '' });
                  }}
                  onBlur={handleAsnBlur}
                  placeholder="Enter ASN Number (e.g. ASN-20260805-5678)"
                  className={`${inputClass} font-mono font-bold uppercase pr-24 ${
                    fieldErrors.asnNumber ? 'border-rose-400 bg-rose-50/30 focus:border-rose-500 focus:ring-rose-100' : 
                    asnValidatedSuccess ? 'border-emerald-400 bg-emerald-50/20 focus:border-emerald-500' : ''
                  }`}
                  required
                />
                {asnValidating && (
                  <div className="absolute right-3 top-2.5 flex items-center gap-1 text-[11px] font-bold text-teal-600">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking...
                  </div>
                )}
                {asnValidatedSuccess && !asnValidating && (
                  <div className="absolute right-3 top-2.5 flex items-center gap-1 text-[11px] font-extrabold text-emerald-600">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Available
                  </div>
                )}
              </div>
              {fieldErrors.asnNumber && (
                <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" /> {fieldErrors.asnNumber}
                </p>
              )}
            </div>}

            {/* Container Count Field */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Number of Containers <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max={summary?.remainingContainers || 999}
                value={form.containerCount}
                onChange={(e) => {
                  setForm({ ...form, containerCount: e.target.value });
                  if (fieldErrors.containerCount) setFieldErrors({ ...fieldErrors, containerCount: '' });
                }}
                placeholder={`Enter container count (max ${summary?.remainingContainers || 1})`}
                className={`${inputClass} ${
                  fieldErrors.containerCount ? 'border-rose-400 bg-rose-50/30 focus:border-rose-500 focus:ring-rose-100' : ''
                }`}
                required
              />
              {fieldErrors.containerCount ? (
                <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" /> {fieldErrors.containerCount}
                </p>
              ) : summary ? (
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  You can allocate up to {summary.remainingContainers} remaining containers for this BL submission.
                </p>
              ) : null}
            </div>

            {/* Remarks Field */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Remarks / Logistics Notes</label>
              <textarea
                rows={3}
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                placeholder="Optional shipping line notes, vessel details, or port instructions..."
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>
        </section>

        {/* Card 2: Supporting Documents Upload */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-3">
          <CustomFileUpload
            label="Supporting Documents *"
            required
            multiple
            value={files}
            onChange={(val) => {
              setFiles(val);
              if (fieldErrors.files && val.length > 0) setFieldErrors({ ...fieldErrors, files: '' });
            }}
            helperText="Upload official BL scan and shipping line documents (PDF, PNG, JPG max 10MB)."
          />
          {fieldErrors.files && (
            <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" /> {fieldErrors.files}
            </p>
          )}
        </section>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            to={`/vendor/rfqs/${id}/bl-entries`}
            className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 transition shadow-2xs"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={saving || !summary}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#0d7676] hover:bg-[#0f766e] text-white text-xs font-black shadow-md transition active:scale-95 disabled:opacity-50"
          >
            {saving ? 'Submitting...' : 'Submit BL Entry'}
          </button>
        </div>
      </form>
    </div>
  );
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
      const fileNameTarget = invoiceFile?.s3Key || invoiceFile?.fileUrl || invoiceFile?.name || 'Invoice_Document.pdf';
      const fileUrlTarget = invoiceFile?.fileUrl || invoiceFile?.s3Key || invoiceFile?.name || 'Invoice_Document.pdf';
      const docTypeLabel = invoice.invoiceType === 'freight' ? 'Freight Invoice' : invoice.invoiceType === 'destination_charges' ? 'Destination Charges (Shipping Line)' : invoice.invoiceType === 'detention' ? 'Detention & Storage' : invoice.invoiceType === 'agency_fee' ? 'Agency Fee' : 'Logistics Document';

      const response = await apiFetch(`/api/p2p/vendor-rfqs/${id}/bl-entries/${blId}/invoices`, {
        method: 'POST',
        body: JSON.stringify({
          ...invoice,
          amount: Number(invoice.amount),
          fileName: fileNameTarget,
          fileUrl: fileUrlTarget,
          documents: [{ docType: docTypeLabel, fileName: fileNameTarget, fileUrl: fileUrlTarget, uploadedBy: 'Vendor' }]
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

  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceFilter, setInvoiceFilter] = useState('All');
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoicePageSize, setInvoicePageSize] = useState(5);

  const invoicesList = useMemo(() => entry?.invoices || [], [entry?.invoices]);

  const filteredInvoices = useMemo(() => {
    return invoicesList.filter((item) => {
      const q = invoiceSearch.toLowerCase().trim();
      const matchesSearch = !q 
        || String(item.logisticsPaymentId || '').toLowerCase().includes(q)
        || String(item.invoiceNumber || '').toLowerCase().includes(q)
        || String(item.category || '').toLowerCase().includes(q)
        || String(item.categoryLabel || '').toLowerCase().includes(q)
        || String(item.status || '').toLowerCase().includes(q);

      const itemStatus = String(item.status || '').toLowerCase();
      const matchesFilter = invoiceFilter === 'All'
        || (invoiceFilter === 'Pending' && (itemStatus.includes('pending') || itemStatus.includes('exim') || !itemStatus))
        || (invoiceFilter === 'Approved' && itemStatus.includes('approved'))
        || (invoiceFilter === 'Rejected' && itemStatus.includes('rejected'));

      return matchesSearch && matchesFilter;
    });
  }, [invoicesList, invoiceSearch, invoiceFilter]);

  const paginatedInvoices = useMemo(() => {
    return filteredInvoices.slice((invoicePage - 1) * invoicePageSize, invoicePage * invoicePageSize);
  }, [filteredInvoices, invoicePage, invoicePageSize]);

  if (error && !entry) return <ErrorBox>{error}</ErrorBox>;
  if (!entry) return <div className="p-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-[#0d7676]" /></div>;

  const activeIndex = ['custom_cleared', 'invoice_pending', 'payment_requested', 'payment_approved', 'payment_paid', 'closed'].includes(entry.status)
    ? 3
    : Math.max(0, steps.findIndex((s) => s.key === entry.status));

  return (
    <div className="mx-auto max-w-6xl space-y-3.5 pb-8 font-sans antialiased text-left">
      {/* Top Navigation */}
      <div>
        <Link
          to={`/vendor/rfqs/${id}/bl-entries`}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-teal-50/80 hover:bg-teal-100 text-[#0d7676] border border-teal-200/80 text-[11px] font-extrabold transition shadow-2xs"
        >
          <ArrowLeft className="h-3 w-3" /> Back to BL Entries
        </Link>
      </div>

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/80 flex items-center justify-center text-[#0d7676] shadow-2xs shrink-0">
            <Ship className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">{entry.blNumber}</h1>
              <span className="rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-[11px] font-black text-emerald-800 shadow-2xs">
                {statusLabel(entry.status)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 font-semibold mt-0.5">
              <span className="font-bold text-slate-700">{entry.rfqNumber || `RFQ-${id}`}</span>
              <span>·</span>
              <span className="font-bold text-slate-700">
                {entry.containerCount} {Number(entry.containerCount) === 1 ? 'Container' : 'Containers'}
              </span>
              {entry.asnNumber && (
                <>
                  <span>·</span>
                  <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-[10px] font-bold">
                    ASN: {entry.asnNumber}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Header Right Quick Info Pill */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200/80 text-slate-700 text-[11px] font-extrabold shadow-2xs">
            BL ID: <span className="font-mono text-slate-900 font-black">{entry.blId || blId}</span>
          </span>
        </div>
      </div>

      <ErrorBox>{error}</ErrorBox>

      {/* 1. BL ENTRY PROGRESS CARD */}
      <section className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-900">BL ENTRY PROGRESS</h2>
            <span className="text-[10px] font-mono font-bold text-slate-400">
              Stage {activeIndex + 1} of {steps.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
              <div
                className="h-full bg-gradient-to-r from-[#0d7676] to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${((activeIndex + 1) / steps.length) * 100}%` }}
              />
            </div>
            <span className="px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-[#0d7676] text-[10px] font-black">
              {Math.round(((activeIndex + 1) / steps.length) * 100)}% Complete
            </span>
          </div>
        </div>

        {/* 4-Stage Stepper Track */}
        <div className="overflow-x-auto scrollbar-thin">
          <div className="min-w-[540px] relative px-1 py-1">
            <div className="grid grid-cols-4 relative text-center">
              {steps.map((step, idx) => {
                const isDone = idx <= activeIndex;
                const isLineActive = idx < activeIndex;

                return (
                  <div key={step.key} className="relative flex flex-col items-center px-1">
                    {/* Connecting line segment */}
                    {idx < steps.length - 1 && (
                      <div className="absolute left-1/2 right-[-50%] top-4 h-1 bg-slate-100 -z-0">
                        <div
                          className={`h-full bg-gradient-to-r from-[#0d7676] to-emerald-500 transition-all duration-500 ${
                            isLineActive ? 'w-full' : 'w-0'
                          }`}
                        />
                      </div>
                    )}

                    {/* Node Circle */}
                    <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black transition-all duration-300 ${
                      isDone
                        ? 'bg-gradient-to-tr from-[#0d7676] to-emerald-500 text-white shadow-xs ring-2 ring-teal-100'
                        : 'bg-white border-2 border-slate-200 text-slate-400 shadow-2xs'
                    }`}>
                      {isDone ? <CheckCircle2 className="w-5 h-5 text-white" /> : idx + 1}
                    </div>

                    {/* Title & Subtitle */}
                    <p className={`mt-1.5 text-[11px] font-black tracking-tight ${isDone ? 'text-slate-900' : 'text-slate-400'}`}>
                      {step.title}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5 max-w-[130px] mx-auto">
                      {step.sub}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 2-COLUMN GRID: BL DETAILS & DOCUMENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
        {/* BL DETAILS CARD (lg:col-span-6) */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs flex flex-col justify-between space-y-2.5">
          <div className="space-y-2.5">
            <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">BL DETAILS</h2>

            <div className="grid grid-cols-2 gap-3 text-xs border-b border-slate-100 pb-2.5">
              <div>
                <span className="text-slate-400 font-bold block text-[10px]">Assigned To</span>
                <span className="font-extrabold text-slate-800 mt-0.5 block text-xs">{entry.assignedDate || '03 Aug 2026'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[10px]">Customs Cleared</span>
                <span className="font-extrabold text-slate-800 mt-0.5 block text-xs">{entry.customsClearedDate || '03 Aug 2026'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">Exim Notes</span>
                <div className="p-2 bg-sky-50/70 border border-sky-100 rounded-lg text-xs font-semibold text-sky-900">
                  {entry.eximNotes || 'No notes provided by EXIM team.'}
                </div>
              </div>

              <div>
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">Agent Notes</span>
                <div className="p-2 bg-emerald-50/70 border border-emerald-100 rounded-lg text-xs font-semibold text-emerald-900">
                  {entry.agentNotes || 'Customs clearance processed successfully.'}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* DOCUMENTS TABLE CARD (lg:col-span-6) */}
        <section className="lg:col-span-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-col justify-between">
          <div>
            <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between bg-white">
              <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
                Documents ({entry.documents?.length || 1})
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                  <tr>
                    <th className="px-3.5 py-2">TYPE</th>
                    <th className="px-3.5 py-2">UPLOADED BY</th>
                    <th className="px-3.5 py-2">FILENAME</th>
                    <th className="px-3.5 py-2">DATE</th>
                    <th className="px-3.5 py-2 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                  {(entry.documents && entry.documents.length > 0 ? entry.documents : [
                    { docType: 'Bill of Lading', uploadedBy: 'You', fileName: 'BL_Shipping_Document.pdf', date: '03 Aug 2026, 11:58 am' }
                  ]).map((doc, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition">
                      <td className="px-3.5 py-2 font-bold text-slate-900">{doc.docType}</td>
                      <td className="px-3.5 py-2 font-bold text-amber-600">{doc.uploadedBy || 'You'}</td>
                      <td className="px-3.5 py-2 font-mono text-slate-500 max-w-[130px] truncate">{doc.fileUrl || doc.fileName}</td>
                      <td className="px-3.5 py-2 text-slate-400 font-semibold text-[10px]">{doc.date || '03 Aug 2026, 11:58 am'}</td>
                      <td className="px-3.5 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            const fileName = doc.fileUrl || doc.fileName || 'Document.pdf';
                            showToast({ title: 'Downloading Document', description: `Initiating download for ${fileName}...`, type: 'info' });
                            downloadDocumentFile(fileName);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-[#0d7676] font-extrabold text-[11px] border border-teal-200 transition cursor-pointer"
                          title="Download document"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* FULL-WIDTH INVOICE REQUESTS TABLE CARD */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        {/* Header & Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/40 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">INVOICE REQUESTS</h2>
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">
                {invoicesList.length}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowInvoiceForm(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0d7676] hover:bg-[#0f766e] text-white text-xs font-black shadow-2xs transition active:scale-95 shrink-0 self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" /> Raise New Invoice
            </button>
          </div>

          {/* Search & Filter bar (rendered neatly if invoices present) */}
          {invoicesList.length > 0 && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={invoiceSearch}
                  onChange={(e) => { setInvoiceSearch(e.target.value); setInvoicePage(1); }}
                  placeholder="Filter by invoice #, payment ID, category..."
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs font-medium outline-none focus:border-[#0d7676] focus:ring-2 focus:ring-teal-100 transition"
                />
              </div>

              <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto">
                {['All', 'Pending', 'Approved', 'Rejected'].map((tab) => {
                  const isActive = invoiceFilter === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => { setInvoiceFilter(tab); setInvoicePage(1); }}
                      className={`h-9 px-3.5 rounded-xl text-xs font-bold transition flex items-center justify-center ${
                        isActive 
                          ? 'bg-slate-900 text-white shadow-2xs font-extrabold' 
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
              <tr>
                <th className="px-5 py-3">INVOICE / ID</th>
                <th className="px-5 py-3">CATEGORY</th>
                <th className="px-5 py-3">AMOUNT</th>
                <th className="px-5 py-3">STATUS</th>
                <th className="px-5 py-3">DETAILS / NOTES</th>
                <th className="px-5 py-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
              {paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-xs font-semibold text-slate-400 bg-slate-50/30">
                    No invoice requests matching current search or filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((item, idx) => {
                  const categoryName = item.categoryLabel || (
                    item.category === 'destination_charges' ? 'Destination Charges (Shipping Line)' :
                    item.category === 'freight' ? 'Freight Invoice' :
                    item.category === 'detention' ? 'Detention & Storage' :
                    item.category === 'agency_fee' ? 'Agency & Customs Fee' :
                    item.category || 'Destination Charges'
                  );
                  const isRejected = item.status?.toLowerCase() === 'rejected';
                  const isApproved = item.status?.toLowerCase() === 'approved';

                  return (
                    <tr key={item.logisticsPaymentId || item.id || idx} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-3.5">
                        <span className="font-mono font-black text-slate-900 block text-xs">
                          {item.logisticsPaymentId || item.invoiceNumber}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          Invoice #{item.invoiceNumber} · {item.submittedDate || new Date(item.createdAt || Date.now()).toLocaleDateString('en-IN')}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-900 text-[11px] font-bold">
                          {categoryName}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {(() => {
                          const formatted = formatCurrencyINR(item.amount, item.currency);
                          return (
                            <div>
                              <span className="font-mono font-black text-sm text-slate-900 block">{formatted.primary}</span>
                              {formatted.isConverted && (
                                <span className="text-[10px] text-teal-700 font-bold block">{formatted.secondary}</span>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${
                          isRejected ? 'bg-rose-50 border border-rose-200 text-rose-700' :
                          isApproved ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' :
                          'bg-amber-50 border border-amber-200 text-amber-800'
                        }`}>
                          {item.status || 'Pending EXIM Manager Approval'}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-slate-600 max-w-[280px]">
                        {item.rejectionReason ? (
                          <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] font-semibold text-rose-700 flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                            <span>{item.rejectionReason}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-medium truncate block">
                            {item.description || 'Logistics invoice submitted.'}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => downloadDocumentFile(item.fileUrl || item.fileName || item.invoiceNumber, categoryName)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-[#0d7676] font-extrabold text-[11px] border border-teal-200 transition cursor-pointer shadow-2xs"
                          title="Download Invoice Document"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server Pagination Footer */}
        <div className="p-3 bg-slate-50/50 border-t border-slate-100">
          <ServerPagination
            page={invoicePage}
            totalPages={Math.ceil(filteredInvoices.length / invoicePageSize) || 1}
            total={filteredInvoices.length}
            pageSize={invoicePageSize}
            itemLabel="invoice requests"
            onPageChange={(p) => setInvoicePage(p)}
            onPageSizeChange={(s) => { setInvoicePageSize(s); setInvoicePage(1); }}
          />
        </div>
      </section>

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
