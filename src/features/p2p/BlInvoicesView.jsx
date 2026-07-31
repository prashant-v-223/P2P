import React, { useState } from 'react';
import { Package, CheckCircle2, DollarSign, FileText } from 'lucide-react';

export default function BlInvoicesView() {
  const [invoices] = useState([
    {
      invoiceId: 'BLINV-9021',
      blNumber: 'MAEU987456320',
      shippingLine: 'Maersk Line',
      amount: 480000,
      detentionCharges: 12000,
      status: 'approved',
      utrNumber: 'UTRIBK902847'
    }
  ]);

  return (
    <div className="w-full space-y-4 font-sans">
      {/* Clean Toolbar Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#0d7676] border border-teal-100 flex items-center justify-center font-bold">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">Bill of Lading Ocean Freight Billing</h2>
            <p className="text-xs text-slate-500">Verification of shipping line freight bills, detention/demurrage charges, and destination port fees</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden w-full">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-extrabold text-slate-800 text-sm">BL Freight Invoices</h3>
          <span className="text-xs font-semibold text-slate-500">{invoices.length} Invoices</span>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Invoice ID</th>
                <th className="py-3.5 px-4">BL Number</th>
                <th className="py-3.5 px-4">Shipping Line</th>
                <th className="py-3.5 px-4 text-right">Ocean Freight</th>
                <th className="py-3.5 px-4 text-right">Detention Charges</th>
                <th className="py-3.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {invoices.map((inv) => (
                <tr key={inv.invoiceId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-4 font-bold text-teal-700 font-mono">{inv.invoiceId}</td>
                  <td className="py-4 px-4 font-bold text-slate-900">{inv.blNumber}</td>
                  <td className="py-4 px-4 font-semibold text-slate-800">{inv.shippingLine}</td>
                  <td className="py-4 px-4 text-right font-bold text-slate-900">₹{inv.amount.toLocaleString('en-IN')}</td>
                  <td className="py-4 px-4 text-right font-bold text-amber-700">₹{inv.detentionCharges.toLocaleString('en-IN')}</td>
                  <td className="py-4 px-4 text-center">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
