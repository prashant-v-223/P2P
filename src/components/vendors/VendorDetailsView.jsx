import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { useConfirm } from '../ui/confirm-dialog';
import GeneratePasswordModal from './GeneratePasswordModal';
import RecordDbInfoDrawer from '../common/RecordDbInfoDrawer';
import UniversalApprovalWorkflowCard from '../common/UniversalApprovalWorkflowCard';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { 
  Building2, 
  Pencil, 
  KeyRound, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle,
  ArrowLeft,
  ShoppingBag,
  CreditCard,
  FileText,
  CheckCheck,
  Mail,
  Phone,
  User,
  ShieldCheck,
  Lock,
  Globe
} from 'lucide-react';

import { ServerPagination } from '../ui/server-pagination';

export default function VendorDetailsView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [poPage, setPoPage] = useState(1);
  const [poPageSize, setPoPageSize] = useState(5);

  // Password Modal State
  const [passModalOpen, setPassModalOpen] = useState(false);
  const [modalPassword, setModalPassword] = useState('');

  const fetchVendorDetails = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/vendors/${id}`);
      if (res.ok) {
        const data = await res.json();
        setVendor(data.vendor);
      }
    } catch (err) {
      console.error('Error fetching vendor details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendorDetails();
  }, [id]);

  const handleGeneratePassword = async () => {
    try {
      setActionLoading(true);
      const res = await apiFetch(`/api/vendors/${vendor?.id || id}/generate-password`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setModalPassword(data.temporaryPassword);
        setPassModalOpen(true);
      } else {
        setToastMessage(data.error || 'Failed to generate password. Please try again.');
        setTimeout(() => setToastMessage(''), 4000);
      }
    } catch (err) {
      console.error('Error generating password:', err);
      setToastMessage('Network error — could not generate password.');
      setTimeout(() => setToastMessage(''), 4000);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteVendor = async () => {
    const isConfirmed = await confirm({
      title: 'Delete Vendor Account',
      description: `Are you sure you want to delete vendor "${vendor?.companyName}"? Portal access will be revoked immediately.`,
      confirmLabel: 'Delete Vendor',
      cancelLabel: 'Cancel'
    });

    if (isConfirmed) {
      try {
        setActionLoading(true);
        const res = await apiFetch(`/api/vendors/${vendor?.id || id}`, { method: 'DELETE' });
        if (res.ok) {
          navigate('/management/vendors');
        }
      } catch (err) {
        console.error('Error deleting vendor:', err);
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleTogglePortalAccess = async () => {
    try {
      setActionLoading(true);
      const updatedStatus = !vendor.portalAccessEnabled;
      const res = await apiFetch(`/api/vendors/${vendor?.id || id}`, {
        method: 'PUT',
        body: JSON.stringify({ portalAccessEnabled: updatedStatus })
      });
      if (res.ok) {
        setVendor(prev => ({ ...prev, portalAccessEnabled: updatedStatus }));
        setToastMessage(`Portal access ${updatedStatus ? 'enabled' : 'deactivated'} successfully.`);
        setTimeout(() => setToastMessage(''), 3500);
      }
    } catch (err) {
      console.error('Error toggling portal access:', err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-slate-400 text-xs font-semibold">Loading vendor profile details...</div>;
  }

  if (!vendor) {
    return <div className="py-16 text-center text-slate-500 text-xs font-semibold">Vendor record not found.</div>;
  }

  return (
    <div className="space-y-6 w-full max-w-full pb-16 font-sans">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#0d7676] text-white p-4 rounded-xl shadow-2xl flex items-center gap-3 border border-teal-300 animate-in fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Top Header Banner Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/management/vendors" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-[#0d7676] font-extrabold text-xl flex items-center justify-center border border-teal-200 shadow-2xs flex-shrink-0">
            {(vendor.companyName?.[0] || 'V').toUpperCase()}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">{vendor.companyName}</h1>
              <span className="bg-teal-50 text-[#0d7676] text-[10px] font-bold px-2 py-0.5 rounded border border-teal-200 uppercase">
                {vendor.category || 'Manufacturing'}
              </span>
              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200 uppercase">
                {vendor.status || 'Active'}
              </span>
              <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 uppercase">
                {vendor.vendorType || 'Domestic'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              SAP Vendor Code: <span className="font-mono font-bold text-[#0d7676]">{vendor.sapVendorCode}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <RecordDbInfoDrawer entityId={vendor?.id || vendor?.sapVendorCode || id} entityType="Vendor" recordData={vendor} />
          <Button variant="outline" size="sm" onClick={() => navigate(`/admin/vendors/${vendor.id || id}/edit`)} className="text-xs font-bold">
            <Pencil className="w-3.5 h-3.5 mr-1" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={handleGeneratePassword} loading={actionLoading} className="border-amber-300 text-amber-800 hover:bg-amber-50 text-xs font-bold">
            <KeyRound className="w-3.5 h-3.5 text-amber-600 mr-1" />
            Generate Password
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDeleteVendor} loading={actionLoading} className="text-xs font-bold">
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Deactivate
          </Button>
        </div>
      </div>

      {/* Universal Dynamic Approval Workflow Stepper Component */}
      <UniversalApprovalWorkflowCard
        referenceId={vendor.sapVendorCode || vendor.id || id}
        recordType="Vendor Account"
        vendorName={vendor.companyName}
        amountFormatted={vendor.sapVendorCode ? `Code: ${vendor.sapVendorCode}` : ''}
        poRef={vendor.sapVendorCode}
        onStatusChange={fetchVendorDetails}
      />

      {/* 4 Summary Stat Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-[#0d7676] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold">Purchase Orders</span>
            <ShoppingBag className="w-4 h-4 text-[#0d7676]" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{vendor.purchaseOrdersCount || 0}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-amber-500 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold">Advance Payments</span>
            <CreditCard className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{vendor.advancePaymentsCount || 0}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-blue-500 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold">Total Invoices</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{vendor.totalInvoicesCount || 0}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-emerald-500 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold">Invoices Paid</span>
            <CheckCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{vendor.invoicesPaidCount || 0}</p>
        </Card>
      </div>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT COLUMN: Company Details & Financial Tables */}
        <div className="lg:col-span-2 space-y-6">

          {/* Company Details Card */}
          <Card className="border-slate-200">
            <CardHeader className="p-5 border-b border-slate-100">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#0d7676]" />
                Company Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1 flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" /> Contact Person
                </span>
                <span className="font-bold text-slate-900">{vendor.contactPerson || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" /> Phone
                </span>
                <span className="font-bold text-[#0d7676]">{vendor.phone || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-slate-400" /> Email
                </span>
                <span className="font-bold text-slate-900 font-mono text-[11px]">{vendor.email || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">GSTIN</span>
                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border">{vendor.gstin || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">PAN</span>
                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border">{vendor.pan || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">Vendor Type</span>
                <span className="font-bold text-slate-900">{vendor.vendorType || 'DOMESTIC'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">Payment Terms</span>
                <span className="font-bold text-slate-900">{vendor.paymentTerms || '30 Days'}</span>
              </div>
            </CardContent>
          </Card>

          {/* Bank Details Card */}
          <Card className="border-slate-200">
            <CardHeader className="p-5 border-b border-slate-100">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#0d7676]" />
                Bank Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-4 gap-6 text-xs">
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">Bank Name</span>
                <span className="font-bold text-slate-900">{vendor.bankName || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">Branch</span>
                <span className="font-bold text-slate-900">{vendor.branch || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">Account No</span>
                <span className="font-mono font-bold text-slate-900">{vendor.accountNumber || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">IFSC Code</span>
                <span className="font-mono font-bold text-slate-900">{vendor.ifscCode || '—'}</span>
              </div>
            </CardContent>
          </Card>

          {/* Recent Purchase Orders Table */}
          <Card className="border-slate-200">
            <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold">Recent Purchase Orders</CardTitle>
              <Badge variant="outline">{vendor.recentPOs?.length || 0} Records</Badge>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {vendor.recentPOs?.length > 0 ? (
                <>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-6">PO NUMBER</th>
                        <th className="py-3 px-6">DATE</th>
                        <th className="py-3 px-6">TYPE</th>
                        <th className="py-3 px-6">AMOUNT</th>
                        <th className="py-3 px-6">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {vendor.recentPOs.slice((poPage - 1) * poPageSize, poPage * poPageSize).map((po, idx) => (
                        <tr key={idx} className="hover:bg-teal-50/30 transition">
                          <td className="py-3.5 px-6 font-bold text-[#0d7676] font-mono">{po.poNumber}</td>
                          <td className="py-3.5 px-6 text-slate-600">{po.date}</td>
                          <td className="py-3.5 px-6">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                              {po.type}
                            </span>
                          </td>
                          <td className="py-3.5 px-6 font-mono font-bold text-slate-900">{po.amount}</td>
                          <td className="py-3.5 px-6">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                              {po.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <ServerPagination
                    page={poPage}
                    totalPages={Math.ceil((vendor.recentPOs?.length || 0) / poPageSize) || 1}
                    total={vendor.recentPOs?.length || 0}
                    pageSize={poPageSize}
                    onPageChange={(p) => setPoPage(p)}
                    onPageSizeChange={(s) => { setPoPageSize(s); setPoPage(1); }}
                    pageSizeOptions={[5, 10, 20]}
                  />
                </>
              ) : (
                <div className="py-10 text-center text-slate-400 text-xs font-semibold">
                  No purchase order records available yet.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Payments Card */}
          <Card className="border-slate-200">
            <CardHeader className="p-5 border-b border-slate-100">
              <CardTitle className="text-sm font-bold">Recent Payments</CardTitle>
            </CardHeader>
            <CardContent className="p-10 text-center text-slate-400 text-xs font-semibold">
              No payment records available yet.
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Portal Access & Danger Zone */}
        <div className="space-y-6">

          {/* Portal Access Card */}
          <Card className="border-slate-200">
            <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0d7676]" />
                Portal Access
              </CardTitle>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                vendor.portalAccessEnabled 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                {vendor.portalAccessEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-1">
                <p className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Portal Access Active
                </p>
                <p className="text-[11px] text-emerald-700">Vendor can log in to submit invoices & track status.</p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Login URL</span>
                  <div className="relative">
                    <Globe className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      readOnly
                      value={vendor.loginUrl || '/vendor/login'}
                      className="w-full pl-8 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Login Email</span>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      readOnly
                      value={vendor.email || 'vendor@rayzonsolar.one'}
                      className="w-full pl-8 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Button 
                    onClick={handleTogglePortalAccess} 
                    loading={actionLoading}
                    variant={vendor.portalAccessEnabled ? "destructive" : "emerald"}
                    className="w-full text-xs font-bold"
                  >
                    {vendor.portalAccessEnabled ? 'Deactivate Access' : 'Enable Access'}
                  </Button>

                  <Button 
                    onClick={handleGeneratePassword} 
                    loading={actionLoading}
                    variant="outline" 
                    className="w-full text-xs font-bold border-amber-300 text-amber-800 hover:bg-amber-50"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-600 mr-1" />
                    Generate New Password
                  </Button>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-500 font-medium">
                  <div className="flex justify-between">
                    <span>Account Created</span>
                    <span className="font-bold text-slate-800">29 Jul 2026</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Updated</span>
                    <span className="font-bold text-slate-800">29 Jul 2026</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Account ID</span>
                    <span className="font-mono font-bold text-[#0d7676]">#{vendor.id || id}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone Card */}
          <Card className="border-rose-200 bg-rose-50/20">
            <CardHeader className="p-5 border-b border-rose-100">
              <CardTitle className="text-sm font-bold text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Deleting this vendor will remove their portal access. Historical data is preserved.
              </p>
              <Button 
                onClick={handleDeleteVendor} 
                loading={actionLoading}
                variant="outline" 
                className="w-full text-xs text-rose-600 border-rose-300 hover:bg-rose-100 font-bold"
              >
                Delete Vendor Account
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Password Generator Modal */}
      <GeneratePasswordModal
        isOpen={passModalOpen}
        onClose={() => setPassModalOpen(false)}
        vendorName={vendor?.companyName}
        password={modalPassword}
      />

    </div>
  );
}
