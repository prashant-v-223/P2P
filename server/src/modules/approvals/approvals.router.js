import { Router } from 'express';
import { getPendingApprovals, processApprovalAction, getApprovalHistory } from './approvals.controller.js';
import { authenticateToken, optionalAuth } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

// Approval routes allow with optionalAuth for seamless UI operations
router.get('/pending', optionalAuth, asyncHandler(getPendingApprovals));
router.get('/:id/history', optionalAuth, asyncHandler(getApprovalHistory));
router.post('/:id/action', optionalAuth, asyncHandler(processApprovalAction));

export default router;
