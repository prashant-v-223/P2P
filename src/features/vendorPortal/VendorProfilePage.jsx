import React, { useState } from 'react';
import { useVendor } from './vendorContext';
import { useToast } from '../../components/ui/toast';
import { Edit3, KeyRound, Info, CheckCircle2, X, Landmark, Receipt, Building2, UserCheck, ShieldCheck, Loader2, Eye, EyeOff } from 'lucide-react';

export default function VendorProfilePage() {
  const { vendorProfile, updateProfile, changePassword } = useVendor();
  const { showToast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Edit form state
  const [contactPerson, setContactPerson] = useState(vendorProfile.contactPerson || '');
  const [phone, setPhone] = useState(vendorProfile.phone || '');
  const [email, setEmail] = useState(vendorProfile.email || '');

  // Password state
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passSuccess, setPassSuccess] = useState(false);
  const [passError, setPassError] = useState('');
  const [isSubmittingPass, setIsSubmittingPass] = useState(false);

  const initials = (vendorProfile.companyName || 'Vendor')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'VN';

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateProfile({ contactPerson, phone, email });
      setIsSaving(false);
      setIsEditing(false);
      showToast({
        title: 'Profile Updated',
        description: 'Vendor contact information updated successfully.',
        type: 'success'
      });
    } catch (err) {
      setIsSaving(false);
      showToast({
        title: 'Update Error',
        description: err.message || 'Failed to update profile.',
        type: 'error'
      });
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPassError('');

    if (newPass !== confirmPass) {
      setPassError('New passwords do not match');
      return;
    }
    if (newPass.length < 8) {
      setPassError('Password must be at least 8 characters');
      return;
    }

    setIsSubmittingPass(true);
    try {
      await changePassword(currentPass, newPass);
      setIsSubmittingPass(false);
      setPassSuccess(true);
      showToast({
        title: 'Password Changed',
        description: 'Your portal access password has been updated in MongoDB.',
        type: 'success'
      });
      setTimeout(() => {
        setShowPasswordModal(false);
        setPassSuccess(false);
        setCurrentPass('');
        setNewPass('');
        setConfirmPass('');
      }, 1500);
    } catch (err) {
      setIsSubmittingPass(false);
      setPassError(err.message || 'Failed to change password. Please check your credentials.');
    }
  };

  return (
    <div className="space-y-6 font-sans w-full max-w-7xl mx-auto pb-12 antialiased text-left">
      {/* Header & Edit Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Profile</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage your company contact information, bank account details, and security credentials.
          </p>
        </div>

        <button
          onClick={() => setIsEditing(!isEditing)}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-teal-300 bg-teal-50 text-[#0d7676] font-bold text-xs rounded-xl hover:bg-teal-100/80 transition shadow-2xs cursor-pointer self-start sm:self-auto"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>{isEditing ? 'Cancel Edit' : 'Edit Profile'}</span>
        </button>
      </div>

      {/* Card 1: Vendor Hero Header Info Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 text-[#0d7676] text-xl font-extrabold flex items-center justify-center border border-teal-200 shrink-0 shadow-xs">
              {initials}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-lg font-extrabold text-slate-900">{vendorProfile.companyName}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1.5 shadow-2xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
                </span>
                {vendorProfile.vendorType && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {vendorProfile.vendorType}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium">
                SAP Vendor Code: <span className="font-mono font-bold text-[#0d7676]">{vendorProfile.sapVendorCode}</span>
              </p>
            </div>
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Contact Person</label>
                <input
                  type="text"
                  required
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Phone</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
                <label className="block text-xs font-semibold text-slate-700">Official Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-[#0d7676] hover:bg-[#0f766e] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSaving ? 'Saving...' : 'Save Profile'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-xs font-medium">
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100">
              <span className="text-slate-400 block mb-1 text-[11px] font-semibold uppercase tracking-wider">Contact Person</span>
              <span className="text-slate-900 font-bold text-sm flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-[#0d7676] shrink-0" />
                {vendorProfile.contactPerson || '—'}
              </span>
            </div>

            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100">
              <span className="text-slate-400 block mb-1 text-[11px] font-semibold uppercase tracking-wider">Phone</span>
              <span className="text-slate-900 font-bold text-sm">{vendorProfile.phone || '—'}</span>
            </div>

            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100">
              <span className="text-slate-400 block mb-1 text-[11px] font-semibold uppercase tracking-wider">Official Email</span>
              <span className="text-slate-900 font-bold text-sm truncate block" title={vendorProfile.email}>{vendorProfile.email || '—'}</span>
            </div>

            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100">
              <span className="text-slate-400 block mb-1 text-[11px] font-semibold uppercase tracking-wider">Vendor Category</span>
              <span className="text-slate-900 font-bold text-sm">{vendorProfile.vendorType || 'Import'}</span>
            </div>
          </div>
        )}
      </div>

      {/* 2-Column Main Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 2: Bank Details */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2">
            <Landmark className="w-4 h-4 text-emerald-600" />
            Bank Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-xs font-medium">
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
              <span className="text-slate-400 block mb-1 text-[10.5px] font-semibold uppercase tracking-wider">Bank Name</span>
              <span className="text-slate-800 font-bold text-sm">{vendorProfile.bankName || 'HDFC Bank'}</span>
            </div>

            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
              <span className="text-slate-400 block mb-1 text-[10.5px] font-semibold uppercase tracking-wider">Branch</span>
              <span className="text-slate-800 font-bold text-sm">{vendorProfile.branch || 'Main Branch'}</span>
            </div>

            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
              <span className="text-slate-400 block mb-1 text-[10.5px] font-semibold uppercase tracking-wider">Account Number</span>
              <span className="text-slate-800 font-bold font-mono text-sm">{vendorProfile.accountNumber || '**** 8888'}</span>
            </div>

            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
              <span className="text-slate-400 block mb-1 text-[10.5px] font-semibold uppercase tracking-wider">IFSC / SWIFT code</span>
              <span className="text-slate-800 font-bold font-mono text-sm">{vendorProfile.ifscCode || 'HDFC0000101'}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Tax Information */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#0d7676]" />
            Tax Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-xs font-medium">
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
              <span className="text-slate-400 block mb-1 text-[10.5px] font-semibold uppercase tracking-wider">GSTIN</span>
              <span className="text-slate-800 font-bold font-mono text-sm">{vendorProfile.gstin || '-'}</span>
            </div>

            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
              <span className="text-slate-400 block mb-1 text-[10.5px] font-semibold uppercase tracking-wider">PAN</span>
              <span className="text-slate-800 font-bold font-mono text-sm">{vendorProfile.pan || '-'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Security and Notice Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 4: Change Password */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/60 shadow-2xs shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Portal Password</h3>
              <p className="text-xs text-slate-400 font-medium">
                Keep your account secure with a strong password.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setPassError('');
              setShowPasswordModal(true);
            }}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-xl transition shadow-2xs cursor-pointer whitespace-nowrap"
          >
            Change Password
          </button>
        </div>

        {/* Card 5: Notice Callout Banner */}
        <div className="bg-teal-50/80 border border-teal-200 rounded-2xl p-6 text-xs font-semibold text-teal-950 flex items-center gap-3.5 shadow-2xs">
          <Info className="w-5 h-5 text-[#0d7676] shrink-0" />
          <span className="leading-relaxed">
            To update official registered company name, bank details, or tax identifiers, please contact the Rayzon procurement team.
          </span>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl border border-slate-100 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Change Password</h3>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {passSuccess ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto animate-bounce" />
                <p className="text-xs font-bold text-slate-800">Password Updated Successfully!</p>
                <p className="text-[11px] text-slate-400 font-medium">Saved to MongoDB vendor security store.</p>
              </div>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                {passError && (
                  <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                    {passError}
                  </p>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? "text" : "password"}
                      required
                      value={currentPass}
                      onChange={(e) => setCurrentPass(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-3 top-2 text-slate-400 hover:text-slate-600"
                    >
                      {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPass ? "text" : "password"}
                      required
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPass ? "text" : "password"}
                      required
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0d7676] focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute right-3 top-2 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="px-4 py-2 border border-slate-200 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPass}
                    className="px-4 py-2 bg-[#0d7676] hover:bg-[#0f766e] text-white text-xs font-bold uppercase rounded-xl transition cursor-pointer flex items-center gap-1.5"
                  >
                    {isSubmittingPass && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isSubmittingPass ? 'Updating...' : 'Update Password'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
