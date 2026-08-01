import express from 'express';
import { authenticateToken, optionalAuth } from '../../middleware/auth.middleware.js';
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
router.get('/', optionalAuth, getCustomAgents);
router.get('/:id', optionalAuth, getCustomAgentById);

// Mutation routes - allow with optionalAuth
router.post('/', optionalAuth, createCustomAgent);
router.put('/:id', optionalAuth, updateCustomAgent);
router.post('/change-password', optionalAuth, customAgentChangePassword);
router.delete('/:id', optionalAuth, deleteCustomAgent);

export default router;
