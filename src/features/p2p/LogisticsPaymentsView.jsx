import React, { useState, useEffect } from 'react';
import { Truck, DollarSign, CheckCircle2, FileText, Building2 } from 'lucide-react';
import { apiFetch } from '../../services/api';
import DocumentUploader from '../../components/shared/DocumentUploader';

export default function LogisticsPaymentsView() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPaymentId, setSelectedPaymentId] = useState('');

  useEffect(() => {
    async function fetchPayments() {
      try {
        setLoading(true);
        const res = await apiFetch('/api/p2p/logistics-payments');
        if (res.ok) {
          const data = await res.json();
          setPayments(data.payments || []);
        }
      } catch (e) {
        console.error('Error fetching logistics payments:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchPayments();
  }, []);

  return (
    <div className="w-full space-y-4 font-sans">
      {/* Clean Toolbar Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#0d7676] border border-teal-100 flex items-center justify-center font-bold">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">Logistics & Freight Payout Ledger</h2>
            <p className="text-xs text-slate-500">Freight charges, ocean transport, destination handling, and port storage payouts to logistics providers</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden w-full">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-extrabold text-slate-800 text-sm">Logistics Vendor Invoices & Disbursements</h3>
          <span className="text-xs font-semibold text-slate-500">{payments.length} Payments</span>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Payment ID</th>
                <th className="py-3.5 px-4">Logistics Provider</th>
                <th className="py-3.5 px-4">BL Reference</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4 text-right">Amount</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {payments.map((p) => (
                <tr key={p.logisticsPaymentId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-4 font-bold text-teal-700 font-mono">{p.logisticsPaymentId}</td>
                  <td className="py-4 px-4 font-bold text-slate-900">{p.providerName}</td>
                  <td className="py-4 px-4 font-semibold text-slate-800">{p.blNumber}</td>
                  <td className="py-4 px-4 font-medium text-slate-600">{p.category}</td>
                  <td className="py-4 px-4 text-right font-black text-slate-900 text-sm">₹{p.amount.toLocaleString('en-IN')}</td>
                  <td className="py-4 px-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                      p.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    {p.status === 'approved' ? (
                      <button 
                        onClick={() => setPayments(prev => prev.map(item => item.logisticsPaymentId === p.logisticsPaymentId ? { ...item, status: 'paid', utrNumber: 'UTRDHL908172' } : item))}
                        className="px-3 py-1.5 rounded-lg bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold text-[11px]"
                      >
                        Record Treasury Payout
                      </button>
                    ) : (
                      <span className="text-[11px] font-semibold text-emerald-600 flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> UTR: {p.utrNumber}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      {/* Document Upload Section */}
      {payments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Freight & Logistics Documents</h3>
            <p className="text-xs text-slate-500">Attach invoices, bills of lading, freight receipts, and payment proof</p>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700">Select Logistics Payment</label>
            <select
              value={selectedPaymentId}
              onChange={(e) => setSelectedPaymentId(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#0d7676] focus:border-[#0d7676]"
            >
              <option value="">-- Select a logistics payment to upload documents --</option>
              {payments.map(payment => (
                <option key={payment.logisticsPaymentId} value={payment.logisticsPaymentId}>
                  {payment.logisticsPaymentId} · {payment.providerName} · ₹{payment.amount.toLocaleString('en-IN')}
                </option>
              ))}
            </select>
          </div>

          {selectedPaymentId && (
            <div className="pt-3">
              <DocumentUploader
                documentableType="LogisticsPayment"
                documentableId={selectedPaymentId}
                documentType="bill_of_lading"
                multiple={true}
              />
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
