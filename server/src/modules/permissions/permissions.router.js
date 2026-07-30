import { Router } from 'express';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizeRole } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createPermission, deletePermission, getPermissions, updatePermission } from './permissions.controller.js';

const router = Router();
router.use(authenticateToken);
router.get('/', asyncHandler(getPermissions));
router.post('/', authorizeRole(['System Admin']), asyncHandler(createPermission));
router.put('/:id', authorizeRole(['System Admin']), asyncHandler(updatePermission));
router.delete('/:id', authorizeRole(['System Admin']), asyncHandler(deletePermission));

export default router;
