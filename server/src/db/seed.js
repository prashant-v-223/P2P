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
  } catch (err) {
    console.warn('[DB] Seeding error:', err.message);
  }
};
