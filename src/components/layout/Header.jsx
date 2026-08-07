import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { logout } from '../../features/auth/authSlice';
import { fetchPendingApprovals } from '../../features/approvals/approvalsSlice';
import { Menu, ChevronsLeft, ChevronsRight, ChevronDown, User, LogOut } from 'lucide-react';
import { routeMeta } from '../../config/navigation';
import NotificationPanel from './NotificationPanel';

export default function Header({ collapsed, setCollapsed, onOpenMobile }) {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const { user } = useSelector((state) => state.auth);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    dispatch(fetchPendingApprovals(user?.role || 'Finance Lead'));
  }, [dispatch, user?.role]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  // Exact match first, then try progressive prefix stripping for dynamic routes like /p2p/advance-payments/:id
  const meta = routeMeta[location.pathname]
    || routeMeta[location.pathname.split('/').slice(0, -1).join('/')] // strip last segment e.g. /ADV-xxx
    || routeMeta[location.pathname.split('/').slice(0, -2).join('/')] // strip last 2 e.g. /ADV-xxx/edit
    || (location.pathname.startsWith('/admin/vendors') ? routeMeta['/management/vendors'] : null)
    || routeMeta['/dashboard'];
  const PageIcon = meta.icon;

  return (
    <header className="sticky top-0 z-20 flex min-h-[60px] items-center justify-between border-b border-slate-200 bg-white/95 px-3 backdrop-blur-xl sm:px-4 lg:px-5">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <button onClick={onOpenMobile} className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50 lg:hidden" aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-500 transition hover:bg-teal-50 hover:text-teal-700 lg:flex"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight className="h-[18px] w-[18px]" /> : <ChevronsLeft className="h-[18px] w-[18px]" />}
        </button>
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-100 sm:flex">
            <PageIcon className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-bold tracking-tight text-slate-950">{meta.title}</h1>
              <span className="hidden rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 md:inline">{meta.eyebrow}</span>
            </div>
            <p className="hidden truncate text-xs text-slate-500 md:block">{meta.description}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <NotificationPanel />

        {/* User Profile */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2.5 rounded-xl border border-transparent p-1.5 transition hover:border-slate-200 hover:bg-slate-50"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-teal-200 bg-teal-50 text-sm font-bold text-teal-800">
              {user?.avatar || 'SA'}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-semibold text-slate-800 leading-tight">{user?.name || 'System Admin'}</p>
              <p className="mt-0.5 text-xs text-slate-500">{user?.role || 'System Admin'}</p>
            </div>
            <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-sm shadow-2xl shadow-slate-900/10">
              <div className="mb-1 rounded-xl bg-slate-50 px-3 py-3">
                <p className="font-semibold text-slate-900">{user?.name || 'System Admin'}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{user?.email || 'admin@rayzon.one'}</p>
              </div>

              <Link
                to="/profile"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                <User className="h-4 w-4 text-slate-400" />
                Profile & security
              </Link>
              <div className="my-1 border-t border-slate-100"></div>
              <button
                onClick={() => { dispatch(logout()); navigate('/login'); }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-medium text-rose-600 hover:bg-rose-50"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-500" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

    </header>
  );
}
