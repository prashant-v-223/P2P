import { Router } from 'express';
import { getUsers, createUser, updateUser, deleteUser } from './users.controller.js';
import { authenticateToken, optionalAuth } from '../../middleware/auth.middleware.js';
import { authorizePermission } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.get('/', optionalAuth, asyncHandler(getUsers));
router.post('/', authenticateToken, authorizePermission('users', 'create'), asyncHandler(createUser));
router.put('/:id', authenticateToken, authorizePermission('users', 'update'), asyncHandler(updateUser));
router.delete('/:id', authenticateToken, authorizePermission('users', 'delete'), asyncHandler(deleteUser));

export default router;
