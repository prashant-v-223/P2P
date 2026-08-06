import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { ServerPagination } from '../../components/ui/server-pagination';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { CustomInput } from '../../components/ui/custom-input';
import { 
  Search, 
  Eye, 
  ChevronRight, 
  Loader2,
  FileText,
  Plus
} from 'lucide-react';

const getInitials = (name) => {
  if (!name) return 'PO';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

export default function PurchaseOrdersView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read state directly from URL search params
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const searchTerm = searchParams.get('q') || '';
  const typeFilter = searchParams.get('type') || 'All Types';
  const statusFilter = searchParams.get('status') || 'All Status';
  const pageSizeParam = parseInt(searchParams.get('pageSize') || '10', 10);

  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(pageSizeParam);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchPOs();
  }, [currentPage, searchTerm, typeFilter, statusFilter, pageSize]);

  const updateUrlParams = (newParams) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([k, v]) => {
      if (v && v !== 'All Status' && v !== 'All Types' && v !== 'All') {
        params.set(k, v);
      } else {
        params.delete(k);
      }
    });
    setSearchParams(params);
  };

  const fetchPOs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        size: pageSize,
        q: searchTerm,
        type: typeFilter,
        status: statusFilter
      });

      const res = await apiFetch(`/api/p2p/purchase-orders?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          const mapped = json.data.map((item, idx) => ({
            id: (currentPage - 1) * pageSize + idx + 1,
            poNumber: item.sapPoNumber || item.poNumber,
            vendorName: item.supplierName || 'Vendor',
            vendorCode: item.supplierId || '100001',
            poDate: item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '30 Jul 2026',
            type: (item.poNumber || '').startsWith('PO-43') || (item.poNumber || '').startsWith('60') ? 'Import' : 'Domestic',
            poValue: item.totalAmount || 0,
            currency: item.currency || 'INR',
            advancePaid: item.advancePaid || null,
            status: item.status === 'open' ? 'Open' : item.status || 'Open'
          }));
          setPos(mapped);
          setTotalCount(json.total || mapped.length);
          setTotalPages(json.totalPages || 1);
        }
      }
    } catch (e) {
      console.error('Error fetching POs from backend:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    updateUrlParams({ q: e.target.value, page: '1' });
  };

  const handleTypeChange = (e) => {
    updateUrlParams({ type: e.target.value, page: '1' });
  };

  const handleStatusChange = (e) => {
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

  return (
    <div className="space-y-3 font-sans text-left pb-10 flex flex-col min-h-0">
      {/* SINGLE UNIFIED CONTROL BAR (Search + Type + Status + Page Size + Action Button) */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="min-w-[240px] flex-1">
            <CustomInput
              type="text"
              placeholder="Search PO number, vendor..."
              value={searchTerm}
              onChange={handleSearchChange}
              onClear={() => handleSearchChange({ target: { value: '' } })}
              leftIcon={Search}
              clearable={true}
              size="sm"
            />
          </div>

          <div className="w-32">
            <SearchableSelect
              options={[
                { label: 'All Types', value: 'All Types' },
                { label: 'Domestic', value: 'Domestic' },
                { label: 'Import', value: 'Import' }
              ]}
              value={typeFilter}
              onChange={(val) => updateUrlParams({ type: val, page: '1' })}
              size="sm"
              searchable={false}
            />
          </div>

          <div className="w-32">
            <SearchableSelect
              options={[
                { label: 'All Status', value: 'All Status' },
                { label: 'Open', value: 'Open' },
                { label: 'Closed', value: 'Closed' }
              ]}
              value={statusFilter}
              onChange={(val) => updateUrlParams({ status: val, page: '1' })}
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
              onChange={(val) => { setPageSize(Number(val)); updateUrlParams({ pageSize: String(val), page: '1' }); }}
              size="sm"
              searchable={false}
            />
          </div>
        </div>

        <Link
          to="/p2p/advance-payments/create"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold text-xs rounded-lg shadow-2xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> Raise Advance Request
        </Link>
      </div>

      {/* PO Table Container with Max Height & Scrolling */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden w-full flex flex-col max-h-[calc(100vh-210px)] min-h-[320px]">
        <div className="overflow-auto w-full flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 sticky top-0 z-10 text-slate-400 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-200 backdrop-blur-xs">
              <tr>
                <th className="py-3.5 px-4 text-center">#</th>
                <th className="py-3.5 px-4">PO NUMBER</th>
                <th className="py-3.5 px-4">VENDOR</th>
                <th className="py-3.5 px-4">PO DATE</th>
                <th className="py-3.5 px-4 text-center">TYPE</th>
                <th className="py-3.5 px-4 text-right">PO VALUE</th>
                <th className="py-3.5 px-4 text-center">ADVANCE PAID</th>
                <th className="py-3.5 px-4 text-center">STATUS</th>
                <th className="py-3.5 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-16 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 text-[#0d7676] animate-spin" />
                      <p>Loading purchase orders...</p>
                    </div>
                  </td>
                </tr>
              ) : pos.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-16 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <FileText className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-700">No purchase order records found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                pos.map((po) => {
                  const avatarInitials = getInitials(po.vendorName);
                  const isImport = po.type === 'Import';

                  return (
                    <tr key={po.poNumber} className="hover:bg-slate-50/70 transition-colors text-xs">
                      <td className="py-3.5 px-4 text-center text-slate-400 font-semibold tabular-nums">
                        {po.id}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-extrabold text-slate-900">
                        <Link
                          to={`/p2p/purchase-orders/${po.poNumber}`}
                          className="hover:text-teal-700 transition-colors"
                        >
                          {po.poNumber}
                        </Link>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-teal-50 border border-teal-200 text-[#0d7676] text-[10px] font-extrabold flex items-center justify-center shrink-0">
                            {avatarInitials}
                          </div>
                          <div className="truncate">
                            <div className="font-bold text-slate-900 truncate">{po.vendorName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{po.vendorCode}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                        {po.poDate}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          isImport
                            ? 'bg-purple-50 text-purple-700 border-purple-200' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isImport ? 'bg-purple-500' : 'bg-emerald-500'}`} />
                          {po.type}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-slate-900">
                        {po.poValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {po.currency}
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono text-slate-500">
                        {po.advancePaid ? (
                          <span className="text-emerald-700 font-bold">
                            {po.advancePaid.toLocaleString('en-IN')} INR
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {po.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => navigate(`/p2p/purchase-orders/${po.poNumber}`)}
                            title="View PO Details"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => navigate(`/p2p/advance-payments/create?poId=${po.poNumber}`)}
                            className="px-2.5 py-1 rounded-lg bg-[#0d7676] hover:bg-[#0f766e] text-white text-[11px] font-bold shadow-2xs transition-colors flex items-center gap-1"
                          >
                            Pay <ChevronRight className="w-3 h-3" />
                          </button>
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
          itemLabel="purchase orders"
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}
