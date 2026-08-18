import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { apiFetch } from '../../services/api';
import { ServerPagination } from '../../components/ui/server-pagination';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { CustomInput } from '../../components/ui/custom-input';
import { useToast } from '../../components/ui/toast';
import { userHasPermission } from '../../lib/permissions';
import { exportCsv } from '../../utils/exportCsv';
import { 
  FileCheck2, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  CreditCard,
  Trash2,
  Search,
  Loader2,
  Lock,
  Clock,
  RotateCcw,
  XCircle,
  Eye,
  Edit3,
  Download
} from 'lucide-react';

export default function InvoicePaymentsView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { user } = useSelector((state) => state.auth);
  const userPerms = user?.permissions || user?.customPermissions;
  const canCreate = userHasPermission(user?.role, 'invoice-payments.create', userPerms);
  const canEdit = canCreate || userHasPermission(user?.role, 'invoice-payments.edit', userPerms);
  const canMarkPaid = userHasPermission(user?.role, 'invoice-payments.mark-paid', userPerms);

  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const searchTerm = searchParams.get('q') || '';
  const statusFilter = searchParams.get('status') || 'All Status';
  const matchFilter = searchParams.get('threeWayMatch') || 'All Match';
  const scopeFilter = searchParams.get('scope') || 'team';

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [utrInput, setUtrInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pagination state
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // PO Options for creation dropdown
  const [availablePOs, setAvailablePOs] = useState([]);

  // Form State
  const [formPo, setFormPo] = useState('');
  const [formInvNum, setFormInvNum] = useState('');
  const [formGross, setFormGross] = useState('');
  const [formGst, setFormGst] = useState('');
  const [formTds, setFormTds] = useState('');
  const [formAdvAdj, setFormAdvAdj] = useState('');
  const [formPoQty, setFormPoQty] = useState('');
  const [formGrnQty, setFormGrnQty] = useState('');
  const [formInvQty, setFormInvQty] = useState('');

  useEffect(() => {
    fetchInvoices();
  }, [currentPage, searchTerm, statusFilter, matchFilter, scopeFilter]);

  useEffect(() => {
    fetchAvailablePOs();
  }, []);

  const updateUrlParams = (newParams) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([k, v]) => {
      if (v && v !== 'All Status' && v !== 'All Match' && v !== 'All') {
        params.set(k, v);
      } else {
        params.delete(k);
      }
    });
    setSearchParams(params);
  };

  const fetchAvailablePOs = async () => {
    try {
      const res = await apiFetch('/api/p2p/purchase-orders?size=50');
      if (res.ok) {
        const json = await res.json();
        if (json.data) setAvailablePOs(json.data);
      }
    } catch (e) {
      console.error('Error fetching POs for dropdown:', e);
    }
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        size: pageSize,
        q: searchTerm,
        status: statusFilter,
        threeWayMatch: matchFilter,
        scope: scopeFilter
      });

      const res = await apiFetch(`/api/p2p/invoices?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setInvoices(json.data);
          setTotalCount(json.total || json.data.length);
          setTotalPages(json.totalPages || 1);
        }
      }
    } catch (e) {
      console.error('Error fetching invoices from MongoDB:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    updateUrlParams({ q: e.target.value, page: '1' });
  };

  const handleStatusFilterChange = (e) => {
    updateUrlParams({ status: e.target.value, page: '1' });
  };

  const handleMatchFilterChange = (e) => {
    updateUrlParams({ threeWayMatch: e.target.value, page: '1' });
  };

  const handleOpenCreateModal = () => {
    setFormInvNum('INV-' + Math.floor(100000 + Math.random() * 900000));
    setShowModal(true);
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/p2p/invoices/create', {
        method: 'POST',
        body: JSON.stringify({
          poNumber: formPo,
          invoiceNumber: formInvNum,
          grossAmount: Number(formGross),
          gstAmount: Number(formGst),
          tdsAmount: Number(formTds),
          advanceAdjusted: Number(formAdvAdj),
          advanceIdAdjusted: 'ADV-' + Date.now().toString().slice(-6),
          poQuantity: Number(formPoQty),
          grnQuantity: Number(formGrnQty),
          invoiceQuantity: Number(formInvQty),
          requestedBy: 'Finance Team'
        })
      });
      if (res.ok) {
        showToast({ title: 'Invoice Submitted', description: 'Invoice payment request submitted & 3-way match executed.', type: 'success' });
        await fetchInvoices();
        setShowModal(false);
      } else {
        const errJson = await res.json();
        showToast({ title: 'Error', description: errJson.error || 'Failed to submit invoice', type: 'error' });
      }
    } catch (e) {
      console.error('Error creating invoice:', e);
      showToast({ title: 'Error', description: 'Could not connect to server.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayoutSubmit = async (e) => {
    e.preventDefault();
    if (!selectedInvoice || !utrInput.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/api/p2p/invoices/${selectedInvoice.invoicePaymentId}/payout`, {
        method: 'POST',
        body: JSON.stringify({ utrNumber: utrInput, paymentMode: 'NEFT' })
      });
      if (res.ok) {
        showToast({ title: 'Payout Executed', description: `UTR ${utrInput} recorded for ${selectedInvoice.invoiceNumber}.`, type: 'success' });
        await fetchInvoices();
        setShowPayoutModal(false);
        setSelectedInvoice(null);
        setUtrInput('');
      } else {
        showToast({ title: 'Payout Failed', description: 'Could not record treasury payout.', type: 'error' });
      }
    } catch (e) {
      console.error('Error recording invoice payout:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteInvoice = async (invoicePaymentId, status) => {
    if (status !== 'draft' && status !== 'returned') {
      showToast({ title: 'Locked', description: 'Invoice in approval workflow or completed cannot be deleted.', type: 'warning' });
      return;
    }
    if (!window.confirm(`Delete invoice payment "${invoicePaymentId}" from MongoDB?`)) return;
    setInvoices(prev => prev.filter(i => i.invoicePaymentId !== invoicePaymentId));
    try {
      await apiFetch(`/api/p2p/invoices/${invoicePaymentId}`, { method: 'DELETE' });
      showToast({ title: 'Deleted', description: `${invoicePaymentId} has been deleted.`, type: 'info' });
      await fetchInvoices();
    } catch (e) {
      console.error('Error deleting invoice:', e);
    }
  };

  const netPayableCalc = Math.max(0, Number(formGross) + Number(formGst) - Number(formTds) - Number(formAdvAdj));

const getInitials = (name) => {
  if (!name) return 'INV';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

  return (
    <div className="w-full space-y-3 font-sans text-slate-800 pb-10">
      {/* Scope Selector Bar (My Records / My Team Records / All Records) */}
      <div className="flex items-center justify-between gap-3 shrink-0 flex-wrap">
        {/* <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => updateUrlParams({ scope: 'my', page: '1' })}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              scopeFilter === 'my'
                ? 'bg-white text-[#0d7676] shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            My Records
          </button>
          <button
            type="button"
            onClick={() => updateUrlParams({ scope: 'team', page: '1' })}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              scopeFilter === 'team'
                ? 'bg-white text-[#0d7676] shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            My Team Records
          </button>
          <button
            type="button"
            onClick={() => updateUrlParams({ scope: 'all', page: '1' })}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              scopeFilter === 'all'
                ? 'bg-white text-[#0d7676] shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            All Records
          </button>
        </div> */}
<div></div>
        {canCreate && (
          <button
            onClick={() => navigate('/admin/invoice-payments/create')}
            className="flex items-center gap-1.5 bg-[#0d7676] hover:bg-[#0f766e] text-white px-4 py-2 rounded-lg font-bold text-xs shadow-2xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" /> New Invoice Payment
          </button>
        )}
        <button type="button" onClick={() => exportCsv('invoice-payments.csv', invoices)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* SINGLE UNIFIED CONTROL BAR (Search + 3-Way Match + Status + Page Size) */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_150px_150px_130px]">
          <div className="min-w-0 sm:col-span-2 xl:col-span-1">
            <CustomInput
              type="text"
              placeholder="Search reference, ASN, invoice..."
              value={searchTerm}
              onChange={handleSearchChange}
              onClear={() => handleSearchChange({ target: { value: '' } })}
              leftIcon={Search}
              clearable={true}
              size="sm"
            />
          </div>

          <div className="min-w-0">
            <SearchableSelect
              options={[
                { label: 'All 3-Way Match', value: 'All Match' },
                { label: 'Matched', value: 'matched' },
                { label: 'Mismatch', value: 'mismatch' }
              ]}
              value={matchFilter}
              onChange={(val) => updateUrlParams({ threeWayMatch: val, page: '1' })}
              size="sm"
              searchable={false}
            />
          </div>

          <div className="min-w-0">
            <SearchableSelect
              options={[
                { label: 'All Status', value: 'All Status' },
                { label: 'Draft', value: 'draft' },
                { label: 'Pending', value: 'pending' },
                { label: 'Approved', value: 'approved' },
                { label: 'Rejected', value: 'rejected' },
                { label: 'Returned', value: 'returned' },
                { label: 'Paid', value: 'paid' }
              ]}
              value={statusFilter}
              onChange={(val) => updateUrlParams({ status: val, page: '1' })}
              size="sm"
              searchable={false}
            />
          </div>

          <div className="min-w-0">
            <SearchableSelect
              options={[
                { label: '10 per page', value: 10 },
                { label: '20 per page', value: 20 },
                { label: '50 per page', value: 50 }
              ]}
              value={pageSize}
              onChange={(val) => { setPageSize(Number(val)); updateUrlParams({ pageSize: String(val), page: '1' }); }}
              size="sm"
              searchable={false}
            />
          </div>
        </div>
      </div>

      {/* Invoice Table Container with Max Height & Sticky Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden w-full flex flex-col max-h-[calc(100vh-210px)] min-h-[320px]">
        <div className="overflow-auto w-full flex-1">
          <table className="w-full min-w-[1240px] table-auto text-left text-[11px] 2xl:min-w-[1320px] 2xl:text-xs">
            <thead className="bg-slate-50/90 sticky top-0 z-10 text-slate-400 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-200 backdrop-blur-xs">
              <tr>
                <th className="py-3.5 px-2 text-center">#</th>
                <th className="py-3.5 px-3.5 whitespace-nowrap">REFERENCE</th>
                <th className="py-3.5 px-2.5 whitespace-nowrap">ASN</th>
                <th className="py-3.5 px-3.5">PO NUMBER</th>
                <th className="py-3.5 px-3.5">INVOICE NO.</th>
                <th className="py-3.5 px-3.5">VENDOR</th>
                <th className="py-3.5 px-3.5 text-right">INVOICE AMT</th>
                <th className="py-3.5 px-2.5 text-center whitespace-nowrap">TDS</th>
                <th className="py-3.5 px-3.5 text-right">NET PAYABLE</th>
                <th className="py-3.5 px-3.5 text-center">3-WAY MATCH</th>
                <th className="py-3.5 px-3.5 text-center">STATUS</th>
                <th className="py-3.5 px-3.5 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="12" className="py-16 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 text-[#0d7676] animate-spin" />
                      <p>Loading vendor invoices...</p>
                    </div>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan="12" className="py-16 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <FileCheck2 className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-700">No invoice records found</p>
                      <p className="text-xs text-slate-400">Click &quot;Submit New Invoice Payment&quot; to create one.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                invoices.map((inv, index) => {
                  const canDelete = inv.status === 'draft' || inv.status === 'returned';
                  const isMatched = inv.threeWayMatch?.status === 'matched';
                  
                  const statusPills = {
                    draft:    'bg-slate-100 text-slate-600 border-slate-200',
                    pending:  'bg-amber-50 text-amber-700 border-amber-200',
                    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    rejected: 'bg-rose-50 text-rose-700 border-rose-200',
                    returned: 'bg-orange-50 text-orange-700 border-orange-200',
                    paid:     'bg-sky-50 text-sky-700 border-sky-200'
                  };

                  return (
                    <tr key={inv.invoicePaymentId} className="hover:bg-slate-50/70 transition-colors text-xs">
                      {/* # */}
                      <td className="py-3 px-2 text-center text-slate-400 font-semibold tabular-nums">
                        {(currentPage - 1) * pageSize + index + 1}
                      </td>

                      {/* REFERENCE */}
                      <td className="py-3 px-3.5 font-mono font-extrabold text-slate-900 whitespace-nowrap">
                        <Link
                          to={`/admin/invoice-payments/${inv.invoicePaymentId}`}
                          className="hover:text-teal-700 transition-colors"
                        >
                          {inv.invoicePaymentId || `INV-${index + 1}`}
                        </Link>
                      </td>

                      {/* ASN */}
                      <td className="py-3 px-2.5 font-mono text-slate-400 whitespace-nowrap">
                        {inv.asnNumber ? (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                            {inv.asnNumber}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-center block">—</span>
                        )}
                      </td>

                      {/* PO NUMBER */}
                      <td className="py-3 px-3.5 font-mono font-bold whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-sky-50 text-[#0284c7] border border-sky-200 text-[11px] font-bold font-mono">
                          {inv.poId}
                        </span>
                      </td>

                      {/* INVOICE NO. */}
                      <td className="py-3 px-3.5 font-mono text-slate-700 font-semibold whitespace-nowrap">
                        {inv.invoiceNumber}
                      </td>

                      {/* VENDOR */}
                      <td className="py-3 px-3.5 min-w-[180px] max-w-[220px]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-teal-50 border border-teal-200 text-[#0d7676] text-[10px] font-extrabold flex items-center justify-center shrink-0">
                            {getInitials(inv.vendorName)}
                          </div>
                          <span className="font-bold text-slate-900 truncate">{inv.vendorName}</span>
                        </div>
                      </td>

                      {/* INVOICE AMT */}
                      <td className="py-3 px-3.5 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap">
                        {(inv.grossAmount || 0).toLocaleString(inv.currency === 'USD' ? 'en-US' : 'en-IN', { minimumFractionDigits: 2 })} {inv.currency || 'INR'}
                      </td>

                      {/* TDS */}
                      <td className="py-3 px-2.5 text-center font-mono text-slate-500 whitespace-nowrap">
                        {inv.tdsAmount ? `${inv.tdsAmount.toLocaleString(inv.currency === 'USD' ? 'en-US' : 'en-IN', { minimumFractionDigits: 2 })} ${inv.currency || 'INR'}` : <span className="text-slate-300">—</span>}
                      </td>

                      {/* NET PAYABLE */}
                      <td className="py-3 px-3.5 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap">
                        {(inv.netPayable || 0).toLocaleString(inv.currency === 'USD' ? 'en-US' : 'en-IN', { minimumFractionDigits: 2 })} {inv.currency || 'INR'}
                      </td>

                      {/* 3-WAY MATCH */}
                      <td className="py-3 px-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          isMatched 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isMatched ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          {isMatched ? 'Matched' : 'Pending'}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td className="py-3 px-3.5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${statusPills[inv.status] || statusPills.draft}`}>
                          {inv.status}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/admin/invoice-payments/${inv.invoicePaymentId}`)}
                            title="View Invoice Details"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {canMarkPaid && inv.status === 'approved' && (
                            <button
                              onClick={() => { setSelectedInvoice(inv); setShowPayoutModal(true); }}
                              title="Mark Invoice as Paid"
                              className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canEdit && (
                            <button
                              onClick={() => navigate(`/admin/invoice-payments/${inv.invoicePaymentId}/edit`)}
                              title="Edit Invoice"
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canDelete && (
                            <button
                              onClick={() => handleDeleteInvoice(inv.invoicePaymentId, inv.status)}
                              title="Delete Invoice"
                              className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Separated Pagination Bar with Spacing Gap */}
      <div className="pt-1">
        <ServerPagination
          page={currentPage}
          totalPages={totalPages}
          total={totalCount}
          pageSize={pageSize}
          itemLabel="invoice payments"
          onPageChange={(p) => updateUrlParams({ page: String(p) })}
        />
      </div>

      {/* Submit Invoice Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-left">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-[#0d7676]" /> Submit Invoice for 3-Way Match & Approval
            </h3>
            <form onSubmit={handleCreateInvoice} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target PO</label>
                  <SearchableSelect
                    options={availablePOs.length > 0 ? (
                      availablePOs.map(p => ({ label: `${p.poNumber} — ${p.supplierName}`, value: p.poNumber }))
                    ) : [
                      { label: 'PO-4300001510 — Jinko Solar', value: 'PO-4300001510' },
                      { label: 'PO-4300001511 — Trina Solar', value: 'PO-4300001511' },
                      { label: 'PO-4100004110 — Acute Systems', value: 'PO-4100004110' }
                    ]}
                    value={formPo}
                    onChange={(val) => setFormPo(val)}
                    size="md"
                    searchable={true}
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vendor Invoice Number</label>
                  <input
                    type="text"
                    value={formInvNum}
                    onChange={(e) => setFormInvNum(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none font-bold"
                    placeholder="e.g. INV-2026-001"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Gross Amount (₹)</label>
                  <input
                    type="number"
                    value={formGross}
                    onChange={(e) => setFormGross(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">GST Amount (18% ₹)</label>
                  <input
                    type="number"
                    value={formGst}
                    onChange={(e) => setFormGst(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">TDS Deduction (2% ₹)</label>
                  <input
                    type="number"
                    value={formTds}
                    onChange={(e) => setFormTds(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Advance Knock-Off (₹)</label>
                  <input
                    type="number"
                    value={formAdvAdj}
                    onChange={(e) => setFormAdvAdj(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-bold text-amber-700 bg-white"
                  />
                </div>
              </div>

              {/* 3-Way Match Quantity Inputs */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <p className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">3-Way Match Quantities</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block">PO Qty</span>
                    <input
                      type="number"
                      value={formPoQty}
                      onChange={(e) => setFormPoQty(e.target.value)}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold bg-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block">GRN Qty</span>
                    <input
                      type="number"
                      value={formGrnQty}
                      onChange={(e) => setFormGrnQty(e.target.value)}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold bg-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block">Invoice Qty</span>
                    <input
                      type="number"
                      value={formInvQty}
                      onChange={(e) => setFormInvQty(e.target.value)}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 font-extrabold flex justify-between items-center text-xs">
                <span>Calculated Net Payable:</span>
                <span className="font-mono text-sm">₹{netPayableCalc.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit & Run 3-Way Match
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payout Modal */}
      {showPayoutModal && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-left">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" /> Invoice Treasury Bank Payout
            </h3>
            <p className="text-xs text-slate-500">
              Record bank UTR details for Invoice <span className="font-bold text-slate-900">{selectedInvoice.invoiceNumber}</span>. Net Payable: <span className="font-bold text-teal-700">₹{(selectedInvoice.netPayable || 0).toLocaleString('en-IN')}</span>.
            </p>

            <form onSubmit={handlePayoutSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Bank UTR / Reference Number</label>
                <input
                  type="text"
                  placeholder="e.g. UTRIBK90281745"
                  value={utrInput}
                  onChange={(e) => setUtrInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono font-bold"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Execute Invoice Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
