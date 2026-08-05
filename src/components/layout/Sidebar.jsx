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
  Building2
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
      { path: '/p2p/logistics-payments', label: 'Logistics Payments', icon: Truck }
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
      { path: '/approvals', label: 'Pending Approvals', icon: CheckSquare, badge: 'pendingCount' }
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
            ? "justify-center py-3 rounded-xl mx-auto"
            : "justify-between pl-3 pr-3 py-2.5 rounded-xl",
          isActive
            ? "bg-[#0d9488] text-white shadow-sm font-semibold"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
        )
      }
    >
      {({ isActive }) => (
        <>
          <div className="flex items-center gap-3 min-w-0">
            <Icon className={cn(
              "flex-shrink-0 transition-colors", 
              collapsed ? "w-5 h-5" : "w-[18px] h-[18px]",
              isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600"
            )} />
            {!collapsed && <span className="truncate text-[13.5px] leading-tight">{item.label}</span>}
          </div>

          {displayBadge !== null && !collapsed && (
            <span className={cn(
              "flex-shrink-0 font-bold text-[11px] rounded-full flex items-center justify-center transition-all min-w-[24px] h-[20px] px-2",
              isActive
                ? "bg-white/25 text-white"
                : "bg-slate-100 text-slate-600"
            )}>
              {displayBadge}
            </span>
          )}

          {/* Badge for collapsed state */}
          {displayBadge !== null && collapsed && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
              {displayBadge}
            </span>
          )}

          {/* Custom Tooltip — only shown in collapsed mode */}
          {collapsed && (
            <span
              className={cn(
                "pointer-events-none absolute left-full ml-3 z-50",
                "px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap",
                "bg-slate-800 text-white shadow-lg",
                "opacity-0 -translate-x-1 scale-95",
                "group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100",
                "transition-all duration-150 ease-out",
                // Arrow
                "before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-1.5",
                "before:border-4 before:border-transparent before:border-r-slate-800",
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
    <div className="p-3 border-t border-slate-200 bg-white flex-shrink-0">
      <Link
        to="/profile"
        onClick={onNavigate}
        className={cn(
          "flex items-center p-2.5 rounded-xl hover:bg-slate-50 transition-all duration-200 group",
          collapsed ? "justify-center" : "justify-start gap-2.5"
        )}
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0d9488] to-[#0f766e] text-white font-bold text-sm flex items-center justify-center flex-shrink-0 shadow-sm">
          {initials}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-slate-800 truncate leading-tight">{user?.name || 'System Admin'}</p>
            <p className="text-[11px] text-slate-500 truncate leading-tight mt-0.5">{user?.email || 'admin@rayzon.one'}</p>
          </div>
        )}
      </Link>
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
        "bg-white border-r border-slate-200 h-screen flex flex-col transition-all duration-300 flex-shrink-0 select-none z-40",
        collapsed ? "w-[68px] overflow-visible" : "w-[250px] ",
        "fixed inset-y-0 left-0 lg:static lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
    >
      {/* Brand Header with Improved Logo */}
      <header className={cn(
        "border-b border-slate-200 flex items-center h-[64px] flex-shrink-0 bg-white",
        collapsed ? "px-3 justify-center" : "px-4 justify-start"
      )}>
        <Link to={homePath} onClick={onNavigate} className="flex items-center gap-3 overflow-hidden transition-all duration-200">
          {collapsed ? (
            /* Collapsed Logo - Icon Only */
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#0d9488] to-[#0f766e] shadow-sm">
              <span className="text-white font-black text-[17px]">R</span>
            </div>
          ) : (
            /* Full Logo with Company Name */
            <>
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#0d9488] to-[#0f766e] shadow-sm">
                <span className="text-white font-black text-[17px]">R</span>
              </div>
              <div className="flex flex-col -space-y-0.5">
                <span className="text-[16px] font-black text-slate-800 tracking-tight leading-tight">
                  RAYZON
                </span>
                <span className="text-[11px] font-medium text-slate-500 tracking-wide leading-tight uppercase">
                  Solar
                </span>
              </div>
            </>
          )}
        </Link>
      </header>

      {/* Navigation List */}
      <nav className={cn("flex-1 py-3 space-y-1", collapsed ? "px-2 overflow-visible" : "px-3 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent")}>
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
        className="hidden lg:flex absolute -right-3 top-1/2 transform -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-slate-200 shadow-xs items-center justify-center hover:bg-slate-50 transition-colors"
      >
        <ChevronRight className={cn("w-4 h-4 ml-0.5 text-slate-500 transition-transform", collapsed ? "rotate-180" : "")} />
      </button>
    </aside>
  );
}