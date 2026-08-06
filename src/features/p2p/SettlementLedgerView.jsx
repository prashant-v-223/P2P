import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { ServerPagination } from '../../components/ui/server-pagination';
import { 
  CreditCard, 
  Search, 
  Download
} from 'lucide-react';

export default function SettlementLedgerView() {
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchLedger();
  }, []);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/p2p/settlement-ledger');
      if (res.ok) {
        const json = await res.json();
        if (json.data) setLedger(json.data);
      }
    } catch (e) {
      console.error('Error fetching settlement ledger from MongoDB:', e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = ledger.filter(item => 
    (item.paymentId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.vendorName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.utrNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalDisbursed = ledger.reduce((acc, i) => acc + (i.netAmount || 0), 0);
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedLedger = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="w-full space-y-4 font-sans text-slate-800">
      {/* Clean Toolbar Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0d7676] border border-teal-100 flex items-center justify-center font-semibold">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Central Treasury Payout & Settlement Ledger</h2>
            <p className="text-xs text-slate-500">Single polymorphic ledger of all bank money transfers stored in MongoDB across Advances, Invoices, Freight, and Customs Duty</p>
          </div>
        </div>

        <div className="bg-teal-50 px-3.5 py-1.5 rounded-xl border border-teal-200 text-right">
          <p className="text-[10px] text-[#0d7676] font-bold uppercase tracking-wider">Total Disbursed Net Amount</p>
          <p className="text-lg font-bold text-[#0d7676] font-mono">₹{totalDisbursed.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden w-full flex flex-col">
        <div className="p-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
          <div className="relative w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search UTR, Vendor, Payment ID..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none font-medium text-slate-900"
            />
          </div>
          <button
            onClick={() => alert('Exporting Settlement Ledger CSV...')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-300 transition-colors"
          >
            <Download className="w-4 h-4" /> Export Ledger CSV
          </button>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Payment ID</th>
                <th className="py-3 px-4">Payable Module</th>
                <th className="py-3 px-4">Beneficiary Vendor</th>
                <th className="py-3 px-4 text-center">Payment Mode</th>
                <th className="py-3 px-4 font-mono">Bank UTR Number</th>
                <th className="py-3 px-4 text-right">Gross Amount</th>
                <th className="py-3 px-4 text-right">TDS Ded.</th>
                <th className="py-3 px-4 text-right">Net Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
              {paginatedLedger.map((item) => (
                <tr key={item.paymentId} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                    {item.paymentId}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-teal-50 text-[#0d7676] border border-teal-200">
                      {item.payableType}
                    </span>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{item.referenceNumber}</p>
                  </td>
                  <td className="py-3.5 px-4 font-medium">
                    <p className="font-semibold text-slate-900">{item.vendorName}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{item.vendorId}</p>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {item.paymentMode}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                    {item.utrNumber}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                    ₹{(item.grossAmount || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-rose-600 font-bold">
                    -₹{(item.tdsAmount || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-extrabold text-emerald-700 text-sm">
                    ₹{(item.netAmount || 0).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ServerPagination
          page={currentPage}
          totalPages={totalPages}
          total={filtered.length}
          pageSize={pageSize}
          itemLabel="settlement payments"
          onPageChange={setCurrentPage}
          onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
        />
      </div>
    </div>
  );
}
