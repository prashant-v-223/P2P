import { Router } from 'express';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizeRole } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getSapOverview, getSapSyncHistory, runSapSync } from './sap.controller.js';

const router = Router();
router.use(authenticateToken);
router.get('/overview', asyncHandler(getSapOverview));
router.get('/history', asyncHandler(getSapSyncHistory));
router.post('/sync/:entity', authorizeRole(['admin', 'System Admin']), asyncHandler(runSapSync));

export default router;
