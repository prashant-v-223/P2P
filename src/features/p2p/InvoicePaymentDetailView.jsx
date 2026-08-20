import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Edit3,
  Send,
  Trash2,
  FileCheck2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  DollarSign,
  Loader2,
  XCircle,
  RotateCcw
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import DocumentUploader from '../../components/shared/DocumentUploader';
import RecordDbInfoDrawer from '../../components/common/RecordDbInfoDrawer';
import UniversalApprovalWorkflowCard from '../../components/common/UniversalApprovalWorkflowCard';

const formatCurrency = (val, currency = 'INR') => {
  if (val === undefined || val === null) return `${currency === 'USD' ? '$' : '₹'}0.00`;
  const num = Number(val) || 0;
  const curr = String(currency || 'INR').toUpperCase();
  if (curr === 'USD') return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (curr === 'EUR') return `€${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (curr === 'GBP') return `£${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

const formatDateTime = (val) => {
  if (!val) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(val));
  } catch (_) {
    return String(val);
  }
};

export default function InvoicePaymentDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [invoice, setInvoice] = useState(null);
  const [approval, setApproval] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/p2p/invoices/${id}`);
      const data = await res.json();
      if (res.ok && data.data) {
        setInvoice(data.data);
        // Fetch approval data if invoice is not draft
        if (data.data.status !== 'draft') {
          fetchApprovalData(data.data.invoicePaymentId || id);
        }
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

  const fetchApprovalData = async (invoiceId) => {
    try {
      const res = await apiFetch(`/api/approvals/${invoiceId}/history`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setApproval({
            status: data.status,
            currentStep: data.currentStep,
            actionHistory: data.history || []
          });
        }
      }
    } catch (e) {
      console.error('Fetch approval error:', e);
      // Silently fail - approval data is optional
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
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-2">
            <Link to="/admin/invoice-payments" className="hover:text-slate-600 transition-colors">Invoice Payments</Link>
            <span>/</span>
            <span className="text-slate-700 font-semibold">{invoice.invoicePaymentId}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{invoice.invoicePaymentId}</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border ${statusPills[invoice.status] || statusPills.draft}`}>
              {invoice.status}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1.5 font-medium">
            Invoice <span className="font-bold text-slate-700">{invoice.invoiceNumber}</span> · {formatDate(invoice.invoiceDate)}
          </p>
        </div>

        {/* Top Right Action Buttons */}
        <div className="flex items-center gap-2.5">
          <RecordDbInfoDrawer entityId={invoice?.invoicePaymentId || id} entityType="InvoicePayment" recordData={invoice || approval} />
          {isDraft && (
            <button
              onClick={() => navigate(`/admin/invoice-payments/${invoice.invoicePaymentId}/edit`)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm shadow-sm transition-all hover:shadow"
            >
              <Edit3 className="w-4 h-4" /> Edit
            </button>
          )}

          {(isDraft || invoice.status === 'returned') && (
            <button
              onClick={handleSubmitForApproval}
              disabled={actionLoading}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-extrabold text-sm shadow-md transition-all disabled:opacity-50 hover:shadow-lg"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit for Approval
            </button>
          )}

          {isDraft && (
            <button
              onClick={handleDelete}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-sm transition-all disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
        </div>
      </div>



      {/* ─── STATUS BANNERS ─────────────────────────────────────────────── */}
      {isDraft && (
        <div className="p-5 rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-amber-100/50 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-700" />
          </div>
          <div className="flex-1">
            <p className="font-extrabold text-amber-950 text-sm mb-1">This payment request is a draft</p>
            <p className="text-sm text-amber-900 leading-relaxed">
              Review all details below, attach vendor invoice if not done, then click <strong className="font-extrabold">Submit for Approval</strong> to start the approval workflow.
            </p>
          </div>
        </div>
      )}

      {invoice.status === 'returned' && (
        <div className="p-5 rounded-2xl border-2 border-orange-300 bg-gradient-to-r from-orange-50 to-orange-100/50 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-orange-200 flex items-center justify-center shrink-0">
            <RotateCcw className="w-5 h-5 text-orange-700" />
          </div>
          <div className="flex-1">
            <p className="font-extrabold text-orange-950 text-sm mb-1">Returned for Changes</p>
            <p className="text-sm text-orange-900 leading-relaxed">
              This invoice payment was returned by approver. Please review the feedback, make necessary changes, and resubmit.
            </p>
          </div>
        </div>
      )}

      {invoice.status === 'rejected' && (
        <div className="p-5 rounded-2xl border-2 border-rose-300 bg-gradient-to-r from-rose-50 to-rose-100/50 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-rose-200 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5 text-rose-700" />
          </div>
          <div className="flex-1">
            <p className="font-extrabold text-rose-950 text-sm mb-1">Request Rejected</p>
            <p className="text-sm text-rose-900 leading-relaxed">
              This invoice payment request has been rejected and cannot be processed further.
            </p>
          </div>
        </div>
      )}

      {/* ─── MAIN TWO COLUMN CONTENT ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT COLUMN (2/3 Width) */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Card 1: Invoice Details */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-slate-600" />
              Invoice Details
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">PO Number</span>
                <span className="font-mono font-bold text-[#0284c7] block text-base">{invoice.poId || invoice.sapPoNumber || '4100005154'}</span>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Vendor</span>
                <span className="font-bold text-slate-900 block truncate">{invoice.vendorName || 'Borosil Renewables Limited'}</span>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">ASN Number</span>
                <span className="font-mono text-slate-700 block">{invoice.asnNumber || '—'}</span>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">BL Number</span>
                <span className="font-mono font-bold text-slate-900 block">{invoice.blNumber || '—'}</span>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">BL Date</span>
                <span className="font-semibold text-slate-700 block">{invoice.blDate ? formatDate(invoice.blDate) : '—'}</span>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">BOE Number</span>
                <span className="font-mono font-bold text-slate-900 block">{invoice.boeNumber || '—'}</span>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">BOE Date</span>
                <span className="font-semibold text-slate-700 block">{invoice.boeDate ? formatDate(invoice.boeDate) : '—'}</span>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Invoice Number</span>
                <span className="font-mono font-bold text-slate-900 block text-base">{invoice.invoiceNumber || '9000024000'}</span>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Invoice Date</span>
                <span className="font-semibold text-slate-700 block">{formatDate(invoice.invoiceDate || '2026-06-15')}</span>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Due Date</span>
                <span className="font-semibold text-slate-700 block">{formatDate(invoice.dueDate || '2026-07-31')}</span>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">GRN Number</span>
                <span className="font-mono text-slate-700 block">{invoice.grnNumber || '—'}</span>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Three-Way Match</span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${
                  isMatched ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {isMatched ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  {isMatched ? 'Matched' : 'Pending'}
                </span>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Payment Mode</span>
                <span className="font-semibold text-slate-800 block">NEFT</span>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Approval To</span>
                <span className="font-semibold text-slate-700 block">{invoice.approvalTo || '—'}</span>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Requested By</span>
                <span className="font-semibold text-slate-700 block">{invoice.createdBy || 'Finance Team'}</span>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">UTR Number</span>
                <span className="font-mono font-bold text-slate-900 block">{invoice.utrNumber || '—'}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Amount Breakdown */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-slate-600" />
              Amount Breakdown
            </h3>
            
            <div className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
              <div className="py-3 flex items-center justify-between">
                <span className="text-slate-600">Invoice Amount</span>
                <span className="font-mono font-bold text-slate-900 text-base">{formatCurrency(invoice.grossAmount || 0, invoice.currency)}</span>
              </div>

              <div className="py-3 flex items-center justify-between">
                <span className="text-slate-600">CGST</span>
                <span className="font-mono text-slate-600">{formatCurrency(invoice.cgstAmount || 0, invoice.currency)}</span>
              </div>

              <div className="py-3 flex items-center justify-between">
                <span className="text-slate-600">SGST</span>
                <span className="font-mono text-slate-600">{formatCurrency(invoice.sgstAmount || 0, invoice.currency)}</span>
              </div>

              <div className="py-3 flex items-center justify-between">
                <span className="text-slate-600">IGST</span>
                <span className="font-mono text-slate-600">{formatCurrency(invoice.igstAmount || 0, invoice.currency)}</span>
              </div>

              <div className="py-3 flex items-center justify-between">
                <span className="text-slate-600">TDS ({invoice.tdsPercentage || 0.00}%)</span>
                <span className="font-mono text-rose-600 font-semibold">- {formatCurrency(invoice.tdsAmount || 0, invoice.currency)}</span>
              </div>

              <div className="py-3 flex items-center justify-between">
                <span className="text-slate-600">Advance Adjusted</span>
                <span className="font-mono text-amber-700 font-semibold">- {formatCurrency(invoice.advanceAdjusted || 0, invoice.currency)}</span>
              </div>

              <div className="py-4 flex items-center justify-between bg-gradient-to-r from-teal-50 to-teal-100/50 px-4 rounded-xl mt-2 border-2 border-teal-200">
                <div>
                  <span className="font-extrabold text-slate-900 text-base block">Net Payable</span>
                  {invoice.currency && invoice.currency !== 'INR' && (
                    <span className="text-[11px] font-semibold text-teal-700 block font-mono">
                      (INR Equiv: ₹{(invoice.amountINR || ((invoice.netPayable || 0) * (invoice.fxRate || 83.5))).toLocaleString('en-IN')})
                    </span>
                  )}
                </div>
                <span className="font-mono font-extrabold text-teal-800 text-xl">{formatCurrency(invoice.netPayable || 0, invoice.currency)}</span>
              </div>
            </div>
          </div>

          {/* Card 3: Documents */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-slate-600" />
                Documents
              </h3>
            </div>

            <DocumentUploader
              documentableType="InvoicePayment"
              documentableId={invoice.invoicePaymentId}
              documentType="vendor_invoice"
              existingDocuments={invoice.supportingDocuments || []}
              multiple={true}
              readOnly={true}
            />
          </div>
        </div>

        {/* RIGHT COLUMN (1/3 Width) */}
        <div className="space-y-5">

          {/* Universal Dynamic Approval Workflow Stepper Component */}
          <UniversalApprovalWorkflowCard
            referenceId={invoice.invoicePaymentId}
            recordType="Invoice Payment"
            vendorName={invoice.vendorName}
            amountFormatted={formatCurrency(invoice.netPayable || 0, invoice.currency)}
            poRef={invoice.sapPoNumber || invoice.poId}
            onStatusChange={fetchInvoice}
          />

          {/* Card 2: Net Payable Highlight Box */}
          <div className="bg-gradient-to-br from-[#0f4c4c] to-[#0d7676] text-white p-6 rounded-2xl shadow-lg space-y-2 border border-teal-900/20">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-200 block">Net Payable Amount</span>
            <p className="font-mono text-3xl font-extrabold text-white tracking-tight">{formatCurrency(invoice.netPayable || 2467980)}</p>
            <div className="flex items-center gap-2 pt-1">
              <span className="px-2.5 py-1 rounded-lg bg-teal-900/30 text-xs font-bold text-teal-100 border border-teal-700/30">NEFT</span>
            </div>
          </div>

          {/* Card 3: Summary Key/Value Table */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Quick Summary</h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Invoice No</span>
                <span className="font-mono font-bold text-slate-900">{invoice.invoiceNumber || '9000024000'}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">ASN No</span>
                <span className="font-mono text-slate-700">{invoice.asnNumber || '—'}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Invoice Date</span>
                <span className="font-semibold text-slate-800">{formatDate(invoice.invoiceDate || '2026-06-16')}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Vendor Code</span>
                <span className="font-mono font-bold text-slate-900">{invoice.vendorId || '10000088'}</span>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500 font-medium">Created</span>
                <span className="font-semibold text-slate-800">{formatDate(invoice.createdAt || '2026-07-20')}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 text-center">
              <Link to="/admin/invoice-payments" className="text-sm font-bold text-[#0d7676] hover:text-[#0f4c4c] hover:underline transition-colors inline-flex items-center gap-1">
                ← Back to All Invoice Payments
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
