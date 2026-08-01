import { Role } from '../models/Role.js';
import { Permission } from '../models/Permission.js';

export const DEFAULT_PERMISSIONS = [
  { id: 'perm-1', key: 'users.read', name: 'View Users', module: 'User Management', action: 'read', description: 'View user directory and account details.', type: 'System', status: 'Active' },
  { id: 'perm-2', key: 'users.create', name: 'Provision User', module: 'User Management', action: 'create', description: 'Create new user accounts.', type: 'System', status: 'Active' },
  { id: 'perm-3', key: 'users.update', name: 'Edit User', module: 'User Management', action: 'update', description: 'Update existing user profile and roles.', type: 'System', status: 'Active' },
  { id: 'perm-4', key: 'users.delete', name: 'Delete User', module: 'User Management', action: 'delete', description: 'Remove user accounts.', type: 'System', status: 'Active' },

  { id: 'perm-5', key: 'vendors.read', name: 'View Vendors', module: 'Vendor Management', action: 'read', description: 'View vendor directory and profile details.', type: 'System', status: 'Active' },
  { id: 'perm-6', key: 'vendors.create', name: 'Add Vendor', module: 'Vendor Management', action: 'create', description: 'Create new vendor accounts.', type: 'System', status: 'Active' },
  { id: 'perm-7', key: 'vendors.update', name: 'Edit Vendor', module: 'Vendor Management', action: 'update', description: 'Modify vendor profile details and bank info.', type: 'System', status: 'Active' },
  { id: 'perm-8', key: 'vendors.delete', name: 'Delete Vendor', module: 'Vendor Management', action: 'delete', description: 'Delete vendor records.', type: 'System', status: 'Active' },

  { id: 'perm-9', key: 'workflows.read', name: 'View Workflows', module: 'Workflow Slabs', action: 'read', description: 'View workflow slab routing rules.', type: 'System', status: 'Active' },
  { id: 'perm-10', key: 'workflows.create', name: 'Add Workflow', module: 'Workflow Slabs', action: 'create', description: 'Create new workflow approval slabs.', type: 'System', status: 'Active' },
  { id: 'perm-11', key: 'workflows.update', name: 'Edit Workflow', module: 'Workflow Slabs', action: 'update', description: 'Modify workflow slab rules and stages.', type: 'System', status: 'Active' },
  { id: 'perm-12', key: 'workflows.delete', name: 'Delete Workflow', module: 'Workflow Slabs', action: 'delete', description: 'Remove workflow slabs.', type: 'System', status: 'Active' },

  { id: 'perm-13', key: 'exchange-rates.read', name: 'View Rates', module: 'Exchange Rates', action: 'read', description: 'View currency exchange rates.', type: 'System', status: 'Active' },
  { id: 'perm-14', key: 'exchange-rates.update', name: 'Manage Rates', module: 'Exchange Rates', action: 'update', description: 'Update FX rates used for INR conversion.', type: 'System', status: 'Active' },

  { id: 'perm-15', key: 'approvals.read', name: 'View Approvals', module: 'Approvals', action: 'read', description: 'View pending and completed approval requests.', type: 'System', status: 'Active' },
  { id: 'perm-16', key: 'approvals.approve', name: 'Approve Request', module: 'Approvals', action: 'approve', description: 'Approve payment or PO requests.', type: 'System', status: 'Active' },
  { id: 'perm-17', key: 'approvals.reject', name: 'Reject Request', module: 'Approvals', action: 'reject', description: 'Reject requests with remarks.', type: 'System', status: 'Active' },

  { id: 'perm-18', key: 'roles.read', name: 'View Roles', module: 'Roles & Permissions', action: 'read', description: 'View system roles and permission matrix.', type: 'System', status: 'Active' },
  { id: 'perm-19', key: 'roles.update', name: 'Manage Permissions', module: 'Roles & Permissions', action: 'update', description: 'Assign permissions to system roles.', type: 'System', status: 'Active' }
];

export const DEFAULT_ROLES = [
  {
    id: 'role-1',
    roleName: 'System Admin',
    description: 'Full database and administrative control across all modules.',
    type: 'System',
    status: 'Active',
    permissions: {
      users: ['read', 'create', 'update', 'delete'],
      vendors: ['read', 'create', 'update', 'delete'],
      workflows: ['read', 'create', 'update', 'delete'],
      'exchange-rates': ['read', 'update'],
      approvals: ['read', 'approve', 'reject'],
      roles: ['read', 'update']
    }
  },
  {
    id: 'role-2',
    roleName: 'Finance Lead',
    description: 'Financial approval authority, rate maintenance, and vendor oversight.',
    type: 'System',
    status: 'Active',
    permissions: {
      users: ['read'],
      vendors: ['read', 'update'],
      workflows: ['read', 'update'],
      'exchange-rates': ['read', 'update'],
      approvals: ['read', 'approve', 'reject'],
      roles: ['read']
    }
  },
  {
    id: 'role-3',
    roleName: 'Procurement Head',
    description: 'Procurement operations, supplier provisioning, and PO approvals.',
    type: 'System',
    status: 'Active',
    permissions: {
      users: ['read'],
      vendors: ['read', 'create', 'update'],
      workflows: ['read'],
      approvals: ['read', 'approve', 'reject']
    }
  },
  {
    id: 'role-4',
    roleName: 'MD',
    description: 'Executive tier approval authority for high-value threshold payments.',
    type: 'System',
    status: 'Active',
    permissions: {
      workflows: ['read'],
      approvals: ['read', 'approve', 'reject']
    }
  },
  {
    id: 'role-5',
    roleName: 'Logistics Lead',
    description: 'Logistics payment verification and supplier coordination.',
    type: 'System',
    status: 'Active',
    permissions: {
      vendors: ['read'],
      approvals: ['read', 'approve']
    }
  }
];

import { ApprovalWorkflow, ApprovalInstance, ApprovalAction } from '../models/ApprovalEngine.js';
import { AdvancePayment } from '../models/AdvancePayment.js';
import { InvoicePayment } from '../models/InvoicePayment.js';
import { CustomDutyPayment } from '../models/CustomDutyPayment.js';
import { LogisticsPayment } from '../models/LogisticsPayment.js';
import { Document } from '../models/Document.js';

export const seedDatabase = async () => {
  try {
    const permCount = await Permission.countDocuments();
    if (permCount === 0) {
      console.log('[DB] Seeding default system permissions...');
      await Permission.insertMany(DEFAULT_PERMISSIONS);
    }

    const roleCount = await Role.countDocuments();
    if (roleCount === 0) {
      console.log('[DB] Seeding default system roles...');
      await Role.insertMany(DEFAULT_ROLES);
    } else {
      // Ensure existing roles have permissions object populated
      for (const defRole of DEFAULT_ROLES) {
        const existing = await Role.findOne({ roleName: defRole.roleName });
        if (existing && (!existing.permissions || Object.keys(existing.permissions).length === 0)) {
          existing.permissions = defRole.permissions;
          existing.markModified('permissions');
          await existing.save();
        }
      }
    }

    // --- Seed Approval Workflows ---
    const workflowCount = await ApprovalWorkflow.countDocuments();
    if (workflowCount === 0) {
      console.log('[DB] Seeding P2P Approval Workflows...');
      await ApprovalWorkflow.insertMany([
        {
          workflowId: 'WF-001',
          name: 'Advance Payment (Up to ₹50K)',
          module: 'advance_payment',
          minAmount: 0,
          maxAmount: 50000,
          status: 'Active',
          steps: [
            { stepNumber: 1, stepName: 'Procurement Head Approval', approverRole: 'procurement_head', escalationHours: 24 }
          ]
        },
        {
          workflowId: 'WF-002',
          name: 'Advance Payment (> ₹50K)',
          module: 'advance_payment',
          minAmount: 50001,
          maxAmount: 1000000,
          status: 'Active',
          steps: [
            { stepNumber: 1, stepName: 'Procurement Head Approval', approverRole: 'procurement_head', escalationHours: 24 },
            { stepNumber: 2, stepName: 'Finance Approval', approverRole: 'finance', escalationHours: 24 }
          ]
        },
        {
          workflowId: 'WF-003',
          name: 'Invoice Payment (Up to ₹1CR)',
          module: 'invoice_payment',
          minAmount: 0,
          maxAmount: 10000000,
          status: 'Active',
          steps: [
            { stepNumber: 1, stepName: 'Procurement Head Review', approverRole: 'procurement_head', escalationHours: 24 },
            { stepNumber: 2, stepName: 'Finance Head Approval', approverRole: 'finance', escalationHours: 48 }
          ]
        },
        {
          workflowId: 'WF-009',
          name: 'RFQ Vendor Allocation Approval',
          module: 'rfq',
          minAmount: 0,
          maxAmount: 50000000,
          status: 'Active',
          steps: [
            { stepNumber: 1, stepName: 'Procurement Head Review', approverRole: 'procurement_head', escalationHours: 24 },
            { stepNumber: 2, stepName: 'EXIM Manager Signoff', approverRole: 'exim-manager', escalationHours: 24 },
            { stepNumber: 3, stepName: 'MD Final Approval', approverRole: 'md', escalationHours: 72 }
          ]
        }
      ]);
    }

    // --- Seed Invoice Payments ---
    const invCount = await InvoicePayment.countDocuments();
    if (invCount === 0) {
      console.log('[DB] Seeding Invoice Payment trace data...');
      await InvoicePayment.create({
        invoicePaymentId: 'INV-PAY-007',
        poId: 'PO-2026-9901',
        sapPoNumber: '31094582',
        vendorId: 'VEND-001',
        vendorName: 'Solar Tech Industries',
        invoiceNumber: 'INV-20260713-0001',
        grossAmount: 219497.36,
        gstAmount: 39509.52,
        tdsAmount: 4389.95,
        netPayable: 254616.93,
        status: 'approved',
        approvalInstanceId: 'INST-11'
      });
    }

    // --- Seed Advance Payments ---
    const advCount = await AdvancePayment.countDocuments();
    if (advCount === 0) {
      console.log('[DB] Seeding Advance Payment trace data...');
      await AdvancePayment.insertMany([
        {
          advanceId: 'ADV-PAY-001',
          poId: 'PO-2026-8801',
          sapPoNumber: '21094581',
          vendorId: 'VEND-002',
          vendorName: 'Global Silicon Supplies',
          amount: 50000,
          gstBreakup: { cgst: 41.325, sgst: 41.325, igst: 0, totalGst: 82.65 },
          paymentMode: 'RTGS',
          status: 'approved',
          approvalInstanceId: 'INST-01'
        },
        {
          advanceId: 'ADV-PAY-002',
          poId: 'PO-2026-8802',
          sapPoNumber: '21094582',
          vendorId: 'VEND-003',
          vendorName: 'Alpha Logistics & Materials',
          amount: 2194.80,
          gstBreakup: { cgst: 0, sgst: 0, igst: 0, totalGst: 0 },
          paymentMode: 'RTGS',
          status: 'draft',
          approvalInstanceId: 'INST-02'
        }
      ]);
    }

    // --- Seed Custom Duty Payments ---
    const customCount = await CustomDutyPayment.countDocuments();
    if (customCount === 0) {
      console.log('[DB] Seeding Custom Duty Payment trace data...');
      await CustomDutyPayment.create({
        customDutyId: 'CD-PAY-001',
        referenceNumber: 'CD-20260713-0001',
        boeNumber: 'BOE-994812',
        boeDate: new Date('2026-07-13'),
        portCode: 'INNSA1',
        dutyAmount: 45000,
        fineInterestAmount: 0,
        totalAmount: 45000,
        status: 'draft'
      });
    }

    // --- Seed Logistics Payments ---
    const logCount = await LogisticsPayment.countDocuments();
    if (logCount === 0) {
      console.log('[DB] Seeding Logistics Payment trace data...');
      await LogisticsPayment.create({
        logisticsPaymentId: 'LOG-PAY-001',
        referenceNumber: 'LOG-20260713-0001',
        vendorId: 'VEND-102',
        vendorName: 'Oceanic Freight Systems',
        invoiceNumber: 'OFS-98471',
        blNumber: 'BL-98471209',
        freightCharges: 12000,
        terminalHandlingCharges: 3000,
        totalAmount: 15000,
        status: 'draft'
      });
    }

    // --- Seed Approval Instances & Audit Actions ---
    const instCount = await ApprovalInstance.countDocuments();
    if (instCount === 0) {
      console.log('[DB] Seeding Approval Instances & Actions trace data...');
      await ApprovalInstance.insertMany([
        {
          instanceId: 'INST-11',
          approvableType: 'InvoicePayment',
          approvableId: 'INV-PAY-007',
          workflowId: 'WF-003',
          currentStep: 2,
          totalSteps: 2,
          assignedApproverRole: 'finance',
          status: 'approved'
        },
        {
          instanceId: 'INST-19',
          approvableType: 'RfqHeader',
          approvableId: 'RFQ-005',
          workflowId: 'WF-009',
          currentStep: 3,
          totalSteps: 3,
          assignedApproverRole: 'md',
          status: 'returned'
        }
      ]);

      await ApprovalAction.insertMany([
        {
          actionId: 'ACT-10',
          instanceId: 'INST-11',
          stepIndex: 1,
          action: 'approve',
          performedBy: 'USER-001',
          performedByName: 'Procurement Head User',
          comments: 'Invoice verified against GRN.'
        },
        {
          actionId: 'ACT-11',
          instanceId: 'INST-11',
          stepIndex: 2,
          action: 'approve',
          performedBy: 'USER-002',
          performedByName: 'Finance Manager',
          comments: 'Approved for disbursement.'
        },
        {
          actionId: 'ACT-21',
          instanceId: 'INST-19',
          stepIndex: 3,
          action: 'return',
          performedBy: 'USER-003',
          performedByName: 'Managing Director',
          comments: 'Re-negotiate freight terms with vendor.'
        }
      ]);
    }

    // --- Seed Documents ---
    const docCount = await Document.countDocuments();
    if (docCount === 0) {
      console.log('[DB] Seeding Document Attachments trace data...');
      await Document.insertMany([
        {
          documentId: 'DOC-101',
          title: 'Vendor Tax Invoice copy',
          documentType: 'vendor_invoice',
          fileUrl: '/uploads/invoices/inv_20260713_0001.pdf',
          fileName: 'inv_20260713_0001.pdf',
          fileSize: 1024500,
          documentableType: 'InvoicePayment',
          documentableId: 'INV-PAY-007',
          uploadedBy: 'Finance User'
        },
        {
          documentId: 'DOC-102',
          title: 'RFQ Terms & Vendor Quotes',
          documentType: 'rfq_document',
          fileUrl: '/uploads/rfq/rfq_005_specs.pdf',
          fileName: 'rfq_005_specs.pdf',
          fileSize: 2048000,
          documentableType: 'RfqHeader',
          documentableId: 'RFQ-005',
          uploadedBy: 'Procurement User'
        }
      ]);
    }

  } catch (err) {
    console.warn('[DB] Seeding error:', err.message);
  }
};

