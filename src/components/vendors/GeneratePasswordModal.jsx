import React, { useState } from 'react';
import { KeyRound, Copy, Check, X, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/button';

export default function GeneratePasswordModal({ isOpen, onClose, vendorName, password }) {
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSendEmail = () => {
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden font-sans space-y-0">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-200/80 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">Temporary Password</h2>
              <p className="text-xs text-slate-500 font-medium">{vendorName || 'Vendor Account'}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          <p className="text-xs text-slate-600 leading-relaxed">
            A secure temporary login password has been generated for <span className="font-bold text-slate-900">{vendorName}</span>. Share these credentials or send directly via email:
          </p>

          {/* Password Box */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
            <div className="space-y-0.5 min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Generated Password</span>
              <span className="font-mono text-base font-extrabold text-[#0d7676] tracking-wider select-all block truncate">
                {password}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className={`shrink-0 text-xs transition ${copied ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : ''}`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-600" />
                  Copy
                </>
              )}
            </Button>
          </div>

          {emailSent && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Login credentials dispatched to vendor email!</span>
            </div>
          )}

          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-800 font-medium">
            Note: This temporary password expires in 24 hours. The vendor will be prompted to reset it upon first sign in.
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleSendEmail}
            className="text-xs border-teal-200 text-[#0d7676] hover:bg-teal-50"
          >
            <Mail className="w-3.5 h-3.5" />
            Email Credentials
          </Button>

          <Button 
            variant="default" 
            size="sm"
            onClick={onClose}
            className="bg-[#0d7676] hover:bg-[#0a5c5c] text-white text-xs px-6"
          >
            Done
          </Button>
        </div>

      </div>
    </div>
  );
}
