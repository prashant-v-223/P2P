import { Role } from '../models/Role.js';
import { Permission } from '../models/Permission.js';

// ─────────────────────────────────────────────────────────────────────────────
// ALL 49 PERMISSIONS (matching the user's reference spec + system needs)
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_PERMISSIONS = [
  // ── Dashboard ──────────────────────────────────────────────────────────────
  { id: 'perm-001', key: 'dashboard.view', name: 'View Dashboard', module: 'Dashboard', action: 'view', description: 'Access the main overview dashboard.', type: 'System', status: 'Active' },

  // ── Purchase Orders ─────────────────────────────────────────────────────────
  { id: 'perm-002', key: 'purchase-orders.view', name: 'View Purchase Orders', module: 'Purchase Orders', action: 'view', description: 'View purchase order list and detail.', type: 'System', status: 'Active' },

  // ── Advance Payments ────────────────────────────────────────────────────────
  { id: 'perm-003', key: 'advance-payments.view', name: 'View Advance Payments', module: 'Advance Payments', action: 'view', description: 'View advance payment records.', type: 'System', status: 'Active' },
  { id: 'perm-004', key: 'advance-payments.create', name: 'Create Advance Payment', module: 'Advance Payments', action: 'create', description: 'Create new advance payment requests.', type: 'System', status: 'Active' },
  { id: 'perm-005', key: 'advance-payments.delete', name: 'Delete Advance Payment', module: 'Advance Payments', action: 'delete', description: 'Delete advance payment records.', type: 'System', status: 'Active' },
  { id: 'perm-006', key: 'advance-payments.mark-paid', name: 'Mark Advance Paid', module: 'Advance Payments', action: 'mark-paid', description: 'Mark advance payments as paid.', type: 'System', status: 'Active' },

  // ── Invoice Payments ────────────────────────────────────────────────────────
  { id: 'perm-007', key: 'invoice-payments.view', name: 'View Invoice Payments', module: 'Invoice Payments', action: 'view', description: 'View invoice payment records.', type: 'System', status: 'Active' },
  { id: 'perm-008', key: 'invoice-payments.create', name: 'Create Invoice Payment', module: 'Invoice Payments', action: 'create', description: 'Create new invoice payment entries.', type: 'System', status: 'Active' },
  { id: 'perm-009', key: 'invoice-payments.delete', name: 'Delete Invoice Payment', module: 'Invoice Payments', action: 'delete', description: 'Delete invoice payment records.', type: 'System', status: 'Active' },
  { id: 'perm-010', key: 'invoice-payments.mark-paid', name: 'Mark Invoice Paid', module: 'Invoice Payments', action: 'mark-paid', description: 'Mark invoice payments as paid.', type: 'System', status: 'Active' },

  // ── Logistics Payments ──────────────────────────────────────────────────────
  { id: 'perm-011', key: 'logistics-payments.view', name: 'View Logistics Payments', module: 'Logistics Payments', action: 'view', description: 'View logistics payment records.', type: 'System', status: 'Active' },
  { id: 'perm-012', key: 'logistics-payments.create', name: 'Create Logistics Payment', module: 'Logistics Payments', action: 'create', description: 'Create new logistics payment entries.', type: 'System', status: 'Active' },
  { id: 'perm-013', key: 'logistics-payments.delete', name: 'Delete Logistics Payment', module: 'Logistics Payments', action: 'delete', description: 'Delete logistics payment records.', type: 'System', status: 'Active' },
  { id: 'perm-014', key: 'logistics-payments.mark-paid', name: 'Mark Logistics Paid', module: 'Logistics Payments', action: 'mark-paid', description: 'Mark logistics payments as paid.', type: 'System', status: 'Active' },

  // ── Custom Duty ─────────────────────────────────────────────────────────────
  { id: 'perm-015', key: 'custom-duty.view', name: 'View Custom Duty', module: 'Custom Duty', action: 'view', description: 'View custom duty payment records.', type: 'System', status: 'Active' },
  { id: 'perm-016', key: 'custom-duty.create', name: 'Create Custom Duty', module: 'Custom Duty', action: 'create', description: 'Create custom duty payment entries.', type: 'System', status: 'Active' },
  { id: 'perm-017', key: 'custom-duty.delete', name: 'Delete Custom Duty', module: 'Custom Duty', action: 'delete', description: 'Delete custom duty records.', type: 'System', status: 'Active' },
  { id: 'perm-018', key: 'custom-duty.mark-paid', name: 'Mark Custom Duty Paid', module: 'Custom Duty', action: 'mark-paid', description: 'Mark custom duty as paid.', type: 'System', status: 'Active' },

  // ── BI / Blank Invoices ─────────────────────────────────────────────────────
  { id: 'perm-019', key: 'blank-invoices.view', name: 'View BI Invoices', module: 'BI Invoices', action: 'view', description: 'View blank invoice records.', type: 'System', status: 'Active' },
  { id: 'perm-020', key: 'blank-invoices.action', name: 'BI Invoice Actions', module: 'BI Invoices', action: 'action', description: 'Perform actions on blank invoices.', type: 'System', status: 'Active' },
  { id: 'perm-021', key: 'blank-invoices.mark-paid', name: 'Mark BI Invoice Paid', module: 'BI Invoices', action: 'mark-paid', description: 'Mark blank invoices as paid.', type: 'System', status: 'Active' },

  // ── Approvals ───────────────────────────────────────────────────────────────
  { id: 'perm-022', key: 'approvals.view', name: 'View Approvals', module: 'Approvals', action: 'view', description: 'View pending and completed approval requests.', type: 'System', status: 'Active' },
  { id: 'perm-023', key: 'approvals.action', name: 'Perform Approval Action', module: 'Approvals', action: 'action', description: 'Approve, reject, or return requests.', type: 'System', status: 'Active' },

  // ── RFQ ─────────────────────────────────────────────────────────────────────
  { id: 'perm-024', key: 'rfq.view', name: 'View RFQ', module: 'Rfq', action: 'view', description: 'View RFQ list and detail.', type: 'System', status: 'Active' },
  { id: 'perm-025', key: 'rfq.create', name: 'Create RFQ', module: 'Rfq', action: 'create', description: 'Create new RFQ sourcing events.', type: 'System', status: 'Active' },
  { id: 'perm-026', key: 'rfq.delete', name: 'Delete RFQ', module: 'Rfq', action: 'delete', description: 'Delete RFQ records.', type: 'System', status: 'Active' },
  { id: 'perm-027', key: 'rfq.award', name: 'Award RFQ', module: 'Rfq', action: 'award', description: 'Award RFQ to selected vendor.', type: 'System', status: 'Active' },

  // ── BL (Bill of Lading) ─────────────────────────────────────────────────────
  { id: 'perm-028', key: 'bl.view', name: 'View BL', module: 'Bl', action: 'view', description: 'View Bill of Lading records.', type: 'System', status: 'Active' },
  { id: 'perm-029', key: 'bl.manage', name: 'Manage BL', module: 'Bl', action: 'manage', description: 'Create and manage BL entries.', type: 'System', status: 'Active' },

  // ── Exim ─────────────────────────────────────────────────────────────────────
  { id: 'perm-030', key: 'exim.view', name: 'View EXIM', module: 'Exim', action: 'view', description: 'View EXIM / import review records.', type: 'System', status: 'Active' },
  { id: 'perm-031', key: 'exim.manage', name: 'Manage EXIM', module: 'Exim', action: 'manage', description: 'Perform EXIM review and clearance actions.', type: 'System', status: 'Active' },

  // ── Logistics Providers ──────────────────────────────────────────────────────
  { id: 'perm-032', key: 'logistics-providers.view', name: 'View Logistics Providers', module: 'Logistics Providers', action: 'view', description: 'View logistics provider directory.', type: 'System', status: 'Active' },
  { id: 'perm-033', key: 'logistics-providers.manage', name: 'Manage Logistics Providers', module: 'Logistics Providers', action: 'manage', description: 'Create, edit and deactivate logistics providers.', type: 'System', status: 'Active' },

  // ── Custom Agents ────────────────────────────────────────────────────────────
  { id: 'perm-034', key: 'custom-agents.view', name: 'View Custom Agents', module: 'Custom Agents', action: 'view', description: 'View customs agent directory.', type: 'System', status: 'Active' },
  { id: 'perm-035', key: 'custom-agents.manage', name: 'Manage Custom Agents', module: 'Custom Agents', action: 'manage', description: 'Create and manage customs agents.', type: 'System', status: 'Active' },

  // ── Vendors ──────────────────────────────────────────────────────────────────
  { id: 'perm-036', key: 'vendors.view', name: 'View Vendors', module: 'Vendors', action: 'view', description: 'View vendor directory and profile.', type: 'System', status: 'Active' },
  { id: 'perm-037', key: 'vendors.manage', name: 'Manage Vendors', module: 'Vendors', action: 'manage', description: 'Create, edit and manage vendors.', type: 'System', status: 'Active' },

  // ── Exchange Rates ───────────────────────────────────────────────────────────
  { id: 'perm-038', key: 'exchange-rates.view', name: 'View Exchange Rates', module: 'Exchange Rates', action: 'view', description: 'View currency exchange rates.', type: 'System', status: 'Active' },
  { id: 'perm-039', key: 'exchange-rates.manage', name: 'Manage Exchange Rates', module: 'Exchange Rates', action: 'manage', description: 'Update FX rates used for INR conversion.', type: 'System', status: 'Active' },

  // ── SAP Sync ─────────────────────────────────────────────────────────────────
  { id: 'perm-040', key: 'sap.view', name: 'View SAP Sync', module: 'Sap', action: 'view', description: 'View SAP sync run logs.', type: 'System', status: 'Active' },
  { id: 'perm-041', key: 'sap.sync', name: 'Trigger SAP Sync', module: 'Sap', action: 'sync', description: 'Manually trigger SAP data sync.', type: 'System', status: 'Active' },

  // ── Workflows ────────────────────────────────────────────────────────────────
  { id: 'perm-042', key: 'workflows.view', name: 'View Workflows', module: 'Workflows', action: 'view', description: 'View workflow slab routing rules.', type: 'System', status: 'Active' },
  { id: 'perm-043', key: 'workflows.manage', name: 'Manage Workflows', module: 'Workflows', action: 'manage', description: 'Create, edit and delete workflow slabs.', type: 'System', status: 'Active' },

  // ── Users ────────────────────────────────────────────────────────────────────
  { id: 'perm-044', key: 'users.view', name: 'View Users', module: 'Users', action: 'view', description: 'View user directory and account details.', type: 'System', status: 'Active' },
  { id: 'perm-045', key: 'users.create', name: 'Provision User', module: 'Users', action: 'create', description: 'Provision new user account in directory.', type: 'System', status: 'Active' },
  { id: 'perm-046', key: 'users.edit', name: 'Edit User', module: 'Users', action: 'edit', description: 'Edit user profile, role, department and account status.', type: 'System', status: 'Active' },
  { id: 'perm-047', key: 'users.delete', name: 'Delete User', module: 'Users', action: 'delete', description: 'Delete user account from directory.', type: 'System', status: 'Active' },
  { id: 'perm-048', key: 'users.manage', name: 'Manage Users', module: 'Users', action: 'manage', description: 'Master control to create, edit, deactivate and delete user accounts.', type: 'System', status: 'Active' },

  // ── Roles & Permissions ──────────────────────────────────────────────────────
  { id: 'perm-049', key: 'roles.view', name: 'View Roles', module: 'Roles & Permissions', action: 'view', description: 'View system roles and permission matrix.', type: 'System', status: 'Active' },
  { id: 'perm-050', key: 'roles.manage', name: 'Manage Roles', module: 'Roles & Permissions', action: 'manage', description: 'Create, edit roles and assign permissions.', type: 'System', status: 'Active' },
  { id: 'perm-051', key: 'permissions.view', name: 'View Permissions', module: 'Roles & Permissions', action: 'view-perms', description: 'View the permission registry.', type: 'System', status: 'Active' },
  { id: 'perm-052', key: 'permissions.create', name: 'Create Permissions', module: 'Roles & Permissions', action: 'create-perms', description: 'Create new permission keys.', type: 'System', status: 'Active' },
];

// ─────────────────────────────────────────────────────────────────────────────
// ALL 10 ROLES (matching the user's reference spec)
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_ROLES = [
  {
    id: 'role-accounts',
    roleName: 'accounts',
    description: 'Accounts team — financial record views, payment tracking and basic dashboard access.',
    type: 'System',
    status: 'Active',
    permissions: {
      'dashboard': ['view'],
      'purchase-orders': ['view'],
      'advance-payments': ['view'],
      'invoice-payments': ['view'],
      'logistics-payments': ['view'],
      'custom-duty': ['view'],
      'approvals': ['view'],
      'blank-invoices': ['view'],
      'exchange-rates': ['view'],
      'sap': ['view']
    }
  },
  {
    id: 'role-admin',
    roleName: 'admin',
    description: 'Full administrative control across all modules and settings.',
    type: 'System',
    status: 'Active',
    permissions: {
      'dashboard': ['view'],
      'purchase-orders': ['view'],
      'advance-payments': ['view', 'create', 'delete', 'mark-paid'],
      'invoice-payments': ['view', 'create', 'delete', 'mark-paid'],
      'logistics-payments': ['view', 'create', 'delete', 'mark-paid'],
      'custom-duty': ['view', 'create', 'delete', 'mark-paid'],
      'blank-invoices': ['view', 'action', 'mark-paid'],
      'approvals': ['view', 'action'],
      'rfq': ['view', 'create', 'delete', 'award'],
      'bl': ['view', 'manage'],
      'exim': ['view', 'manage'],
      'logistics-providers': ['view', 'manage'],
      'custom-agents': ['view', 'manage'],
      'vendors': ['view', 'manage'],
      'exchange-rates': ['view', 'manage'],
      'sap': ['view', 'sync'],
      'workflows': ['view', 'manage'],
      'users': ['view', 'create', 'edit', 'delete', 'manage'],
      'roles': ['view', 'manage'],
      'permissions': ['view-perms', 'create-perms']
    }
  },
  {
    id: 'role-cfo',
    roleName: 'cfo',
    description: 'Chief Financial Officer — full financial visibility and approval authority.',
    type: 'System',
    status: 'Active',
    permissions: {
      'dashboard': ['view'],
      'purchase-orders': ['view'],
      'advance-payments': ['view', 'mark-paid'],
      'invoice-payments': ['view', 'mark-paid'],
      'logistics-payments': ['view', 'mark-paid'],
      'custom-duty': ['view', 'mark-paid'],
      'approvals': ['view', 'action'],
      'exchange-rates': ['view', 'manage'],
      'vendors': ['view'],
      'workflows': ['view']
    }
  },
  {
    id: 'role-exim',
    roleName: 'exim',
    description: 'EXIM team — handles import/export clearance, logistics, customs and BL tracking.',
    type: 'System',
    status: 'Active',
    permissions: {
      'dashboard': ['view'],
      'purchase-orders': ['view'],
      'advance-payments': ['view'],
      'invoice-payments': ['view'],
      'logistics-payments': ['view', 'create'],
      'custom-duty': ['view', 'create'],
      'blank-invoices': ['view', 'action'],
      'approvals': ['view', 'action'],
      'rfq': ['view', 'create'],
      'bl': ['view', 'manage'],
      'exim': ['view', 'manage'],
      'logistics-providers': ['view', 'manage'],
      'custom-agents': ['view', 'manage'],
      'exchange-rates': ['view'],
      'sap': ['view'],
      'vendors': ['view'],
      'workflows': ['view']
    }
  },
  {
    id: 'role-exim-manager',
    roleName: 'exim-manager',
    description: 'EXIM Manager — oversight of EXIM operations with approval and RFQ award authority.',
    type: 'Custom',
    status: 'Active',
    permissions: {
      'dashboard': ['view'],
      'advance-payments': ['view'],
      'rfq': ['view', 'create', 'award'],
      'bl': ['view', 'manage'],
      'exim': ['view', 'manage'],
      'logistics-providers': ['view', 'manage'],
      'custom-agents': ['view', 'manage'],
      'logistics-payments': ['view', 'create'],
      'custom-duty': ['view'],
      'blank-invoices': ['view', 'action'],
      'approvals': ['view', 'action'],
      'exchange-rates': ['view'],
      'vendors': ['view'],
      'workflows': ['view'],
      'users': ['view']
    }
  },
  {
    id: 'role-finance',
    roleName: 'finance',
    description: 'Finance team — payment marking, vendor oversight and financial approvals.',
    type: 'System',
    status: 'Active',
    permissions: {
      'dashboard': ['view'],
      'logistics-payments': ['view', 'mark-paid'],
      'advance-payments': ['view', 'mark-paid'],
      'invoice-payments': ['view', 'mark-paid'],
      'custom-duty': ['view', 'mark-paid'],
      'blank-invoices': ['view', 'mark-paid'],
      'approvals': ['view', 'action'],
      'exchange-rates': ['view', 'manage'],
      'vendors': ['view', 'manage'],
      'purchase-orders': ['view'],
      'rfq': ['view'],
      'sap': ['view'],
      'users': ['view'],
      'workflows': ['view'],
      'roles': ['view'],
      'permissions': ['view-perms']
    }
  },
  {
    id: 'role-logistics',
    roleName: 'logistics',
    description: 'Logistics team — logistics provider management and logistics payment visibility.',
    type: 'System',
    status: 'Active',
    permissions: {
      'logistics-providers': ['view', 'manage'],
      'logistics-payments': ['view', 'create'],
      'rfq': ['view'],
      'bl': ['view'],
      'exim': ['view']
    }
  },
  {
    id: 'role-md',
    roleName: 'md',
    description: 'Managing Director — executive-tier authority for final approvals and full visibility.',
    type: 'Custom',
    status: 'Active',
    permissions: {
      'dashboard': ['view'],
      'logistics-providers': ['view', 'manage'],
      'logistics-payments': ['view', 'mark-paid'],
      'advance-payments': ['view', 'mark-paid'],
      'invoice-payments': ['view', 'mark-paid'],
      'purchase-orders': ['view'],
      'rfq': ['view', 'award'],
      'bl': ['view', 'manage'],
      'exim': ['view', 'manage'],
      'custom-duty': ['view', 'mark-paid'],
      'blank-invoices': ['view', 'action', 'mark-paid'],
      'approvals': ['view', 'action'],
      'exchange-rates': ['view', 'manage'],
      'vendors': ['view', 'manage'],
      'workflows': ['view', 'manage'],
      'users': ['view'],
      'roles': ['view'],
      'sap': ['view'],
      'custom-agents': ['view'],
      'permissions': ['view-perms']
    }
  },
  {
    id: 'role-procurement',
    roleName: 'procurement',
    description: 'Procurement team — purchase orders, advance payments, invoice and RFQ management.',
    type: 'System',
    status: 'Active',
    permissions: {
      'dashboard': ['view'],
      'purchase-orders': ['view'],
      'advance-payments': ['view', 'create'],
      'invoice-payments': ['view', 'create'],
      'logistics-payments': ['view', 'create'],
      'custom-duty': ['view'],
      'blank-invoices': ['view'],
      'approvals': ['view', 'action'],
      'rfq': ['view', 'create'],
      'exchange-rates': ['view'],
      'vendors': ['view', 'manage'],
      'workflows': ['view'],
      'users': ['view'],
      'sap': ['view'],
      'custom-agents': ['view'],
      'logistics-providers': ['view'],
      'roles': ['view'],
      'permissions': ['view-perms']
    }
  },
  {
    id: 'role-procurement-head',
    roleName: 'procurement_head',
    description: 'Procurement Head — senior procurement authority with approval and team oversight.',
    type: 'Custom',
    status: 'Active',
    permissions: {
      'dashboard': ['view'],
      'purchase-orders': ['view'],
      'advance-payments': ['view', 'create', 'mark-paid'],
      'invoice-payments': ['view', 'create', 'mark-paid'],
      'logistics-payments': ['view', 'create', 'mark-paid'],
      'custom-duty': ['view', 'create'],
      'blank-invoices': ['view', 'action'],
      'approvals': ['view', 'action'],
      'rfq': ['view', 'create', 'award'],
      'bl': ['view'],
      'exim': ['view'],
      'exchange-rates': ['view'],
      'vendors': ['view', 'manage'],
      'custom-agents': ['view', 'manage'],
      'logistics-providers': ['view', 'manage'],
      'workflows': ['view'],
      'users': ['view'],
      'sap': ['view'],
      'roles': ['view'],
      'permissions': ['view-perms']
    }
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS FOR FULL SEED
// ─────────────────────────────────────────────────────────────────────────────
import { ApprovalWorkflow, ApprovalInstance, ApprovalAction } from '../models/ApprovalEngine.js';
import { AdvancePayment } from '../models/AdvancePayment.js';
import { InvoicePayment } from '../models/InvoicePayment.js';
import { CustomDutyPayment } from '../models/CustomDutyPayment.js';
import { LogisticsPayment } from '../models/LogisticsPayment.js';
import { Document } from '../models/Document.js';
import { User } from '../models/User.js';
import { Vendor } from '../models/Vendor.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';

// ─────────────────────────────────────────────────────────────────────────────
// DUMMY USERS — 15+ users across all 10 roles
// ─────────────────────────────────────────────────────────────────────────────
const DUMMY_USERS = [
  // ── Super Admin ────────────────────────────────────────────────────────────
  { id: 'usr-001', name: 'Prashant Vadhvana', email: 'prashantvadhvana@gmail.com', role: 'admin', department: 'Executive Administration', avatar: 'PV', status: 'Active' },

  // ── Accounts (role: accounts) ───────────────────────────────────────────────
  { id: 'usr-002', name: 'Kavya Mehta', email: 'kavya.mehta@rayzon.com', role: 'accounts', department: 'Accounts & Finance', avatar: 'KM', status: 'Active' },

  // ── CFO ────────────────────────────────────────────────────────────────────
  { id: 'usr-003', name: 'Rajesh Patel', email: 'rajesh.patel@rayzon.com', role: 'cfo', department: 'Finance & Treasury', avatar: 'RP', status: 'Active' },

  // ── EXIM Team (role: exim) ──────────────────────────────────────────────────
  { id: 'usr-004', name: 'Sneha Sharma', email: 'sneha.sharma@rayzon.com', role: 'exim', department: 'EXIM & Logistics', avatar: 'SS', status: 'Active' },
  { id: 'usr-005', name: 'Deepak Nair', email: 'deepak.nair@rayzon.com', role: 'exim', department: 'EXIM & Logistics', avatar: 'DN', status: 'Active' },
  { id: 'usr-006', name: 'Priya Joshi', email: 'priya.joshi@rayzon.com', role: 'exim', department: 'EXIM & Logistics', avatar: 'PJ', status: 'Active' },
  { id: 'usr-007', name: 'Amit Kulkarni', email: 'amit.kulkarni@rayzon.com', role: 'exim', department: 'EXIM & Logistics', avatar: 'AK', status: 'Active' },
  { id: 'usr-008', name: 'Riya Desai', email: 'riya.desai@rayzon.com', role: 'exim', department: 'EXIM & Logistics', avatar: 'RD', status: 'Active' },

  // ── EXIM Manager ────────────────────────────────────────────────────────────
  { id: 'usr-009', name: 'Manish Thakkar', email: 'manish.thakkar@rayzon.com', role: 'exim-manager', department: 'EXIM & Logistics', avatar: 'MT', status: 'Active' },

  // ── Finance ─────────────────────────────────────────────────────────────────
  { id: 'usr-010', name: 'Suresh Kumar', email: 'suresh.kumar@rayzon.com', role: 'finance', department: 'Finance & Treasury', avatar: 'SK', status: 'Active' },
  { id: 'usr-011', name: 'Anita Verma', email: 'anita.verma@rayzon.com', role: 'finance', department: 'Finance & Treasury', avatar: 'AV', status: 'Active' },

  // ── Logistics ───────────────────────────────────────────────────────────────
  { id: 'usr-012', name: 'Vikram Singh', email: 'vikram.singh@rayzon.com', role: 'logistics', department: 'Logistics & Supply Chain', avatar: 'VS', status: 'Active' },

  // ── MD ──────────────────────────────────────────────────────────────────────
  { id: 'usr-013', name: 'Arjun Shah', email: 'arjun.shah@rayzon.com', role: 'md', department: 'Executive Board', avatar: 'AS', status: 'Active' },

  // ── Procurement (East team members) ─────────────────────────────────────────
  { id: 'usr-014', name: 'Neha Gupta', email: 'neha.gupta@rayzon.com', role: 'procurement', department: 'Procurement', avatar: 'NG', status: 'Active' },
  { id: 'usr-016', name: 'Pooja Agarwal', email: 'pooja.agarwal@rayzon.com', role: 'procurement', department: 'Procurement', avatar: 'PA', status: 'Active' },
  { id: 'usr-018', name: 'Sanjay Bhatt', email: 'sanjay.bhatt@rayzon.com', role: 'procurement', department: 'Procurement', avatar: 'SB', status: 'Active' },
  { id: 'usr-020', name: 'Karan Patel', email: 'karan.patel@rayzon.com', role: 'procurement', department: 'Procurement', avatar: 'KP', status: 'Active' },

  // ── Procurement (West team members) ─────────────────────────────────────────
  { id: 'usr-015', name: 'Rohit Pandey', email: 'rohit.pandey@rayzon.com', role: 'procurement', department: 'Procurement', avatar: 'RP', status: 'Active' },
  { id: 'usr-017', name: 'Rahul Mehta', email: 'rahul.mehta@rayzon.com', role: 'procurement', department: 'Procurement', avatar: 'RM', status: 'Active' },
  { id: 'usr-019', name: 'Divya Rao', email: 'divya.rao@rayzon.com', role: 'procurement', department: 'Procurement', avatar: 'DR', status: 'Active' },
  { id: 'usr-021', name: 'Monika Trivedi', email: 'monika.trivedi@rayzon.com', role: 'procurement', department: 'Procurement', avatar: 'MT', status: 'Active' },

  // ── Procurement Head ────────────────────────────────────────────────────────
  { id: 'usr-022', name: 'Harish Solanki', email: 'harish.solanki@rayzon.com', role: 'procurement_head', department: 'Procurement', avatar: 'HS', status: 'Active',
    parentUserId: 'usr-013', delegationActive: false, delegationNote: 'Annual leave delegation' },
  { id: 'usr-025', name: 'Meera Iyer', email: 'meera.iyer@rayzon.com', role: 'procurement_head', department: 'Procurement', avatar: 'MI', status: 'Active' },

  // ── Purchase Manager - East ─────────────────────────────────────────────────
  { id: 'usr-023', name: 'Harish Solanki East', email: 'east.manager@rayzon.com', role: 'procurement', department: 'Procurement', avatar: 'EM', status: 'Active', isManager: true },

  // ── Purchase Manager - West ─────────────────────────────────────────────────
  { id: 'usr-024', name: 'Harish Solanki West', email: 'west.manager@rayzon.com', role: 'procurement', department: 'Procurement', avatar: 'WM', status: 'Active', isManager: true }
];

const DEMO_HIERARCHY = {
  // Level 0 — Senior executives, see all
  'usr-001': { managerId: null, managerName: null, team: null, hierarchyLevel: 0, canSeeAllRequests: true },
  'usr-013': { managerId: null, managerName: null, team: null, hierarchyLevel: 0, canSeeAllRequests: true },

  // Level 1 — CFO (reports to MD, sees all)
  'usr-003': { managerId: 'usr-013', managerName: 'Arjun Shah', team: 'Finance', hierarchyLevel: 1, canSeeAllRequests: true },

  // Finance team (reports to CFO)
  'usr-010': { managerId: 'usr-003', managerName: 'Rajesh Patel', team: 'Finance', hierarchyLevel: 2, canSeeAllRequests: false },
  'usr-011': { managerId: 'usr-003', managerName: 'Rajesh Patel', team: 'Finance', hierarchyLevel: 2, canSeeAllRequests: false },
  'usr-002': { managerId: 'usr-003', managerName: 'Rajesh Patel', team: 'Finance', hierarchyLevel: 2, canSeeAllRequests: false },

  // Level 1 — Procurement Head (reports to MD)
  'usr-022': { managerId: 'usr-013', managerName: 'Arjun Shah', team: 'Procurement', hierarchyLevel: 1, canSeeAllRequests: false },
  'usr-025': { managerId: 'usr-013', managerName: 'Arjun Shah', team: 'Procurement', hierarchyLevel: 1, canSeeAllRequests: false },

  // Level 2 — Purchase Manager - East (reports to Procurement Head)
  'usr-023': { managerId: 'usr-022', managerName: 'Harish Solanki', team: 'East', hierarchyLevel: 2, canSeeAllRequests: false, isManager: true },

  // Level 2 — Purchase Manager - West (reports to Procurement Head)
  'usr-024': { managerId: 'usr-022', managerName: 'Harish Solanki', team: 'West', hierarchyLevel: 2, canSeeAllRequests: false, isManager: true },

  // Level 3 — East team members (report to East Manager)
  'usr-014': { managerId: 'usr-023', managerName: 'Harish Solanki East', team: 'East', hierarchyLevel: 3, canSeeAllRequests: false },
  'usr-016': { managerId: 'usr-023', managerName: 'Harish Solanki East', team: 'East', hierarchyLevel: 3, canSeeAllRequests: false },
  'usr-018': { managerId: 'usr-023', managerName: 'Harish Solanki East', team: 'East', hierarchyLevel: 3, canSeeAllRequests: false },
  'usr-020': { managerId: 'usr-023', managerName: 'Harish Solanki East', team: 'East', hierarchyLevel: 3, canSeeAllRequests: false },

  // Level 3 — West team members (report to West Manager)
  'usr-015': { managerId: 'usr-024', managerName: 'Harish Solanki West', team: 'West', hierarchyLevel: 3, canSeeAllRequests: false },
  'usr-017': { managerId: 'usr-024', managerName: 'Harish Solanki West', team: 'West', hierarchyLevel: 3, canSeeAllRequests: false },
  'usr-019': { managerId: 'usr-024', managerName: 'Harish Solanki West', team: 'West', hierarchyLevel: 3, canSeeAllRequests: false },
  'usr-021': { managerId: 'usr-024', managerName: 'Harish Solanki West', team: 'West', hierarchyLevel: 3, canSeeAllRequests: false },

  // Level 1 — EXIM Manager (reports to MD)
  'usr-009': { managerId: 'usr-013', managerName: 'Arjun Shah', team: 'EXIM & Logistics', hierarchyLevel: 1, canSeeAllRequests: false, isManager: true },

  // Level 2 — EXIM team members (report to EXIM Manager)
  'usr-004': { managerId: 'usr-009', managerName: 'Manish Thakkar', team: 'EXIM & Logistics', hierarchyLevel: 2, canSeeAllRequests: false },
  'usr-005': { managerId: 'usr-009', managerName: 'Manish Thakkar', team: 'EXIM & Logistics', hierarchyLevel: 2, canSeeAllRequests: false },
  'usr-006': { managerId: 'usr-009', managerName: 'Manish Thakkar', team: 'EXIM & Logistics', hierarchyLevel: 2, canSeeAllRequests: false },
  'usr-007': { managerId: 'usr-009', managerName: 'Manish Thakkar', team: 'EXIM & Logistics', hierarchyLevel: 2, canSeeAllRequests: false },
  'usr-008': { managerId: 'usr-009', managerName: 'Manish Thakkar', team: 'EXIM & Logistics', hierarchyLevel: 2, canSeeAllRequests: false },
  'usr-012': { managerId: 'usr-009', managerName: 'Manish Thakkar', team: 'EXIM & Logistics', hierarchyLevel: 2, canSeeAllRequests: false }
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SEED FUNCTION
// ─────────────────────────────────────────────────────────────────────────────
export const seedDatabase = async () => {
  try {
    // ── Permissions ──────────────────────────────────────────────────────────
    const permCount = await Permission.countDocuments();
    if (permCount < DEFAULT_PERMISSIONS.length) {
      console.log('[DB] Seeding/updating system permissions...');
      for (const perm of DEFAULT_PERMISSIONS) {
        await Permission.updateOne({ id: perm.id }, { $setOnInsert: perm }, { upsert: true });
      }
    }

    // ── Roles ────────────────────────────────────────────────────────────────
    console.log('[DB] Seeding/updating system roles...');
    for (const defRole of DEFAULT_ROLES) {
      await Role.updateOne(
        { id: defRole.id },
        { $set: { ...defRole } },
        { upsert: true }
      );
    }

    // ── Users ────────────────────────────────────────────────────────────────
    console.log('[DB] Seeding/updating system users...');
    const defaultPassHash = await User.hashPassword('Rayzon@2026');
    for (const u of DUMMY_USERS) {
      const hierarchy = DEMO_HIERARCHY[u.id] || {};
      const existing = await User.findOne({ email: u.email });
      if (!existing) {
        await User.create({ ...u, ...hierarchy, passwordHash: defaultPassHash });
      } else {
        Object.assign(existing, { ...u, ...hierarchy });
        await existing.save();
      }
    }

    // ── Freight Forwarder / Logistics Vendors ─────────────────────────────────
    const ffVendorCount = await Vendor.countDocuments({
      vendorType: { $in: ['Freight Forwarder', 'Shipping Line', 'Logistics Provider'] }
    });
    if (ffVendorCount === 0) {
      console.log('[DB] Seeding Freight Forwarder / Shipping Line vendors...');
      const ffPassHash = await User.hashPassword('Rayzon@2026');
      await Vendor.insertMany([
        { id: 'v-ff-1', supplierId: 'FF-20000215', sapVendorCode: '20000215', companyName: 'Aquair International Freight Forwarders', contactPerson: 'Customs Manager', phone: '+91 22 2345 6789', email: 'customs@aquairintl.com', vendorType: 'Freight Forwarder', category: 'Freight Forwarder', status: 'Active', paymentTerms: '30 Days', gstin: '27AAACA9081F1Z1', pan: 'AAACA9081F', bankName: 'HDFC Bank', branch: 'Mumbai', accountNumber: '**** 0011', ifscCode: 'HDFC0000101', portalAccessEnabled: true, loginUrl: '/vendor/login', passwordHash: ffPassHash },
        { id: 'v-ff-2', supplierId: 'FF-10002355', sapVendorCode: '10002355', companyName: 'Babaji Shivram Clearing & Carriers', contactPerson: 'Clearing Manager', phone: '+91 99 8877 6655', email: 'clearing@babajishivram.in', vendorType: 'Freight Forwarder', category: 'Freight Forwarder', status: 'Active', paymentTerms: '30 Days', gstin: '24AAACB0001B1Z1', pan: 'AAACB0001B', bankName: 'SBI Bank', branch: 'Gandhidham', accountNumber: '**** 1122', ifscCode: 'SBIN0001234', portalAccessEnabled: true, loginUrl: '/vendor/login', passwordHash: ffPassHash },
        { id: 'v-ff-3', supplierId: 'FF-11001450', sapVendorCode: '11001450', companyName: 'Fairwinds Shipping Private Limited', contactPerson: 'Shipping Manager', phone: '+91 22 4455 6677', email: 'ops@fairwindsshipping.com', vendorType: 'Shipping Line', category: 'Shipping Line', status: 'Active', paymentTerms: '45 Days', gstin: '27AAACF0002F1Z1', pan: 'AAACF0002F', bankName: 'ICICI Bank', branch: 'Mumbai', accountNumber: '**** 2233', ifscCode: 'ICIC0000456', portalAccessEnabled: true, loginUrl: '/vendor/login', passwordHash: ffPassHash },
        { id: 'v-ff-4', supplierId: 'FF-11001810', sapVendorCode: '11001810', companyName: 'Fast Forward Logistics India', contactPerson: 'Magnesh Phapale', phone: '+91 98765 43210', email: 'magnesh@fflindia.com', vendorType: 'Freight Forwarder', category: 'Freight Forwarder', status: 'Active', paymentTerms: '30 Days', gstin: '27AAACF0003F1Z1', pan: 'AAACF0003F', bankName: 'Axis Bank', branch: 'Mumbai', accountNumber: '**** 3344', ifscCode: 'UTIB0000789', portalAccessEnabled: true, loginUrl: '/vendor/login', passwordHash: ffPassHash },
        { id: 'v-ff-5', supplierId: 'FF-11001148', sapVendorCode: '11001148', companyName: 'Gef Global Logistics Pvt Ltd', contactPerson: 'Operations Head', phone: '+91 22 3344 5566', email: 'ops@gefglobal.com', vendorType: 'Freight Forwarder', category: 'Freight Forwarder', status: 'Active', paymentTerms: '30 Days', gstin: '27AAACG0004G1Z1', pan: 'AAACG0004G', bankName: 'Kotak Bank', branch: 'Mumbai', accountNumber: '**** 4455', ifscCode: 'KKBK0000012', portalAccessEnabled: true, loginUrl: '/vendor/login', passwordHash: ffPassHash },
        { id: 'v-ff-6', supplierId: 'FF-50000131', sapVendorCode: '50000131', companyName: 'Globiiz Synergy Private Limited', contactPerson: 'Freight Manager', phone: '+91 22 5566 7788', email: 'freight@globiiz.com', vendorType: 'Freight Forwarder', category: 'Freight Forwarder', status: 'Active', paymentTerms: '30 Days', gstin: '27AAACG0005G1Z1', pan: 'AAACG0005G', bankName: 'PNB', branch: 'Mumbai', accountNumber: '**** 5566', ifscCode: 'PUNB0001234', portalAccessEnabled: true, loginUrl: '/vendor/login', passwordHash: ffPassHash },
        { id: 'v-ff-7', supplierId: 'FF-11001776', sapVendorCode: '11001776', companyName: 'Kgl Network Pvt. Ltd.', contactPerson: 'Network Manager', phone: '+91 22 6677 8899', email: 'ops@kglnetwork.com', vendorType: 'Freight Forwarder', category: 'Freight Forwarder', status: 'Active', paymentTerms: '30 Days', gstin: '27AAACK0006K1Z1', pan: 'AAACK0006K', bankName: 'HDFC Bank', branch: 'Navi Mumbai', accountNumber: '**** 6677', ifscCode: 'HDFC0001001', portalAccessEnabled: true, loginUrl: '/vendor/login', passwordHash: ffPassHash },
        { id: 'v-ff-8', supplierId: 'FF-11001920', sapVendorCode: '11001920', companyName: 'Isgfl India Pvt. Ltd.', contactPerson: 'Shipping Head', phone: '+91 22 7788 9900', email: 'shipping@isgfl.com', vendorType: 'Shipping Line', category: 'Shipping Line', status: 'Active', paymentTerms: '45 Days', gstin: '27AAACI0007I1Z1', pan: 'AAACI0007I', bankName: 'Citibank', branch: 'Mumbai', accountNumber: '**** 7788', ifscCode: 'CITI0000001', portalAccessEnabled: true, loginUrl: '/vendor/login', passwordHash: ffPassHash },
        { id: 'v-ff-9', supplierId: 'FF-11002010', sapVendorCode: '11002010', companyName: 'Seaways Shipping & Logistics Ltd', contactPerson: 'Logistics Head', phone: '+91 22 8899 0011', email: 'ops@seawaysshipping.com', vendorType: 'Freight Forwarder', category: 'Freight Forwarder', status: 'Active', paymentTerms: '30 Days', gstin: '27AAACS0008S1Z1', pan: 'AAACS0008S', bankName: 'HDFC Bank', branch: 'Nhava Sheva', accountNumber: '**** 8899', ifscCode: 'HDFC0002001', portalAccessEnabled: true, loginUrl: '/vendor/login', passwordHash: ffPassHash },
      ]);
    }

    // ── Purchase Orders ───────────────────────────────────────────────────────
    const poCount = await PurchaseOrder.countDocuments();
    if (poCount === 0) {
      console.log('[DB] Seeding default Purchase Orders...');
      await PurchaseOrder.insertMany([
        {
          poId: '4100005638',
          poNumber: '4100005638',
          sapPoNumber: '4100005638',
          supplierId: '11001810',
          supplierName: 'Fast Forward Logistics India',
          companyCode: '1000',
          currency: 'INR',
          totalAmount: 500000,
          status: 'open',
          documentDate: new Date(),
          items: [{ itemNumber: '10', description: 'Solar Material Freight 40HC', quantity: 5, unitPrice: 100000, totalPrice: 500000, uom: 'PCS' }]
        },
        {
          poId: '4700000251',
          poNumber: '4700000251',
          sapPoNumber: '4700000251',
          supplierId: '11002010',
          supplierName: 'Seaways Shipping & Logistics Ltd',
          companyCode: '1000',
          currency: 'INR',
          totalAmount: 750000,
          status: 'open',
          documentDate: new Date(),
          items: [{ itemNumber: '10', description: 'Solar Cell Freight 40HC', quantity: 5, unitPrice: 150000, totalPrice: 750000, uom: 'PCS' }]
        },
        {
          poId: '4100005639',
          poNumber: '4100005639',
          sapPoNumber: '4100005639',
          supplierId: '11001450',
          supplierName: 'Fairwinds Shipping Private Limited',
          companyCode: '1000',
          currency: 'INR',
          totalAmount: 320000,
          status: 'open',
          documentDate: new Date(),
          items: [{ itemNumber: '10', description: 'Solar Glass Transport', quantity: 4, unitPrice: 80000, totalPrice: 320000, uom: 'PCS' }]
        }
      ]);
    }

    // ── Approval Workflows ────────────────────────────────────────────────────
    const workflowCount = await ApprovalWorkflow.countDocuments();
    if (workflowCount === 0) {
      console.log('[DB] Seeding P2P Approval Workflows...');
      await ApprovalWorkflow.insertMany([
        { workflowId: 'WF-001', name: 'Advance Payment (Up to ₹50K)', module: 'advance_payment', minAmount: 0, maxAmount: 50000, status: 'Active', steps: [{ stepNumber: 1, stepName: 'Procurement Head Approval', approverRole: 'procurement_head', escalationHours: 24 }] },
        { workflowId: 'WF-002', name: 'Advance Payment (> ₹50K)', module: 'advance_payment', minAmount: 50001, maxAmount: 1000000, status: 'Active', steps: [{ stepNumber: 1, stepName: 'Procurement Head Approval', approverRole: 'procurement_head', escalationHours: 24 }, { stepNumber: 2, stepName: 'Finance Approval', approverRole: 'finance', escalationHours: 24 }] },
        { workflowId: 'WF-003', name: 'Invoice Payment (Up to ₹1CR)', module: 'invoice_payment', minAmount: 0, maxAmount: 10000000, status: 'Active', steps: [{ stepNumber: 1, stepName: 'Procurement Head Review', approverRole: 'procurement_head', escalationHours: 24 }, { stepNumber: 2, stepName: 'Finance Head Approval', approverRole: 'finance', escalationHours: 48 }] },
        { workflowId: 'WF-009', name: 'RFQ Vendor Allocation Approval', module: 'rfq', minAmount: 0, maxAmount: 50000000, status: 'Active', steps: [{ stepNumber: 1, stepName: 'Procurement Head Review', approverRole: 'procurement_head', escalationHours: 24 }, { stepNumber: 2, stepName: 'EXIM Manager Signoff', approverRole: 'exim-manager', escalationHours: 24 }, { stepNumber: 3, stepName: 'MD Final Approval', approverRole: 'md', escalationHours: 72 }] }
      ]);
    }

    // ── Invoice Payments ──────────────────────────────────────────────────────
    const invCount = await InvoicePayment.countDocuments();
    if (invCount === 0) {
      console.log('[DB] Seeding Invoice Payment trace data...');
      await InvoicePayment.create({ invoicePaymentId: 'INV-PAY-007', poId: 'PO-2026-9901', sapPoNumber: '31094582', vendorId: 'VEND-001', vendorName: 'Solar Tech Industries', invoiceNumber: 'INV-20260713-0001', asnNumber: '', grossAmount: 219497.36, gstAmount: 39509.52, tdsAmount: 4389.95, netPayable: 254616.93, status: 'approved', approvalInstanceId: 'INST-11' });
    }

    // ── Advance Payments ──────────────────────────────────────────────────────
    const advCount = await AdvancePayment.countDocuments();
    if (advCount === 0) {
      console.log('[DB] Seeding Advance Payment trace data...');
      await AdvancePayment.insertMany([
        { advanceId: 'ADV-PAY-001', poId: 'PO-2026-8801', sapPoNumber: '21094581', vendorId: 'VEND-002', vendorName: 'Global Silicon Supplies', amount: 50000, gstBreakup: { cgst: 41.325, sgst: 41.325, igst: 0, totalGst: 82.65 }, paymentMode: 'RTGS', status: 'approved', approvalInstanceId: 'INST-01' },
        { advanceId: 'ADV-PAY-002', poId: 'PO-2026-8802', sapPoNumber: '21094582', vendorId: 'VEND-003', vendorName: 'Alpha Logistics & Materials', amount: 2194.80, gstBreakup: { cgst: 0, sgst: 0, igst: 0, totalGst: 0 }, paymentMode: 'RTGS', status: 'draft', approvalInstanceId: 'INST-02' }
      ]);
    }

    // ── Custom Duty Payments ──────────────────────────────────────────────────
    const customCount = await CustomDutyPayment.countDocuments();
    if (customCount === 0) {
      console.log('[DB] Seeding Custom Duty Payment trace data...');
      await CustomDutyPayment.create({ dutyId: 'CD-PAY-001', blId: 'BL-98471209', blNumber: 'BL-98471209', boeNumber: 'BOE-994812', portCode: 'INNSA1', dutyAmount: 45000, icegateRef: 'ICEGATE-45000001', customAgentName: 'Magnesh - Fast Forward Logistics India', status: 'draft' });
    }

    // ── Logistics Payments ────────────────────────────────────────────────────
    const logCount = await LogisticsPayment.countDocuments();
    if (logCount === 0) {
      console.log('[DB] Seeding Logistics Payment trace data...');
      await LogisticsPayment.create({ logisticsPaymentId: 'LOG-PAY-001', referenceNumber: 'LOG-20260713-0001', vendorId: 'VEND-102', vendorName: 'Oceanic Freight Systems', invoiceNumber: 'OFS-98471', blNumber: 'BL-98471209', freightCharges: 12000, terminalHandlingCharges: 3000, totalAmount: 15000, status: 'draft' });
    }

    // ── Approval Instances & Actions ──────────────────────────────────────────
    const instCount = await ApprovalInstance.countDocuments();
    if (instCount === 0) {
      console.log('[DB] Seeding Approval Instances & Actions trace data...');
      await ApprovalInstance.insertMany([
        { instanceId: 'INST-11', approvableType: 'InvoicePayment', approvableId: 'INV-PAY-007', workflowId: 'WF-003', currentStep: 2, totalSteps: 2, assignedApproverRole: 'finance', status: 'approved' },
        { instanceId: 'INST-19', approvableType: 'RfqHeader', approvableId: 'RFQ-005', workflowId: 'WF-009', currentStep: 3, totalSteps: 3, assignedApproverRole: 'md', status: 'returned' }
      ]);
      await ApprovalAction.insertMany([
        { actionId: 'ACT-10', instanceId: 'INST-11', stepIndex: 1, action: 'approve', performedBy: 'usr-022', performedByName: 'Harish Solanki', comments: 'Invoice verified against GRN.' },
        { actionId: 'ACT-11', instanceId: 'INST-11', stepIndex: 2, action: 'approve', performedBy: 'usr-010', performedByName: 'Suresh Kumar', comments: 'Approved for disbursement.' },
        { actionId: 'ACT-21', instanceId: 'INST-19', stepIndex: 3, action: 'return', performedBy: 'usr-013', performedByName: 'Arjun Shah', comments: 'Re-negotiate freight terms with vendor.' }
      ]);
    }

    // ── Documents ─────────────────────────────────────────────────────────────
    const docCount = await Document.countDocuments();
    if (docCount === 0) {
      console.log('[DB] Seeding Document Attachments trace data...');
      await Document.insertMany([
        { documentId: 'DOC-101', title: 'Vendor Tax Invoice copy', documentType: 'vendor_invoice', fileUrl: '/uploads/invoices/inv_20260713_0001.pdf', fileName: 'inv_20260713_0001.pdf', fileSize: 1024500, documentableType: 'InvoicePayment', documentableId: 'INV-PAY-007', uploadedBy: 'Suresh Kumar' },
        { documentId: 'DOC-102', title: 'RFQ Terms & Vendor Quotes', documentType: 'rfq_document', fileUrl: '/uploads/rfq/rfq_005_specs.pdf', fileName: 'rfq_005_specs.pdf', fileSize: 2048000, documentableType: 'RfqHeader', documentableId: 'RFQ-005', uploadedBy: 'Harish Solanki' }
      ]);
    }

    // ── Workflow Slabs ────────────────────────────────────────────────────────
    console.log('[DB] Ensuring default workflow slabs...');
    const { ensureAllWorkflows } = await import('../modules/workflows/workflowDefaults.js');
    await ensureAllWorkflows();

  } catch (err) {
    console.warn('[DB] Seeding error:', err.message);
  }
};
