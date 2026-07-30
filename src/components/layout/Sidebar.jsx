import React, { useMemo, useCallback } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { 
  LayoutDashboard, 
  GitFork, 
  DollarSign, 
  CheckCircle2, 
  Users, 
  Lock, 
  User,
  Building2,
  ChevronRight,
  Sun,
  Shield,
  Settings
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';

// Constants for better maintainability
const NAV_SECTIONS = [
  {
    id: 'core',
    title: 'CORE WORKSPACE',
    items: [
      { path: '/dashboard', label: 'Dashboard Overview', icon: LayoutDashboard },
      { path: '/approvals', label: 'Pending Approvals', icon: CheckCircle2, badge: 'pendingCount' }
    ]
  },
  {
    id: 'configuration',
    title: 'CONFIGURATION',
    items: [
      { path: '/admin/workflows', label: 'Workflow Slabs', icon: GitFork },
      { path: '/admin/exchange-rates', label: 'Exchange Rates', icon: DollarSign }
    ]
  },
  {
    id: 'management',
    title: 'MANAGEMENT',
    items: [
      { path: '/management/vendors', label: 'Vendors Directory', icon: Building2 },
      { path: '/admin/users', label: 'User Directory', icon: Users },
      { path: '/admin/roles', label: 'Roles & Permissions', icon: Lock }
    ]
  },
  {
    id: 'security',
    title: 'SECURITY',
    items: [
      { path: '/profile', label: 'My Security Profile', icon: User }
    ]
  }
];

// Extracted NavItem component for better reusability
const NavItem = React.memo(({ item, collapsed, onNavigate, badgeValue }) => {
  const Icon = item.icon;
  const hasBadge = badgeValue !== undefined && badgeValue > 0;

  return (
    <NavLink
      key={item.path}
      to={item.path}
      onClick={onNavigate}
      title={collapsed ? item.label : ''}
      className={({ isActive }) =>
        cn(
          "group w-full flex items-center transition-all rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2",
          collapsed 
            ? "justify-center py-0.5" 
            : "justify-between px-3 py-2.5 text-xs font-semibold",
          isActive
            ? (collapsed 
                ? "text-[#0d7676]" 
                : "bg-teal-50/80 text-[#0d7676] font-bold border-2 border-[#0d7676] shadow-sm")
            : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900",
          "transition-colors duration-150"
        )
      }
    >
      {({ isActive }) => (
        collapsed ? (
          <CollapsedNavItem isActive={isActive} Icon={Icon} badgeValue={badgeValue} />
        ) : (
          <ExpandedNavItem isActive={isActive} Icon={Icon} label={item.label} badgeValue={badgeValue} />
        )
      )}
    </NavLink>
  );
});

// Sub-component for collapsed state
const CollapsedNavItem = React.memo(({ isActive, Icon, badgeValue }) => (
  <div className={cn(
    "relative w-10 h-10 rounded-xl flex items-center justify-center transition-all",
    isActive 
      ? "bg-teal-50 text-[#0d7676] ring-1 ring-teal-200/80 shadow-sm" 
      : "hover:bg-slate-100 text-slate-500"
  )}>
    <Icon className={cn("w-5 h-5", isActive ? "text-[#0d7676]" : "text-slate-500")} />
    {badgeValue > 0 && (
      <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
        {badgeValue > 99 ? '99+' : badgeValue}
      </span>
    )}
  </div>
));

// Sub-component for expanded state
const ExpandedNavItem = React.memo(({ isActive, Icon, label, badgeValue }) => (
  <>
    <div className="flex items-center gap-3 min-w-0">
      <Icon className={cn("w-4 h-4 flex-shrink-0 transition-colors", isActive ? "text-[#0d7676]" : "text-slate-400")} />
      <span className="truncate">{label}</span>
    </div>
    {badgeValue > 0 && (
      <Badge variant="rose" className="px-2 py-0.5 text-[10px] font-bold">
        {badgeValue}
      </Badge>
    )}
  </>
));

// User Profile component
const UserProfile = React.memo(({ user, collapsed, onNavigate }) => {
  const initials = useMemo(() => {
    if (user?.avatar) return user.avatar;
    if (user?.name) {
      return user.name
        .split(' ')
        .map(word => word[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    }
    return 'SA';
  }, [user]);

  const displayName = user?.name || 'System Admin';
  const displayEmail = user?.email || 'admin@rayzon.one';

  return collapsed ? (
    <div className="py-3 border-t border-slate-100 flex justify-center bg-slate-50/30 flex-shrink-0">
      <Link 
        to="/profile" 
        onClick={onNavigate}
        className="w-9 h-9 rounded-full bg-[#0d7676] text-white font-bold text-xs flex items-center justify-center shadow-sm hover:ring-2 hover:ring-teal-300 transition-all duration-200" 
        title={displayName}
      >
        {initials}
      </Link>
    </div>
  ) : (
    <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
      <Link
        to="/profile"
        onClick={onNavigate}
        className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 hover:border-teal-300 transition-all duration-200 group shadow-sm hover:shadow-md"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#0d7676] text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate leading-tight">{displayName}</p>
            <p className="text-[10px] text-slate-400 font-medium truncate">{displayEmail}</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#0d7676] transition-colors flex-shrink-0" />
      </Link>
    </div>
  );
});

// Main Sidebar Component
export default function Sidebar({ collapsed, setCollapsed, mobileOpen, onNavigate }) {
  const { user } = useSelector((state) => state.auth);
  const { pendingCount } = useSelector((state) => state.approvals);

  // Memoize navigation sections with badge values
  const navSections = useMemo(() => {
    return NAV_SECTIONS.map(section => ({
      ...section,
      items: section.items.map(item => ({
        ...item,
        badgeValue: item.badge === 'pendingCount' ? pendingCount : undefined
      }))
    }));
  }, [pendingCount]);

  // Handle keyboard navigation for collapsed state
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && collapsed) {
      setCollapsed(false);
    }
  }, [collapsed, setCollapsed]);

  return (
    <aside 
      className={cn(
        "bg-white border-r border-slate-200 h-screen flex flex-col transition-all duration-300 flex-shrink-0 select-none z-40 shadow-sm",
        collapsed ? "w-16" : "w-64",
        "fixed inset-y-0 left-0 lg:static lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
      aria-label="Main navigation"
      role="navigation"
    >
      {/* Brand Header */}
      <header className={cn(
        "border-b border-slate-100 flex items-center transition-all h-16 flex-shrink-0 bg-white",
        collapsed ? "px-2 justify-center" : "px-5 justify-between"
      )}>
        <Link 
          to="/dashboard" 
          onClick={onNavigate} 
          className="flex items-center gap-3 overflow-hidden focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded-lg outline-none"
          aria-label="Rayzon Solar P2P Portal"
        >
          <div className="w-9 h-9 rounded-xl bg-[#0d7676] flex items-center justify-center text-white font-extrabold text-sm shadow-sm flex-shrink-0 ring-2 ring-teal-100">
            <Sun className="w-5 h-5 text-amber-300 fill-amber-300" aria-hidden="true" />
          </div>
          {!collapsed && (
            <div className="leading-tight truncate">
              <h1 className="font-extrabold text-slate-900 text-sm tracking-tight truncate flex items-center gap-1.5">
                Rayzon Solar
                <span className="text-[9px] bg-teal-50 text-[#0d7676] px-1.5 py-0.5 rounded border border-teal-200 font-mono">
                  P2P
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 font-semibold truncate">Procurement Portal</p>
            </div>
          )}
        </Link>
        
        {/* Mobile close button - only visible on mobile when open */}
        {mobileOpen && (
          <button
            onClick={() => setCollapsed(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </header>

      {/* Navigation List */}
      <nav 
        className={cn(
          "flex-1 overflow-y-auto py-2 space-y-3 scrollbar-thin scrollbar-thumb-slate-200",
          collapsed ? "px-2" : "px-3"
        )}
        aria-label="Sidebar navigation"
        onKeyDown={handleKeyDown}
      >
        {navSections.map((section) => (
          <div key={section.id} className="space-y-1">
            {section.title && !collapsed && (
              <h3 className="px-3 text-[10px] font-extrabold text-slate-400 tracking-wider uppercase mb-2">
                {section.title}
              </h3>
            )}
            {section.items.map((item) => (
              <NavItem
                key={item.path}
                item={item}
                collapsed={collapsed}
                onNavigate={onNavigate}
                badgeValue={item.badgeValue}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom User Profile Section */}
      <UserProfile
        user={user}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />

      {/* Optional: Toggle collapse button (uncomment if needed) */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm items-center justify-center hover:bg-slate-50 transition-colors"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <ChevronRight className={cn("w-3 h-3 text-slate-500 transition-transform", collapsed ? "rotate-180" : "")} />
      </button>
    </aside>
  );
}