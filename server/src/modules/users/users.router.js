import { Router } from 'express';
import { getUsers, createUser, updateUser, deleteUser } from './users.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizePermission } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.use(authenticateToken);

router.get('/', authorizePermission('users', 'read'), asyncHandler(getUsers));
router.post('/', authorizePermission('users', 'create'), asyncHandler(createUser));
router.put('/:id', authorizePermission('users', 'update'), asyncHandler(updateUser));
router.delete('/:id', authorizePermission('users', 'delete'), asyncHandler(deleteUser));

export default router;
