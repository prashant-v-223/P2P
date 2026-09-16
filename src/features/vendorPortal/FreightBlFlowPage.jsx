import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, FileText, Loader2, Plus, Ship, Search, Filter, FileCheck, Download, RefreshCw, UserRound, CalendarClock, BadgeCheck, MessageSquareText, Files, ReceiptText, LockKeyhole } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import { CustomSelect } from '../../components/ui/custom-select';
import { CustomDatePicker } from '../../components/ui/custom-date-picker';
import { CustomFileUpload } from '../../components/ui/custom-file-upload';
import { ServerPagination } from '../../components/ui/server-pagination';
import { downloadDocumentFile } from '../../utils/downloadHelper';
import { formatCurrencyINR } from '../../utils/currencyHelper';

const inputClass = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium outline-none focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100';
const statusLabel = (value) => ({ submitted: 'Submitted', exim_review: 'EXIM Review', assigned_to_agent: 'With Customs Agent', material_received: 'Material Received', custom_cleared: 'Customs Cleared', invoice_pending: 'Invoice Pending', payment_requested: 'Payment Requested', payment_approved: 'Payment Approved', payment_paid: 'Payment Paid', closed: 'Closed' }[value] || String(value || '').replaceAll('_', ' '));
const clearedBlStatuses = ['custom_cleared', 'invoice_pending', 'payment_requested', 'payment_approved', 'payment_paid', 'closed'];
const formatDateTime = (value) => value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not yet';
const blStatusTone = (value) => ({
  submitted: 'bg-sky-50 border-sky-200 text-sky-700',
  exim_review: 'bg-amber-50 border-amber-200 text-amber-800',
  assigned_to_agent: 'bg-violet-50 border-violet-200 text-violet-700',
  material_received: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  custom_cleared: 'bg-emerald-50 border-emerald-200 text-emerald-800'
}[value] || 'bg-slate-50 border-slate-200 text-slate-700');

function ErrorBox({ children }) { return children ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700"><AlertCircle className="mr-2 inline h-4 w-4" />{children}</div> : null; }

function PageLoader({ label }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-2xs" role="status" aria-live="polite">
      <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-[#0d7676]" />
      <p className="text-sm font-bold text-slate-700">{label}</p>
      <p className="mt-1 text-xs text-slate-400">Please wait while we retrieve the latest shipment data.</p>
    </div>
  );
}

export function FreightBlEntriesPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);

  const loadEntries = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(`/api/p2p/vendor-rfqs/${id}/bl-entries`);
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Unable to load BL entries.');
      setData(json.data);
    } catch (e) {
      setError(e.message || 'Unable to load BL entries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEntries(); }, [id]);

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

  if (loading && !data) return <PageLoader label="Loading BL entries" />;
  if (error && !data) return (
    <div className="space-y-3">
      <ErrorBox>{error}</ErrorBox>
      <button type="button" onClick={loadEntries} className="inline-flex items-center gap-2 rounded-xl bg-[#0d7676] px-4 py-2 text-xs font-black text-white">
        <RefreshCw className="h-3.5 w-3.5" /> Try again
      </button>
    </div>
  );

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

          {data.remainingContainers > 0 ? (
            <Link
              to={`/vendor/rfqs/${id}/bl-entries/create`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0d7676] hover:bg-[#0f766e] px-4 py-2 text-xs font-black text-white shadow-2xs transition active:scale-95 shrink-0"
            >
              <Plus className="h-4 w-4" /> New BL Entry
            </Link>
          ) : (
            <div className="relative group shrink-0">
              <button
                disabled
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-200 text-slate-400 px-4 py-2 text-xs font-black cursor-not-allowed opacity-75 shadow-2xs"
              >
                <Plus className="h-4 w-4" /> New BL Entry
              </button>
              <div className="absolute right-0 bottom-full mb-2 hidden group-hover:flex flex-col items-center w-56 z-50 pointer-events-none">
                <div className="bg-slate-900 text-white text-[11px] font-semibold rounded-lg py-1.5 px-3 shadow-lg text-center leading-snug">
                  All awarded containers ({data.allocation?.containers}) have been allocated to BL entries.
                </div>
                <div className="w-2.5 h-2.5 bg-slate-900 rotate-45 -mt-1"></div>
              </div>
            </div>
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
              placeholder="Search BL or ASN number..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs font-medium outline-none focus:border-[#0d7676] focus:ring-2 focus:ring-teal-100 transition"
            />
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
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
                  <td className="p-3.5 text-center font-semibold text-slate-600">{entry.documents?.length || 0} files</td>
                  <td className="p-3.5 text-center font-semibold text-slate-600">{entry.invoices?.length || 0}</td>
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
              {search || statusFilter !== 'All' ? 'No BL entries match your filters.' : 'No BL entries submitted yet.'}
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
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/p2p/vendor-rfqs/${id}/bl-entries`)
      .then((r) => r.json())
      .then((j) => (j.success ? setSummary(j.data) : setError(j.error)))
      .catch((e) => setError(e.message))
      .finally(() => setSummaryLoading(false));
  }, [id]);

  const [fieldErrors, setFieldErrors] = useState({});
  const [asnValidating, setAsnValidating] = useState(false);
  const [asnValidatedSuccess, setAsnValidatedSuccess] = useState(false);
  const [asnValidationMessage, setAsnValidationMessage] = useState('');
  const requiresAsn = false;

  const handleAsnBlur = () => {
    const cleanAsn = form.asnNumber.trim().toUpperCase();
    if (cleanAsn) {
      setForm((prev) => ({ ...prev, asnNumber: cleanAsn }));
      setFieldErrors((prev) => ({ ...prev, asnNumber: '' }));
      setAsnValidatedSuccess(true);
      setAsnValidationMessage('ASN Number accepted.');
    } else {
      setFieldErrors((prev) => ({ ...prev, asnNumber: '' }));
      setAsnValidatedSuccess(false);
      setAsnValidationMessage('');
    }
  };

  if (summaryLoading) return <PageLoader label="Loading shipment allocation" />;

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

    if (cleanAsn && cleanAsn.length > 30) {
      errors.asnNumber = 'ASN Number cannot exceed 30 characters.';
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
          documents: files.map((file) => ({
            docType: 'Bill of Lading',
            fileName: file.name || file.fileName || 'BL_Document.pdf',
            fileUrl: file.fileUrl || file.s3Key || file.name,
            originalFilename: file.name || file.originalName
          }))
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

            {/* ASN Number Field - import BL only (Optional) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ASN Number (Advance Shipping Notice) <span className="text-slate-400 font-normal text-[11px]">(Optional)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={form.asnNumber}
                  onChange={(e) => {
                    setForm({ ...form, asnNumber: e.target.value });
                    setAsnValidatedSuccess(false);
                    setAsnValidationMessage('');
                    if (fieldErrors.asnNumber) setFieldErrors({ ...fieldErrors, asnNumber: '' });
                  }}
                  onBlur={handleAsnBlur}
                  placeholder="Enter ASN Number (e.g. ASN-20260805-5678)"
                  className={`${inputClass} font-mono font-bold uppercase pr-24 ${
                    fieldErrors.asnNumber ? 'border-rose-400 bg-rose-50/30 focus:border-rose-500 focus:ring-rose-100' : 
                    asnValidatedSuccess ? 'border-emerald-400 bg-emerald-50/20 focus:border-emerald-500' : ''
                  }`}
                />
                {asnValidating && (
                  <div className="absolute right-3 top-2.5 flex items-center gap-1 text-[11px] font-bold text-teal-600">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking...
                  </div>
                )}
                {asnValidatedSuccess && !asnValidating && (
                  <div className="absolute right-3 top-2.5 flex items-center gap-1 text-[11px] font-extrabold text-emerald-600">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Valid
                  </div>
                )}
              </div>
              {fieldErrors.asnNumber && (
                <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" /> {fieldErrors.asnNumber}
                </p>
              )}
              {asnValidatedSuccess && asnValidationMessage && (
                <p className="mt-1 flex items-start gap-1 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" /> {asnValidationMessage}
                </p>
              )}
            </div>

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
  const [downloadingDocument, setDownloadingDocument] = useState('');
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

  const loadEntry = async () => {
    setError('');
    setEntry(null);
    try {
      const response = await apiFetch(`/api/p2p/vendor-rfqs/${id}/bl-entries/${blId}`);
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Unable to load this BL entry.');
      setEntry(json.data);
    } catch (e) { setError(e.message || 'Unable to load this BL entry.'); }
  };

  useEffect(() => { loadEntry(); }, [id, blId]);

  useEffect(() => {
    if (!showInvoiceForm) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !saving) setShowInvoiceForm(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [showInvoiceForm, saving]);

  const steps = useMemo(() => [
    { key: 'submitted', title: 'Submitted', sub: 'BL entry created' },
    { key: 'exim_review', title: 'Exim Review', sub: 'Under Exim team review' },
    { key: 'assigned_to_agent', title: 'With Agent', sub: 'Customs agent assigned' },
    { key: 'material_received', title: 'Material Received', sub: 'Shipment receipt confirmed' },
    { key: 'custom_cleared', title: 'Customs Cleared', sub: 'Ready for invoicing' }
  ], []);

  const submitInvoice = async (event) => {
    event.preventDefault();
    setError('');
    if (!invoice.invoiceType) return setError('Select an invoice type.');
    if (!invoice.invoiceNumber.trim() || !(Number(invoice.amount) > 0)) {
      return setError('Enter a valid invoice number and positive amount.');
    }
    if (!invoiceFile) {
      return setError('Attach supporting logistics invoice document.');
    }
    
    setSaving(true);
    try {
      // Handle both single file object and array of files
      const fileObj = Array.isArray(invoiceFile) ? invoiceFile[0] : invoiceFile;
      
      console.log('[Invoice Submit] fileObj:', fileObj);
      
      if (!fileObj) {
        throw new Error('No file selected. Please upload a file first.');
      }
      
      // Extract file URL and name from the file object
      const fileUrlTarget = fileObj.fileUrl || fileObj.s3Key || fileObj.fileName || fileObj.name;
      const fileNameTarget = fileObj.name || fileObj.fileName || fileObj.originalName || 'Invoice_Document.pdf';
      
      console.log('[Invoice Submit] Extracted:', { fileUrlTarget, fileNameTarget });
      
      if (!fileUrlTarget) {
        console.error('[Invoice Submit] File object missing URL:', fileObj);
        throw new Error('File was not uploaded to storage. Please wait for upload to complete (look for "Attached" badge) and try again.');
      }
      
      const docTypeLabel = invoice.invoiceType === 'freight' ? 'Freight Invoice' : invoice.invoiceType === 'destination_charges' ? 'Destination Charges (Shipping Line)' : invoice.invoiceType === 'detention' ? 'Detention & Storage' : invoice.invoiceType === 'agency_fee' ? 'Agency Fee' : 'Logistics Document';

      const response = await apiFetch(`/api/p2p/vendor-rfqs/${id}/bl-entries/${blId}/invoices`, {
        method: 'POST',
        body: JSON.stringify({
          ...invoice,
          amount: Number(invoice.amount),
          fileName: fileNameTarget,
          fileUrl: fileUrlTarget,
          documents: [{ 
            docType: docTypeLabel, 
            fileName: fileNameTarget, 
            fileUrl: fileUrlTarget,
            filePath: fileUrlTarget,
            originalFilename: fileNameTarget,
            uploadedBy: 'Vendor' 
          }]
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
      console.error('[Invoice Submit] Error:', e);
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

  if (error && !entry) return <div className="space-y-3"><ErrorBox>{error}</ErrorBox><button type="button" onClick={loadEntry} className="inline-flex items-center gap-2 rounded-xl bg-[#0d7676] px-4 py-2 text-xs font-black text-white"><RefreshCw className="h-3.5 w-3.5" />Try again</button></div>;
  if (!entry) return <PageLoader label="Loading BL details" />;

  const activeIndex = clearedBlStatuses.includes(entry.status)
    ? steps.length - 1
    : Math.max(0, steps.findIndex((s) => s.key === entry.status));

  const canInvoice = Boolean(entry.canInvoice ?? clearedBlStatuses.includes(entry.status));

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
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{entry.blNumber}</h1>
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black shadow-2xs ${blStatusTone(entry.status)}`}>
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
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">BL Entry Progress</h2>
            <span className="text-[11px] font-mono font-bold text-slate-400">
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
            <div className="grid grid-cols-5 relative text-center">
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
            <h2 className="flex items-center gap-2 text-xs font-black uppercase text-slate-900 tracking-wider"><FileText className="h-4 w-4 text-[#0d7676]" />BL Details</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs border-b border-slate-100 pb-3">
              <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                <div><span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wide">Customs Agent</span>
                <span className="font-extrabold text-slate-800 mt-0.5 block text-xs">{entry.customAgentName || entry.customAgentAgencyName || 'Not assigned'}</span></div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div><span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wide">Customs Cleared</span>
                <span className="font-extrabold text-slate-800 mt-0.5 block text-xs">{formatDateTime(entry.customsClearedAt || entry.customsClearedDate)}</span></div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                <div><span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wide">Submitted</span>
                <span className="font-extrabold text-slate-800 mt-0.5 block text-xs">{formatDateTime(entry.createdAt)}</span></div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div><span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wide">Assigned On</span>
                <span className="font-extrabold text-slate-800 mt-0.5 block text-xs">{formatDateTime(entry.assignedAt || entry.assignedDate)}</span></div>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <span className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1"><MessageSquareText className="h-3.5 w-3.5 text-sky-600" />EXIM Notes</span>
                <div className="p-2 bg-sky-50/70 border border-sky-100 rounded-lg text-xs font-semibold text-sky-900">
                  {entry.eximNotes || 'No notes provided by EXIM team.'}
                </div>
              </div>

              <div>
                <span className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1"><MessageSquareText className="h-3.5 w-3.5 text-violet-600" />Agent Notes</span>
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600">
                  {entry.agentNotes || 'No notes provided by the customs agent.'}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* DOCUMENTS CARD */}
        <section className="lg:col-span-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-[#0d7676]"><Files className="h-4 w-4" /></span>
                Documents
                <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] text-slate-600">{entry.documents?.length || 0}</span>
              </h2>
              <p className="ml-9 mt-0.5 text-[10px] font-medium text-slate-400">Shipment and customs-clearance files</p>
            </div>
          </div>

          {(entry.documents || []).length > 0 ? (
            <div className="divide-y divide-slate-100">
              {(entry.documents || []).map((doc, idx) => {
                const documentKey = doc._id || `${doc.fileUrl || doc.fileName}-${idx}`;
                const downloadTarget = doc.fileUrl || doc.filePath || doc.fileName;
                const displayName = doc.originalFilename || doc.fileName || String(doc.fileUrl || '').split('/').pop() || 'Document';
                const isDownloading = downloadingDocument === documentKey;
                return (
                  <article key={documentKey} className="group grid gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50/70 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_auto] sm:items-center">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-teal-100 bg-teal-50 text-[#0d7676]">
                        <FileCheck className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-extrabold text-slate-900" title={doc.docType || 'Supporting document'}>{doc.docType || 'Supporting document'}</p>
                        <p className="mt-1 truncate font-mono text-[10px] font-medium text-slate-500" title={displayName}>{displayName}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-l-0 text-[10px] sm:grid-cols-1 sm:border-l sm:border-slate-100 sm:pl-4">
                      <div className="min-w-0">
                        <span className="block font-bold uppercase tracking-wide text-slate-400">Uploaded by</span>
                        <span className="mt-0.5 block truncate text-[11px] font-bold text-slate-700" title={doc.uploadedBy || 'Vendor'}>{doc.uploadedBy || 'Vendor'}</span>
                      </div>
                      <div>
                        <span className="block font-bold uppercase tracking-wide text-slate-400">Uploaded on</span>
                        <span className="mt-0.5 block text-[11px] font-semibold text-slate-600">{formatDateTime(doc.uploadedAt || doc.date)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!downloadTarget || isDownloading}
                      onClick={async () => {
                        setDownloadingDocument(documentKey);
                        try {
                          await downloadDocumentFile(downloadTarget, displayName);
                        } finally {
                          setDownloadingDocument('');
                        }
                      }}
                      className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-teal-200 bg-white px-3 text-[11px] font-extrabold text-[#0d7676] shadow-2xs transition hover:border-teal-300 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Download ${displayName}`}
                    >
                      {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      {isDownloading ? 'Downloading' : 'Download'}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Files className="h-5 w-5" /></span>
              <p className="mt-3 text-xs font-bold text-slate-700">No documents attached</p>
              <p className="mt-1 max-w-xs text-[11px] text-slate-400">Documents uploaded for this BL entry will appear here.</p>
            </div>
          )}
        </section>
      </div>

      {/* FULL-WIDTH INVOICE REQUESTS TABLE CARD */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        {/* Header & Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/40 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900"><ReceiptText className="h-4 w-4 text-[#0d7676]" />Invoice Requests</h2>
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">
                {invoicesList.length}
              </span>
            </div>

            <div className="relative group shrink-0 self-start sm:self-auto">
              <button
                type="button"
                disabled={!canInvoice}
                onClick={() => { setError(''); setShowInvoiceForm(true); }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black shadow-2xs transition active:scale-95 ${
                  canInvoice
                    ? 'bg-[#0d7676] hover:bg-[#0f766e] text-white cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-75'
                }`}
              >
                <Plus className="w-3.5 h-3.5" /> Raise New Invoice
              </button>
              {!canInvoice && (
                <div className="absolute right-0 bottom-full mb-2 hidden group-hover:flex flex-col items-center w-64 z-50 pointer-events-none">
                  <div className="bg-slate-900 text-white text-[11px] font-semibold rounded-lg py-1.5 px-3 shadow-lg text-center leading-snug">
                    Logistics invoice can only be raised after customs clearance is completed by the Customs Agent.
                  </div>
                  <div className="w-2.5 h-2.5 bg-slate-900 rotate-45 -mt-1"></div>
                </div>
              )}
            </div>
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
                  <td colSpan={6} className="px-5 py-10 text-center bg-slate-50/30">
                    <div className="mx-auto flex max-w-md flex-col items-center gap-2">
                      {canInvoice ? <ReceiptText className="h-7 w-7 text-slate-300" /> : <LockKeyhole className="h-7 w-7 text-amber-400" />}
                      <p className="text-xs font-bold text-slate-600">{invoiceSearch || invoiceFilter !== 'All' ? 'No invoice requests match the current search or filter.' : canInvoice ? 'No invoice requests yet' : 'Invoice creation is locked'}</p>
                      <p className="text-[11px] font-medium text-slate-400">{invoiceSearch || invoiceFilter !== 'All' ? 'Change or clear the filters to see other requests.' : canInvoice ? 'Use “Raise New Invoice” to create the first request.' : 'Invoicing becomes available after customs clearance.'}</p>
                    </div>
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
                          onClick={() => downloadDocumentFile(item.documents?.[0]?.fileUrl || item.fileUrl || item.invoiceFile || item.fileName || item.invoiceNumber, categoryName)}
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
        {invoicesList.length > 0 && <div className="p-3 bg-slate-50/50 border-t border-slate-100">
          <ServerPagination
            page={invoicePage}
            totalPages={Math.ceil(filteredInvoices.length / invoicePageSize) || 1}
            total={filteredInvoices.length}
            pageSize={invoicePageSize}
            itemLabel="invoice requests"
            onPageChange={(p) => setInvoicePage(p)}
            onPageSizeChange={(s) => { setInvoicePageSize(s); setInvoicePage(1); }}
          />
        </div>}
      </section>

      {/* NEW INVOICE REQUEST MODAL OVERLAY */}
      {showInvoiceForm && (
        <div
          className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center bg-slate-900/40 p-3 backdrop-blur-xs sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setShowInvoiceForm(false);
          }}
          role="presentation"
        >
          <div className="relative w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-left font-sans shadow-2xl sm:max-h-[calc(100dvh-2rem)]" role="dialog" aria-modal="true" aria-labelledby="new-invoice-title">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-teal-200 bg-teal-50 text-[#0d7676]">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <h2 id="new-invoice-title" className="text-sm font-black text-slate-900">New Invoice Request</h2>
                  <p className="text-xs text-slate-500 font-medium">{entry.blNumber} · {entry.rfqNumber || `RFQ-${id}`}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInvoiceForm(false)}
                disabled={saving}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:opacity-40"
                aria-label="Close invoice request"
              >
                ✕
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={submitInvoice} className="mt-4 space-y-4">
              <ErrorBox>{error}</ErrorBox>
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
                  max={new Date().toISOString().split('T')[0]}
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
                    min="0.01"
                    step="0.01"
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
              <div className="sticky -bottom-5 -mx-5 flex items-center justify-end gap-2 border-t border-slate-100 bg-white px-5 pb-0 pt-3.5">
                <button
                  type="button"
                  onClick={() => setShowInvoiceForm(false)}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-w-40 items-center justify-center gap-2 rounded-lg bg-[#0d7676] px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#0f6f6f] focus:outline-none focus:ring-2 focus:ring-teal-300 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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
