import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { apiFetch } from '../../services/api';
import { ServerPagination } from '../../components/ui/server-pagination';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { CustomInput } from '../../components/ui/custom-input';
import { useToast } from '../../components/ui/toast';
import { userHasPermission } from '../../lib/permissions';
import { exportCsv } from '../../utils/exportCsv';
import { 
  Search, 
  Eye, 
  Pencil, 
  Trash2, 
  Plus, 
  FileText, 
  Clock, 
  CheckCircle2, 
  Wallet,
  Loader2,
  Download
} from 'lucide-react';

const formatRoleName = (str) => {
  if (!str || str === '—') return '—';
  const val = String(str).trim();
  if (val.toLowerCase() === 'cfo') return 'CFO';
  if (val.toLowerCase() === 'md') return 'Managing Director (MD)';
  if (val.toLowerCase() === 'procurement_head' || val.toLowerCase() === 'procurement head') return 'Procurement Head';
  if (val.toLowerCase() === 'purchase_head' || val.toLowerCase() === 'purchase head') return 'Purchase Head';
  if (val.toLowerCase() === 'purchase_manager' || val.toLowerCase() === 'purchase manager') return 'Purchase Manager';
  if (val.toLowerCase() === 'finance_head' || val.toLowerCase() === 'finance head') return 'Finance Head';
  return val.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const getInitials = (name) => {
  if (!name) return 'ADV';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

export default function AdvancePaymentsView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useSelector((state) => state.auth);
  const userPerms = user?.permissions || user?.customPermissions;
  const canCreate = userHasPermission(user?.role, 'advance-payments.create', userPerms);
  const canEdit = canCreate || userHasPermission(user?.role, 'advance-payments.edit', userPerms);
  const canDelete = userHasPermission(user?.role, 'advance-payments.delete', userPerms);
  const canMarkPaid = userHasPermission(user?.role, 'advance-payments.mark-paid', userPerms);
console.log("canMarkPaid",canMarkPaid);

  // Read state directly from URL search params
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const searchTerm = searchParams.get('q') || '';
  const statusFilter = searchParams.get('status') || 'All Status';
  const scopeFilter = searchParams.get('scope') || 'team';
  const pageSizeParam = parseInt(searchParams.get('pageSize') || '10', 10);

  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(pageSizeParam);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Status Metrics
  const [metrics, setMetrics] = useState({
    total: 0,
    draft: 0,
    pending: 0,
    approved: 0,
    paid: 0
  });

  useEffect(() => {
    fetchAdvances();
  }, [currentPage, searchTerm, statusFilter, scopeFilter, pageSize]);

  const updateUrlParams = (newParams) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([k, v]) => {
      if (v && v !== 'All Status' && v !== 'All') {
        params.set(k, v);
      } else {
        params.delete(k);
      }
    });
    setSearchParams(params);
  };

  const fetchAdvances = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: currentPage,
        size: pageSize,
        q: searchTerm,
        status: statusFilter,
        scope: scopeFilter
      });

      const res = await apiFetch(`/api/p2p/advances?${queryParams.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          const mapped = json.data.map((item, idx) => ({
            id: item._id || idx + 1,
            reference:     item.advanceId || `ADV-${idx + 1}`,
            poNumber:      item.sapPoNumber || item.poId || '—',
            vendorName:    item.vendorName || 'Vendor',
            requestedBy:   item.requestedByName || item.requestedBy || item.createdBy || 'Finance Team',
            amount:        item.amount || 0,
            adjustedAmount: item.adjustedAmount || 0,
            currency:      item.currency || 'INR',
            pctOfPo:       `${item.percentageOfPo || 0}.00%`,
            mode:          item.paymentMode || 'NEFT',
            status: {
              draft:    'Draft',
              pending:  'Pending',
              approved: 'Approved',
              rejected: 'Rejected',
              returned: 'Returned',
              paid:     'Paid'
            }[item.status?.toLowerCase()] || item.status || 'Draft',
            submittedDate: item.createdAt
              ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : '—',
            dueDate: item.dueDate || item.approvalDueDate
              ? new Date(item.dueDate || item.approvalDueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : '—',
            approvalStage: item.assignedApproverRole || item.assignedApproverName ||
              (item.status === 'pending' ? 'Purchase Manager' : '')
          }));

          setAdvances(mapped);
          setTotalCount(json.total || mapped.length);
          setTotalPages(json.totalPages || 1);

          setMetrics({
            total: json.total || mapped.length,
            draft: mapped.filter(a => a.status === 'Draft').length,
            pending: mapped.filter(a => a.status === 'Pending').length,
            approved: mapped.filter(a => a.status === 'Approved').length,
            paid: mapped.filter(a => a.status === 'Paid').length
          });
        }
      }
    } catch (e) {
      console.error('Error fetching advances:', e);
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

  const handlePageSizeChange = (e) => {
    const newSize = parseInt(e.target.value, 10);
    setPageSize(newSize);
    updateUrlParams({ pageSize: String(newSize), page: '1' });
  };

  const handlePageChange = (newPage) => {
    updateUrlParams({ page: String(newPage) });
  };

  const handleDeleteAdvance = async (reference) => {
    if (!window.confirm(`Are you sure you want to delete advance "${reference}"?`)) return;
    setAdvances(prev => prev.filter(a => a.reference !== reference));
    try {
      const res = await apiFetch(`/api/p2p/advances/${reference}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed.');
      showToast({ type: 'success', title: 'Advance Deleted', description: `${reference} was removed.` });
      fetchAdvances();
    } catch (e) {
      showToast({ type: 'error', title: 'Delete Failed', description: e.message });
      fetchAdvances();
    }
  };

  const handlePayout = async (reference) => {
    const utrNumber = window.prompt('Enter bank UTR / payment reference number:');
    if (!utrNumber?.trim()) return;
    const res = await apiFetch(`/api/p2p/advances/${reference}/payout`, { method: 'POST', body: JSON.stringify({ utrNumber: utrNumber.trim() }) });
    const data = await res.json();
    if (!res.ok) return showToast({ title: 'Payout Failed', description: data.error || 'Unable to record payout.', type: 'error' });
    showToast({ title: 'Payment Recorded', description: data.message, type: 'success' });
    fetchAdvances();
  };

  return (
    <div className="space-y-3 font-sans text-left pb-10 flex flex-col min-h-0">
      {/* Scope Selector Bar (My Records / My Team Records / All Records) */}
      {/* Top Action Bar */}
      <div className="flex items-center justify-end gap-2.5 shrink-0">
        {canCreate && (
          <Link
            to="/p2p/advance-payments/create"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold text-xs rounded-lg shadow-2xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" /> New Advance Payment
          </Link>
        )}
        <button type="button" onClick={() => exportCsv('advance-payments.csv', advances)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs">
          <Download className="h-4 w-4 text-slate-500" /> Export CSV
        </button>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">TOTAL</p>
            <p className="text-lg font-extrabold text-slate-900 mt-0.5">{totalCount}</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">PENDING APPROVAL</p>
            <p className="text-lg font-extrabold text-amber-700 mt-0.5">{metrics.pending}</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">APPROVED</p>
            <p className="text-lg font-extrabold text-emerald-700 mt-0.5">{metrics.approved}</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-sky-600 uppercase tracking-wider">PAID</p>
            <p className="text-lg font-extrabold text-sky-700 mt-0.5">{metrics.paid}</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
            <Wallet className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* SINGLE UNIFIED CONTROL BAR */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="min-w-[240px] flex-1">
            <CustomInput
              type="text"
              placeholder="Search reference, vendor, PO number..."
              value={searchTerm}
              onChange={handleSearchChange}
              onClear={() => handleSearchChange({ target: { value: '' } })}
              leftIcon={Search}
              clearable={true}
              size="sm"
            />
          </div>

          <div className="w-36">
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
              onChange={(val) => updateUrlParams({ status: val, page: 1 })}
              size="sm"
              searchable={false}
            />
          </div>

          <div className="w-32">
            <SearchableSelect
              options={[
                { label: '10 per page', value: 10 },
                { label: '20 per page', value: 20 },
                { label: '50 per page', value: 50 }
              ]}
              value={pageSize}
              onChange={(val) => { setPageSize(Number(val)); updateUrlParams({ pageSize: val, page: 1 }); }}
              size="sm"
              searchable={false}
            />
          </div>
        </div>
      </div>

      {/* Table Container with Max Height & Sticky Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden w-full flex flex-col max-h-[calc(100vh-270px)] min-h-[300px]">
        <div className="overflow-auto w-full flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 sticky top-0 z-10 text-slate-400 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-200 backdrop-blur-xs">
              <tr>
                <th className="py-3.5 px-4 text-center">#</th>
                <th className="py-3.5 px-4 whitespace-nowrap">REFERENCE</th>
                <th className="py-3.5 px-4 whitespace-nowrap">PO NUMBER</th>
                <th className="py-3.5 px-4">VENDOR</th>
                <th className="py-3.5 px-4">REQUESTED BY</th>
                <th className="py-3.5 px-4 text-right">AMOUNT</th>
                <th className="py-3.5 px-4 text-right">ADJUSTED AMOUNT</th>
                <th className="py-3.5 px-4 text-center">% OF PO</th>
                <th className="py-3.5 px-4 text-center">MODE</th>
                <th className="py-3.5 px-4 text-center">STATUS</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">SUBMITTED</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">DUE DATE</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">APPROVAL STAGE</th>
                <th className="py-3.5 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="14" className="py-16 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 text-[#0d7676] animate-spin" />
                      <p>Loading advance payments...</p>
                    </div>
                  </td>
                </tr>
              ) : advances.length === 0 ? (
                <tr>
                  <td colSpan="14" className="py-16 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Wallet className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-700">No advance payment records found</p>
                      <p className="text-xs text-slate-400">Click "New Advance Payment" to create one.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                advances.map((adv, index) => {
                  const avatarInitials = getInitials(adv.vendorName);
                  const statusColors = {
                    Draft:    { badge: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
                    Pending:  { badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
                    Approved: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
                    Rejected: { badge: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
                    Returned: { badge: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
                    Paid:     { badge: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' }
                  };
                  const color = statusColors[adv.status] || statusColors.Draft;

                  return (
                    <tr key={adv.reference} className="hover:bg-slate-50/70 transition-colors text-xs">
                      <td className="py-3.5 px-4 text-center text-slate-400 font-semibold tabular-nums">
                        {(currentPage - 1) * pageSize + index + 1}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-extrabold text-slate-900 whitespace-nowrap">
                        <Link
                          to={`/p2p/advance-payments/${adv.reference}`}
                          className="hover:text-teal-700 transition-colors"
                        >
                          {adv.reference}
                        </Link>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-[#0284c7] whitespace-nowrap">
                        {adv.poNumber}
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-teal-50 border border-teal-200 text-[#0d7676] text-[10px] font-extrabold flex items-center justify-center shrink-0">
                            {avatarInitials}
                          </div>
                          <span className="font-bold text-slate-900 truncate">{adv.vendorName}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {adv.requestedBy}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-slate-900">
                        {adv.amount.toLocaleString(adv.currency === 'USD' ? 'en-US' : 'en-IN', { minimumFractionDigits: 2 })} {adv.currency}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-700">
                        {adv.adjustedAmount.toLocaleString(adv.currency === 'USD' ? 'en-US' : 'en-IN', { minimumFractionDigits: 2 })} {adv.currency}
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-600">
                        {adv.pctOfPo}
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono text-slate-500 font-semibold">
                        {adv.mode}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${color.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                          {adv.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center text-slate-500 font-mono text-[11px]">
                        {adv.submittedDate}
                      </td>

                      <td className="py-3.5 px-4 text-center text-slate-500 font-mono text-[11px]">
                        {adv.dueDate}
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {adv.approvalStage ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                            {formatRoleName(adv.approvalStage)}
                          </span>
                        ) : '—'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/p2p/advance-payments/${adv.reference}`)}
                            title="View Details"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {canMarkPaid && adv.status === 'Approved' && (
                            <button
                              onClick={() => handlePayout(adv.reference)}
                              title="Mark Advance as Paid"
                              className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                            >
                              <Wallet className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canEdit && (
                            <button
                              onClick={() => navigate(`/p2p/advance-payments/${adv.reference}/edit`)}
                              title="Edit Advance"
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canDelete && (
                            <button
                              onClick={() => handleDeleteAdvance(adv.reference)}
                              title="Delete Advance"
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
          itemLabel="advance payments"
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}
