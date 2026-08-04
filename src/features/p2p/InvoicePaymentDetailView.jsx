import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeft,
  Edit3,
  Send,
  Trash2,
  FileCheck2,
  Download,
  AlertTriangle,
  Clock,
  CheckCircle2,
  DollarSign,
  Loader2,
  Lock,
  Building2
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import DocumentUploader from '../../components/shared/DocumentUploader';

const formatCurrency = (val) => {
  if (val === undefined || val === null) return '₹0.00';
  const num = Number(val) || 0;
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (val) => {
  if (!val) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(val));
  } catch (_) {
    return String(val);
  }
};

export default function InvoicePaymentDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/p2p/invoices/${id}`);
      const data = await res.json();
      if (res.ok && data.data) {
        setInvoice(data.data);
      } else {
        showToast({ title: 'Not Found', description: data.error || 'Invoice not found.', type: 'error' });
      }
    } catch (e) {
      console.error('Fetch invoice error:', e);
      showToast({ title: 'Error', description: 'Could not connect to server.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const handleSubmitForApproval = async () => {
    try {
      setActionLoading(true);
      const res = await apiFetch(`/api/p2p/invoices/${invoice?.invoicePaymentId || id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending' })
      });
      if (res.ok) {
        showToast({ title: 'Submitted for Approval', description: 'Invoice has been moved to approval queue.', type: 'success' });
        await fetchInvoice();
      } else {
        const err = await res.json();
        showToast({ title: 'Submission Failed', description: err.error || 'Could not submit invoice.', type: 'error' });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete draft invoice "${invoice?.invoicePaymentId || id}"?`)) return;
    try {
      setActionLoading(true);
      const res = await apiFetch(`/api/p2p/invoices/${invoice?.invoicePaymentId || id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast({ title: 'Deleted', description: 'Invoice payment deleted successfully.', type: 'info' });
        navigate('/admin/invoice-payments');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-slate-500 font-medium text-sm">
        <Loader2 className="w-5 h-5 animate-spin text-[#0d7676]" /> Loading invoice payment details...
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs max-w-lg mx-auto my-12 space-y-3">
        <FileCheck2 className="w-10 h-10 text-slate-300 mx-auto" />
        <h3 className="text-base font-bold text-slate-900">Invoice Record Not Found</h3>
        <p className="text-xs text-slate-500">The invoice record with ID "{id}" could not be located.</p>
        <Link to="/admin/invoice-payments" className="inline-block px-4 py-2 bg-[#0d7676] text-white rounded-lg text-xs font-bold">
          Back to Invoice Payments
        </Link>
      </div>
    );
  }

  const isDraft = invoice.status === 'draft';
  const isPending = invoice.status === 'pending';
  const isApproved = invoice.status === 'approved';
  const isPaid = invoice.status === 'paid';
  const isMatched = invoice.threeWayMatch?.status === 'matched';

  const statusPills = {
    draft:    'bg-amber-50 text-amber-700 border-amber-200',
    pending:  'bg-[#0284c7]/10 text-[#0284c7] border-[#0284c7]/20',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200',
    returned: 'bg-orange-50 text-orange-700 border-orange-200',
    paid:     'bg-sky-50 text-sky-700 border-sky-200'
  };

  return (
    <div className="w-full space-y-4 font-sans text-slate-800 pb-12 text-left">
      {/* ─── BREADCRUMB & HEADER BAR ──────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <Link to="/admin/invoice-payments" className="hover:text-slate-600">Invoice Payments</Link>
            <span>/</span>
            <span className="text-slate-700 font-semibold">{invoice.invoicePaymentId}</span>
          </div>
          <div className="flex items-center gap-2.5 mt-1 flex-wrap">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight font-mono">{invoice.invoicePaymentId}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${statusPills[invoice.status] || statusPills.draft}`}>
              {invoice.status}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Invoice <span className="font-semibold text-slate-700">{invoice.invoiceNumber}</span> · {formatDate(invoice.invoiceDate)}
          </p>
        </div>

        {/* Top Right Action Buttons */}
        <div className="flex items-center gap-2">
          {isDraft && (
            <button
              onClick={() => navigate(`/admin/invoice-payments/${invoice.invoicePaymentId}/edit`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition-all"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit
            </button>
          )}

          {(isDraft || invoice.status === 'returned') && (
            <button
              onClick={handleSubmitForApproval}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-2xs transition-all disabled:opacity-50"
            >
              {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Submit for Approval
            </button>
          )}

          {isDraft && (
            <button
              onClick={handleDelete}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs transition-all disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
        </div>
      </div>

      {/* ─── WARNING BANNER (DRAFT) ─────────────────────────────────────── */}
      {isDraft && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/80 flex items-center gap-3 text-xs text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-bold text-amber-950">This payment request is a draft</p>
            <p className="text-amber-800 mt-0.5">
              Review all details below, attach vendor invoice if not done, then click <strong className="font-extrabold">Submit for Approval</strong> to start the approval workflow.
            </p>
          </div>
        </div>
      )}

      {/* ─── MAIN TWO COLUMN CONTENT ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT COLUMN (2/3 Width) */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Card 1: Invoice Details */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Invoice Details</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">PO Number</span>
                <span className="font-mono font-bold text-[#0284c7] block">{invoice.poId || invoice.sapPoNumber || '4100005154'}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Vendor</span>
                <span className="font-bold text-slate-900 block truncate">{invoice.vendorName || 'Borosil Renewables Limited'}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">ASN Number</span>
                <span className="font-mono text-slate-700 block">{invoice.asnNumber || '—'}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Invoice Number</span>
                <span className="font-mono font-bold text-slate-900 block">{invoice.invoiceNumber || '9000024000'}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Invoice Date</span>
                <span className="font-medium text-slate-700 block">{formatDate(invoice.invoiceDate || '2026-06-15')}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Due Date</span>
                <span className="font-medium text-slate-700 block">{formatDate(invoice.dueDate || '2026-07-31')}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">GRN Number</span>
                <span className="font-mono text-slate-700 block">{invoice.grnNumber || '—'}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Three-Way Match</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                  isMatched ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {isMatched ? 'Matched' : 'pending'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Payment Mode</span>
                <span className="font-semibold text-slate-800 block">NEFT</span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Approval To</span>
                <span className="font-semibold text-slate-700 block">{invoice.approvalTo || '—'}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Requested By</span>
                <span className="font-semibold text-slate-700 block">{invoice.createdBy || 'Finance Team'}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">UTR Number</span>
                <span className="font-mono font-bold text-slate-900 block">{invoice.utrNumber || '—'}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Amount Breakdown */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Amount Breakdown</h3>
            
            <div className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              <div className="py-2 flex items-center justify-between">
                <span>Invoice Amount</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(invoice.grossAmount || 2467980)}</span>
              </div>

              <div className="py-2 flex items-center justify-between">
                <span>CGST</span>
                <span className="font-mono text-slate-500">{formatCurrency(invoice.cgstAmount || 0)}</span>
              </div>

              <div className="py-2 flex items-center justify-between">
                <span>SGST</span>
                <span className="font-mono text-slate-500">{formatCurrency(invoice.sgstAmount || 0)}</span>
              </div>

              <div className="py-2 flex items-center justify-between">
                <span>IGST</span>
                <span className="font-mono text-slate-500">{formatCurrency(invoice.igstAmount || 0)}</span>
              </div>

              <div className="py-2 flex items-center justify-between">
                <span>TDS ({invoice.tdsPercentage || 0.00}%)</span>
                <span className="font-mono text-rose-600">- {formatCurrency(invoice.tdsAmount || 0)}</span>
              </div>

              <div className="py-2 flex items-center justify-between">
                <span>Advance Adjusted</span>
                <span className="font-mono text-amber-700">- {formatCurrency(invoice.advanceAdjusted || 0)}</span>
              </div>

              <div className="py-3 flex items-center justify-between text-sm bg-slate-50/70 px-3 rounded-xl mt-1">
                <span className="font-extrabold text-slate-900">Net Payable</span>
                <span className="font-mono font-extrabold text-teal-800 text-base">{formatCurrency(invoice.netPayable || 2467980)}</span>
              </div>
            </div>
          </div>

          {/* Card 3: Documents */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">Documents</h3>
            </div>

            <DocumentUploader
              documentableType="InvoicePayment"
              documentableId={invoice.invoicePaymentId}
              documentType="vendor_invoice"
              multiple={true}
            />
          </div>
        </div>

        {/* RIGHT COLUMN (1/3 Width) */}
        <div className="space-y-4">
          
          {/* Card 1: PAYMENT STATUS Stepper */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">PAYMENT STATUS</span>
            
            <div className="flex items-center justify-between text-xs font-bold pt-1">
              <span className={`px-3 py-1 rounded-md border ${isDraft ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                Draft
              </span>
              <span className={`px-3 py-1 rounded-md border ${isPending ? 'bg-[#0284c7] text-white border-[#0284c7]' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                Pending
              </span>
              <span className={`px-3 py-1 rounded-md border ${isApproved ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                Approved
              </span>
              <span className={`px-3 py-1 rounded-md border ${isPaid ? 'bg-sky-600 text-white border-sky-600' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                Paid
              </span>
            </div>
          </div>

          {/* Card 2: Net Payable Highlight Box */}
          <div className="bg-[#0f4c4c] text-white p-5 rounded-2xl shadow-sm space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-200 block">Net Payable</span>
            <p className="font-mono text-2xl font-extrabold text-white tracking-tight">{formatCurrency(invoice.netPayable || 2467980)}</p>
            <span className="text-[11px] font-bold text-teal-200 block pt-1">NEFT</span>
          </div>

          {/* Card 3: Summary Key/Value Table */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-400 font-medium">Invoice No</span>
              <span className="font-mono font-bold text-slate-900">{invoice.invoiceNumber || '9000024000'}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-400 font-medium">ASN No</span>
              <span className="font-mono text-slate-700">{invoice.asnNumber || '—'}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-400 font-medium">Invoice Date</span>
              <span className="font-medium text-slate-800">{formatDate(invoice.invoiceDate || '2026-06-16')}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-400 font-medium">Vendor Code</span>
              <span className="font-mono font-bold text-slate-900">{invoice.vendorId || '10000088'}</span>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400 font-medium">Created</span>
              <span className="font-medium text-slate-800">{formatDate(invoice.createdAt || '2026-07-20')}</span>
            </div>

            <div className="pt-2 border-t border-slate-100 text-center">
              <Link to="/admin/invoice-payments" className="text-xs font-bold text-[#0d7676] hover:underline">
                ← All Payments
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
