import { Router } from 'express';
import { getUsers, createUser, updateUser, deleteUser, getUserDelegation } from './users.controller.js';
import { authenticateToken, optionalAuth } from '../../middleware/auth.middleware.js';
import { authorizePermission } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.get('/', optionalAuth, asyncHandler(getUsers));
router.post('/', authenticateToken, authorizePermission('users', 'manage'), asyncHandler(createUser));
router.put('/:id', authenticateToken, authorizePermission('users', 'manage'), asyncHandler(updateUser));
router.delete('/:id', authenticateToken, authorizePermission('users', 'manage'), asyncHandler(deleteUser));

// Admin: view delegation info for any user
router.get('/:id/delegation', authenticateToken, authorizePermission('users', 'view'), asyncHandler(getUserDelegation));

export default router;
