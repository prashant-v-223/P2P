import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  User, Mail, Building2, LockKeyhole, ShieldCheck, Laptop,
  CheckCircle2, AlertCircle, Eye, EyeOff, LogOut, KeyRound, Shield
} from 'lucide-react';
import { updateCurrentUser, revokeAllSessions } from '../auth/authSlice';
import { apiFetch } from '../../services/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useToast } from '../../components/ui/toast';

const Notice = ({ type = 'success', children }) => (
  <div className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold ${type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
    {type === 'error' ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
    <span>{children}</span>
  </div>
);

const Section = ({ icon: Icon, title, description, children }) => (
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs flex flex-col justify-between h-full">
    <div>
      <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 bg-slate-50/50">
        <div className="rounded-xl bg-teal-50 p-2 text-[#0d7676] ring-1 ring-teal-100/80 shadow-2xs">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold tracking-tight text-slate-900">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500 font-medium">{description}</p>
        </div>
      </header>
      <div className="p-5">{children}</div>
    </div>
  </section>
);

export default function UserProfilePage() {
  const dispatch = useDispatch();
  const { showToast } = useToast();
  const { user } = useSelector((state) => state.auth);
  const [profile, setProfile] = useState({ name: '', email: '', department: '' });
  const [profileState, setProfileState] = useState({ saving: false, error: '', success: '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordState, setPasswordState] = useState({ saving: false, error: '', success: '' });
  const [sessionState, setSessionState] = useState({ saving: false, success: '' });
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [twoFactorState, setTwoFactorState] = useState({ saving: false, error: '', success: '' });

  useEffect(() => {
    setProfile({
      name: user?.name || '',
      email: user?.email || '',
      department: user?.department || ''
    });
  }, [user]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileState({ saving: true, error: '', success: '' });
    try {
      const response = await apiFetch('/api/auth/me', {
        method: 'PUT',
        body: JSON.stringify(profile)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update profile.');
      dispatch(updateCurrentUser(data.user));
      showToast({ title: 'Profile updated', description: 'Your account details were saved.' });
      setProfileState({ saving: false, error: '', success: 'Your profile has been updated.' });
    } catch (error) {
      showToast({ type: 'error', title: 'Profile was not updated', description: error.message });
      setProfileState({ saving: false, error: error.message, success: '' });
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordState({ saving: false, error: 'New passwords do not match.', success: '' });
      return;
    }
    setPasswordState({ saving: true, error: '', success: '' });
    try {
      const response = await apiFetch('/api/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: passwords.currentPassword,
          newPassword: passwords.newPassword
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to change password.');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showToast({ title: 'Password updated', description: 'Other active sessions were signed out.' });
      setPasswordState({ saving: false, error: '', success: data.message });
    } catch (error) {
      showToast({ type: 'error', title: 'Password was not updated', description: error.message });
      setPasswordState({ saving: false, error: error.message, success: '' });
    }
  };

  const closeOtherSessions = async () => {
    setSessionState({ saving: true, success: '' });
    await dispatch(revokeAllSessions());
    showToast({ title: 'Sessions revoked', description: 'Other signed-in devices have been logged out.' });
    setSessionState({ saving: false, success: 'Other sessions have been signed out.' });
  };

  const updateTwoFactor = async () => {
    setTwoFactorState({ saving: true, error: '', success: '' });
    try {
      const response = await apiFetch('/api/auth/two-factor', {
        method: 'PUT',
        body: JSON.stringify({ enabled: !user?.twoFactorEnabled, currentPassword: twoFactorPassword })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update two-factor authentication.');
      dispatch(updateCurrentUser(data.user));
      showToast({ title: data.user.twoFactorEnabled ? 'Two-factor enabled' : 'Two-factor disabled', description: data.message });
      setTwoFactorPassword('');
      setTwoFactorOpen(false);
      setTwoFactorState({ saving: false, error: '', success: data.message });
    } catch (error) {
      showToast({ type: 'error', title: 'Two-factor update failed', description: error.message });
      setTwoFactorState({ saving: false, error: error.message, success: '' });
    }
  };

  return (
    <div className="w-full space-y-5 pb-8 font-sans antialiased">
      {/* Clean White Profile Header Card (No Account ID) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex items-center gap-4">
          {/* User Avatar */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-[#0d7676] text-xl font-extrabold border border-teal-200 shadow-2xs">
            {user?.avatar || 'NA'}
          </div>

          {/* User Details */}
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-bold text-slate-900">{user?.name}</h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
              </span>
            </div>

            <p className="text-xs text-slate-500 font-medium">{user?.email}</p>

            <div className="flex flex-wrap gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-teal-50 text-[#0d7676] border border-teal-200/80 px-2.5 py-0.5 text-xs font-semibold">
                <Shield className="h-3 w-3" /> {user?.role}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/80 px-2.5 py-0.5 text-xs font-semibold">
                <Building2 className="h-3 w-3" /> {user?.department || 'Not assigned'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Main 3 Column Section Grid */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        {/* Column 1: Personal Information */}
        <Section icon={User} title="Personal information" description="Keep your contact and organization details current.">
          <form noValidate onSubmit={saveProfile} className="space-y-4">
            {profileState.error && <Notice type="error">{profileState.error}</Notice>}
            {profileState.success && <Notice>{profileState.success}</Notice>}
            
            <div className="grid gap-3.5 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-700">
                Full name <span className="text-rose-500">*</span>
                <div className="relative mt-1.5">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input className="pl-10" maxLength={80} autoComplete="name" placeholder="Enter full name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required />
                </div>
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Work email <span className="text-rose-500">*</span>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input className="pl-10" type="email" maxLength={120} autoComplete="email" placeholder="name@rayzon.one" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} required />
                </div>
              </label>
            </div>

            <label className="block text-xs font-semibold text-slate-700">
              Department
              <div className="relative mt-1.5">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input className="pl-10" maxLength={80} autoComplete="organization-title" placeholder="Enter department" value={profile.department} onChange={(e) => setProfile({ ...profile, department: e.target.value })} />
              </div>
            </label>

            <div className="flex justify-end border-t border-slate-100 pt-3">
              <Button loading={profileState.saving} className="bg-[#0d7676] hover:bg-[#0f766e]">Save profile</Button>
            </div>
          </form>
        </Section>

        {/* Column 2: Change Password */}
        <Section icon={KeyRound} title="Change password" description="Use at least eight characters and avoid passwords used elsewhere.">
          <form noValidate onSubmit={changePassword} className="space-y-4">
            {passwordState.error && <Notice type="error">{passwordState.error}</Notice>}
            {passwordState.success && <Notice>{passwordState.success}</Notice>}
            
            {[
              ['currentPassword', 'Current password'],
              ['newPassword', 'New password'],
              ['confirmPassword', 'Confirm new password']
            ].map(([key, label]) => (
              <label key={key} className="block text-xs font-semibold text-slate-700">
                {label} <span className="text-rose-500">*</span>
                <div className="relative mt-1.5">
                  <LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input className="pl-10 pr-11" type={showPasswords ? 'text' : 'password'} minLength={8} maxLength={128} autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'} placeholder={key === 'currentPassword' ? 'Enter current password' : key === 'newPassword' ? 'Enter new password' : 'Confirm new password'} value={passwords[key]} onChange={(e) => setPasswords({ ...passwords, [key]: e.target.value })} required />
                  <button type="button" onClick={() => setShowPasswords(!showPasswords)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Toggle password visibility">
                    {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
            ))}

            <div className="flex justify-end border-t border-slate-100 pt-3">
              <Button loading={passwordState.saving} className="bg-[#0d7676] hover:bg-[#0f766e]">Update password</Button>
            </div>
          </form>
        </Section>

        {/* Column 3: Security & Session */}
        <div className="space-y-5">
          <Section icon={ShieldCheck} title="Access & security" description="Your current account protection status.">
            <div className="space-y-3.5">
              {twoFactorState.error && <Notice type="error">{twoFactorState.error}</Notice>}
              {twoFactorState.success && <Notice>{twoFactorState.success}</Notice>}
              
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/60">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned role</p>
                <p className="mt-1 text-xs font-bold text-slate-900">{user?.role}</p>
                <p className="mt-1 text-xs leading-4 text-slate-500 font-medium">Permissions are managed by your system administrator.</p>
              </div>

              <div className="rounded-xl border border-slate-200 p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Email two-factor authentication</p>
                    <p className="mt-1 text-[11px] text-slate-500 font-medium">{user?.twoFactorEnabled ? 'Required at every new sign in' : 'Protect sign in with an emailed code'}</p>
                  </div>
                  <button type="button" onClick={() => setTwoFactorOpen(!twoFactorOpen)} className={`rounded-full px-3 py-1 text-xs font-bold border ${user?.twoFactorEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                    {user?.twoFactorEnabled ? 'Enabled' : 'Enable'}
                  </button>
                </div>

                {twoFactorOpen && (
                  <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
                    <label className="block text-xs font-semibold text-slate-600">
                      Confirm current password
                      <Input className="mt-1.5" type="password" maxLength={128} autoComplete="current-password" placeholder="Enter current password" value={twoFactorPassword} onChange={(e) => setTwoFactorPassword(e.target.value)} />
                    </label>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" loading={twoFactorState.saving} onClick={updateTwoFactor} className="bg-[#0d7676]">
                        {user?.twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setTwoFactorOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section icon={Laptop} title="Current session" description="Control access on your signed-in devices.">
            <div className="space-y-3">
              {sessionState.success && <Notice>{sessionState.success}</Notice>}
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="rounded-lg bg-white p-2 text-[#0d7676] shadow-2xs border border-slate-200/60">
                  <Laptop className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900">Windows · Chrome</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 font-medium">This device · Active now</p>
                </div>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              <Button variant="outline" className="w-full border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold" loading={sessionState.saving} onClick={closeOtherSessions}>
                <LogOut className="h-4 w-4" /> Sign out other sessions
              </Button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
