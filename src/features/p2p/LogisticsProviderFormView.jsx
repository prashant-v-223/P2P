import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Building2, ArrowLeft, Loader2, Info, Landmark } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';
import { SearchableSelect } from '../../components/ui/searchable-select';

export default function LogisticsProviderFormView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    companyName: '',
    contactPerson: '',
    phone: '',
    email: '',
    status: 'Active',
    serviceType: 'Freight Forwarder',
    gstin: '',
    pan: '',
    bankName: '',
    bankBranch: '',
    accountNumber: '',
    ifscCode: ''
  });

  useEffect(() => {
    if (isEdit && id) {
      async function loadProvider() {
        try {
          setLoading(true);
          const res = await apiFetch(`/api/p2p/logistics-providers/${id}`);
          if (res.ok) {
            const data = await res.json();
            const provider = data.provider;
            if (provider) {
              setForm({
                companyName: provider.name || provider.companyName || '',
                contactPerson: provider.contactPerson || '',
                phone: provider.phone || '',
                email: provider.email || '',
                status: provider.status || 'Active',
                serviceType: provider.serviceType || 'Freight Forwarder',
                gstin: provider.gstin || '',
                pan: provider.pan || '',
                bankName: provider.bankName || '',
                bankBranch: provider.bankBranch || provider.branch || '',
                accountNumber: provider.accountNumber || '',
                ifscCode: provider.ifscCode || ''
              });
            }
          }
        } catch (err) {
          console.error('Error loading provider:', err);
        } finally {
          setLoading(false);
        }
      }
      loadProvider();
    }
  }, [id, isEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.companyName.trim()) {
      showToast({ title: 'Validation Error', description: 'Company Name is required.', type: 'error' });
      return;
    }

    try {
      setSaving(true);
      const url = isEdit ? `/api/p2p/logistics-providers/${id}` : '/api/p2p/logistics-providers';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        ...form,
        name: form.companyName
      };

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast({
          title: 'Success',
          description: isEdit ? 'Logistics Provider updated.' : 'Logistics Provider created.',
          type: 'success'
        });
        if (window.history.length > 2) {
          navigate(-1);
        } else {
          navigate('/management/logistics-providers');
        }
      } else {
        showToast({ title: 'Error', description: json.error || 'Failed to save provider.', type: 'error' });
      }
    } catch (err) {
      showToast({ title: 'Error', description: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 font-sans">
        <Loader2 className="w-8 h-8 text-[#0d7676] animate-spin mr-3" />
        <span className="text-sm font-semibold text-slate-600">Loading logistics provider data...</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5 font-sans pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <button onClick={() => navigate(-1)} className="hover:text-slate-700 flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Logistics Providers
        </button>
        <span>/</span>
        <span className="text-slate-700 font-bold">{isEdit ? 'Edit Provider' : 'Create Provider'}</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Section 1: Provider Details matching Screenshot 3 */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-4 h-4 text-[#0d7676]" /> Provider Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                placeholder="Enter logistics provider company name"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Contact Person</label>
              <input
                type="text"
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                placeholder="Enter contact person name"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Enter mobile or phone number"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Enter email address"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Status <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={[
                  { label: 'Active', value: 'Active' },
                  { label: 'Inactive', value: 'Inactive' }
                ]}
                value={form.status}
                onChange={(val) => setForm({ ...form, status: val })}
                size="md"
                searchable={false}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">GSTIN</label>
              <input
                type="text"
                value={form.gstin}
                onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                placeholder="Enter GSTIN"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">PAN</label>
              <input
                type="text"
                value={form.pan}
                onChange={(e) => setForm({ ...form, pan: e.target.value })}
                placeholder="Enter PAN number"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Bank Details matching Screenshot 3 */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Landmark className="w-4 h-4 text-[#0d7676]" /> Bank Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Bank Name</label>
              <input
                type="text"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                placeholder="Enter bank name"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Bank Branch</label>
              <input
                type="text"
                value={form.bankBranch}
                onChange={(e) => setForm({ ...form, bankBranch: e.target.value })}
                placeholder="Enter branch name"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Bank Account</label>
              <input
                type="text"
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                placeholder="Enter bank account number"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">IFSC Code</label>
              <input
                type="text"
                value={form.ifscCode}
                onChange={(e) => setForm({ ...form, ifscCode: e.target.value })}
                placeholder="Enter IFSC code"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
              />
            </div>
          </div>
        </div>

        {/* Why this master exists Info Card matching Screenshot 3 */}
        <div className="p-4 bg-sky-50/80 border border-sky-200/80 rounded-2xl flex items-start gap-3 text-xs text-sky-800 font-medium">
          <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sky-900">Why this master exists</p>
            <p className="mt-0.5 text-slate-600">
              Every future logistics payment will map to this provider, so finance can track payment history provider-wise without depending on a PO.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-[#0d7676] hover:bg-[#0f766e] text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving...
              </>
            ) : (
              'Save Provider'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
