import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVendor } from './vendorContext';
import { Eye, EyeOff, Sun, ArrowRight } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

export default function VendorLoginPage() {
  const { loginVendor } = useVendor();
  const navigate = useNavigate();

  const [email, setEmail] = useState('kaiming.sun@jinkosolar.com');
  const [password, setPassword] = useState('••••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      loginVendor(email, password);
      setIsLoading(false);
      navigate('/vendor/dashboard');
    }, 300);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center items-center px-4 py-12 font-sans antialiased">
      <div className="w-full max-w-[420px] space-y-6">
        {/* Top Brand Logo Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 bg-[#0d7676] rounded-2xl flex items-center justify-center shadow-sm">
            <Sun className="w-6 h-6 text-amber-300 fill-amber-300" />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">Vendor Portal</h1>
            <p className="text-xs text-slate-500 font-medium">
              Sign in to access your RFQs, Invoices & payment status
            </p>
          </div>
        </div>

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
                onChange={(e) => setEmail(e.target.value)}
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
                  onChange={(e) => setPassword(e.target.value)}
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
