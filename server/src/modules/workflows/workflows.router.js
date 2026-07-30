import { Router } from 'express';
import {
  getWorkflows,
  createWorkflowSlab,
  updateWorkflowSlab,
  deleteWorkflowSlab
} from './workflows.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizePermission } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(getWorkflows));
router.post('/', authenticateToken, authorizePermission('workflows', 'create'), asyncHandler(createWorkflowSlab));
router.put('/:id', authenticateToken, authorizePermission('workflows', 'update'), asyncHandler(updateWorkflowSlab));
router.delete('/:id', authenticateToken, authorizePermission('workflows', 'delete'), asyncHandler(deleteWorkflowSlab));

export default router;
