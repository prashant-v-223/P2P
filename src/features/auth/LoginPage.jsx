import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { loginUser } from './authSlice';
import ForgotPasswordModal from './ForgotPasswordModal';
import AuthShell from './AuthShell';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { getFirstAllowedRoute } from '../../lib/permissions';

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [forgotOpen, setForgotOpen] = useState(false);
  const { twoFactorRequired, twoFactorEmail } = useSelector((state) => state.auth);

  const signIn = (credentials) => dispatch(loginUser(credentials)).unwrap().then((data) => {
    if (!data.requiresTwoFactor) {
      const targetPath = getFirstAllowedRoute(data.user?.role, data.user?.permissions);
      navigate(targetPath);
    }
    return data;
  });
  const submit = (event) => { event.preventDefault(); signIn({ email, password, rememberMe }).catch(() => {}); };
  return (
    <AuthShell title="Sign in to your account" description="Rayzon Solar — Procure-to-Pay Portal">
      {error && <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700">{error}</div>}
      <form noValidate onSubmit={twoFactorRequired ? (event) => { event.preventDefault(); signIn({ email, password, twoFactorCode, rememberMe }).catch(() => {}); } : submit} className="space-y-3.5">
        {twoFactorRequired ? (
          <>
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-3.5 text-sm text-teal-800">A six-digit sign-in code was sent to <strong>{twoFactorEmail}</strong>.</div>
            <label className="block text-sm font-semibold text-slate-700">Verification code <span className="text-rose-500" aria-hidden="true">*</span><Input className="mt-2 text-center font-mono tracking-[0.3em]" inputMode="numeric" maxLength={6} placeholder="000000" value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required /></label>
            <Button size="lg" className="w-full" loading={loading}>Verify and sign in <ArrowRight className="h-4 w-4" /></Button>
          </>
        ) : (
          <>
        <label className="block text-sm font-semibold text-slate-700">Work email <span className="text-rose-500" aria-hidden="true">*</span>
          <div className="relative mt-2"><Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" /><Input type="email" className="pl-10" maxLength={120} autoComplete="email" placeholder="name@rayzon.one" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          <span className="flex items-center justify-between"><span>Password <span className="text-rose-500" aria-hidden="true">*</span></span><button type="button" onClick={() => setForgotOpen(true)} className="text-sm font-semibold text-teal-700 hover:text-teal-900">Forgot password?</button></span>
          <div className="relative mt-2">
            <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <Input type={showPassword ? 'text' : 'password'} className="bg-slate-50 pl-10 pr-11" minLength={8} maxLength={128} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-2.5 rounded-lg bg-white p-1.5 text-slate-500 shadow-sm hover:text-teal-700" aria-label="Toggle password visibility">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
          <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-teal-700" />
          Keep me signed in
        </label>
        <Button size="lg" className="w-full" loading={loading}>Sign in <ArrowRight className="h-4 w-4" /></Button>
          </>
        )}
      </form>
      <ForgotPasswordModal isOpen={forgotOpen} onClose={() => setForgotOpen(false)} />
    </AuthShell>
  );
}
