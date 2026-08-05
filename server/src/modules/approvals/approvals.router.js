import { Router } from 'express';
import { getPendingApprovals, processApprovalAction, getApprovalHistory, getApprovalById } from './approvals.controller.js';
import { authenticateToken, optionalAuth } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.get('/pending', authenticateToken, asyncHandler(getPendingApprovals));
router.get('/:id/history', authenticateToken, asyncHandler(getApprovalHistory));
router.get('/:id', optionalAuth, asyncHandler(getApprovalById));
router.post('/:id/action', authenticateToken, asyncHandler(processApprovalAction));

export default router;
