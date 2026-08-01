import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useVendor } from './vendorContext';
import { FileText, Plus, Search, Filter, Eye, Download, CheckCircle, Clock, XCircle } from 'lucide-react';

export default function VendorInvoicesListPage() {
  const { invoices, vendorProfile } = useVendor();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.poNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 font-sans pb-12 antialiased">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Invoices</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage and track all submitted invoices for {vendorProfile?.companyName || 'your vendor account'}
          </p>
        </div>

        <Link
          to="/vendor/invoices/upload"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold text-xs rounded-xl shadow-xs transition uppercase tracking-wider self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Upload Invoice</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search invoice or PO number..."
            className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] shadow-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d7676] shadow-xs cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Paid">Paid</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Main Table / Empty State */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredInvoices.length === 0 ? (
          <div className="py-20 px-4 flex flex-col items-center justify-center text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center border border-slate-100 mb-1">
              <FileText className="w-7 h-7 stroke-[1.5]" />
            </div>
            <h3 className="text-xs font-bold text-slate-700">No invoices submitted yet</h3>
            <p className="text-[11px] text-slate-400 font-medium">
              Invoices submitted by {vendorProfile?.companyName || 'your company'} will appear here with live status
            </p>
            <Link
              to="/vendor/invoices/upload"
              className="text-xs font-bold text-[#0d7676] hover:underline pt-2"
            >
              Submit your first invoice →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-4">Invoice #</th>
                  <th className="p-4">PO Number</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Due Date</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                    <td className="p-4 font-bold text-slate-900 font-mono">{inv.invoiceNumber || inv.id}</td>
                    <td className="p-4 text-slate-800 font-mono font-bold">{inv.poNumber}</td>
                    <td className="p-4 text-slate-500">{inv.invoiceDate || inv.createdAt || 'Today'}</td>
                    <td className="p-4 text-slate-500">{inv.paymentDueDate || '30 Days'}</td>
                    <td className="p-4 font-bold text-slate-900 font-mono">
                      {typeof inv.invoiceAmount === 'string' && (inv.invoiceAmount.includes('₹') || inv.invoiceAmount.includes('USD'))
                        ? inv.invoiceAmount
                        : `${inv.currency || '₹'} ${Number(inv.invoiceAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                          inv.status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inv.status === 'Paid'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-teal-100 text-teal-800'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
