/**
 * events.router.js
 * 
 * GET /api/events/stream  — SSE endpoint for real-time approval notifications.
 * Token is passed as ?token= query param (EventSource doesn't support custom headers).
 */

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { registerClient, getClientCount } from '../../services/sse.service.js';

const router = Router();

// GET /api/events/stream
router.get('/stream', (req, res) => {
  // Decode user from token query param (EventSource can't set headers)
  let userInfo = { userId: 'anon', userName: 'Anonymous', userRole: 'guest' };
  const token = req.query.token || (req.headers.authorization?.split(' ')[1]);

  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtAccessSecret);
      userInfo = {
        userId: decoded.id || decoded._id || decoded.sub,
        userName: decoded.name || decoded.email,
        userRole: decoded.role || ''
      };
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid or expired notification token.' });
    }
  } else {
    return res.status(401).json({ success: false, error: 'Notification token is required.' });
  }

  registerClient(res, userInfo);
  // Keep the connection open — don't call res.end()
});

// GET /api/events/health
router.get('/health', (_req, res) => {
  res.json({ success: true, connectedClients: getClientCount() });
});

export default router;
