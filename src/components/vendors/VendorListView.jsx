import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { useConfirm } from '../ui/confirm-dialog';
import GeneratePasswordModal from './GeneratePasswordModal';
import { ServerPagination } from '../ui/server-pagination';
import { SearchableSelect } from '../ui/searchable-select';
import { CustomInput } from '../ui/custom-input';
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
  Loader2,
  User
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
  const [selectedVendorForPass, setSelectedVendorForPass] = useState(null);
  const [genPwdLoading, setGenPwdLoading] = useState(false);

  // Toast Notification State
  const [toastText, setToastText] = useState('');

  const showToast = (msg) => {
    setToastText(msg);
    setTimeout(() => setToastText(''), 4000);
  };

  const [usersMap, setUsersMap] = useState({});

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const [vendorsRes, usersRes] = await Promise.all([
        apiFetch('/api/vendors').catch(() => null),
        apiFetch('/api/users?size=200').catch(() => null)
      ]);

      if (usersRes && usersRes.ok) {
        const uData = await usersRes.json();
        const uList = uData.users || uData.data || (Array.isArray(uData) ? uData : []);
        const uMap = {};
        uList.forEach(u => {
          if (u.id) uMap[u.id] = u;
          if (u._id) uMap[u._id] = u;
          if (u.email) uMap[u.email.toLowerCase()] = u;
        });
        setUsersMap(uMap);
      }

      if (vendorsRes && vendorsRes.ok) {
        const data = await vendorsRes.json();
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

  const handleOpenPasswordModal = (vendor) => {
    setSelectedVendorForPass(vendor);
    setModalVendorName(vendor.companyName);
    setModalPassword('');
    setPassModalOpen(true);
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
        } else {
          const errData = await res.json().catch(() => ({}));
          showToast(errData.error || 'Failed to delete vendor.');
        }
      } catch (err) {
        console.error('Error deleting vendor:', err);
        showToast('Network error — could not delete vendor.');
      }
    }
  };

  // Derive all available vendor types (standard list + dynamic types present in dataset)
  const standardTypes = ['DOMESTIC', 'IMPORT', 'FREIGHT FORWARDER','SHIPPING LINE', 'OTHER'];
  const datasetTypes = Array.from(new Set(vendors.map(v => (v.vendorType || '').toUpperCase()).filter(Boolean)));
  const allTypesList = Array.from(new Set([...standardTypes, ...datasetTypes]));

  const typeFilterOptions = [
    { label: 'All types', value: 'All' },
    ...allTypesList.map(t => ({ label: t, value: t }))
  ];

  // Client-side filtering & sorting
  const filteredVendors = vendors
    .filter(v => {
      const query = search.toLowerCase();
      const matchesSearch = 
        !search ||
        (v.companyName || '').toLowerCase().includes(query) ||
        (v.email || '').toLowerCase().includes(query) ||
        (v.sapVendorCode || '').toLowerCase().includes(query) ||
        (v.assignedPurchaseManager || '').toLowerCase().includes(query) ||
        (v.buyerName || '').toLowerCase().includes(query) ||
        (v.createdBy || '').toLowerCase().includes(query);

      const matchesType = 
        typeFilter === 'All' || 
        (v.vendorType || 'DOMESTIC').toUpperCase() === typeFilter.toUpperCase();

      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      if (sort === 'newest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      if (sort === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      if (sort === 'name') return (a.companyName || '').localeCompare(b.companyName || '');
      return 0;
    });

  // Client-side pagination slicing
  const totalVendors = filteredVendors.length;
  const totalPages = Math.ceil(totalVendors / pageSize) || 1;
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
          <div className="min-w-[240px] flex-1">
            <CustomInput
              type="text"
              placeholder="Search vendor by name, email or SAP code..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              onClear={() => { setSearch(''); setCurrentPage(1); }}
              leftIcon={Search}
              clearable={true}
              size="sm"
            />
          </div>

          {/* Type Filter Select */}
          <div className="w-48">
            <SearchableSelect
              options={typeFilterOptions}
              value={typeFilter}
              onChange={(val) => { setTypeFilter(val); setCurrentPage(1); }}
              size="sm"
              searchable={false}
            />
          </div>

          {/* Sort Select */}
          <div className="w-36">
            <SearchableSelect
              options={[
                { label: 'Newest first', value: 'newest' },
                { label: 'Oldest first', value: 'oldest' },
                { label: 'Name A–Z', value: 'name' }
              ]}
              value={sort}
              onChange={(val) => setSort(val)}
              size="sm"
              searchable={false}
            />
          </div>

          {/* Page Size Select */}
          <div className="w-32">
            <SearchableSelect
              options={[
                { label: '10 per page', value: 10 },
                { label: '20 per page', value: 20 },
                { label: '50 per page', value: 50 }
              ]}
              value={pageSize}
              onChange={(val) => { setPageSize(Number(val)); setCurrentPage(1); }}
              size="sm"
              searchable={false}
            />
          </div>
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
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider sticky top-0 z-10 select-none">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3 min-w-[200px]">VENDOR</th>
                  <th className="py-3 px-3 whitespace-nowrap min-w-[210px]">LINKED USER</th>
                  <th className="py-3 px-3 whitespace-nowrap">SAP CODE</th>
                  <th className="py-3 px-3 whitespace-nowrap">CONTACT EMAIL</th>
                  <th className="py-3 px-3 whitespace-nowrap">TYPE</th>
                  <th className="py-3 px-3 whitespace-nowrap">STATUS</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedVendors.map((v, index) => (
                  <tr key={v.id || v._id} className="hover:bg-teal-50/20 transition">
                    <td className="w-10 font-semibold tabular-nums text-slate-400 px-3 py-2.5 text-center">
                      {(currentPage - 1) * pageSize + index + 1}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-teal-100 text-[#0d7676] font-bold text-xs flex items-center justify-center border border-teal-200 shadow-2xs flex-shrink-0">
                          {(v.companyName?.[0] || 'V').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 block leading-tight truncate">{v.companyName || 'Vendor Record'}</span>
                          {v.contactPerson && <span className="text-[11px] text-slate-400 font-normal block leading-tight">{v.contactPerson}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {(() => {
                        const linkedUser = usersMap[v.assignedPurchaseManagerId] || usersMap[v.buyerId] || (usersMap[v.userId]?.role !== 'vendor' ? usersMap[v.userId] : null);
                        const linkedName = v.linkedUserName || linkedUser?.name || v.assignedPurchaseManager || v.buyerName || 'Procurement Team';
                        const linkedSub = v.linkedUserEmail || linkedUser?.email || (v.assignedPurchaseManagerId ? `ID: ${v.assignedPurchaseManagerId}` : 'Internal User');

                        return (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-teal-50 text-[#0d7676] text-[10px] font-extrabold flex items-center justify-center border border-teal-200 shrink-0 shadow-2xs">
                              {linkedName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-800 text-xs block leading-tight whitespace-nowrap" title={linkedName}>
                                {linkedName}
                              </span>
                              <span className="text-[10.5px] font-mono text-slate-500 font-medium block whitespace-nowrap" title={linkedSub}>
                                {linkedSub}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold text-[#0d7676] whitespace-nowrap">
                      <span className="bg-teal-50 text-[#0d7676] px-2 py-0.5 rounded-md border border-teal-200 font-mono text-xs">
                        {v.sapVendorCode || 'N/A'}
                      </span>
                    </td>
                    <td className="text-slate-600 font-mono px-3 py-2.5 text-xs whitespace-nowrap">{v.email || 'N/A'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border whitespace-nowrap inline-block ${
                        (v.vendorType || '').toUpperCase() === 'IMPORT' 
                          ? 'bg-amber-50 text-amber-800 border-amber-200' 
                          : (v.vendorType || '').toUpperCase() === 'FREIGHT FORWARDER'
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {v.vendorType || 'DOMESTIC'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {v.status || 'Active'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => navigate(`/admin/vendors/${v.id || v._id}`)} 
                          title="View Vendor Details"
                          className="h-7 w-7 hover:bg-teal-50 hover:text-[#0d7676]"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500 hover:text-[#0d7676]" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => navigate(`/admin/vendors/${v.id || v._id}/edit`)} 
                          title="Edit Vendor Account"
                          className="h-7 w-7 hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Pencil className="w-3.5 h-3.5 text-slate-500 hover:text-slate-900" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleOpenPasswordModal(v)} 
                          title="Manage Supplier Password"
                          className="h-7 w-7 hover:bg-amber-50 hover:text-amber-700 cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteVendor(v.id || v._id, v.companyName || 'Vendor')} 
                          title="Delete Vendor Account"
                          className="h-7 w-7 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
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
        vendorId={selectedVendorForPass?.id || selectedVendorForPass?._id}
        sapVendorCode={selectedVendorForPass?.sapVendorCode}
        vendorName={selectedVendorForPass?.companyName || modalVendorName}
        initialPassword={modalPassword}
      />

    </div>
  );
}
