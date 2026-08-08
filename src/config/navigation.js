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
  Building2,
  FileText,
  Wallet,
  Receipt,
  ShieldCheck,
  Truck,
  FileSpreadsheet,
  Anchor,
  Package,
  CreditCard,
  Shield,
  RefreshCw
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
    label: 'Payments',
    items: [
      { to: '/p2p/purchase-orders', label: 'Purchase Orders', icon: FileText },
      { to: '/p2p/advances', label: 'Advance Payments', icon: Wallet },
      { to: '/p2p/invoices', label: 'Invoice Payments', icon: Receipt },
      { to: '/p2p/custom-duty', label: 'Custom Duty', icon: ShieldCheck },
      { to: '/p2p/logistics-payments', label: 'Logistics Payments', icon: Truck },
    ]
  },
  {
    label: 'Logistics',
    items: [
      { to: '/p2p/rfq', label: 'RFQ', icon: FileSpreadsheet },
      { to: '/p2p/exim-review', label: 'Exim Review', icon: Anchor },
      { to: '/p2p/bl-invoices', label: 'BL Invoices', icon: Package },
    ]
  },
  {
    label: 'Management',
    items: [
      { to: '/management/vendors', label: 'Vendors', icon: Store },
      { to: '/management/custom-agents', label: 'Custom Agents', icon: Shield },
      { to: '/management/logistics-providers', label: 'Logistics Providers', icon: Building2 },
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/roles', label: 'Roles & Permissions', icon: Lock },
      { to: '/admin/hierarchy-report', label: 'Hierarchy Report', icon: RefreshCw },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/sap-sync', label: 'SAP Sync', icon: Cloud },
      { to: '/admin/workflows', label: 'Workflows', icon: GitFork },
      { to: '/admin/exchange-rates', label: 'Exchange Rates', icon: DollarSign },
    ]
  }
];

export const routeMeta = {
  '/dashboard': {
    icon: LayoutDashboard,
    eyebrow: 'Workspace',
    title: 'Dashboard Overview',
    description: 'Monitor procurement operations, approvals, and system health.',
  },
  '/p2p/purchase-orders': {
    icon: FileText,
    eyebrow: 'Payments',
    title: 'Purchase Orders',
    description: 'Manage SAP Purchase Orders, SAP lock guards, and advance tracking.',
  },
  '/p2p/advances': {
    icon: Wallet,
    eyebrow: 'Payments',
    title: 'Advance Payments',
    description: 'Raise and manage PO advance payments and approval slab routing.',
  },
  '/p2p/advance-payments': {
    icon: Wallet,
    eyebrow: 'Payments',
    title: 'Advance Payment Detail',
    description: 'View request details, documents, and approval workflow timeline.',
  },
  '/admin/advance-payments': {
    icon: Wallet,
    eyebrow: 'Payments',
    title: 'Advance Payment Detail',
    description: 'View request details, documents, and approval workflow timeline.',
  },
  '/p2p/advance-payments/create': {
    icon: Wallet,
    eyebrow: 'Payments',
    title: 'New Advance Payment',
    description: 'Create a new advance payment request against a purchase order.', 
  },
  '/p2p/invoices': {
    icon: Receipt,
    eyebrow: 'Payments',
    title: 'Invoice Payments',
    description: 'Process vendor invoices, 3-way match validation, and TDS tax calculation.',
  },
  '/p2p/custom-duty': {
    icon: ShieldCheck,
    eyebrow: 'Payments',
    title: 'Custom Duty',
    description: 'Execute ICEGATE customs duty payouts for BL import shipments.',
  },
  '/p2p/logistics-payments': {
    icon: Truck,
    eyebrow: 'Payments',
    title: 'Logistics Payments',
    description: 'Pay freight, destination handling, and ocean shipping invoices.',
  },
  '/p2p/rfq': {
    icon: FileSpreadsheet,
    eyebrow: 'Logistics',
    title: 'Request For Quotes (RFQ)',
    description: 'Source freight rates from logistics vendors and award container allocations.',
  },
  '/p2p/exim-review': {
    icon: Anchor,
    eyebrow: 'Logistics',
    title: 'EXIM Review',
    description: 'Track Bill of Lading (BL) import shipment clearance stepper.',
  },
  '/p2p/bl-invoices': {
    icon: Package,
    eyebrow: 'Logistics',
    title: 'BL Invoices',
    description: 'Verify ocean freight invoices, detention, and demurrage charges.',
  },
  '/approvals': {
    icon: CheckCircle2,
    eyebrow: 'Approvals',
    title: 'Pending Approvals',
    description: 'Review requests that need your authorization.',
  },
  '/p2p/approval-engine': {
    icon: GitFork,
    eyebrow: 'Approvals',
    title: 'Approval Engine',
    description: 'Polymorphic workflow engine routing and pending authorization inbox.',
  },
  '/p2p/settlement-ledger': {
    icon: CreditCard,
    eyebrow: 'Treasury',
    title: 'Settlement Ledger',
    description: 'Central treasury bank payout ledger and UTR audit trail.',
  },
  '/management/vendors': {
    icon: Store,
    eyebrow: 'Management',
    title: 'Vendors Directory',
    description: 'Manage SAP suppliers, vendor credentials, and portal access.',
  },
  '/management/custom-agents': {
    icon: Shield,
    eyebrow: 'Management',
    title: 'Custom Agents Directory',
    description: 'Manage authorized Customs House Agents (CHA) and port assignments.',
  },
  '/management/logistics-providers': {
    icon: Building2,
    eyebrow: 'Management',
    title: 'Logistics Providers Directory',
    description: 'Manage empanelled freight forwarders and logistics partners.',
  },
  '/admin/users': {
    icon: Users,
    eyebrow: 'Management',
    title: 'User Directory',
    description: 'Provision internal users and assign operational roles.',
  },
  '/admin/roles': {
    icon: Lock,
    eyebrow: 'Management',
    title: 'Roles & Permissions',
    description: 'Control RBAC permissions and approval role mappings.',
  },
  '/admin/hierarchy-report': {
    icon: RefreshCw,
    eyebrow: 'Management',
    title: 'Hierarchy Report',
    description: 'Hierarchical grid showing advance QTs, PO amounts, invoice adjustments, and vendor requirements per user.',
  },
  '/admin/sap-sync': {
    icon: Cloud,
    eyebrow: 'System',
    title: 'SAP Sync Logs',
    description: 'Audit and trigger manual SAP S/4HANA master data synchronization.',
  },
  '/admin/sap': {
    icon: Cloud,
    eyebrow: 'System',
    title: 'SAP Sync Logs',
    description: 'Audit and trigger manual SAP S/4HANA master data synchronization.',
  },
  '/admin/workflows': {
    icon: GitFork,
    eyebrow: 'System',
    title: 'Workflow Slabs',
    description: 'Define routing, approval stages, and payment thresholds.',
  },
  '/admin/exchange-rates': {
    icon: DollarSign,
    eyebrow: 'System',
    title: 'Exchange Rates',
    description: 'Maintain currency rates used by approval routing.',
  },
  '/profile': {
    icon: User,
    eyebrow: 'Security',
    title: 'My Security Profile',
    description: 'Manage your personal information and security.',
  }
};
