import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Truck, DollarSign, CheckCircle2, FileText, Building2, Search, Plus, Trash2, AlertTriangle, Pencil, Save, X, Loader2 } from 'lucide-react';
import { apiFetch } from '../../services/api';
import DocumentUploader from '../../components/shared/DocumentUploader';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { ServerPagination } from '../../components/ui/server-pagination';
import { useToast } from '../../components/ui/toast';
import { userHasPermission } from '../../lib/permissions';

export default function LogisticsPaymentsView() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useSelector((state) => state.auth);

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal states
  const [showClearBliModal, setShowClearBliModal] = useState(false);
  const [deletingBli, setDeletingBli] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Edit Payment Modal states
  const [editPayment, setEditPayment] = useState(null);
  const [editForm, setEditForm] = useState({ invoiceNumber: '', amount: '', vendorName: '', remarks: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const canCreate = userHasPermission(
    user?.role,
    'logistics-payments.create',
    user?.permissions || user?.customPermissions
  );
  const canMarkPaid = userHasPermission(user?.role, 'logistics-payments.mark-paid', user?.permissions || user?.customPermissions);
  const canDelete = userHasPermission(user?.role, 'logistics-payments.delete', user?.permissions || user?.customPermissions);

  const handlePayout = async (payment, refId) => {
    const utrNumber = window.prompt('Enter bank UTR / payment reference number:');
    if (!utrNumber?.trim()) return;
    const res = await apiFetch(`/api/p2p/logistics-payments/${refId}/payout`, {
      method: 'POST', body: JSON.stringify({ utrNumber: utrNumber.trim() })
    });
    const data = await res.json();
    if (!res.ok) return showToast({ title: 'Payout Failed', description: data.error || 'Unable to record payout.', type: 'error' });
    showToast({ title: 'Payment Recorded', description: data.message, type: 'success' });
    fetchPayments();
  };

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/p2p/logistics-payments');
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments || data.invoices || []);
      }
    } catch (e) {
      console.error('Error fetching logistics payments:', e);
      showToast({ title: 'Error', description: 'Failed to load logistics payments.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleOpenEdit = (p) => {
    setEditPayment(p);
    setEditForm({
      invoiceNumber: p.invoiceNumber || '',
      amount: p.amount?.toString() || p.totalAmount?.toString() || '',
      vendorName: p.vendorName || '',
      remarks: p.remarks || ''
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editForm.invoiceNumber || !editForm.amount || Number(editForm.amount) <= 0) {
      return showToast({ title: 'Validation Error', description: 'Enter valid Invoice Number and Amount.', type: 'error' });
    }
    setSavingEdit(true);
    try {
      const refId = editPayment.referenceNumber || editPayment.logisticsPaymentId || editPayment.id;
      const res = await apiFetch(`/api/p2p/logistics-payments/${refId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber: editForm.invoiceNumber,
          amount: Number(editForm.amount),
          vendorName: editForm.vendorName,
          remarks: editForm.remarks
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update payment');
      showToast({ title: 'Resent for Approval', description: `${refId} updated and sent again for approval cycle from Step 1.`, type: 'success' });
      setEditPayment(null);
      fetchPayments();
    } catch (err) {
      showToast({ title: 'Update Failed', description: err.message, type: 'error' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleClearAllBli = async () => {
    try {
      setDeletingBli(true);
      const res = await apiFetch('/api/p2p/logistics-payments/clear-bli', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast({
          title: 'BLI Data Cleared',
          description: data.message || `Deleted ${data.deletedCount || 0} BLI record(s).`,
          type: 'success'
        });
        setShowClearBliModal(false);
        fetchPayments();
      } else {
        throw new Error(data.error || 'Failed to clear BLI data');
      }
    } catch (err) {
      showToast({ title: 'Delete Failed', description: err.message, type: 'error' });
    } finally {
      setDeletingBli(false);
    }
  };

  const handleDeleteSingle = async (id, refNumber) => {
    if (!window.confirm(`Are you sure you want to delete payment ${refNumber || id}?`)) return;
    try {
      setDeletingId(id);
      const res = await apiFetch(`/api/p2p/logistics-payments/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast({ title: 'Deleted', description: `Payment ${refNumber || id} removed successfully.`, type: 'success' });
        fetchPayments();
      } else {
        throw new Error(data.error || 'Failed to delete record');
      }
    } catch (err) {
      showToast({ title: 'Delete Error', description: err.message, type: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  // Filter Payments (Strictly LOG payments only)
  const filtered = payments.filter(p => {
    const q = search.toLowerCase();
    const ref = p.referenceNumber || p.id || '';
    const matchesSearch = !search ||
      ref.toLowerCase().includes(q) ||
      (p.vendorName || p.providerName || '').toLowerCase().includes(q) ||
      (p.invoiceNumber || p.blNumber || '').toLowerCase().includes(q) ||
      (p.category || p.typeDisplay || '').toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'All' || (p.status || '').toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="w-full space-y-4 font-sans text-slate-800 antialiased pb-16">
      {/* Clean Toolbar Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0d7676] border border-teal-100 flex items-center justify-center font-bold">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">Logistics & Freight Payout Ledger</h2>
            <p className="text-xs text-slate-500">Freight charges, ocean transport, destination handling, and port storage payouts to logistics providers</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canCreate && (
            <button
              onClick={() => navigate('/p2p/logistics-payments/create')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Logistics Payment</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search payment ID (LOG), provider, invoice..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
            />
          </div>

          <div className="w-36">
            <SearchableSelect
              options={[
                { label: 'All Status', value: 'All' },
                { label: 'Approved', value: 'approved' },
                { label: 'Paid', value: 'paid' }
              ]}
              value={statusFilter}
              onChange={(val) => { setStatusFilter(val); setPage(1); }}
              size="sm"
              searchable={false}
            />
          </div>
        </div>

        <span className="text-xs font-bold text-slate-400">
          Showing {filtered.length} of {payments.length} logistics payments
        </span>
      </div>

      {/* Logistics Payment Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden w-full">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-extrabold text-slate-800 text-sm">Logistics Vendor Invoices & Disbursements</h3>
          <span className="text-xs font-semibold text-slate-500">{filtered.length} Payments</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium">
            Loading logistics payment ledger...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium space-y-2">
            <Truck className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
            <p className="font-bold text-slate-600">No logistics payments found.</p>
            <p className="text-[11px] text-slate-400">Click "New Logistics Payment" above to record a new payout.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Payment ID</th>
                  <th className="py-3.5 px-4">Logistics Provider</th>
                  <th className="py-3.5 px-4">Invoice / Ref No</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {paginated.map((p, idx) => {
                  const refId = p.referenceNumber || p.logisticsPaymentId || p.id || `LOG-${idx}`;
                  const provider = p.vendorName || p.providerName || 'Logistics Provider';
                  const invRef = p.invoiceNumber || p.blNumber || 'N/A';
                  const cat = p.typeDisplay || p.category || 'Logistics Freight Payment';
                  const amt = p.amount || p.totalAmount || 0;
                  const curr = p.currency || 'INR';
                  const status = p.status || 'Approved';

                  return (
                    <tr key={refId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-4 font-bold text-[#0d7676] font-mono">{refId}</td>
                      <td className="py-4 px-4 font-bold text-slate-900">{provider}</td>
                      <td className="py-4 px-4 font-semibold text-slate-800">{invRef}</td>
                      <td className="py-4 px-4 font-medium text-slate-600">{cat}</td>
                      <td className="py-4 px-4 text-right font-black text-slate-900 text-sm">
                        {curr === 'USD' ? '$' : '₹'}{Number(amt).toLocaleString('en-IN')}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                          status.toLowerCase().includes('approved') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          status.toLowerCase().includes('paid') ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          status.toLowerCase().includes('reject') ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canMarkPaid && status.toLowerCase().includes('approved') ? (
                            <button
                              onClick={() => handlePayout(p, refId)}
                              className="px-3 py-1.5 rounded-lg bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold text-[11px] cursor-pointer shadow-2xs transition"
                            >
                              Record Payout
                            </button>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-500">
                              {p.utrNumber ? `UTR: ${p.utrNumber}` : `Step ${p.currentStep || 1}/${p.totalSteps || 1}`}
                            </span>
                          )}

                          {canCreate && !status.toLowerCase().includes('paid') && (
                            <button
                              onClick={() => navigate(`/p2p/logistics-payments/${refId}/edit`)}
                              className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                              title={`Edit ${refId} & Resubmit for Approval`}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}

                          {canDelete && !status.toLowerCase().includes('pending') && !status.toLowerCase().includes('approval') && !status.toLowerCase().includes('approved') && !status.toLowerCase().includes('paid') && (
                            <button
                              onClick={() => handleDeleteSingle(p.id || refId, refId)}
                              disabled={deletingId === (p.id || refId)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                              title={`Delete ${refId}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <ServerPagination
          page={page}
          totalPages={Math.ceil(filtered.length / pageSize) || 1}
          total={filtered.length}
          pageSize={pageSize}
          itemLabel="logistics payments"
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>


      {/* Modal: Delete All BLI Data */}
      {showClearBliModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Purge Legacy BLI Data?</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  This action will permanently delete all legacy <strong className="text-rose-700">BLI (Bill of Lading Invoices)</strong> records and their associated approval records from the system.
                </p>
                <div className="mt-2.5 p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 font-semibold">
                  Note: All <strong>LOG (Logistics Payments)</strong> records will remain completely safe and untouched.
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowClearBliModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAllBli}
                disabled={deletingBli}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {deletingBli ? (
                  <span>Purging...</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Purge BLI Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT LOGISTICS PAYMENT MODAL */}
      {editPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 font-sans text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-[#0d7676]" />
                <h3 className="text-base font-bold text-slate-900">Edit Logistics Payment</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditPayment(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 font-semibold">
                ⚡ Editing this payment will reset its status and resubmit it for approval from Step 1.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Invoice Number <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={editForm.invoiceNumber}
                  onChange={(e) => setEditForm({ ...editForm, invoiceNumber: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:border-[#0d7676] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount <span className="text-rose-500">*</span></label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:border-[#0d7676] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Logistics Provider Name</label>
                <input
                  type="text"
                  value={editForm.vendorName}
                  onChange={(e) => setEditForm({ ...editForm, vendorName: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl font-medium text-slate-900 focus:border-[#0d7676] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Remarks / Update Reason</label>
                <textarea
                  rows={2}
                  value={editForm.remarks}
                  onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                  placeholder="Reason for editing or updated payment notes..."
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl font-medium text-slate-900 focus:border-[#0d7676] outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditPayment(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-[#0d7676] hover:bg-[#0f766e] text-white shadow-xs transition disabled:opacity-50"
                >
                  {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{savingEdit ? 'Resubmitting...' : 'Save & Resubmit for Approval'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
