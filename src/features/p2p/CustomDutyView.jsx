import React, { useState } from 'react';
import { ServerPagination } from '../../components/ui/server-pagination';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function CustomDutyView() {
  const [duties, setDuties] = useState([
    {
      dutyId: 'DUTY-880291',
      blNumber: 'MAEU987456320',
      vesselName: 'MAERSK SEOUL V-204W',
      portCode: 'INMUN1 (Mundra Port)',
      dutyAmount: 1450000,
      icegateRef: 'ICEGATE-9028471',
      status: 'paid',
      utrNumber: 'ICEGATE-UTR-89104',
      paidAt: '2026-07-29'
    },
    {
      dutyId: 'DUTY-880299',
      blNumber: 'COSU630291823',
      vesselName: 'COSCO SHIPPING V-102E',
      portCode: 'INNHAV (Nhava Sheva)',
      dutyAmount: 2180000,
      icegateRef: 'ICEGATE-9029102',
      status: 'pending',
      utrNumber: null,
      paidAt: null
    }
  ]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.ceil(duties.length / pageSize) || 1;
  const paginatedDuties = duties.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="w-full space-y-4 font-sans text-slate-800">
      {/* Clean Toolbar Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0d7676] border border-teal-100 flex items-center justify-center font-semibold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Customs Duty & ICEGATE Settlement</h2>
            <p className="text-xs text-slate-500">Direct ICEGATE customs duty payment execution for imported cargo BL entries</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden w-full flex flex-col">
        <div className="p-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">Customs Duty Payout Records</h3>
          <span className="text-xs font-semibold text-slate-500">{duties.length} Items</span>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Duty ID</th>
                <th className="py-3 px-4">BL Number</th>
                <th className="py-3 px-4">Port Location</th>
                <th className="py-3 px-4 text-right">Duty Amount</th>
                <th className="py-3 px-4 font-mono">ICEGATE Ref</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
              {paginatedDuties.map((item) => (
                <tr key={item.dutyId} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-semibold text-teal-700">{item.dutyId}</td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">{item.blNumber}</td>
                  <td className="py-3.5 px-4 font-medium text-slate-800">{item.portCode}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-sm">₹{item.dutyAmount.toLocaleString('en-IN')}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-700">{item.icegateRef}</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      item.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {item.status === 'pending' ? (
                      <button 
                        onClick={() => setDuties(prev => prev.map(d => d.dutyId === item.dutyId ? { ...d, status: 'paid', utrNumber: 'ICEGATE-UTR-99102' } : d))}
                        className="px-3 py-1.5 rounded-lg bg-[#0d7676] hover:bg-[#0f766e] text-white font-semibold text-xs"
                      >
                        Execute ICEGATE Payout
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-600 flex items-center justify-end gap-1 font-mono">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Paid via ICEGATE
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ServerPagination
          page={currentPage}
          totalPages={totalPages}
          total={duties.length}
          pageSize={pageSize}
          itemLabel="customs duty entries"
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}
