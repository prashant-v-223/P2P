import express from 'express';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizePermission } from '../../middleware/rbac.middleware.js';
import {
  getCustomAgents,
  getCustomAgentById,
  customAgentLogin,
  createCustomAgent,
  updateCustomAgent,
  customAgentChangePassword,
  deleteCustomAgent
} from './customAgents.controller.js';

const router = express.Router();

// Public route - Login
router.post('/login', customAgentLogin);

// Directory view routes - allow view with optionalAuth
router.get('/', authenticateToken, getCustomAgents);
router.get('/:id', authenticateToken, getCustomAgentById);

// Mutation routes - allow with optionalAuth
router.post('/', authenticateToken, authorizePermission('custom-agents', 'manage'), createCustomAgent);
router.put('/:id', authenticateToken, authorizePermission('custom-agents', 'manage'), updateCustomAgent);
router.post('/change-password', authenticateToken, customAgentChangePassword);
router.delete('/:id', authenticateToken, authorizePermission('custom-agents', 'manage'), deleteCustomAgent);

export default router;
