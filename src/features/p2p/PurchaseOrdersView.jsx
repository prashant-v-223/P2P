import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { ServerPagination } from '../../components/ui/server-pagination';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { CustomInput } from '../../components/ui/custom-input';
import { formatCurrency } from '../../utils/formatCurrency';
import { SortableHeader, useUrlSorting } from '../../components/ui/sortable-header';
import { TableActionButton } from '../../components/ui/table-action-button';
import { exportPurchaseOrdersCsv } from '../../utils/exportCsv';
import { 
  Search, 
  Eye, 
  ChevronRight, 
  Loader2,
  FileText,
  Plus,
  Download,
  CheckCircle2,
  Clock
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
  const { sortBy, sortOrder, onSort } = useUrlSorting(searchParams, setSearchParams);

  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(pageSizeParam);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchPOs();
  }, [currentPage, searchTerm, typeFilter, statusFilter, pageSize, sortBy, sortOrder]);

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
        status: statusFilter,
        sortBy,
        sortOrder
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
            poDate: item.documentDate || item.createdAt ? new Date(item.documentDate || item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
            dueDate: item.dueDate || item.deliveryDate || item.paymentDueDate
              ? new Date(item.dueDate || item.deliveryDate || item.paymentDueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : '—',
            type: (item.poNumber || '').startsWith('PO-43') || (item.poNumber || '').startsWith('60') ? 'Import' : 'Domestic',
            poValue: item.totalAmount || 0,
            paidAmount: Number(item.paidAdvanceAmount) || 0,
            inApprovalAmount: Number(item.inApprovalAdvanceAmount || item.advanceCommitted || item.approvedAdvanceAmount) || 0,
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
        <button type="button" onClick={() => exportPurchaseOrdersCsv(pos)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* PO Table Container with Max Height & Scrolling */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden w-full flex flex-col max-h-[calc(100vh-210px)] min-h-[320px]">
        <div className="overflow-auto w-full flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 sticky top-0 z-10 text-slate-400 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-200 backdrop-blur-xs">
              <tr>
                <th className="py-3.5 px-4 text-center">#</th>
                <SortableHeader sortKey="poNumber" activeKey={sortBy} direction={sortOrder} onSort={onSort} className="py-3.5 px-4">PO NUMBER</SortableHeader>
                <SortableHeader sortKey="supplierName" activeKey={sortBy} direction={sortOrder} onSort={onSort} className="py-3.5 px-4">VENDOR</SortableHeader>
                <SortableHeader sortKey="documentDate" activeKey={sortBy} direction={sortOrder} onSort={onSort} className="py-3.5 px-4">PO DATE</SortableHeader>
                <SortableHeader sortKey="dueDate" activeKey={sortBy} direction={sortOrder} onSort={onSort} className="py-3.5 px-4 whitespace-nowrap">DUE DATE</SortableHeader>
                <th className="py-3.5 px-4 text-center">TYPE</th>
                <SortableHeader sortKey="totalAmount" activeKey={sortBy} direction={sortOrder} onSort={onSort} className="py-3.5 px-4 text-right">PO VALUE</SortableHeader>
                <th className="py-3.5 px-4 text-center">ADVANCE PAID</th>
                <SortableHeader sortKey="status" activeKey={sortBy} direction={sortOrder} onSort={onSort} className="py-3.5 px-4 text-center">STATUS</SortableHeader>
                <th className="py-3.5 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="10" className="py-16 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 text-[#0d7676] animate-spin" />
                      <p>Loading purchase orders...</p>
                    </div>
                  </td>
                </tr>
              ) : pos.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-16 text-center text-slate-400 font-medium">
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

                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {po.poDate}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {po.dueDate}
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

                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap">
                        {formatCurrency(po.poValue, po.currency)}
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono">
                        {po.paidAmount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap shadow-2xs">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            {formatCurrency(po.paidAmount, po.currency)} (Paid)
                          </span>
                        ) : po.inApprovalAmount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap shadow-2xs">
                            <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                            {formatCurrency(po.inApprovalAmount, po.currency)} (In Approval)
                          </span>
                        ) : (
                          <span className="text-slate-300 font-mono">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          String(po.status || '').toLowerCase() === 'closed'
                            ? 'bg-slate-100 text-slate-600 border-slate-300'
                            : String(po.status || '').toLowerCase() === 'completed'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            String(po.status || '').toLowerCase() === 'closed'
                              ? 'bg-slate-400'
                              : String(po.status || '').toLowerCase() === 'completed'
                              ? 'bg-purple-500'
                              : 'bg-emerald-500'
                          }`} />
                          {po.status || 'Open'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <TableActionButton
                            onClick={() => navigate(`/p2p/purchase-orders/${po.poNumber}`)}
                            title="View PO Details"
                            icon={Eye}
                            variant="view"
                          />
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
