import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowLeft, CheckCircle2, KeyRound, Mail, X } from 'lucide-react';
import { forgotPassword, resetPassword, resetForgotStep } from './authSlice';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

export default function ForgotPasswordModal({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const { forgotStep, resetMessage, demoOtp, loading, error } = useSelector((state) => state.auth);
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  if (!isOpen) return null;

  const close = () => { dispatch(resetForgotStep()); onClose(); };
  return (
    <div className="modal-backdrop">
      <div className="modal-panel max-w-md">
        <header className="modal-header items-start bg-gradient-to-r from-teal-50 to-white">
          <div className="flex gap-3"><span className="rounded-lg bg-white p-2 text-teal-700 shadow-sm"><KeyRound className="h-5 w-5" /></span><div><h2 className="text-base font-bold text-slate-950">Recover your account</h2><p className="mt-0.5 text-xs text-slate-500">Reset your password securely.</p></div></div>
          <button onClick={close} className="rounded-xl p-2 text-slate-400 hover:bg-white hover:text-slate-700"><X className="h-5 w-5" /></button>
        </header>
        <div className="p-4">
          {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
          {forgotStep === 'email' && (
            <form noValidate onSubmit={(e) => { e.preventDefault(); dispatch(forgotPassword({ email })); }} className="space-y-4">
              <p className="text-sm leading-6 text-slate-600">Enter the email associated with your account. We’ll generate a six-digit recovery code.</p>
              <label className="block text-sm font-semibold text-slate-700">Work email <span className="text-rose-500" aria-hidden="true">*</span><div className="relative mt-2"><Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" /><Input type="email" className="pl-10" maxLength={120} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@rayzon.one" required /></div></label>
              <Button size="lg" className="w-full" loading={loading}>Send recovery code</Button>
            </form>
          )}
          {forgotStep === 'otp' && (
            <form noValidate onSubmit={(e) => { e.preventDefault(); dispatch(resetPassword({ email, otpCode, newPassword })); }} className="space-y-3.5">
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">{resetMessage}{demoOtp && <p className="mt-2 font-mono font-bold">Development code: {demoOtp}</p>}</div>
              <label className="block text-sm font-semibold text-slate-700">Recovery code <span className="text-rose-500" aria-hidden="true">*</span><Input className="mt-2 text-center font-mono tracking-[0.3em]" inputMode="numeric" maxLength={6} placeholder="000000" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required /></label>
              <label className="block text-sm font-semibold text-slate-700">New password <span className="text-rose-500" aria-hidden="true">*</span><Input className="mt-2" type="password" minLength={8} maxLength={128} autoComplete="new-password" placeholder="Minimum 8 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></label>
              <Button size="lg" className="w-full" loading={loading}>Reset password</Button>
              <button type="button" onClick={() => dispatch(resetForgotStep())} className="flex w-full items-center justify-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Use another email</button>
            </form>
          )}
          {forgotStep === 'success' && (
            <div className="py-3 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-7 w-7" /></span><h3 className="mt-4 text-lg font-bold text-slate-950">Password updated</h3><p className="mt-2 text-sm text-slate-500">{resetMessage}</p><Button size="lg" className="mt-6 w-full" onClick={close}>Return to sign in</Button></div>
          )}
        </div>
      </div>
    </div>
  );
}
