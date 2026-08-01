import React from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useVendor } from './vendorContext';
import { LayoutDashboard, FileText, Wallet, User, LogOut, Sun } from 'lucide-react';

export function RayzonLogo() {
  return (
    <div className="flex items-center gap-2.5 cursor-pointer select-none">
      <div className="w-9 h-9 rounded-xl bg-[#0d7676] flex items-center justify-center text-white font-extrabold shadow-xs shrink-0 ring-2 ring-teal-100">
        <Sun className="w-5 h-5 text-amber-300 fill-amber-300" />
      </div>
      <div className="flex flex-col leading-tight">
        <div className="flex items-center gap-1.5">
          <h1 className="font-extrabold text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
            Rayzon Solar
            <span className="text-[9px] bg-teal-50 text-[#0d7676] px-1.5 py-0.5 rounded border border-teal-200 font-mono font-bold">
              VENDOR
            </span>
          </h1>
        </div>
        <p className="text-[11px] text-slate-400 font-semibold">Supplier Portal</p>
      </div>
    </div>
  );
}

export default function VendorLayout() {
  const { vendorProfile, logoutVendor } = useVendor();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = (e) => {
    e.preventDefault();
    logoutVendor();
    navigate('/vendor/login');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans antialiased">
      {/* Top Header Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Navigation Links */}
          <div className="flex items-center gap-8">
            <NavLink to="/vendor/dashboard" className="flex items-center">
              <RayzonLogo />
            </NavLink>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-2">
              <NavLink
                to="/vendor/dashboard"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                    isActive
                      ? 'bg-teal-50 text-[#0d7676] border-2 border-[#0d7676] font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </NavLink>

              <NavLink
                to="/vendor/invoices"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                    isActive || location.pathname.startsWith('/vendor/invoices')
                      ? 'bg-teal-50 text-[#0d7676] border-2 border-[#0d7676] font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                <FileText className="w-4 h-4" />
                <span>Invoices</span>
              </NavLink>

              <NavLink
                to="/vendor/advances"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                    isActive
                      ? 'bg-teal-50 text-[#0d7676] border-2 border-[#0d7676] font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                <Wallet className="w-4 h-4" />
                <span>Advance</span>
              </NavLink>

              <NavLink
                to="/vendor/profile"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                    isActive
                      ? 'bg-teal-50 text-[#0d7676] border-2 border-[#0d7676] font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                <User className="w-4 h-4" />
                <span>Profile</span>
              </NavLink>
            </nav>
          </div>

          {/* User Profile Right */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-[#0d7676] font-bold flex items-center justify-center text-xs border border-teal-200">
                {(vendorProfile.companyName || 'Vendor').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <span className="font-bold text-slate-900 max-w-[180px] truncate block text-xs leading-tight">
                  {vendorProfile.companyName}
                </span>
                <span className="text-[10px] text-slate-400 font-medium block">
                  Code: {vendorProfile.sapVendorCode}
                </span>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-xl border border-transparent hover:border-rose-100 transition-all"
            >
              <LogOut className="w-4 h-4 text-rose-500" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Links */}
        <div className="md:hidden flex items-center justify-around border-t border-slate-100 px-2 py-2 bg-white text-xs">
          <NavLink
            to="/vendor/dashboard"
            className={({ isActive }) =>
              `flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold ${
                isActive ? 'bg-teal-50 text-[#0d7676] font-bold' : 'text-slate-600'
              }`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/vendor/invoices"
            className={({ isActive }) =>
              `flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold ${
                isActive || location.pathname.startsWith('/vendor/invoices') ? 'bg-teal-50 text-[#0d7676] font-bold' : 'text-slate-600'
              }`
            }
          >
            Invoices
          </NavLink>
          <NavLink
            to="/vendor/advances"
            className={({ isActive }) =>
              `flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold ${
                isActive ? 'bg-teal-50 text-[#0d7676] font-bold' : 'text-slate-600'
              }`
            }
          >
            Advance
          </NavLink>
          <NavLink
            to="/vendor/profile"
            className={({ isActive }) =>
              `flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold ${
                isActive ? 'bg-teal-50 text-[#0d7676] font-bold' : 'text-slate-600'
              }`
            }
          >
            Profile
          </NavLink>
        </div>
      </header>

      {/* Main Outlet Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
