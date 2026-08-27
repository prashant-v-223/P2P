import { Router } from 'express';
import { getDepartments, createDepartment, deleteDepartment } from './departments.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizeRole } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(getDepartments));
router.post('/', authenticateToken, authorizeRole(['admin', 'System Admin']), asyncHandler(createDepartment));
router.delete('/:id', authenticateToken, authorizeRole(['admin', 'System Admin']), asyncHandler(deleteDepartment));

export default router;
