import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Shield, ArrowLeft, Loader2, Info, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';

export default function CustomAgentFormView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    agencyName: '',
    phone: '+91 ',
    status: 'Active - Can log in',
    iecCode: '',
    licenceNumber: '',
    paymentTerms: '30',
    email: '',
    password: ''
  });

  useEffect(() => {
    if (isEdit && id) {
      async function loadAgent() {
        try {
          setLoading(true);
          const res = await apiFetch(`/api/custom-agents/${id}`);
          if (res.ok) {
            const data = await res.json();
            const agent = data.agent;
            if (agent) {
              setForm({
                fullName: agent.contactPerson || '',
                agencyName: agent.agencyName || '',
                phone: agent.phone || '',
                status: agent.status === 'Inactive' ? 'Inactive' : 'Active - Can log in',
                iecCode: agent.iecCode || '',
                licenceNumber: agent.licenceNumber || '',
                paymentTerms: agent.paymentTerms || '30',
                email: agent.email || '',
                password: ''
              });
            }
          }
        } catch (err) {
          console.error('Error loading custom agent:', err);
        } finally {
          setLoading(false);
        }
      }
      loadAgent();
    }
  }, [id, isEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.email) {
      showToast({ title: 'Validation Error', description: 'Email address is required.', type: 'error' });
      return;
    }
    if (!isEdit && !form.password) {
      showToast({ title: 'Validation Error', description: 'Password is required for new accounts.', type: 'error' });
      return;
    }

    try {
      setSaving(true);
      const url = isEdit ? `/api/custom-agents/${id}` : '/api/custom-agents';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          contactPerson: form.fullName,
          agencyName: form.agencyName || form.fullName,
          status: form.status.includes('Inactive') ? 'Inactive' : 'Active',
          portalAccessEnabled: !form.status.includes('Inactive'),
          isEdit
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast({
          title: 'Success',
          description: isEdit ? 'Custom Agent updated successfully.' : 'Custom Agent Account created successfully.',
          type: 'success'
        });
        navigate(-1);
      } else {
        showToast({ title: 'Error', description: json.error || 'Failed to save agent account.', type: 'error' });
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
        <span className="text-sm font-semibold text-slate-600">Loading custom agent data...</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 font-sans pb-12">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <button onClick={() => navigate(-1)} className="hover:text-slate-700 flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Custom Agents
        </button>
        <span>/</span>
        <span className="text-slate-700 font-bold">{isEdit ? 'Edit Agent' : 'Add Agent'}</span>
      </div>

      {/* Header Banner */}
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
          {isEdit ? 'Edit Custom Agent Account' : 'Add New Custom Agent Account'}
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-1">
          Create a portal account for a custom clearing agent. They will log in at <code className="text-[#0d7676] font-bold bg-teal-50 px-1.5 py-0.5 rounded">/agent/login</code> to manage BL clearances assigned to them.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form Area (2 Columns wide) */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">

          {/* Section 1: Agent Information */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3">
              Agent Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Rajesh Customs"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Company / Firm Name
                </label>
                <input
                  type="text"
                  value={form.agencyName}
                  onChange={(e) => setForm({ ...form, agencyName: e.target.value })}
                  placeholder="Rajesh Clearing Agents Pvt. Ltd"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 98000 00000"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Account Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
                >
                  <option value="Active - Can log in">Active — Can log in</option>
                  <option value="Inactive">Inactive — Access disabled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: License & Registration */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3">
              License &amp; Registration
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">IEC Code</label>
                <input
                  type="text"
                  value={form.iecCode}
                  onChange={(e) => setForm({ ...form, iecCode: e.target.value })}
                  placeholder="Importer Exporter Code"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
                />
                <p className="text-[10px] text-slate-400 font-medium mt-1">
                  10-digit Import Export Code issued by DGFT
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">CHA License Number</label>
                <input
                  type="text"
                  value={form.licenceNumber}
                  onChange={(e) => setForm({ ...form, licenceNumber: e.target.value })}
                  placeholder="Custom House Agent License No."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
                />
                <p className="text-[10px] text-slate-400 font-medium mt-1">
                  License issued by Commissioner of Customs
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Terms (Days)</label>
                <input
                  type="text"
                  value={form.paymentTerms}
                  onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                  placeholder="e.g. 30"
                  className="w-full max-w-sm px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
                />
                <p className="text-[10px] text-slate-400 font-medium mt-1">
                  e.g. 30 = Net 30. Invoice due date is auto-calculated when agent raises an Invoice.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Portal Login Credentials */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3">
              Portal Login Credentials
            </h2>

            {/* Warning Banner matching Screenshot 2 */}
            <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 font-medium">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Share these with the agent so they can log in at <code className="font-bold">/agent/login</code>. After creating, use <span className="font-bold">Generate Password</span> from the agent list for a shareable one-time password.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="admin@p2p.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Password {!isEdit && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="password"
                  required={!isEdit}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={isEdit ? 'Leave blank to keep unchanged' : '••••••••'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0d7676]"
                />
              </div>
            </div>
          </div>

          {/* Form Bottom Actions */}
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
              ) : isEdit ? (
                'Save Agent Account'
              ) : (
                'Create Agent Account'
              )}
            </button>
          </div>
        </form>

        {/* Right Sidebar - Guide Cards matching Screenshot 2 */}
        <div className="space-y-4">
          {/* Setup Guide */}
          <div className="bg-emerald-50/40 border border-emerald-200/60 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Setup Guide
            </h3>
            <ol className="text-xs text-slate-700 font-medium space-y-2.5 list-decimal pl-4">
              <li>
                <span className="font-bold text-slate-900">Enter agent details</span> — name, company and contact information.
              </li>
              <li>
                <span className="font-bold text-slate-900">Enter license numbers</span> — IEC code and CHA license for compliance records.
              </li>
              <li>
                <span className="font-bold text-slate-900">Set email + password</span> — these are the agent's portal login credentials at <code className="text-emerald-800 font-semibold bg-emerald-100/60 px-1 py-0.5 rounded">/agent/login</code>.
              </li>
              <li>
                <span className="font-bold text-slate-900">Once created</span>, assign BL entries to this agent from the Exim module.
              </li>
            </ol>
          </div>

          {/* Agent Portal Features */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-900">Agent Portal Features</h3>
            <ul className="text-xs text-slate-600 font-medium space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0d7676]" /> View assigned BL entries
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0d7676]" /> Upload customs clearance documents
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0d7676]" /> Mark material as received
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
