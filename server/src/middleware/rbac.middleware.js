import { Role } from '../models/Role.js';

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

    // System Admin bypass
    if (req.user.role === 'System Admin') {
      return next();
    }

    try {
      const role = await Role.findOne({ roleName: req.user.role }).lean();
      const modulePerms = role?.permissions?.[moduleKey] || [];

      if (!modulePerms.includes(action)) {
        return res.status(403).json({
          success: false,
          error: `Forbidden: Permission '${action}' on '${moduleKey}' module required`
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
};
