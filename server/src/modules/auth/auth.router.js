import { Router } from 'express';
import { 
  register, 
  login, 
  forgotPassword, 
  resetPassword, 
  getMe, 
  logout, 
  refreshTokenController, 
  revokeAllSessionsController 
} from './auth.controller.js';
import { updateMe, changePassword } from './auth.controller.js';
import { updateTwoFactor } from './auth.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.post('/refresh', asyncHandler(refreshTokenController));
router.post('/forgot-password', asyncHandler(forgotPassword));
router.post('/reset-password', asyncHandler(resetPassword));
router.get('/me', authenticateToken, asyncHandler(getMe));
router.put('/me', authenticateToken, asyncHandler(updateMe));
router.put('/change-password', authenticateToken, asyncHandler(changePassword));
router.put('/two-factor', authenticateToken, asyncHandler(updateTwoFactor));
router.post('/logout', authenticateToken, logout);
router.post('/revoke-all-sessions', authenticateToken, revokeAllSessionsController);

export default router;
