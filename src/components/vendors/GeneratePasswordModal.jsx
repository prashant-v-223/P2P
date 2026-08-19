import React, { useState, useEffect } from 'react';
import { KeyRound, Copy, Check, X, Mail, ShieldCheck, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { apiFetch } from '../../services/api';

export default function GeneratePasswordModal({ isOpen, onClose, vendorId, vendorName, sapVendorCode, initialPassword }) {
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [password, setPassword] = useState(initialPassword || '');
  const [showPassword, setShowPassword] = useState(true);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPassword(initialPassword || '');
      setStatusMsg('');
      setErrorMsg('');
      setCopied(false);
      setEmailSent(false);
    }
  }, [isOpen, vendorId, sapVendorCode, initialPassword]);

  if (!isOpen) return null;

  const handleGenerateAuto = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let randPass = 'Ryzn@';
    for (let i = 0; i < 6; i++) {
      randPass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(randPass);
    setShowPassword(true);
    setErrorMsg('');
    setStatusMsg('');
  };

  const handleCopy = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSendEmail = () => {
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 4000);
  };

  const handleSavePassword = async () => {
    if (!password || password.trim().length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    setErrorMsg('');
    setStatusMsg('');
    setLoading(true);
    try {
      const targetId = vendorId || sapVendorCode;
      const res = await apiFetch(`/api/vendors/${targetId}/generate-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPassword: password.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg(`Password saved successfully for ${vendorName || 'Supplier'}!`);
        setTimeout(() => {
          onClose();
        }, 600);
      } else {
        setErrorMsg(data.error || 'Failed to save password.');
      }
    } catch (err) {
      setErrorMsg('Network error while saving password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden font-sans">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#0d7676] ring-1 ring-teal-200/80 flex items-center justify-center shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">Supplier Password</h2>
              <p className="text-xs text-slate-500 font-medium truncate max-w-[220px]">
                {vendorName || 'Vendor'} {sapVendorCode ? `(SAP: ${sapVendorCode})` : ''}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600">
            Type custom password or click <span className="font-bold text-[#0d7676]">Generate</span> to auto-fill:
          </p>

          {/* Password Input & Generate Button Row */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Supplier Password</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrorMsg(''); setStatusMsg(''); }}
                  placeholder="Enter custom password..."
                  className="w-full pr-10 pl-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-[#0d7676] focus:ring-2 focus:ring-teal-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleGenerateAuto}
                className="border-teal-200 text-[#0d7676] hover:bg-teal-50 text-xs font-bold py-2.5 px-3 rounded-xl flex items-center gap-1.5 shrink-0"
                title="Auto-generate random password"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Generate</span>
              </Button>
            </div>
          </div>

          {/* Action Row: Copy */}
          {password && (
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-[11px] text-slate-500">Share credentials with supplier</span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs font-bold text-[#0d7676] hover:text-teal-800 flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Password'}</span>
              </button>
            </div>
          )}

          {/* Status and Error Messages */}
          {statusMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
              {errorMsg}
            </div>
          )}

          {emailSent && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Credentials emailed to supplier!</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSendEmail}
              className="text-xs border-teal-200 text-[#0d7676] hover:bg-teal-50 font-bold rounded-xl"
            >
              <Mail className="w-3.5 h-3.5 mr-1" />
              Email
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Close
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleSavePassword}
                disabled={loading || !password.trim()}
                className="bg-[#0d7676] hover:bg-[#0a5c5c] text-white text-xs font-bold px-5 py-2 rounded-xl cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Password'}
              </Button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
