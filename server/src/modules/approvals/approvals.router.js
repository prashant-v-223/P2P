import { Router } from 'express';
import { getPendingApprovals, processApprovalAction } from './approvals.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.get('/pending', asyncHandler(getPendingApprovals));
router.post('/:id/action', authenticateToken, asyncHandler(processApprovalAction));

export default router;
