import { Router } from 'express';
import { createRole, deleteRole, getRoles, updateRole, updateRolePermissions } from './roles.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizeRole } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.get('/', authenticateToken, asyncHandler(getRoles));
router.post('/', authenticateToken, authorizeRole(['admin', 'System Admin']), asyncHandler(createRole));
router.put('/:id', authenticateToken, authorizeRole(['admin', 'System Admin']), asyncHandler(updateRole));
router.put('/:id/permissions', authenticateToken, authorizeRole(['admin', 'System Admin']), asyncHandler(updateRolePermissions));
router.delete('/:id', authenticateToken, authorizeRole(['admin', 'System Admin']), asyncHandler(deleteRole));

export default router;
