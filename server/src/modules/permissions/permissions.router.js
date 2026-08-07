import { Router } from 'express';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizeRole } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createPermission, deletePermission, getPermissions, updatePermission } from './permissions.controller.js';

const router = Router();

router.get('/', authenticateToken, asyncHandler(getPermissions));
router.post('/', authenticateToken, authorizeRole(['admin', 'System Admin']), asyncHandler(createPermission));
router.put('/:id', authenticateToken, authorizeRole(['admin', 'System Admin']), asyncHandler(updatePermission));
router.delete('/:id', authenticateToken, authorizeRole(['admin', 'System Admin']), asyncHandler(deletePermission));

export default router;
