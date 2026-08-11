import { Router } from 'express';
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  getMe,
  logout,
  refreshTokenController,
  revokeAllSessionsController,
  updateMe,
  changePassword,
  updateTwoFactor,
  setDelegation,
  removeDelegation,
  getDelegationStatus
} from './auth.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizeRole } from '../../middleware/rbac.middleware.js';
import { rateLimiter } from '../../middleware/rateLimit.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

const loginLimiter = rateLimiter({ windowMs: 15 * 60 * 1000, max: 15, message: 'Too many login attempts. Please try again after 15 minutes.' });

// Account provisioning is an administrative action; self-registration is disabled.
router.post('/register', authenticateToken, authorizeRole(['admin', 'System Admin']), asyncHandler(register));
router.post('/login', loginLimiter, asyncHandler(login));
router.post('/refresh', asyncHandler(refreshTokenController));
router.post('/forgot-password', asyncHandler(forgotPassword));
router.post('/reset-password', asyncHandler(resetPassword));

// Protected auth routes
router.get('/me', authenticateToken, asyncHandler(getMe));
router.put('/me', authenticateToken, asyncHandler(updateMe));
router.put('/change-password', authenticateToken, asyncHandler(changePassword));
router.put('/two-factor', authenticateToken, asyncHandler(updateTwoFactor));
router.post('/logout', authenticateToken, logout);
router.post('/revoke-all-sessions', authenticateToken, revokeAllSessionsController);

// ── Delegation Routes ──────────────────────────────────────────────────────
// GET  /api/auth/delegation        — get own delegation status
// PUT  /api/auth/delegation        — set/update delegation (parentUserId, active, dates)
// DELETE /api/auth/delegation      — remove / disable delegation
router.get('/delegation', authenticateToken, asyncHandler(getDelegationStatus));
router.put('/delegation', authenticateToken, asyncHandler(setDelegation));
router.delete('/delegation', authenticateToken, asyncHandler(removeDelegation));

export default router;
