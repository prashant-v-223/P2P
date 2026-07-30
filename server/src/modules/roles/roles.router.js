import { Router } from 'express';
import { createRole, deleteRole, getRoles, updateRole, updateRolePermissions } from './roles.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizeRole } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.use(authenticateToken);

router.get('/', asyncHandler(getRoles));
router.post('/', authorizeRole(['System Admin']), asyncHandler(createRole));
router.put('/:id', authorizeRole(['System Admin']), asyncHandler(updateRole));
router.put('/:id/permissions', authorizeRole(['System Admin']), asyncHandler(updateRolePermissions));
router.delete('/:id', authorizeRole(['System Admin']), asyncHandler(deleteRole));

export default router;
