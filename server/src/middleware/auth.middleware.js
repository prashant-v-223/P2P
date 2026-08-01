import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required. No token provided.' 
    });
  }

  jwt.verify(token, config.jwtAccessSecret, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        error: 'Invalid or expired token. Please login again.' 
      });
    }
    req.user = user;
    next();
  });
};

// Optional middleware for routes that work with or without auth
export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, config.jwtAccessSecret, (err, user) => {
    req.user = err ? null : user;
    next();
  });
};
