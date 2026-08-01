import { Router } from 'express';
import { authenticateToken, optionalAuth } from '../../middleware/auth.middleware.js';
import { authorizeRole } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createPermission, deletePermission, getPermissions, updatePermission } from './permissions.controller.js';

const router = Router();

router.get('/', optionalAuth, asyncHandler(getPermissions));
router.post('/', optionalAuth, asyncHandler(createPermission));
router.put('/:id', optionalAuth, asyncHandler(updatePermission));
router.delete('/:id', optionalAuth, asyncHandler(deletePermission));

export default router;
