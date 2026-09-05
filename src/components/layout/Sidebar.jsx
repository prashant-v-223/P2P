import React, { useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPendingApprovals } from '../../features/approvals/approvalsSlice';
import {
  LayoutDashboard,
  FileText,
  Wallet,
  Receipt,
  ShieldCheck,
  Truck,
  CreditCard,
  FileSpreadsheet,
  Anchor,
  Package,
  CheckSquare,
  Store,
  Shield,
  Users,
  Lock,
  Cloud,
  GitFork,
  DollarSign,
  ChevronRight,
  Building2,
  Network
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { userCanAccessRoute, getFirstAllowedRoute } from '../../lib/permissions';

// Exact Sidebar Menu Structure matching User Screenshots
const NAV_SECTIONS = [
  {
    id: 'core',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }
    ]
  },
  {
    id: 'payments',
    title: 'PAYMENTS',
    items: [
      { path: '/p2p/purchase-orders', label: 'Purchase Orders', icon: FileText },
      { path: '/p2p/advances', label: 'Advance Payments', icon: Wallet },
      { path: '/p2p/invoices', label: 'Invoice Payments', icon: Receipt },
      { path: '/p2p/custom-duty', label: 'Custom Duty', icon: ShieldCheck },
      { path: '/p2p/logistics-payments', label: 'Logistics Payments', icon: Truck },
      { path: '/p2p/settlement-ledger', label: 'Settlement Ledger', icon: CreditCard }
    ]
  },
  {
    id: 'logistics',
    title: 'LOGISTICS',
    items: [
      { path: '/p2p/rfq', label: 'RFQ', icon: FileSpreadsheet },
      { path: '/p2p/exim-review', label: 'Exim Review', icon: Anchor },
      { path: '/p2p/bl-invoices', label: 'BL Invoices', icon: Package }
    ]
  },
  {
    id: 'approvals',
    title: 'APPROVALS',
    items: [
      { path: '/approvals', label: 'Pending Approvals', icon: CheckSquare, badge: 'pendingCount' },
      { path: '/admin/hierarchy-report', label: 'Upcoming Payment Report', icon: Network }
    ]
  },
  {
    id: 'management',
    title: 'MANAGEMENT',
    items: [
      { path: '/management/vendors', label: 'Vendors', icon: Store },
      { path: '/management/custom-agents', label: 'Custom Agents', icon: Shield },
      { path: '/management/logistics-providers', label: 'Logistics Providers', icon: Building2 },
      { path: '/admin/users', label: 'Users', icon: Users },
      { path: '/admin/roles', label: 'Roles & Permissions', icon: Lock }
    ]
  },
  {
    id: 'system',
    title: 'SYSTEM',
    items: [
      { path: '/admin/sap-sync', label: 'SAP Sync', icon: Cloud },
      { path: '/admin/workflows', label: 'Workflows', icon: GitFork },
      { path: '/admin/exchange-rates', label: 'Exchange Rates', icon: DollarSign }
    ]
  }
];

// Custom NavItem matching screenshot active indicator bar and pill style
const NavItem = React.memo(({ item, collapsed, onNavigate, badgeValue }) => {
  const Icon = item.icon;
  const displayBadge = item.badge === 'pendingCount' ? (badgeValue || 0) : null;

  return (
    <NavLink
      key={item.path}
      to={item.path}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group relative w-full flex items-center transition-all outline-none font-medium",
          collapsed
            ? "justify-center py-2.5 px-0 rounded-xl mx-auto"
            : "justify-between pl-3 pr-3 py-2.5 rounded-xl",
          isActive
            ? "bg-[#0d9488] text-white shadow-sm font-semibold"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
        )
      }
    >
      {({ isActive }) => (
        <>
          <div className={cn("flex items-center min-w-0", collapsed ? "justify-center" : "gap-2.5 flex-1")}>
            <Icon className={cn(
              "flex-shrink-0 transition-colors",
              collapsed ? "w-5 h-5" : "w-[18px] h-[18px]",
              isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600"
            )} />
            {!collapsed && <span className="text-[13px] font-semibold whitespace-nowrap">{item.label}</span>}
          </div>

          {displayBadge !== null && !collapsed && (
            <span className={cn(
              "flex-shrink-0 font-bold text-[11px] rounded-full flex items-center justify-center transition-all min-w-[24px] h-[20px] px-2 ml-auto",
              isActive
                ? "bg-white/25 text-white font-extrabold"
                : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
            )}>
              {displayBadge}
            </span>
          )}

          {/* Badge for collapsed state */}
          {displayBadge !== null && collapsed && (
            <span className="absolute top-0.5 right-1 min-w-[16px] h-[16px] px-1 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-xs border border-white z-20 pointer-events-none">
              {displayBadge}
            </span>
          )}

          {/* Custom Tooltip — only shown in collapsed mode */}
          {collapsed && (
            <span
              className={cn(
                "pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50",
                "px-3 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap shadow-xl",
                "bg-slate-900 text-white border border-slate-700/50",
                "opacity-0 -translate-x-1 scale-95",
                "group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100",
                "transition-all duration-150 ease-out",
                // Arrow
                "before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-1.5",
                "before:border-4 before:border-transparent before:border-r-slate-900",
                "before:content-['']"
              )}
            >
              {item.label}
              {displayBadge !== null && (
                <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                  {displayBadge}
                </span>
              )}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
});

// User Profile Footer
const UserProfile = React.memo(({ user, collapsed, onNavigate }) => {
  const initials = user?.name ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : 'SA';

  return (
    <div className="p-2 border-t border-slate-200 bg-white shrink-0 relative group">
      <Link
        to="/profile"
        onClick={onNavigate}
        className={cn(
          "flex items-center p-1.5 rounded-xl hover:bg-slate-50 transition-all duration-200",
          collapsed ? "justify-center" : "justify-start gap-2.5"
        )}
      >
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0d7676] to-[#096464] text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
          {initials}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-slate-800 truncate leading-tight">{user?.name || 'System Admin'}</p>
            <p className="text-[11px] text-slate-500 truncate leading-tight mt-0.5">{user?.email || 'admin@rayzon.one'}</p>
          </div>
        )}
      </Link>

      {/* Profile Tooltip for collapsed state */}
      {collapsed && (
        <span
          className={cn(
            "pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50",
            "px-3 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap shadow-xl",
            "bg-slate-900 text-white border border-slate-700/50",
            "opacity-0 -translate-x-1 scale-95",
            "group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100",
            "transition-all duration-150 ease-out",
            "before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-1.5",
            "before:border-4 before:border-transparent before:border-r-slate-900",
            "before:content-['']"
          )}
        >
          {user?.name || 'Profile'} ({user?.email || 'Admin'})
        </span>
      )}
    </div>
  );
});

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, onNavigate }) {
  const { user } = useSelector((state) => state.auth);
  const userRole = user?.role || 'admin';
  const customPerms = user?.permissions || user?.customPermissions;
  const homePath = getFirstAllowedRoute(userRole, customPerms);

  const dispatch = useDispatch();
  const pendingCount = useSelector((state) => state.approvals?.pendingCount || 0);

  useEffect(() => {
    dispatch(fetchPendingApprovals(userRole));
  }, [dispatch, userRole]);

  const allowedSections = NAV_SECTIONS.map((section) => {
    const allowedItems = section.items.filter((item) => userCanAccessRoute(userRole, item.path, customPerms));
    return { ...section, items: allowedItems };
  }).filter((section) => section.items.length > 0);

  return (
    <aside
      className={cn(
        "bg-white border-r border-slate-200 h-screen flex flex-col transition-all duration-300 flex-shrink-0 select-none z-40 relative overflow-visible",
        collapsed ? "w-[68px]" : "w-[232px] 2xl:w-[250px]",
        "fixed inset-y-0 left-0 lg:static lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
    >
      {/* Brand Header with Improved Logo */}
      <header className={cn(
        "border-b border-slate-200 flex items-center h-[64px] flex-shrink-0 bg-white relative",
        collapsed ? "px-2 justify-center" : "px-4 justify-start"
      )}>
        <Link to={homePath} onClick={onNavigate} className="flex items-center gap-3 overflow-hidden transition-all duration-200">
          {collapsed ? (
            <div className="w-7 h-7 rounded-lg bg-[#0d7676] text-white font-black text-sm flex items-center justify-center shadow-2xs shrink-0">
              R
            </div>
          ) : (
            <img src="/logo.png" alt="logo" width={150} height={25} />
          )}
        </Link>
      </header>

      {/* Navigation List */}
      <nav className={cn("flex-1 py-2 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-none", collapsed ? "px-2" : "px-3 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent")}>
        {allowedSections.map((section) => (
          <div key={section.id} className={cn("space-y-0.5", section.id !== 'core' && 'mt-5')}>
            {section.title && !collapsed && (
              <div className="px-3 pt-2 pb-2">
                <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                  {section.title}
                </span>
              </div>
            )}
            {section.items.map((item) => (
              <NavItem
                key={item.path}
                item={item}
                collapsed={collapsed}
                onNavigate={onNavigate}
                badgeValue={pendingCount}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom Profile */}
      <UserProfile user={user} collapsed={collapsed} onNavigate={onNavigate} />

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex absolute -right-3.5 top-[18px] z-50 w-7 h-7 rounded-full bg-white border border-slate-200 shadow-md items-center justify-center hover:bg-teal-50 hover:border-teal-300 hover:text-[#0d7676] transition-all active:scale-95 cursor-pointer"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <ChevronRight className={cn("w-4 h-4 text-slate-600 transition-transform duration-200", collapsed ? "" : "rotate-180")} />
      </button>
    </aside>
  );
}
