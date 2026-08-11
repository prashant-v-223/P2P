import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { User } from '../models/User.js';

const findActiveTokenUser = async (tokenUser) => {
  if (mongoose.connection.readyState !== 1) return tokenUser;
  const identity = { id: tokenUser.id, status: 'Active' };
  if (tokenUser.email) identity.email = String(tokenUser.email).toLowerCase();
  return User.findOne(identity, { id: 1, name: 1, email: 1, role: 1, avatar: 1 }).lean();
};

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required. No token provided.' 
    });
  }

  jwt.verify(token, config.jwtAccessSecret, async (err, user) => {
    if (err) {
      return res.status(401).json({
        success: false, 
        error: 'Invalid or expired token. Please login again.' 
      });
    }
    try {
      const activeUser = await findActiveTokenUser(user);
      if (!activeUser) {
        return res.status(401).json({ success: false, error: 'This login account no longer exists or is inactive. Please login again.' });
      }
      req.user = { ...user, ...activeUser };
      next();
    } catch (dbError) {
      return res.status(503).json({ success: false, error: 'Unable to validate the login account.' });
    }
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

  jwt.verify(token, config.jwtAccessSecret, async (err, user) => {
    if (err) {
      req.user = null;
      return next();
    }
    try {
      const activeUser = await findActiveTokenUser(user);
      req.user = activeUser ? { ...user, ...activeUser } : null;
      next();
    } catch (_) {
      req.user = null;
      next();
    }
  });
};
