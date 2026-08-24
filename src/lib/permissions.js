// ─────────────────────────────────────────────────────────────────────────────
// ROLE-BASED ACCESS CONTROL (RBAC) FRONTEND PERMISSION HELPER
//
// The SOURCE OF TRUTH for permissions is MongoDB:
//   Role.permissions = { moduleKey: ['view', 'create', ...] }
//
// The backend attaches the user's role permissions to the user object on
// login/refresh/getMe as `user.permissions` (the DB shape above). This module
// enforces permissions from that DB-driven object FIRST.
//
// The static ROLE_PERMISSIONS map below is used ONLY as a fallback when DB
// permissions are not available (e.g. offline/demo mode, missing role record).
// ─────────────────────────────────────────────────────────────────────────────

// ── Static fallback permission map (used only when DB permissions are absent) ─
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
    'users.view',
    'users.create',
    'users.edit'
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
    'users.create',
    'users.edit',
    'workflows.view'
  ],

  'logistics': [
    'logistics-providers.view',
    'logistics-payments.view',
    'exim.view'
  ],

  'logistics-manager': [
    'dashboard.view',
    'logistics-providers.view',
    'logistics-payments.view',
    'exim.view',
    'custom-agents.view',
    'approvals.view',
    'approvals.action',
    'users.view',
    'users.create',
    'users.edit'
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
    'users.create',
    'users.edit',
    'sap.view',
    'custom-agents.view'
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
    'logistics-providers.view'
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
    'users.create',
    'users.edit',
    'sap.view'
  ]
};

for (const role of ['accounts', 'cfo', 'exim', 'exim-manager', 'finance', 'logistics', 'logistics-manager', 'md', 'procurement', 'procurement_head']) {
  if (ROLE_PERMISSIONS[role]) {
    if (!ROLE_PERMISSIONS[role].includes('users.view') && (role.includes('manager') || role.includes('head') || role.includes('cfo'))) {
      ROLE_PERMISSIONS[role].push('users.view', 'users.create', 'users.edit');
    }
  }
}

for (const role of ['accounts', 'cfo', 'exim', 'exim-manager', 'finance', 'logistics', 'logistics-manager', 'md', 'procurement', 'procurement_head']) {
  if (ROLE_PERMISSIONS[role] && !ROLE_PERMISSIONS[role].includes('reports.view')) ROLE_PERMISSIONS[role].push('reports.view');
}
for (const role of ['purchase-manager', 'cfo-inner', 'inner-team', 'manager']) {
  ROLE_PERMISSIONS[role] = [...(ROLE_PERMISSIONS[role] || []), 'reports.view'];
}

// Route permission requirements mapping
export const ROUTE_PERMISSIONS = {
  '/dashboard': 'dashboard.view',
  '/p2p/purchase-orders': 'purchase-orders.view',
  '/p2p/advances': 'advance-payments.view',
  '/p2p/advance-payments': 'advance-payments.view',
  '/p2p/invoices': 'invoice-payments.view',
  '/p2p/invoice-payments': 'invoice-payments.view',
  '/p2p/custom-duty/create': 'custom-duty.create',
  '/admin/custom-duty/create': 'custom-duty.create',
  '/p2p/custom-duty': 'custom-duty.view',
  '/p2p/logistics-payments/create': 'logistics-payments.create',
  '/admin/logistics-payments/create': 'logistics-payments.create',
  '/p2p/logistics-payments': 'logistics-payments.view',
  '/p2p/rfq': 'rfq.view',
  '/admin/rfqs': 'rfq.view',
  '/p2p/exim-review': 'exim.view',
  '/admin/exim': 'exim.view',
  '/p2p/bl-invoices': 'bl.view',
  '/approvals': 'approvals.view',
  '/management/vendors': 'vendors.view',
  '/admin/vendors': 'vendors.view',
  '/management/custom-agents': 'custom-agents.view',
  '/admin/custom-agents': 'custom-agents.view',
  '/management/logistics-providers': 'logistics-providers.view',
  '/admin/logistics-providers': 'logistics-providers.view',
  '/admin/users': 'users.view',
  '/admin/roles': 'roles.view',
  '/admin/hierarchy-report': 'reports.view',
  '/admin/sap-sync': 'sap.view',
  '/p2p/sap-sync': 'sap.view',
  '/admin/workflows': 'workflows.view',
  '/admin/exchange-rates': 'exchange-rates.view',
  '/profile': '*'
};

const ADMIN_ROLES = new Set(['admin', 'systemadmin', 'superadmin', 'system admin', 'super admin']);

/**
 * Check if a role belongs to the Finance team (Finance, CFO, Accounts, etc.)
 */
export const isFinanceRole = (userRole) => {
  if (!userRole) return false;
  const r = String(userRole).toLowerCase().trim();
  return r.includes('finance') || r.includes('cfo') || r.includes('account');
};

/**
 * Normalize a role name for alias matching.
 */
const normalizeRole = (role) => String(role || '').toLowerCase().replace(/[\s_-]+/g, '').trim();

/**
 * Resolve the static fallback permission list for a role.
 */
const resolveStaticRolePerms = (userRole) => {
  const roleNorm = normalizeRole(userRole);
  if (ADMIN_ROLES.has(roleNorm)) return ['*'];

  let rolePerms = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS[roleNorm];

  if (!rolePerms) {
    const raw = String(userRole || '').toLowerCase().trim();
    if (raw.includes('cfo')) rolePerms = ROLE_PERMISSIONS['cfo'];
    else if (raw.includes('finance')) rolePerms = ROLE_PERMISSIONS['finance'];
    else if (raw.includes('account')) rolePerms = ROLE_PERMISSIONS['accounts'];
    else if (raw.includes('procurement') && raw.includes('head')) rolePerms = ROLE_PERMISSIONS['procurement_head'];
    else if (raw.includes('procurement')) rolePerms = ROLE_PERMISSIONS['procurement'];
    else if (raw.includes('exim') && raw.includes('manager')) rolePerms = ROLE_PERMISSIONS['exim-manager'];
    else if (raw.includes('exim')) rolePerms = ROLE_PERMISSIONS['exim'];
    else if (raw.includes('logistics') && raw.includes('manager')) rolePerms = ROLE_PERMISSIONS['logistics-manager'];
    else if (raw.includes('logistics')) rolePerms = ROLE_PERMISSIONS['logistics'];
    else if (raw.includes('md') || raw.includes('managing')) rolePerms = ROLE_PERMISSIONS['md'];
  }

  return rolePerms || [];
};

/**
 * Check whether a permission string (e.g. 'users.create') is allowed by the
 * DB-shaped permissions object: { moduleKey: ['view', 'create', ...] }.
 */
const hasPermissionInDbShape = (permissionsObj, moduleKey, action) => {
  if (!permissionsObj || typeof permissionsObj !== 'object') return false;

  // Wildcard module grant: { '*': ['*'] } (admin)
  if (permissionsObj['*']) {
    const wildcard = permissionsObj['*'];
    if (Array.isArray(wildcard) && (wildcard.includes('*') || wildcard.includes(action))) return true;
  }

  const modActions = permissionsObj[moduleKey];
  if (!Array.isArray(modActions)) return false;

  return (
    modActions.includes('*') ||
    modActions.includes(action) ||
    modActions.includes('manage')
  );
};

/**
 * Check if a user role has a specific permission key (e.g. 'users.create').
 *
 * Resolution order:
 *   1. Admin / super-admin roles bypass everything.
 *   2. If DB-shaped permissions are provided (customPermissions), resolve
 *      strictly from them — DB revocations are respected.
  *   3. Otherwise fall back to static permissions when DB object is empty.
 */
export function userHasPermission(userRole, permissionKey, customPermissions) {
  if (!userRole) return false;
  if (permissionKey === '*') return true;

  const roleClean = String(userRole || '').toLowerCase().replace(/[\s_-]+/g, '');
  const isDeptManager = roleClean.includes('manager') || roleClean.includes('head') || roleClean.includes('cfo') || roleClean.includes('lead') || roleClean.includes('director');

  // Department managers automatically get access to users directory and pending approvals
  if ((permissionKey.startsWith('users.') || permissionKey.startsWith('approvals.')) && isDeptManager) return true;

  const [mod, act] = String(permissionKey || '').split('.');

  // 1. DB-driven resolution (source of truth from MongoDB role permissions)
  if (customPermissions && typeof customPermissions === 'object' && Object.keys(customPermissions).length > 0) {
    if (Array.isArray(customPermissions)) {
      if (customPermissions.includes('*') || customPermissions.includes(permissionKey)) return true;
      if (act && (customPermissions.includes(`${mod}.manage`) || customPermissions.includes(`${mod}.*`))) return true;
      return false;
    }
    return hasPermissionInDbShape(customPermissions, mod, act);
  }

  // 2. Admin role bypass (only reached when explicit DB permissions object is empty/absent)
  if (ADMIN_ROLES.has(normalizeRole(userRole))) return true;

  // 3. Static fallback (only reached when DB permissions object is absent or empty)
  const staticPerms = resolveStaticRolePerms(userRole);
  if (staticPerms.includes('*')) return true;
  if (staticPerms.includes(permissionKey)) return true;
  if (act && (staticPerms.includes(`${mod}.manage`) || staticPerms.includes(`${mod}.*`))) return true;

  return false;
}

/**
 * Check if a user role has permission to access a specific route.
 */
export function userCanAccessRoute(userRole, routePath, customPermissions) {
  // Normalize path (strip query params / trailing slashes)
  const cleanPath = (routePath || '/').split('?')[0].replace(/\/$/, '') || '/';

  // Hierarchy Report (7-Day Payment Report): Accessible ONLY to Finance & Admin teams
  if (cleanPath === '/admin/hierarchy-report') {
    const roleNorm = normalizeRole(userRole);
    return ADMIN_ROLES.has(roleNorm) || isFinanceRole(userRole);
  }

  // Find matching route permission (exact match first)
  let permKey = ROUTE_PERMISSIONS[cleanPath];

  // Prefix matching for sub-routes like /p2p/advance-payments/create or /p2p/invoices/INV-123
  if (!permKey) {
    for (const [routePattern, perm] of Object.entries(ROUTE_PERMISSIONS)) {
      if (routePattern !== '/' && cleanPath.startsWith(routePattern)) {
        permKey = perm;
        break;
      }
    }
  }

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
