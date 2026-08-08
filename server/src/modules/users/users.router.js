import { Router } from 'express';
import { getUsers, createUser, updateUser, deleteUser, getUserDelegation, getUserHierarchy, resetDatabase } from './users.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizePermission } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.get('/', authenticateToken, authorizePermission('users', 'view'), asyncHandler(getUsers));
router.get('/hierarchy', authenticateToken, authorizePermission('users', 'view'), asyncHandler(getUserHierarchy));
router.post('/reset-database', authenticateToken, authorizePermission('users', 'manage'), asyncHandler(resetDatabase));
router.post('/', authenticateToken, authorizePermission('users', 'create'), asyncHandler(createUser));
router.put('/:id', authenticateToken, authorizePermission('users', 'edit'), asyncHandler(updateUser));
router.delete('/:id', authenticateToken, authorizePermission('users', 'delete'), asyncHandler(deleteUser));

// Admin: view delegation info for any user
router.get('/:id/delegation', authenticateToken, authorizePermission('users', 'view'), asyncHandler(getUserDelegation));

export default router;
