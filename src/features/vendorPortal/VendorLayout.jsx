import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useVendor } from './vendorContext';
import { LayoutDashboard, FileText, Wallet, User, LogOut, Sun, ClipboardList, Bell } from 'lucide-react';
import { useToast } from '../../components/ui/toast';
import { apiFetch } from '../../services/api';
import VendorNotificationPanel from './VendorNotificationPanel';

export function RayzonLogo() {
  return (
    <div className="flex items-center  cursor-pointer select-none">
      <img src="/logo.png" alt="logo" width={130} height={20} className='my-2' />
    </div>
  );
}

export default function VendorLayout() {
  const { vendorUser, vendorProfile, logoutVendor } = useVendor();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const [rfqNotificationCount, setRfqNotificationCount] = useState(0);
  const isFreightForwarder = /(freight|forwarder|logistics|shipping)/i.test(`${vendorProfile.vendorType || ''} ${vendorProfile.category || ''}`);

  const refreshRfqCount = useCallback(async () => {
    if (!isFreightForwarder || !localStorage.getItem('rayzon_vendor_token')) return;
    try {
      const response = await apiFetch('/api/p2p/vendor-rfqs');
      const json = await response.json();
      if (!response.ok || !json.success) return;
      const now = new Date();
      const actionable = (json.data || []).filter((rfq) => {
        if (rfq.myQuote || String(rfq.status).toLowerCase() !== 'published') return false;
        if (!rfq.closingDate) return true;
        const deadline = new Date(rfq.closingDate);
        const utcMidnight = deadline.getUTCHours() === 0 && deadline.getUTCMinutes() === 0 && deadline.getUTCSeconds() === 0;
        const localMidnight = deadline.getHours() === 0 && deadline.getMinutes() === 0 && deadline.getSeconds() === 0;
        if (localMidnight) deadline.setHours(23, 59, 59, 999);
        else if (utcMidnight) deadline.setUTCHours(23, 59, 59, 999);
        return deadline >= now;
      }).length;
      setRfqNotificationCount(actionable);
      window.dispatchEvent(new CustomEvent('vendor-rfqs-updated', { detail: json.data || [] }));
    } catch { /* Dashboard/list surfaces API failures to the user. */ }
  }, [isFreightForwarder]);

  const handleSignOut = (e) => {
    e.preventDefault();
    logoutVendor();
    navigate('/vendor/login');
  };

  useEffect(() => {
    if (!isFreightForwarder) return undefined;
    refreshRfqCount();
    const token = localStorage.getItem('rayzon_vendor_token');
    if (!token) return undefined;
    const stream = new EventSource(`/api/events/stream?token=${encodeURIComponent(token)}`);
    const identifiers = [vendorProfile.sapVendorCode, vendorProfile.id, vendorUser?.id].filter(Boolean).map(String);
    const invited = (event) => {
      let data; try { data = JSON.parse(event.data); } catch { return; }
      if (!(data.vendorIds || []).some((id) => identifiers.includes(String(id)))) return;
      refreshRfqCount();
      showToast({ type: 'info', title: 'New RFQ Invitation', description: `${data.rfqNumber}: ${data.title}` });
    };
    const awarded = (event) => {
      let data; try { data = JSON.parse(event.data); } catch { return; }
      if (!identifiers.includes(String(data.vendorId)) && data.vendorName !== vendorProfile.companyName) return;
      refreshRfqCount();
      showToast({ type: 'success', title: 'RFQ Awarded', description: `${data.rfqNumber || data.rfqId} has been awarded to your company.` });
    };
    stream.addEventListener('RFQ_INVITED', invited);
    stream.addEventListener('RFQ_AWARDED', awarded);
    return () => stream.close();
  }, [isFreightForwarder, vendorProfile.sapVendorCode, vendorProfile.id, vendorProfile.companyName, vendorUser?.id, showToast, refreshRfqCount]);

  if (!vendorUser?.isLoggedIn || !localStorage.getItem('rayzon_vendor_token')) {
    return <Navigate to="/vendor/login" replace state={{ from: location.pathname }} />;
  }
  if (isFreightForwarder && (location.pathname.startsWith('/vendor/invoices') || location.pathname.startsWith('/vendor/advances'))) {
    return <Navigate to="/vendor/rfqs" replace />;
  }

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
                  `flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${isActive
                    ? 'bg-teal-50 text-[#0d7676] border-2 border-[#0d7676] font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </NavLink>

              {isFreightForwarder && <NavLink
                to="/vendor/rfqs"
                className={({ isActive }) => `flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${isActive ? 'bg-teal-50 text-[#0d7676] border-2 border-[#0d7676] font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
              ><ClipboardList className="w-4 h-4" /><span>RFQs</span>{rfqNotificationCount > 0 && <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">{rfqNotificationCount}</span>}</NavLink>}

              {!isFreightForwarder && <NavLink
                to="/vendor/invoices"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${isActive || location.pathname.startsWith('/vendor/invoices')
                    ? 'bg-teal-50 text-[#0d7676] border-2 border-[#0d7676] font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                <FileText className="w-4 h-4" />
                <span>Invoices</span>
              </NavLink>}

              {!isFreightForwarder && <NavLink
                to="/vendor/advances"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${isActive
                    ? 'bg-teal-50 text-[#0d7676] border-2 border-[#0d7676] font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                <Wallet className="w-4 h-4" />
                <span>Advance</span>
              </NavLink>}

              <NavLink
                to="/vendor/profile"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${isActive
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
            <VendorNotificationPanel
              vendorProfile={vendorProfile}
              vendorUser={vendorUser}
              isFreightForwarder={isFreightForwarder}
            />
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
              `flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold ${isActive ? 'bg-teal-50 text-[#0d7676] font-bold' : 'text-slate-600'
              }`
            }
          >
            Dashboard
          </NavLink>
          {isFreightForwarder ? <NavLink
            to="/vendor/rfqs"
            className={({ isActive }) => `flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold ${isActive ? 'bg-teal-50 text-[#0d7676] font-bold' : 'text-slate-600'}`}
          >RFQs</NavLink> : <NavLink
            to="/vendor/invoices"
            className={({ isActive }) =>
              `flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold ${isActive || location.pathname.startsWith('/vendor/invoices') ? 'bg-teal-50 text-[#0d7676] font-bold' : 'text-slate-600'
              }`
            }
          >
            Invoices
          </NavLink>}
          {!isFreightForwarder && <NavLink
            to="/vendor/advances"
            className={({ isActive }) =>
              `flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold ${isActive ? 'bg-teal-50 text-[#0d7676] font-bold' : 'text-slate-600'
              }`
            }
          >
            Advance
          </NavLink>}
          <NavLink
            to="/vendor/profile"
            className={({ isActive }) =>
              `flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold ${isActive ? 'bg-teal-50 text-[#0d7676] font-bold' : 'text-slate-600'
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
