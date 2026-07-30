import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { useConfirm } from '../ui/confirm-dialog';
import GeneratePasswordModal from './GeneratePasswordModal';
import { ServerPagination } from '../ui/server-pagination';
import { Button } from '../ui/button';
import { 
  Plus, 
  Search, 
  Eye, 
  Pencil, 
  KeyRound, 
  Trash2,
  CheckCircle2,
  X,
  Loader2
} from 'lucide-react';

export default function VendorListView() {
  const navigate = useNavigate();
  const confirm = useConfirm();

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [sort, setSort] = useState('newest');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Password Modal State
  const [passModalOpen, setPassModalOpen] = useState(false);
  const [modalVendorName, setModalVendorName] = useState('');
  const [modalPassword, setModalPassword] = useState('');

  // Toast Notification State
  const [toastText, setToastText] = useState('');

  const showToast = (msg) => {
    setToastText(msg);
    setTimeout(() => setToastText(''), 4000);
  };

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/vendors');
      if (res.ok) {
        const data = await res.json();
        setVendors(data.vendors || []);
      }
    } catch (err) {
      console.error('Error fetching vendors list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const handleGeneratePassword = async (vendorId, companyName) => {
    try {
      const res = await apiFetch(`/api/vendors/${vendorId}/generate-password`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setModalVendorName(companyName);
        setModalPassword(data.temporaryPassword);
        setPassModalOpen(true);
      }
    } catch (err) {
      console.error('Error generating password:', err);
    }
  };

  const handleDeleteVendor = async (vendorId, companyName) => {
    const isConfirmed = await confirm({
      title: 'Delete Vendor Account',
      description: `Are you sure you want to delete vendor "${companyName}"? Portal access will be revoked immediately.`,
      confirmLabel: 'Delete Vendor',
      cancelLabel: 'Cancel'
    });

    if (isConfirmed) {
      try {
        const res = await apiFetch(`/api/vendors/${vendorId}`, { method: 'DELETE' });
        if (res.ok) {
          showToast(`Vendor "${companyName}" deleted successfully.`);
          fetchVendors();
        }
      } catch (err) {
        console.error('Error deleting vendor:', err);
      }
    }
  };

  // Filter and Sort Vendors
  const filteredVendors = vendors
    .filter(v => {
      if (!v) return false;
      const companyNameStr = (v.companyName || '').toLowerCase();
      const emailStr = (v.email || '').toLowerCase();
      const sapCodeStr = (v.sapVendorCode || '').toLowerCase();
      const searchLower = (search || '').toLowerCase();

      const matchesType = typeFilter === 'All' || (v.vendorType || '').toUpperCase() === typeFilter;
      const matchesSearch = 
        companyNameStr.includes(searchLower) ||
        emailStr.includes(searchLower) ||
        sapCodeStr.includes(searchLower);

      return matchesType && matchesSearch;
    })
    .sort((a, b) => {
      if (sort === 'name') {
        return (a.companyName || '').localeCompare(b.companyName || '');
      } else if (sort === 'oldest') {
        return (a.id || '').localeCompare(b.id || '');
      }
      return 0; // Default newest order
    });

  const totalPages = Math.ceil(filteredVendors.length / pageSize) || 1;
  const paginatedVendors = filteredVendors.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] min-h-0 w-full flex-col gap-4 overflow-hidden pb-4 font-sans">
      
      {/* Toast Notification */}
      {toastText && (
        <div className="fixed top-5 right-5 z-50 bg-[#0d7676] text-white p-4 rounded-xl shadow-2xl flex items-center gap-3 border border-teal-300 animate-in fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span className="text-xs font-bold">{toastText}</span>
        </div>
      )}

      {/* SINGLE UNIFIED COMPACT CONTROLS BAR (Search + Type Filter + Sort + Page Size + Button) */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto flex-1">
          
          {/* Search Box */}
          <div className="relative min-w-[240px] flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search vendor by name, email or SAP code..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
            {search && (
              <button onClick={() => { setSearch(''); setCurrentPage(1); }} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Type Filter Select */}
          <select 
            value={typeFilter} 
            onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }} 
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d7676]"
          >
            <option value="All">All types</option>
            <option value="DOMESTIC">DOMESTIC</option>
            <option value="IMPORT">IMPORT</option>
          </select>

          {/* Sort Select */}
          <select 
            value={sort} 
            onChange={(e) => setSort(e.target.value)} 
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d7676]"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name A–Z</option>
          </select>

          {/* Page Size Select */}
          <select 
            value={pageSize} 
            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} 
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d7676]"
          >
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
          </select>
        </div>

        {/* Add New Vendor Button */}
        <button
          onClick={() => navigate('/admin/vendors/create')}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#0d7676] rounded-lg hover:bg-[#0a5c5c] transition shadow-xs flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Vendor</span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className="surface-card flex min-h-0 flex-1 flex-col border border-slate-200 rounded-xl bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs flex items-center justify-center gap-2 flex-1">
            <Loader2 className="w-5 h-5 animate-spin text-[#0d7676]" />
            <span>Loading vendor directory...</span>
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs space-y-3 flex-1 flex flex-col items-center justify-center">
            <p className="font-semibold text-slate-700">No vendor records match your search query.</p>
            <Button onClick={() => navigate('/admin/vendors/create')} variant="outline" size="sm" className="text-xs font-bold">
              <Plus className="w-4 h-4 mr-1" /> Add Vendor Account
            </Button>
          </div>
        ) : (
          <div className="report-scroll min-h-0 flex-1 overflow-auto">
            <table className="data-table w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[11px] sticky top-0 z-10">
                <tr>
                  <th className="py-3.5 px-4">#</th>
                  <th className="py-3.5 px-4">VENDOR</th>
                  <th className="py-3.5 px-4">SAP CODE</th>
                  <th className="py-3.5 px-4">CONTACT EMAIL</th>
                  <th className="py-3.5 px-4">TYPE</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedVendors.map((v, index) => (
                  <tr key={v.id || v._id} className="hover:bg-teal-50/20 transition">
                    <td className="w-12 font-semibold tabular-nums text-slate-400 px-4 py-3">
                      {(currentPage - 1) * pageSize + index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-100 text-[#0d7676] font-bold text-xs flex items-center justify-center border border-teal-200 shadow-2xs flex-shrink-0">
                          {(v.companyName?.[0] || 'V').toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block leading-tight">{v.companyName || 'Vendor Record'}</span>
                          {v.contactPerson && <span className="text-[11px] text-slate-400 font-normal">{v.contactPerson}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-[#0d7676]">
                      <span className="bg-teal-50 text-[#0d7676] px-2 py-0.5 rounded-md border border-teal-200 font-mono text-xs">
                        {v.sapVendorCode || 'N/A'}
                      </span>
                    </td>
                    <td className="text-slate-600 font-mono px-4 py-3 text-xs">{v.email || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                        (v.vendorType || '').toUpperCase() === 'IMPORT' 
                          ? 'bg-amber-50 text-amber-800 border-amber-200' 
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {v.vendorType || 'DOMESTIC'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {v.status || 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => navigate(`/admin/vendors/${v.id || v._id}`)} 
                          title="View Vendor Details"
                          className="hover:bg-teal-50 hover:text-[#0d7676]"
                        >
                          <Eye className="w-4 h-4 text-slate-500 hover:text-[#0d7676]" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => navigate(`/admin/vendors/${v.id || v._id}/edit`)} 
                          title="Edit Vendor Account"
                          className="hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Pencil className="w-4 h-4 text-slate-500 hover:text-slate-900" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleGeneratePassword(v.id || v._id, v.companyName || 'Vendor')} 
                          title="Generate Temporary Password"
                          className="hover:bg-amber-50 hover:text-amber-700"
                        >
                          <KeyRound className="w-4 h-4 text-amber-600" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteVendor(v.id || v._id, v.companyName || 'Vendor')} 
                          title="Delete Vendor Account"
                          className="hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4 text-rose-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Server Pagination Footer Component (Identical to User Directory) */}
      <ServerPagination
        page={currentPage}
        totalPages={totalPages}
        total={filteredVendors.length}
        pageSize={pageSize}
        itemLabel="vendors"
        onPageChange={(nextPage) => setCurrentPage(nextPage)}
      />

      {/* Password Generator Modal */}
      <GeneratePasswordModal
        isOpen={passModalOpen}
        onClose={() => setPassModalOpen(false)}
        vendorName={modalVendorName}
        password={modalPassword}
      />

    </div>
  );
}
