import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { User } from '../models/User.js';
import { Vendor } from '../models/Vendor.js';
import { CustomAgent } from '../models/CustomAgent.js';

const findActiveTokenUser = async (tokenUser) => {
  if (!tokenUser) return null;
  if (mongoose.connection.readyState !== 1) return tokenUser;

  const roleClean = String(tokenUser.role || '').toLowerCase();

  // 1. Vendor account validation
  if (roleClean === 'vendor') {
    const vendorOrs = [];
    if (tokenUser.id) {
      vendorOrs.push({ id: tokenUser.id });
      if (mongoose.Types.ObjectId.isValid(tokenUser.id)) {
        vendorOrs.push({ _id: tokenUser.id });
      }
    }
    if (tokenUser.sapVendorCode) {
      vendorOrs.push({ sapVendorCode: tokenUser.sapVendorCode });
      vendorOrs.push({ supplierId: tokenUser.sapVendorCode });
    }
    if (tokenUser.email) {
      vendorOrs.push({ email: String(tokenUser.email).toLowerCase() });
    }

    if (vendorOrs.length > 0) {
      const vendor = await Vendor.findOne({ $or: vendorOrs }).lean();
      if (vendor && vendor.status !== 'Inactive' && vendor.portalAccessEnabled !== false) {
        return {
          id: vendor.id || vendor.sapVendorCode || (vendor._id ? String(vendor._id) : tokenUser.id),
          sapVendorCode: vendor.sapVendorCode || vendor.supplierId || tokenUser.sapVendorCode,
          supplierId: vendor.supplierId || vendor.sapVendorCode || tokenUser.sapVendorCode,
          companyName: vendor.companyName || tokenUser.companyName,
          email: vendor.email || tokenUser.email,
          role: 'Vendor',
          vendorType: vendor.vendorType,
          category: vendor.category,
          status: vendor.status || 'Active',
          portalAccessEnabled: vendor.portalAccessEnabled !== false
        };
      }
    }
  }

  // 2. CustomAgent account validation
  if (roleClean === 'customagent') {
    const agentOrs = [];
    if (tokenUser.id) {
      agentOrs.push({ agentId: tokenUser.id });
      agentOrs.push({ id: tokenUser.id });
      if (mongoose.Types.ObjectId.isValid(tokenUser.id)) {
        agentOrs.push({ _id: tokenUser.id });
      }
    }
    if (tokenUser.email) {
      agentOrs.push({ email: String(tokenUser.email).toLowerCase() });
    }

    if (agentOrs.length > 0) {
      const agent = await CustomAgent.findOne({ $or: agentOrs }).lean();
      if (agent && agent.status !== 'Inactive' && agent.portalAccessEnabled !== false) {
        return {
          id: agent.agentId || agent.id || (agent._id ? String(agent._id) : tokenUser.id),
          agentId: agent.agentId || tokenUser.id,
          agencyName: agent.agencyName || tokenUser.agencyName,
          email: agent.email || tokenUser.email,
          role: 'CustomAgent',
          status: agent.status || 'Active',
          portalAccessEnabled: agent.portalAccessEnabled !== false
        };
      }
    }
  }

  // 3. User model validation (internal users)
  const identity = { status: 'Active' };
  const userOrs = [];
  if (tokenUser.id) {
    userOrs.push({ id: tokenUser.id });
    if (mongoose.Types.ObjectId.isValid(tokenUser.id)) {
      userOrs.push({ _id: tokenUser.id });
    }
  }
  if (tokenUser.email) {
    userOrs.push({ email: String(tokenUser.email).toLowerCase() });
  }

  if (userOrs.length > 0) {
    identity.$or = userOrs;
    const activeUser = await User.findOne(identity, { id: 1, name: 1, email: 1, role: 1, avatar: 1, status: 1 }).lean();
    if (activeUser) return activeUser;
  }

  // 4. Fallback for Vendor or CustomAgent if role wasn't explicitly set in token
  if (roleClean !== 'vendor' && userOrs.length > 0) {
    const vendor = await Vendor.findOne({ $or: userOrs }).lean();
    if (vendor && vendor.status !== 'Inactive' && vendor.portalAccessEnabled !== false) {
      return {
        id: vendor.id || vendor.sapVendorCode || (vendor._id ? String(vendor._id) : tokenUser.id),
        sapVendorCode: vendor.sapVendorCode || vendor.supplierId,
        supplierId: vendor.supplierId || vendor.sapVendorCode,
        companyName: vendor.companyName,
        email: vendor.email,
        role: 'Vendor',
        vendorType: vendor.vendorType,
        category: vendor.category,
        status: vendor.status || 'Active',
        portalAccessEnabled: vendor.portalAccessEnabled !== false
      };
    }
  }

  if (roleClean !== 'customagent' && userOrs.length > 0) {
    const agent = await CustomAgent.findOne({ $or: userOrs }).lean();
    if (agent && agent.status !== 'Inactive' && agent.portalAccessEnabled !== false) {
      return {
        id: agent.agentId || agent.id,
        agentId: agent.agentId,
        agencyName: agent.agencyName,
        email: agent.email,
        role: 'CustomAgent',
        status: agent.status || 'Active',
        portalAccessEnabled: agent.portalAccessEnabled !== false
      };
    }
  }

  return null;
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
