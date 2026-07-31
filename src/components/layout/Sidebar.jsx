import React, { useMemo, useCallback } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
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
  RefreshCw,
  Cloud,
  GitFork,
  DollarSign,
  Sun,
  ChevronRight,
  Building2
} from 'lucide-react';
import { cn } from '../../lib/utils';

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
  const displayBadge = item.badge === 'pendingCount' ? (badgeValue || 51) : null;

  return (
    <NavLink
      key={item.path}
      to={item.path}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group relative w-full flex items-center transition-all outline-none rounded-xl text-xs font-semibold",
          collapsed 
            ? "justify-center py-2" 
            : "justify-between px-3 py-2.5",
          isActive
            ? "bg-[#e8f5f5] text-[#0d7676] font-bold shadow-2xs border-l-4 border-[#0d7676] rounded-l-none"
            : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
        )
      }
    >
      {({ isActive }) => (
        <>
          <div className="flex items-center gap-3 min-w-0">
            <Icon className={cn("w-4 h-4 flex-shrink-0 transition-colors", isActive ? "text-[#0d7676]" : "text-slate-600 group-hover:text-slate-600")} />
            {!collapsed && <span className="truncate text-[12px] ">{item.label}</span>}
          </div>

          {displayBadge !== null && (
            <span className={cn(
              "flex-shrink-0 font-extrabold text-[11px] rounded-full flex items-center justify-center transition-all",
              collapsed
                ? "absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white shadow-xs"
                : "w-6 h-6 bg-rose-100 text-rose-600 group-hover:bg-rose-500 group-hover:text-white"
            )}>
              {displayBadge}
            </span>
          )}

          {/* Custom Tooltip — only shown in collapsed mode */}
          {collapsed && (
            <span
              className={cn(
                "pointer-events-none absolute left-full ml-3 z-50",
                "px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap",
                "bg-[#0d7676] text-white shadow-lg",
                "opacity-0 -translate-x-1 scale-95",
                "group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100",
                "transition-all duration-150 ease-out",
                // Arrow
                "before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-1.5",
                "before:border-4 before:border-transparent before:border-r-[#0d7676]",
                "before:content-['']"
              )}
            >
              {item.label}
              {displayBadge !== null && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/20 text-white text-[10px] font-extrabold">
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
    <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
      <Link
        to="/profile"
        onClick={onNavigate}
        className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 hover:border-teal-300 transition-all duration-200 group shadow-2xs"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#0d7676] text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{user?.name || 'System Admin'}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email || 'admin@rayzon.one'}</p>
            </div>
          )}
        </div>
      </Link>
    </div>
  );
});

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, onNavigate }) {
  const { user } = useSelector((state) => state.auth);

  return (
    <aside 
      className={cn(
        "bg-white border-r border-slate-200 h-screen flex flex-col transition-all duration-300 flex-shrink-0 select-none z-40 shadow-xs",
        collapsed ? "w-16 overflow-visible" : "w-64 overflow-hidden",
        "fixed inset-y-0 left-0 lg:static lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
    >
      {/* Brand Header */}
      <header className={cn(
        "border-b border-slate-100 flex items-center h-16 flex-shrink-0 bg-white",
        collapsed ? "px-2 justify-center" : "px-5 justify-between"
      )}>
        <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-[#0d7676] flex items-center justify-center text-white font-extrabold text-sm shadow-xs flex-shrink-0">
            <Sun className="w-5 h-5 text-amber-300 fill-amber-300" />
          </div>
          {!collapsed && (
            <div className="leading-tight truncate">
              <h1 className="font-extrabold text-slate-900 text-sm tracking-tight truncate flex items-center gap-1.5">
                Rayzon Solar
                <span className="text-[9px] bg-teal-50 text-[#0d7676] px-1.5 py-0.5 rounded border border-teal-200 ">
                  P2P
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 font-semibold truncate">Procurement System</p>
            </div>
          )}
        </Link>
      </header>

      {/* Navigation List */}
      <nav className={cn("flex-1 py-3 space-y-4 scrollbar-none", collapsed ? "px-1.5 overflow-visible" : "px-3 overflow-y-auto")}>
        {NAV_SECTIONS.map((section) => (
          <div key={section.id} className="space-y-1">
            {section.title && !collapsed && (
              <div className="flex items-center gap-2 px-3 my-2">
                <span className="text-[10px] font-extrabold text-slate-700 tracking-wider uppercase">
                  {section.title}
                </span>
                <div className="flex-1 h-[1px] bg-slate-100"></div>
              </div>
            )}
            {section.items.map((item) => (
              <NavItem
                key={item.path}
                item={item}
                collapsed={collapsed}
                onNavigate={onNavigate}
                badgeValue={51}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom Profile */}
      <UserProfile user={user} collapsed={collapsed} onNavigate={onNavigate} />

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-xs items-center justify-center hover:bg-slate-50 transition-colors"
      >
        <ChevronRight className={cn("w-3 h-3 text-slate-500 transition-transform", collapsed ? "rotate-180" : "")} />
      </button>
    </aside>
  );
}