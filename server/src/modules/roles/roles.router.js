import { Router } from 'express';
import { createRole, deleteRole, getRoles, updateRole, updateRolePermissions } from './roles.controller.js';
import { authenticateToken, optionalAuth } from '../../middleware/auth.middleware.js';
import { authorizeRole } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.get('/', optionalAuth, asyncHandler(getRoles));
router.post('/', optionalAuth, asyncHandler(createRole));
router.put('/:id', optionalAuth, asyncHandler(updateRole));
router.put('/:id/permissions', optionalAuth, asyncHandler(updateRolePermissions));
router.delete('/:id', optionalAuth, asyncHandler(deleteRole));

export default router;
