import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVendor } from './vendorContext';
import { Eye, EyeOff, Sun, ArrowRight, AlertCircle, X } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

export default function VendorLoginPage() {
  const { loginVendor } = useVendor();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    try {
      await loginVendor(email, password);
      setIsLoading(false);
      navigate('/vendor/dashboard');
    } catch (err) {
      setIsLoading(false);
      setErrorMsg(err.message || 'Vendor login failed. Please verify credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center items-center px-4 py-12 font-sans antialiased">
      <div className="w-full max-w-[420px] space-y-6">
        {/* Top Brand Logo Header */}
        <div className="text-center space-y-3">
          <img src="/logo.png" alt="logo" srcset="" width={150} height={25} className='mx-auto d-black' />

          <div className="space-y-1">
            <p className="text-xs text-slate-500 font-medium">
              Sign in to access your RFQs, Invoices & payment status
            </p>
          </div>
        </div>

        {/* Error alert */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button type="button" onClick={() => setErrorMsg('')} className="text-rose-400 hover:text-rose-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Login Form Surface Card */}
        <div className="bg-white rounded-2xl p-7 shadow-sm border border-slate-200">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Address */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Email Address</label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrorMsg(''); }}
                placeholder="vendor@company.com"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrorMsg(''); }}
                  className="pr-11"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 rounded-lg bg-white p-1.5 text-slate-500 shadow-xs hover:text-teal-700"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2.5 pt-1">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-teal-700 cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-sm font-medium text-slate-600 cursor-pointer select-none">
                Keep me signed in
              </label>
            </div>

            {/* Submit Button */}
            <Button size="lg" className="w-full mt-2" loading={isLoading}>
              Sign In To Portal <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </div>

        {/* Support Link Footer */}
        <div className="text-center pt-1">
          <p className="text-xs font-medium text-slate-500">
            Having trouble? Contact IT Support at:{' '}
            <a
              href="mailto:crm@rayzonenergies.com"
              className="text-[#0d7676] font-semibold hover:underline"
            >
              crm@rayzonenergies.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
