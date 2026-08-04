// ─────────────────────────────────────────────────────────────────────────────
// ROLE-BASED ACCESS CONTROL (RBAC) FRONTEND PERMISSION HELPER
// Enforces precise view & action permissions for all 10 system roles
// ─────────────────────────────────────────────────────────────────────────────

export const ROLE_PERMISSIONS = {
  'admin': ['*'],
  'System Admin': ['*'],

  'accounts': [
    'dashboard.view',
    'purchase-orders.view',
    'advance-payments.view',
    'invoice-payments.view',
    'logistics-payments.view',
    'custom-duty.view',
    'approvals.view',
    'blank-invoices.view',
    'exchange-rates.view',
    'sap.view'
  ],

  'cfo': [
    'dashboard.view',
    'purchase-orders.view',
    'advance-payments.view',
    'invoice-payments.view',
    'logistics-payments.view',
    'custom-duty.view',
    'approvals.view',
    'exchange-rates.view',
    'vendors.view',
    'workflows.view'
  ],

  'exim': [
    'dashboard.view',
    'purchase-orders.view',
    'advance-payments.view',
    'invoice-payments.view',
    'logistics-payments.view',
    'custom-duty.view',
    'blank-invoices.view',
    'approvals.view',
    'rfq.view',
    'bl.view',
    'exim.view',
    'logistics-providers.view',
    'custom-agents.view',
    'exchange-rates.view',
    'sap.view',
    'vendors.view',
    'workflows.view'
  ],

  'exim-manager': [
    'dashboard.view',
    'advance-payments.view',
    'rfq.view',
    'bl.view',
    'exim.view',
    'logistics-providers.view',
    'custom-agents.view',
    'logistics-payments.view',
    'custom-duty.view',
    'blank-invoices.view',
    'approvals.view',
    'exchange-rates.view',
    'vendors.view',
    'workflows.view',
    'users.view'
  ],

  'finance': [
    'dashboard.view',
    'logistics-payments.view',
    'advance-payments.view',
    'invoice-payments.view',
    'custom-duty.view',
    'blank-invoices.view',
    'approvals.view',
    'exchange-rates.view',
    'vendors.view',
    'purchase-orders.view',
    'rfq.view',
    'sap.view',
    'users.view',
    'workflows.view',
    'roles.view',
    'permissions.view'
  ],

  'logistics': [
    'logistics-providers.view',
    'logistics-payments.view',
    'rfq.view',
    'bl.view'
  ],

  'md': [
    'dashboard.view',
    'logistics-providers.view',
    'logistics-payments.view',
    'advance-payments.view',
    'invoice-payments.view',
    'purchase-orders.view',
    'rfq.view',
    'bl.view',
    'exim.view',
    'custom-duty.view',
    'blank-invoices.view',
    'approvals.view',
    'exchange-rates.view',
    'vendors.view',
    'workflows.view',
    'users.view',
    'roles.view',
    'sap.view',
    'custom-agents.view',
    'permissions.view'
  ],

  'procurement': [
    'dashboard.view',
    'purchase-orders.view',
    'advance-payments.view',
    'invoice-payments.view',
    'logistics-payments.view',
    'custom-duty.view',
    'blank-invoices.view',
    'approvals.view',
    'rfq.view',
    'exchange-rates.view',
    'vendors.view',
    'workflows.view',
    'users.view',
    'sap.view',
    'custom-agents.view',
    'logistics-providers.view',
    'roles.view',
    'permissions.view'
  ],

  'procurement_head': [
    'dashboard.view',
    'purchase-orders.view',
    'advance-payments.view',
    'invoice-payments.view',
    'logistics-payments.view',
    'custom-duty.view',
    'blank-invoices.view',
    'approvals.view',
    'rfq.view',
    'bl.view',
    'exim.view',
    'exchange-rates.view',
    'vendors.view',
    'custom-agents.view',
    'logistics-providers.view',
    'workflows.view',
    'users.view',
    'sap.view',
    'roles.view',
    'permissions.view'
  ]
};

// Route permission requirements mapping
export const ROUTE_PERMISSIONS = {
  '/dashboard': 'dashboard.view',
  '/p2p/purchase-orders': 'purchase-orders.view',
  '/p2p/advances': 'advance-payments.view',
  '/p2p/invoices': 'invoice-payments.view',
  '/p2p/custom-duty': 'custom-duty.view',
  '/p2p/logistics-payments': 'logistics-payments.view',
  '/p2p/rfq': 'rfq.view',
  '/p2p/exim-review': 'exim.view',
  '/p2p/bl-invoices': 'bl.view',
  '/approvals': 'approvals.view',
  '/management/vendors': 'vendors.view',
  '/management/custom-agents': 'custom-agents.view',
  '/management/logistics-providers': 'logistics-providers.view',
  '/admin/users': 'users.view',
  '/admin/roles': 'roles.view',
  '/admin/sap-sync': 'sap.view',
  '/admin/workflows': 'workflows.view',
  '/admin/exchange-rates': 'exchange-rates.view',
  '/profile': '*'
};

/**
 * Check if a user role has a specific permission key.
 */
export function userHasPermission(userRole, permissionKey, customPermissions) {
  if (!userRole) return false;
  const roleNorm = String(userRole).toLowerCase().trim();
  if (roleNorm === 'admin' || roleNorm === 'system admin' || roleNorm === 'systemadmin') return true;
  if (permissionKey === '*') return true;

  // Check custom permissions object if passed from DB
  if (customPermissions && typeof customPermissions === 'object') {
    const [mod, act] = permissionKey.split('.');
    if (customPermissions[mod] && customPermissions[mod].includes(act)) return true;
  }

  // Fallback to static role permissions map
  const rolePerms = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS[roleNorm] || [];
  if (rolePerms.includes('*')) return true;
  return rolePerms.includes(permissionKey);
}

/**
 * Check if a user role has permission to access a specific route.
 */
export function userCanAccessRoute(userRole, routePath, customPermissions) {
  // Normalize path (strip query params / trailing slashes)
  const cleanPath = (routePath || '/').split('?')[0].replace(/\/$/, '') || '/';
  
  // Find matching route permission
  const permKey = ROUTE_PERMISSIONS[cleanPath];
  if (!permKey) return true; // Unmapped routes default to accessible
  
  return userHasPermission(userRole, permKey, customPermissions);
}

/**
 * Get the first allowed navigation route for a given user role.
 */
export function getFirstAllowedRoute(userRole, customPermissions) {
  const routes = [
    '/dashboard',
    '/p2p/purchase-orders',
    '/p2p/advances',
    '/p2p/invoices',
    '/p2p/custom-duty',
    '/p2p/logistics-payments',
    '/p2p/rfq',
    '/p2p/exim-review',
    '/p2p/bl-invoices',
    '/approvals',
    '/management/vendors',
    '/management/custom-agents',
    '/management/logistics-providers',
    '/admin/users',
    '/admin/roles',
    '/admin/sap-sync',
    '/admin/workflows',
    '/admin/exchange-rates',
    '/profile'
  ];

  for (const path of routes) {
    if (userCanAccessRoute(userRole, path, customPermissions)) {
      return path;
    }
  }

  return '/profile';
}
