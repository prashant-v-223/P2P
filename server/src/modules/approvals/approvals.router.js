import { Router } from 'express';
import { getPendingApprovals, processApprovalAction, getApprovalHistory, getApprovalById } from './approvals.controller.js';
import { getHierarchyPendingApprovals, getHierarchyTeamStats, getReportingChain } from './approvals.hierarchy.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizePermission } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.get('/pending', authenticateToken, asyncHandler(getPendingApprovals));
router.get('/hierarchy/pending', authenticateToken, asyncHandler(getHierarchyPendingApprovals));
router.get('/hierarchy/team-stats', authenticateToken, asyncHandler(getHierarchyTeamStats));
router.get('/hierarchy/reporting-chain', authenticateToken, asyncHandler(getReportingChain));
router.get('/:id/history', authenticateToken, asyncHandler(getApprovalHistory));
router.get('/:id', authenticateToken, asyncHandler(getApprovalById));
router.post('/:id/action', authenticateToken, authorizePermission('approvals', 'action'), asyncHandler(processApprovalAction));

export default router;
