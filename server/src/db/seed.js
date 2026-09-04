import { Role } from '../models/Role.js';
import { Permission } from '../models/Permission.js';
import { ApprovalWorkflow, ApprovalInstance, ApprovalAction } from '../models/ApprovalEngine.js';
import { AdvancePayment } from '../models/AdvancePayment.js';
import { InvoicePayment } from '../models/InvoicePayment.js';
import { CustomDutyPayment } from '../models/CustomDutyPayment.js';
import { LogisticsPayment } from '../models/LogisticsPayment.js';
import { LogisticsProvider } from '../models/LogisticsProvider.js';
import { Document } from '../models/Document.js';
import { User } from '../models/User.js';
import { Vendor } from '../models/Vendor.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';

// ─────────────────────────────────────────────────────────────────────────────
// ALL PERMISSIONS MATRIX
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_PERMISSIONS = [
  { id: 'perm-001', key: 'dashboard.view', name: 'View Dashboard', module: 'Dashboard', action: 'view', description: 'Access the main overview dashboard.', type: 'System', status: 'Active' },
  { id: 'perm-002', key: 'purchase-orders.view', name: 'View Purchase Orders', module: 'Purchase Orders', action: 'view', description: 'View purchase order list and detail.', type: 'System', status: 'Active' },
  { id: 'perm-003', key: 'advance-payments.view', name: 'View Advance Payments', module: 'Advance Payments', action: 'view', description: 'View advance payment records.', type: 'System', status: 'Active' },
  { id: 'perm-004', key: 'advance-payments.create', name: 'Create Advance Payment', module: 'Advance Payments', action: 'create', description: 'Create new advance payment requests.', type: 'System', status: 'Active' },
  { id: 'perm-005', key: 'advance-payments.delete', name: 'Delete Advance Payment', module: 'Advance Payments', action: 'delete', description: 'Delete advance payment records.', type: 'System', status: 'Active' },
  { id: 'perm-006', key: 'advance-payments.mark-paid', name: 'Mark Advance Paid', module: 'Advance Payments', action: 'mark-paid', description: 'Mark advance payments as paid.', type: 'System', status: 'Active' },
  { id: 'perm-007', key: 'invoice-payments.view', name: 'View Invoice Payments', module: 'Invoice Payments', action: 'view', description: 'View invoice payment records.', type: 'System', status: 'Active' },
  { id: 'perm-008', key: 'invoice-payments.create', name: 'Create Invoice Payment', module: 'Invoice Payments', action: 'create', description: 'Create new invoice payment entries.', type: 'System', status: 'Active' },
  { id: 'perm-009', key: 'invoice-payments.delete', name: 'Delete Invoice Payment', module: 'Invoice Payments', action: 'delete', description: 'Delete invoice payment records.', type: 'System', status: 'Active' },
  { id: 'perm-010', key: 'invoice-payments.mark-paid', name: 'Mark Invoice Paid', module: 'Invoice Payments', action: 'mark-paid', description: 'Mark invoice payments as paid.', type: 'System', status: 'Active' },
  { id: 'perm-011', key: 'logistics-payments.view', name: 'View Logistics Payments', module: 'Logistics Payments', action: 'view', description: 'View logistics payment records.', type: 'System', status: 'Active' },
  { id: 'perm-012', key: 'logistics-payments.create', name: 'Create Logistics Payment', module: 'Logistics Payments', action: 'create', description: 'Create new logistics payment entries.', type: 'System', status: 'Active' },
  { id: 'perm-013', key: 'logistics-payments.delete', name: 'Delete Logistics Payment', module: 'Logistics Payments', action: 'delete', description: 'Delete logistics payment records.', type: 'System', status: 'Active' },
  { id: 'perm-014', key: 'logistics-payments.mark-paid', name: 'Mark Logistics Paid', module: 'Logistics Payments', action: 'mark-paid', description: 'Mark logistics payments as paid.', type: 'System', status: 'Active' },
  { id: 'perm-015', key: 'custom-duty.view', name: 'View Custom Duty', module: 'Custom Duty', action: 'view', description: 'View custom duty payment records.', type: 'System', status: 'Active' },
  { id: 'perm-016', key: 'custom-duty.create', name: 'Create Custom Duty', module: 'Custom Duty', action: 'create', description: 'Create custom duty payment entries.', type: 'System', status: 'Active' },
  { id: 'perm-017', key: 'custom-duty.delete', name: 'Delete Custom Duty', module: 'Custom Duty', action: 'delete', description: 'Delete custom duty records.', type: 'System', status: 'Active' },
  { id: 'perm-018', key: 'custom-duty.mark-paid', name: 'Mark Custom Duty Paid', module: 'Custom Duty', action: 'mark-paid', description: 'Mark custom duty as paid.', type: 'System', status: 'Active' },
  { id: 'perm-019', key: 'blank-invoices.view', name: 'View BI Invoices', module: 'BI Invoices', action: 'view', description: 'View blank invoice records.', type: 'System', status: 'Active' },
  { id: 'perm-020', key: 'blank-invoices.action', name: 'BI Invoice Actions', module: 'BI Invoices', action: 'action', description: 'Perform actions on blank invoices.', type: 'System', status: 'Active' },
  { id: 'perm-021', key: 'blank-invoices.mark-paid', name: 'Mark BI Invoice Paid', module: 'BI Invoices', action: 'mark-paid', description: 'Mark blank invoices as paid.', type: 'System', status: 'Active' },
  { id: 'perm-022', key: 'approvals.view', name: 'View Approvals', module: 'Approvals', action: 'view', description: 'View pending and completed approval requests.', type: 'System', status: 'Active' },
  { id: 'perm-023', key: 'approvals.action', name: 'Perform Approval Action', module: 'Approvals', action: 'action', description: 'Approve, reject, or return requests.', type: 'System', status: 'Active' },
  { id: 'perm-024', key: 'rfq.view', name: 'View RFQ', module: 'Rfq', action: 'view', description: 'View RFQ list and detail.', type: 'System', status: 'Active' },
  { id: 'perm-025', key: 'rfq.create', name: 'Create RFQ', module: 'Rfq', action: 'create', description: 'Create new RFQ sourcing events.', type: 'System', status: 'Active' },
  { id: 'perm-026', key: 'rfq.delete', name: 'Delete RFQ', module: 'Rfq', action: 'delete', description: 'Delete RFQ records.', type: 'System', status: 'Active' },
  { id: 'perm-027', key: 'rfq.award', name: 'Award RFQ', module: 'Rfq', action: 'award', description: 'Award RFQ to selected vendor.', type: 'System', status: 'Active' },
  { id: 'perm-028', key: 'bl.view', name: 'View BL', module: 'Bl', action: 'view', description: 'View Bill of Lading records.', type: 'System', status: 'Active' },
  { id: 'perm-029', key: 'bl.manage', name: 'Manage BL', module: 'Bl', action: 'manage', description: 'Create and manage BL entries.', type: 'System', status: 'Active' },
  { id: 'perm-030', key: 'exim.view', name: 'View EXIM', module: 'Exim', action: 'view', description: 'View EXIM / import review records.', type: 'System', status: 'Active' },
  { id: 'perm-031', key: 'exim.manage', name: 'Manage EXIM', module: 'Exim', action: 'manage', description: 'Perform EXIM review and clearance actions.', type: 'System', status: 'Active' },
  { id: 'perm-032', key: 'logistics-providers.view', name: 'View Logistics Providers', module: 'Logistics Providers', action: 'view', description: 'View logistics provider directory.', type: 'System', status: 'Active' },
  { id: 'perm-033', key: 'logistics-providers.manage', name: 'Manage Logistics Providers', module: 'Logistics Providers', action: 'manage', description: 'Create, edit and deactivate logistics providers.', type: 'System', status: 'Active' },
  { id: 'perm-034', key: 'custom-agents.view', name: 'View Custom Agents', module: 'Custom Agents', action: 'view', description: 'View customs agent directory.', type: 'System', status: 'Active' },
  { id: 'perm-035', key: 'custom-agents.manage', name: 'Manage Custom Agents', module: 'Custom Agents', action: 'manage', description: 'Create and manage customs agents.', type: 'System', status: 'Active' },
  { id: 'perm-036', key: 'vendors.view', name: 'View Vendors', module: 'Vendors', action: 'view', description: 'View vendor directory and profile.', type: 'System', status: 'Active' },
  { id: 'perm-037', key: 'vendors.manage', name: 'Manage Vendors', module: 'Vendors', action: 'manage', description: 'Create, edit and manage vendors.', type: 'System', status: 'Active' },
  { id: 'perm-038', key: 'exchange-rates.view', name: 'View Exchange Rates', module: 'Exchange Rates', action: 'view', description: 'View currency exchange rates.', type: 'System', status: 'Active' },
  { id: 'perm-039', key: 'exchange-rates.manage', name: 'Manage Exchange Rates', module: 'Exchange Rates', action: 'manage', description: 'Update FX rates used for INR conversion.', type: 'System', status: 'Active' },
  { id: 'perm-040', key: 'sap.view', name: 'View SAP Sync', module: 'Sap', action: 'view', description: 'View SAP sync run logs.', type: 'System', status: 'Active' },
  { id: 'perm-041', key: 'sap.sync', name: 'Trigger SAP Sync', module: 'Sap', action: 'sync', description: 'Manually trigger SAP data sync.', type: 'System', status: 'Active' },
  { id: 'perm-042', key: 'workflows.view', name: 'View Workflows', module: 'Workflows', action: 'view', description: 'View workflow slab routing rules.', type: 'System', status: 'Active' },
  { id: 'perm-043', key: 'workflows.manage', name: 'Manage Workflows', module: 'Workflows', action: 'manage', description: 'Create, edit and delete workflow slabs.', type: 'System', status: 'Active' },
  { id: 'perm-044', key: 'users.view', name: 'View Users', module: 'Users', action: 'view', description: 'View user directory and account details.', type: 'System', status: 'Active' },
  { id: 'perm-045', key: 'users.create', name: 'Provision User', module: 'Users', action: 'create', description: 'Provision new user account in directory.', type: 'System', status: 'Active' },
  { id: 'perm-046', key: 'users.edit', name: 'Edit User', module: 'Users', action: 'edit', description: 'Edit user profile, role, department and account status.', type: 'System', status: 'Active' },
  { id: 'perm-047', key: 'users.delete', name: 'Delete User', module: 'Users', action: 'delete', description: 'Delete user account from directory.', type: 'System', status: 'Active' },
  { id: 'perm-048', key: 'users.manage', name: 'Manage Users', module: 'Users', action: 'manage', description: 'Master control to create, edit, deactivate and delete user accounts.', type: 'System', status: 'Active' },
  { id: 'perm-049', key: 'roles.view', name: 'View Roles', module: 'Roles & Permissions', action: 'view', description: 'View system roles and permission matrix.', type: 'System', status: 'Active' },
  { id: 'perm-050', key: 'roles.manage', name: 'Manage Roles', module: 'Roles & Permissions', action: 'manage', description: 'Create, edit roles and assign permissions.', type: 'System', status: 'Active' },
  { id: 'perm-051', key: 'permissions.view', name: 'View Permissions', module: 'Roles & Permissions', action: 'view-perms', description: 'View the permission registry.', type: 'System', status: 'Active' },
  { id: 'perm-052', key: 'permissions.create', name: 'Create Permissions', module: 'Roles & Permissions', action: 'create-perms', description: 'Create new permission keys.', type: 'System', status: 'Active' },
  { id: 'perm-053', key: 'reports.view', name: 'View Hierarchy Reports', module: 'Reports', action: 'view', description: 'View advance, invoice and vendor reports within the organisation hierarchy.', type: 'System', status: 'Active' },
  { id: 'perm-054', key: 'reports.view-all', name: 'View All Hierarchy Reports', module: 'Reports', action: 'view-all', description: 'View reports for every user and vendor across the organisation.', type: 'System', status: 'Active' },
  { id: 'perm-055', key: 'settlement-ledger.view', name: 'View Settlement Ledger', module: 'Settlement Ledger', action: 'view', description: 'View treasury payouts, bank references and the settlement audit trail.', type: 'System', status: 'Active' },
];

// ─────────────────────────────────────────────────────────────────────────────
// CLEAN SYSTEM ROLES (12 Standard Core Roles)
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_ROLES = [
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
      'approvals': ['view'],
      'rfq': ['view', 'create']
    }
  },
  {
    id: 'role-procurement-head',
    roleName: 'procurement_head',
    description: 'Procurement Head — senior procurement authority with high-value approval and team oversight.',
    type: 'System',
    status: 'Active',
    permissions: {
      'dashboard': ['view'],
      'purchase-orders': ['view'],
      'advance-payments': ['view', 'create', 'mark-paid'],
      'invoice-payments': ['view', 'create', 'mark-paid'],
      'logistics-payments': ['view', 'create', 'mark-paid'],
      'custom-duty': ['view', 'create'],
      'approvals': ['view', 'action'],
      'rfq': ['view', 'create', 'award'],
      'vendors': ['view', 'manage']
    }
  },
  {
    id: 'role-purchase-manager',
    roleName: 'purchase_manager',
    description: 'Purchase Manager — primary approver for initial purchase and payment requests.',
    type: 'System',
    status: 'Active',
    permissions: {
      'dashboard': ['view'],
      'purchase-orders': ['view'],
      'advance-payments': ['view', 'create', 'mark-paid'],
      'invoice-payments': ['view', 'create', 'mark-paid'],
      'logistics-payments': ['view', 'create'],
      'custom-duty': ['view', 'create'],
      'approvals': ['view', 'action'],
      'rfq': ['view', 'create'],
      'vendors': ['view', 'manage'],
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
      'settlement-ledger': ['view'],
      'dashboard': ['view'],
      'blank-invoices': ['view', 'action'],
      'approvals': ['view', 'action'],
      'rfq': ['view'],
      'exchange-rates': ['view', 'manage'],
      'vendors': ['view']
    }
  },
  {
    id: 'role-accounts',
    roleName: 'accounts',
    description: 'Accounts team — financial record views, payment verification, tracking and ledger reconciliation.',
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
      'blank-invoices': ['view', 'mark-paid'],
      'exchange-rates': ['view'],
      'sap': ['view']
    }
  },
  {
    id: 'role-cfo',
    roleName: 'cfo',
    description: 'Chief Financial Officer — executive financial visibility and high-value approval authority.',
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
      'custom-agents': ['view', 'manage']
    }
  },
  {
    id: 'role-exim-manager',
    roleName: 'exim-manager',
    description: 'EXIM Manager — oversight of EXIM operations with approval and RFQ award authority.',
    type: 'System',
    status: 'Active',
    permissions: {
      'dashboard': ['view'],
      'rfq': ['view', 'create', 'award'],
      'bl': ['view', 'manage'],
      'exim': ['view', 'manage'],
      'logistics-providers': ['view', 'manage'],
      'custom-agents': ['view', 'manage'],
      'approvals': ['view', 'action']
    }
  },
  {
    id: 'role-logistics',
    roleName: 'logistics',
    description: 'Logistics team — logistics provider management, EXIM review, and logistics payment visibility.',
    type: 'System',
    status: 'Active',
    permissions: {
      'logistics-providers': ['view', 'manage'],
      'logistics-payments': ['view', 'create'],
      'exim': ['view']
    }
  },
  {
    id: 'role-logistics-manager',
    roleName: 'logistics-manager',
    description: 'Logistics Manager — management of logistics operations, logistics providers, and logistics payment approvals.',
    type: 'System',
    status: 'Active',
    permissions: {
      'dashboard': ['view'],
      'logistics-providers': ['view', 'manage'],
      'logistics-payments': ['view', 'create', 'mark-paid'],
      'exim': ['view'],
      'approvals': ['view', 'action']
    }
  },
  {
    id: 'role-md',
    roleName: 'md',
    description: 'Managing Director — executive-tier authority for final approvals and full visibility.',
    type: 'System',
    status: 'Active',
    permissions: {
      'dashboard': ['view'],
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
      'workflows': ['view', 'manage']
    }
  }
];

// Every internal role can receive a hierarchy-scoped report. Only executive
// roles receive organisation-wide report visibility by default.
for (const role of DEFAULT_ROLES) {
  role.permissions.reports = ['view'];
  if (['admin', 'md', 'cfo', 'finance', 'accounts'].includes(role.roleName)) role.permissions.reports.push('view-all');
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM USERS & HIERARCHY
// ─────────────────────────────────────────────────────────────────────────────
const DUMMY_USERS = [
  { id: 'usr-000', name: 'System Admin', email: 'admin@rayzon.one', role: 'admin', department: 'Executive Administration', avatar: 'SA', status: 'Active' },
  { id: 'usr-001', name: 'Prashant Vadhvana', email: 'prashantvadhvana@gmail.com', role: 'admin', department: 'Executive Administration', avatar: 'PV', status: 'Active' },

  { id: 'usr-002', name: 'Arjun Shah', email: 'arjun.shah@rayzon.com', role: 'md', department: 'Executive Board', avatar: 'AS', status: 'Active' },
  { id: 'usr-003', name: 'Rajesh Patel', email: 'rajesh.patel@rayzon.com', role: 'cfo', department: 'Finance & Treasury', avatar: 'RP', status: 'Active' },

  { id: 'usr-004', name: 'Suresh Kumar', email: 'suresh.kumar@rayzon.com', role: 'accounts', department: 'Accounts & Finance', avatar: 'SK', status: 'Active' },
  { id: 'usr-005', name: 'Anita Verma', email: 'anita.verma@rayzon.com', role: 'accounts', department: 'Accounts & Finance', avatar: 'AV', status: 'Active' },
  { id: 'usr-006', name: 'Kavya Mehta', email: 'kavya.mehta@rayzon.com', role: 'accounts', department: 'Accounts & Finance', avatar: 'KM', status: 'Active' },

  { id: 'usr-007', name: 'Harish Solanki', email: 'harish.solanki@rayzon.com', role: 'procurement_head', department: 'Procurement', avatar: 'HS', status: 'Active' },
  { id: 'usr-008', name: 'Meera Iyer', email: 'meera.iyer@rayzon.com', role: 'procurement_head', department: 'Procurement', avatar: 'MI', status: 'Active' },

  { id: 'usr-009', name: 'Neha Gupta', email: 'neha.gupta@rayzon.com', role: 'procurement_head', department: 'Procurement', avatar: 'NG', status: 'Active' },
  { id: 'usr-010', name: 'Rohit Pandey', email: 'rohit.pandey@rayzon.com', role: 'procurement_head', department: 'Procurement', avatar: 'RP2', status: 'Active' },

  { id: 'usr-011', name: 'Pooja Agarwal', email: 'pooja.agarwal@rayzon.com', role: 'procurement', department: 'Procurement', avatar: 'PA', status: 'Active' },
  { id: 'usr-012', name: 'Sanjay Bhatt', email: 'sanjay.bhatt@rayzon.com', role: 'procurement', department: 'Procurement', avatar: 'SB', status: 'Active' },
  { id: 'usr-013', name: 'Karan Patel', email: 'karan.patel@rayzon.com', role: 'procurement', department: 'Procurement', avatar: 'KP', status: 'Active' },
  { id: 'usr-014', name: 'Divya Rao', email: 'divya.rao@rayzon.com', role: 'procurement', department: 'Procurement', avatar: 'DR', status: 'Active' },
  { id: 'usr-015', name: 'Monika Trivedi', email: 'monika.trivedi@rayzon.com', role: 'procurement', department: 'Procurement', avatar: 'MT', status: 'Active' }
];

const DEMO_HIERARCHY = {
  'usr-000': { managerId: null, managerName: null, team: 'Executive Administration', hierarchyLevel: 0, canSeeAllRequests: true },
  'usr-001': { managerId: null, managerName: null, team: 'Executive Administration', hierarchyLevel: 0, canSeeAllRequests: true },
  'usr-002': { managerId: null, managerName: null, team: 'Executive Board', hierarchyLevel: 0, canSeeAllRequests: true },
  'usr-003': { managerId: 'usr-002', managerName: 'Arjun Shah', team: 'Finance', hierarchyLevel: 1, canSeeAllRequests: true },
  'usr-004': { managerId: 'usr-003', managerName: 'Rajesh Patel', team: 'Finance', hierarchyLevel: 2, canSeeAllRequests: false },
  'usr-005': { managerId: 'usr-003', managerName: 'Rajesh Patel', team: 'Finance', hierarchyLevel: 2, canSeeAllRequests: false },
  'usr-006': { managerId: 'usr-003', managerName: 'Rajesh Patel', team: 'Finance', hierarchyLevel: 2, canSeeAllRequests: false },
  'usr-007': { managerId: 'usr-002', managerName: 'Arjun Shah', team: 'Procurement', hierarchyLevel: 1, canSeeAllRequests: false },
  'usr-008': { managerId: 'usr-002', managerName: 'Arjun Shah', team: 'Procurement', hierarchyLevel: 1, canSeeAllRequests: false },
  'usr-009': { managerId: 'usr-007', managerName: 'Harish Solanki', team: 'Procurement East', hierarchyLevel: 2, canSeeAllRequests: false },
  'usr-010': { managerId: 'usr-007', managerName: 'Harish Solanki', team: 'Procurement West', hierarchyLevel: 2, canSeeAllRequests: false },
  'usr-011': { managerId: 'usr-009', managerName: 'Neha Gupta', team: 'Procurement East', hierarchyLevel: 3, canSeeAllRequests: false },
  'usr-012': { managerId: 'usr-009', managerName: 'Neha Gupta', team: 'Procurement East', hierarchyLevel: 3, canSeeAllRequests: false },
  'usr-013': { managerId: 'usr-010', managerName: 'Rohit Pandey', team: 'Procurement West', hierarchyLevel: 3, canSeeAllRequests: false },
  'usr-014': { managerId: 'usr-010', managerName: 'Rohit Pandey', team: 'Procurement West', hierarchyLevel: 3, canSeeAllRequests: false },
  'usr-015': { managerId: 'usr-010', managerName: 'Rohit Pandey', team: 'Procurement West', hierarchyLevel: 3, canSeeAllRequests: false }
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
        await Permission.updateOne({ key: perm.key }, { $setOnInsert: perm }, { upsert: true });
      }
    }

    // ── Roles ────────────────────────────────────────────────────────────────
    console.log('[DB] Seeding/updating system roles...');
    // Delete legacy obsolete roles if they exist in DB
    await Role.deleteMany({ roleName: { $in: ['cfo-inner', 'inner-team'] } });
    for (const defRole of DEFAULT_ROLES) {
      await Role.updateOne(
        { roleName: defRole.roleName },
        { $set: { ...defRole } },
        { upsert: true }
      );
    }

    // Update any existing users with legacy role keys to standard role keys
    await User.updateMany({ role: 'cfo-inner' }, { $set: { role: 'accounts' } });
    await User.updateMany({ role: 'inner-team' }, { $set: { role: 'procurement' } });

    // ── Users ────────────────────────────────────────────────────────────────
    console.log('[DB] Seeding/updating system users...');
    const defaultPassHash = await User.hashPassword('Rayzon@2026');
    for (const u of DUMMY_USERS) {
      const hierarchy = DEMO_HIERARCHY[u.id] || {};
      const existing = await User.findOne({ email: u.email });
      if (!existing) {
        await User.create({ ...u, ...hierarchy, passwordHash: defaultPassHash });
      } else {
        Object.assign(existing, { ...u, ...hierarchy, passwordHash: defaultPassHash });
        await existing.save();
      }
    }

    // ── Freight Forwarder / Logistics Vendors ─────────────────────────────────
    const ffVendorCount = await Vendor.countDocuments({
      vendorType: { $in: ['Freight Forwarder', 'Shipping Line', 'Logistics Provider'] }
    });
    if (ffVendorCount === 0) {
      console.log('[DB] Seeding Freight Forwarder / Shipping Line vendors...');
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

    // ── Workflow Slabs ────────────────────────────────────────────────────────
    console.log('[DB] Ensuring default workflow slabs...');
    const { ensureAllWorkflows } = await import('../modules/workflows/workflowDefaults.js');
    await ensureAllWorkflows();

  } catch (err) {
    console.warn('[DB] Seeding error:', err.message);
  }
};

export const resetAndSeedDatabase = async () => {
  const mongoose = (await import('mongoose')).default;
  console.log('[DB RESET] Clearing all collections...');
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
  console.log('[DB RESET] Collections cleared. Starting full re-seed...');
  await seedDatabase();
  console.log('[DB RESET] Completed successfully.');
};
