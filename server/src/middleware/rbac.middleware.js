import { Role } from '../models/Role.js';
import { User } from '../models/User.js';

/**
 * Resolves the EFFECTIVE role(s) for a requesting user.
 * If another user has delegated to this user (parentUserId = req.user.id AND delegationActive = true),
 * this user also inherits the delegating user's role permissions for approval actions.
 */
const getEffectiveRoles = async (requestingUser) => {
  const roles = [requestingUser.role];

  // Find all users who have delegated to this user and delegation is currently active
  const delegators = await User.find({
    parentUserId: requestingUser.id,
    delegationActive: true,
    status: 'Active'
  }).lean();

  for (const delegator of delegators) {
    // Check delegation date range if set
    const now = new Date();
    if (delegator.delegationStartAt && delegator.delegationStartAt > now) continue;
    if (delegator.delegationEndAt && delegator.delegationEndAt < now) continue;
    if (delegator.role && !roles.includes(delegator.role)) {
      roles.push(delegator.role);
    }
  }

  return roles;
};

export const authorizeRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized user' });
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Access requires one of the following roles: ${allowedRoles.join(', ')}`
      });
    }
    next();
  };
};

export const authorizePermission = (moduleKey, action) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized user' });
    }

    // System Admin / admin role — full bypass
    if (req.user.role === 'System Admin' || req.user.role === 'admin') {
      return next();
    }

    try {
      // Get effective roles (own + any delegated roles)
      const effectiveRoles = await getEffectiveRoles(req.user);

      // Check permission across all effective roles
      const roleRecords = await Role.find({ roleName: { $in: effectiveRoles } }).lean();

      if (process.env.NODE_ENV === 'development') {
        console.log(`[RBAC DEBUG] Checking permission: ${action} on ${moduleKey}`);
        console.log(`[RBAC DEBUG] User: ${req.user?.id} (${req.user?.role})`);
        console.log(`[RBAC DEBUG] Effective roles:`, effectiveRoles);
      }

      const hasPermission = roleRecords.some((role) => {
        const modulePerms = role?.permissions?.[moduleKey] || [];
        return modulePerms.includes(action) || modulePerms.includes('manage') || modulePerms.includes('*');
      });

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: `Forbidden: Permission '${action}' on '${moduleKey}' module required`
        });
      }

      // Attach effective roles to request for downstream use
      req.effectiveRoles = effectiveRoles;
      return next();
    } catch (error) {
      console.error('[RBAC ERROR]', error);
      return next(error);
    }
  };
};

/**
 * Check if the requesting user can act on behalf of a specific approver role.
 * Used in approval endpoints to allow delegates to approve on behalf of the delegating user.
 */
export const canActForRole = async (requestingUserId, targetRole) => {
  try {
    const requestingUser = await User.findOne({ id: requestingUserId }).lean();
    if (!requestingUser) return false;
    if (requestingUser.role === targetRole) return true;
    if (requestingUser.role === 'admin' || requestingUser.role === 'System Admin') return true;

    // Check delegated roles
    const effectiveRoles = await getEffectiveRoles(requestingUser);
    return effectiveRoles.includes(targetRole);
  } catch {
    return false;
  }
};
