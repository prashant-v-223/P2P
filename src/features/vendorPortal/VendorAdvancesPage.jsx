import React, { useState } from 'react';
import { useVendor } from './vendorContext';
import { useToast } from '../../components/ui/toast';
import { CreditCard, FileText, Plus, Filter, CheckCircle2, X } from 'lucide-react';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { ServerPagination } from '../../components/ui/server-pagination';
import { formatCurrency } from '../../utils/formatCurrency';

export default function VendorAdvancesPage() {
  const { advances, purchaseOrders, addAdvanceRequest } = useVendor();
  const { showToast } = useToast();

  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedPO, setSelectedPO] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedPurchaseOrder = purchaseOrders.find((po) => po.id === selectedPO);
  const selectedCurrency = selectedPurchaseOrder?.currency || 'INR';
  const eligiblePurchaseOrders = purchaseOrders.filter((po) =>
    !['closed', 'cancelled', 'canceled', 'blocked'].includes(String(po.status || '').toLowerCase()) &&
    Number(po.remainingAdvanceAmount) > 0
  );

  const filteredAdvances = advances.filter((adv) => {
    if (statusFilter === 'All Statuses') return true;
    return adv.status === statusFilter;
  });

  const paginatedAdvances = filteredAdvances.slice((page - 1) * pageSize, page * pageSize);

  const totalCount = advances.length;
  const inProgressCount = advances.filter((a) => a.status === 'In Progress').length;
  const approvedCount = advances.filter((a) => a.status === 'Approved').length;
  const paidCount = advances.filter((a) => a.status === 'Paid').length;

  const handleCreateAdvance = async (e) => {
    e.preventDefault();
    if (!selectedPurchaseOrder) {
      showToast({ type: 'error', title: 'Purchase Order Required', description: 'Select an eligible Purchase Order.' });
      return;
    }
    if (!amount || Number(amount) <= 0) {
      showToast({ type: 'error', title: 'Invalid Amount', description: 'Advance amount must be greater than zero.' });
      return;
    }
    if (Number(amount) > Number(selectedPurchaseOrder.remainingAdvanceAmount)) {
      showToast({
        type: 'error',
        title: 'Amount Exceeds PO Balance',
        description: `Available advance balance: ${selectedCurrency} ${Number(selectedPurchaseOrder.remainingAdvanceAmount).toLocaleString('en-IN')}.`
      });
      return;
    }
    if (!reason.trim() || reason.trim().length < 10) {
      showToast({ type: 'error', title: 'Justification Required', description: 'Enter at least 10 characters explaining the advance request.' });
      return;
    }

    try {
      setIsSubmitting(true);
      await addAdvanceRequest({
        poNumber: selectedPO,
        amount: Number(amount),
        currency: selectedCurrency,
        reason,
        requestedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      });

      setShowRequestModal(false);
      setSelectedPO('');
      setAmount('');
      setReason('');
      showToast({ type: 'success', title: 'Advance Request Submitted', description: 'Your request was sent for approval.' });
    } catch (error) {
      showToast({ type: 'error', title: 'Submission Failed', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 font-sans pb-12 antialiased">
      {/* Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Advance Payments</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            View issued advance payments and track approval status against your Purchase Orders
          </p>
        </div>

        <div className="bg-teal-50 border border-teal-200 text-teal-800 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#0d7676] shrink-0" />
          <span>Advance payment requests are initiated & issued by the buyer procurement team.</span>
        </div>
      </div>

      {/* 4 Stat Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 text-center shadow-xs">
          <span className="text-2xl font-black text-slate-900 block">{totalCount}</span>
          <span className="text-xs font-semibold text-slate-500">Total</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 text-center shadow-xs">
          <span className="text-2xl font-black text-amber-600 block">{inProgressCount}</span>
          <span className="text-xs font-semibold text-slate-500">In Progress</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 text-center shadow-xs">
          <span className="text-2xl font-black text-emerald-600 block">{approvedCount}</span>
          <span className="text-xs font-semibold text-slate-500">Approved</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 text-center shadow-xs">
          <span className="text-2xl font-black text-[#0d7676] block">{paidCount}</span>
          <span className="text-xs font-semibold text-slate-500">Paid</span>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex items-center gap-3">
        <div className="w-48">
          <SearchableSelect
            options={[
              { label: 'All Statuses', value: 'All Statuses' },
              { label: 'In Progress', value: 'In Progress' },
              { label: 'Approved', value: 'Approved' },
              { label: 'Paid', value: 'Paid' }
            ]}
            value={statusFilter}
            onChange={(val) => { setStatusFilter(val); setPage(1); }}
            size="sm"
            searchable={false}
          />
        </div>
      </div>

      {/* Main Table / Empty Container Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredAdvances.length === 0 ? (
          <div className="py-20 px-4 flex flex-col items-center justify-center text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center border border-slate-100 mb-1">
              <FileText className="w-7 h-7 stroke-[1.5]" />
            </div>
            <h3 className="text-xs font-bold text-slate-700">No advance payments found</h3>
            <p className="text-[11px] text-slate-400 font-medium">
              Advance payments raised against your POs will appear here
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="p-4">Request ID</th>
                    <th className="p-4">PO Number</th>
                    <th className="p-4">Submitted Date</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Due Date</th>
                    <th className="p-4">Approval Stage</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {paginatedAdvances.map((adv) => (
                    <tr key={adv.id} className="hover:bg-slate-50/70">
                      <td className="p-4 font-bold text-slate-900">{adv.id}</td>
                      <td className="p-4 text-slate-800">{adv.poNumber}</td>
                      <td className="p-4 text-slate-500">{adv.requestedDate || adv.createdAt || '—'}</td>
                      <td className="p-4 font-bold text-slate-900">
                        {formatCurrency(adv.amount, adv.currency)}
                      </td>
                      <td className="p-4 text-slate-500">
                        {adv.requestedDate ? (() => {
                          try {
                            const d = new Date(adv.requestedDate);
                            if (isNaN(d.getTime())) return '—';
                            d.setDate(d.getDate() + 2);
                            return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                          } catch { return '—'; }
                        })() : '—'}
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          {adv.status === 'In Progress' || adv.status === 'Pending' ? 'Purchase Manager' : adv.status === 'Approved' ? 'Approved' : '—'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          adv.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                          adv.status === 'Paid' ? 'bg-blue-100 text-blue-800' :
                          'bg-teal-100 text-teal-800'
                        }`}>
                          {adv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ServerPagination
              page={page}
              totalPages={Math.ceil(filteredAdvances.length / pageSize) || 1}
              total={filteredAdvances.length}
              pageSize={pageSize}
              itemLabel="advance requests"
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </>
        )}
      </div>

      {/* Request Advance Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Request Advance Payment</h3>
              <button onClick={() => setShowRequestModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAdvance} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Select Purchase Order *</label>
                <SearchableSelect
                  options={eligiblePurchaseOrders.map((po) => ({
                    label: `${po.id} — ${po.amount}`,
                    value: po.id
                  }))}
                  value={selectedPO}
                  onChange={(val) => setSelectedPO(val)}
                  placeholder="Select PO..."
                  size="md"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Advance Amount ({selectedCurrency}) *</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  max={selectedPurchaseOrder?.remainingAdvanceAmount || undefined}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676]"
                />
                {selectedPurchaseOrder && (
                  <p className="text-[10px] font-semibold text-slate-500">
                    Remaining advance balance: {selectedCurrency} {Number(selectedPurchaseOrder.remainingAdvanceAmount).toLocaleString('en-IN')}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Reason / Justification *</label>
                <textarea
                  rows={2}
                  value={reason}
                  required
                  minLength={10}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Raw material procurement..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-2 border border-slate-200 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#0d7676] hover:bg-[#0f766e] text-white text-xs font-bold uppercase tracking-wider rounded-xl"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
