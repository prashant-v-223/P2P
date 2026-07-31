import { Router } from 'express';
import { getPendingApprovals, processApprovalAction, getApprovalHistory } from './approvals.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

// All approval routes require authentication
router.get('/pending', authenticateToken, asyncHandler(getPendingApprovals));
router.get('/:id/history', authenticateToken, asyncHandler(getApprovalHistory));
router.post('/:id/action', authenticateToken, asyncHandler(processApprovalAction));

export default router;
