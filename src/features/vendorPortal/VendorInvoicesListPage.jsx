import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useVendor } from './vendorContext';
import { FileText, Plus, Search, Filter, Eye, Pencil, Download, CheckCircle, Clock, XCircle } from 'lucide-react';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { ServerPagination } from '../../components/ui/server-pagination';
import { formatCurrency } from '../../utils/formatCurrency';

export default function VendorInvoicesListPage() {
  const { invoices, vendorProfile } = useVendor();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.poNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const paginatedInvoices = filteredInvoices.slice((page - 1) * pageSize, page * pageSize);

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
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold text-xs rounded-xl shadow-xs transition uppercase tracking-wider self-start sm:self-auto cursor-pointer"
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
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            placeholder="Search invoice or PO number..."
            className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0d7676] shadow-xs"
          />
        </div>

        <div className="w-full sm:w-44">
          <SearchableSelect
            options={[
              { label: 'All Statuses', value: 'All' },
              { label: 'Pending', value: 'Pending' },
              { label: 'Approved', value: 'Approved' },
              { label: 'Paid', value: 'Paid' },
              { label: 'Rejected', value: 'Rejected' }
            ]}
            value={statusFilter}
            onChange={(val) => { setStatusFilter(val); setPage(1); }}
            size="sm"
            searchable={false}
          />
        </div>
      </div>

      {/* Main Invoices Table */}
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
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="p-4 whitespace-nowrap">Invoice #</th>
                    <th className="p-4 whitespace-nowrap">PO Number</th>
                    <th className="p-4 whitespace-nowrap">Date</th>
                    <th className="p-4 whitespace-nowrap">Due Date</th>
                    <th className="p-4 whitespace-nowrap">Net Payable Amount</th>
                    <th className="p-4 whitespace-nowrap">Approval Stage</th>
                    <th className="p-4 whitespace-nowrap">Status</th>
                    <th className="p-4 whitespace-nowrap text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {paginatedInvoices.map((inv) => {
                    const invId = inv.id || inv.invoicePaymentId || inv.invoiceNumber;
                    const isEditable = ['pending', 'in progress', 'in_progress', 'draft'].includes(String(inv.status || '').toLowerCase());
                    const displayAmt = inv.netPayableAmount ?? inv.netPayable ?? inv.grossAmount ?? inv.invoiceAmount;
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                        <td className="p-4 font-bold font-mono whitespace-nowrap">
                          <Link
                            to={`/vendor/invoices/view/${encodeURIComponent(invId)}`}
                            className="text-[#0d7676] hover:underline font-bold"
                            title="Click to view full invoice entry"
                          >
                            {inv.invoiceNumber || inv.id}
                          </Link>
                        </td>
                        <td className="p-4 text-slate-800 font-mono font-bold whitespace-nowrap">{inv.poNumber}</td>
                        <td className="p-4 text-slate-500 whitespace-nowrap">{inv.invoiceDate || inv.createdAt || '—'}</td>
                        <td className="p-4 text-slate-500 whitespace-nowrap">{inv.paymentDueDate || '—'}</td>
                        <td className="p-4 font-bold text-slate-900 font-mono whitespace-nowrap">
                          {formatCurrency(displayAmt, inv.currency)}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          {isEditable ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                              Purchase Manager
                            </span>
                          ) : String(inv.status).toLowerCase() === 'approved' ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                              ✓ Approved
                            </span>
                          ) : '—'}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                              String(inv.status).toLowerCase() === 'approved'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : String(inv.status).toLowerCase() === 'paid'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => navigate(`/vendor/invoices/view/${encodeURIComponent(invId)}`)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="View Full Invoice Details"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-500" />
                              <span>View</span>
                            </button>

                            {isEditable && (
                              <button
                                type="button"
                                onClick={() => navigate(`/vendor/invoices/edit/${encodeURIComponent(invId)}`)}
                                className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-[#0d7676] font-extrabold text-[11px] rounded-lg transition-colors border border-teal-200 inline-flex items-center gap-1 cursor-pointer"
                                title="Edit & Update Invoice Details"
                              >
                                <Pencil className="w-3.5 h-3.5 text-[#0d7676]" />
                                <span>Edit</span>
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
            <ServerPagination
              page={page}
              totalPages={Math.ceil(filteredInvoices.length / pageSize) || 1}
              total={filteredInvoices.length}
              pageSize={pageSize}
              itemLabel="invoices"
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </>
        )}
      </div>
    </div>
  );
}
