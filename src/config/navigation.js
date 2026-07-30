import {
  LayoutDashboard,
  GitFork,
  DollarSign,
  CheckCircle2,
  Users,
  User,
  Lock,
  Cloud,
  Store,
  Building2
} from 'lucide-react';

export const navigation = [
  {
    label: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { to: '/approvals', label: 'Approvals', icon: CheckCircle2, badgeKey: 'pendingCount' },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { to: '/admin/workflows', label: 'Workflow rules', icon: GitFork },
      { to: '/admin/exchange-rates', label: 'Exchange rates', icon: DollarSign },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/management/vendors', label: 'Vendors directory', icon: Building2 },
      { to: '/admin/users', label: 'People & access', icon: Users },
      { to: '/admin/roles', label: 'Roles & permissions', icon: Lock },
    ],
  },
];

export const routeMeta = {
  '/dashboard': {
    icon: LayoutDashboard,
    eyebrow: 'Workspace',
    title: 'Command center',
    description: 'Monitor procurement operations, approvals, and system health.',
  },
  '/approvals': {
    icon: CheckCircle2,
    eyebrow: 'Workspace',
    title: 'Pending approvals',
    description: 'Review requests that need your attention.',
  },
  '/admin/workflows': {
    icon: GitFork,
    eyebrow: 'Configuration',
    title: 'Workflow rules',
    description: 'Define routing, approval stages, and payment thresholds.',
  },
  '/admin/exchange-rates': {
    icon: DollarSign,
    eyebrow: 'Configuration',
    title: 'Exchange rates',
    description: 'Maintain currency rates used by approval routing.',
  },
  '/admin/users': {
    icon: Users,
    eyebrow: 'Administration',
    title: 'People & access',
    description: 'Provision users and review account access.',
  },
  '/admin/roles': {
    icon: Lock,
    eyebrow: 'Administration',
    title: 'Roles & permissions',
    description: 'Control what each role can view and manage.',
  },
  '/profile': {
    icon: User,
    eyebrow: 'Account',
    title: 'Your profile',
    description: 'Manage your personal information and security.',
  },
  '/admin/sap': {
    icon: Cloud,
    eyebrow: 'System',
    title: 'SAP integration',
    description: 'Synchronize SAP S/4HANA master and transaction data.',
  },
  '/admin/vendors': {
    icon: Building2,
    eyebrow: 'Management',
    title: 'Vendors directory',
    description: 'Manage SAP suppliers, vendor credentials, and portal login access.',
  },
  '/management/vendors': {
    icon: Building2,
    eyebrow: 'Management',
    title: 'Vendors directory',
    description: 'Manage SAP suppliers, vendor credentials, and portal login access.',
  },
};
