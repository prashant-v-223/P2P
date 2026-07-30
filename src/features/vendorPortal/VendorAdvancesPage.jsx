import React, { useState } from 'react';
import { useVendor } from './vendorContext';
import { CreditCard, FileText, Plus, Filter, CheckCircle2, X } from 'lucide-react';

export default function VendorAdvancesPage() {
  const { advances, purchaseOrders, addAdvanceRequest } = useVendor();

  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [showRequestModal, setShowRequestModal] = useState(false);

  const [selectedPO, setSelectedPO] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const filteredAdvances = advances.filter((adv) => {
    if (statusFilter === 'All Statuses') return true;
    return adv.status === statusFilter;
  });

  const totalCount = advances.length;
  const inProgressCount = advances.filter((a) => a.status === 'In Progress').length;
  const approvedCount = advances.filter((a) => a.status === 'Approved').length;
  const paidCount = advances.filter((a) => a.status === 'Paid').length;

  const handleCreateAdvance = (e) => {
    e.preventDefault();
    if (!selectedPO || !amount) return;

    addAdvanceRequest({
      poNumber: selectedPO,
      amount: Number(amount),
      reason,
      requestedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    });

    setShowRequestModal(false);
    setSelectedPO('');
    setAmount('');
    setReason('');
  };

  return (
    <div className="space-y-6 font-sans pb-12 antialiased">
      {/* Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Advance Payments</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            All advance payment requests against your Purchase Orders
          </p>
        </div>

        <button
          onClick={() => setShowRequestModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold text-xs rounded-xl shadow-xs transition uppercase tracking-wider self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Request Advance</span>
        </button>
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
        <div className="relative w-48">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d7676] shadow-xs appearance-none pr-8 cursor-pointer"
          >
            <option value="All Statuses">All Statuses</option>
            <option value="In Progress">In Progress</option>
            <option value="Approved">Approved</option>
            <option value="Paid">Paid</option>
          </select>
          <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-4">Request ID</th>
                  <th className="p-4">PO Number</th>
                  <th className="p-4">Requested Date</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredAdvances.map((adv) => (
                  <tr key={adv.id} className="hover:bg-slate-50/70">
                    <td className="p-4 font-bold text-slate-900">{adv.id}</td>
                    <td className="p-4 text-slate-800">{adv.poNumber}</td>
                    <td className="p-4 text-slate-500">{adv.requestedDate}</td>
                    <td className="p-4 font-bold text-slate-900">
                      USD {Number(adv.amount || 0).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">
                        {adv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Request Advance Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
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
                <select
                  required
                  value={selectedPO}
                  onChange={(e) => setSelectedPO(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676]"
                >
                  <option value="">Select PO...</option>
                  {purchaseOrders.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.id} — {po.amount}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Advance Amount (USD) *</label>
                <input
                  type="number"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Reason / Justification</label>
                <textarea
                  rows={2}
                  value={reason}
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
                  className="px-4 py-2 bg-[#0d7676] hover:bg-[#0f766e] text-white text-xs font-bold uppercase tracking-wider rounded-xl"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
