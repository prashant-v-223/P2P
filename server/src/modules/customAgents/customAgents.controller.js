import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { config } from '../../config/index.js';
import { CustomAgent } from '../../models/CustomAgent.js';
import { RfqBlEntry } from '../../models/RfqLogistics.js';

const buildAgentQuery = (id) => {
  if (!id) return { agentId: 'none' };
  const filter = [{ agentId: id }];
  if (mongoose.Types.ObjectId.isValid(id)) {
    filter.push({ _id: id });
  }
  return { $or: filter };
};

// Seed default custom agents with hashed passwords
export const seedDefaultCustomAgents = async () => {
  try {
    const count = await CustomAgent.countDocuments();
    if (count > 0) return;

    const defaultPassword = await CustomAgent.hashPassword('Agent@2026');

    await CustomAgent.insertMany([
      {
        agentId: 'CHA-001',
        agencyName: 'Fast Forward Logistics India',
        licenceNumber: 'FFLIL-2024-001',
        portLocation: 'NHAVA SHEVA, MUNDRA',
        contactPerson: 'Magnesh Phapale',
        phone: '+91 98765 43210',
        email: 'magnesh@fflindia.com',
        address: 'Mumbai, Maharashtra',
        passwordHash: defaultPassword,
        status: 'Active',
        portalAccessEnabled: true
      },
      {
        agentId: 'CHA-002',
        agencyName: 'Aquair International Freight Forwarders',
        licenceNumber: 'AIFF-2023-045',
        portLocation: 'NHAVA SHEVA, MUMBAI PORT',
        contactPerson: 'Customs Manager',
        phone: '+91 22 2345 6789',
        email: 'customs@aquairintl.com',
        address: 'Navi Mumbai, Maharashtra',
        passwordHash: defaultPassword,
        status: 'Active',
        portalAccessEnabled: true
      },
      {
        agentId: 'CHA-003',
        agencyName: 'Babaji Shivram Clearing & Carriers',
        licenceNumber: 'BSCC-2022-089',
        portLocation: 'MUNDRA, KANDLA',
        contactPerson: 'Clearing Manager',
        phone: '+91 99 8877 6655',
        email: 'clearing@babajishivram.in',
        address: 'Gandhidham, Gujarat',
        passwordHash: defaultPassword,
        status: 'Active',
        portalAccessEnabled: true
      }
    ]);

    console.log('[CUSTOM AGENT SEED SUCCESS] Initialized default CHA accounts in MongoDB.');
  } catch (err) {
    console.warn('[CUSTOM AGENT SEED WARN]', err.message);
  }
};

// GET all custom agents
export const getCustomAgents = async (req, res) => {
  try {
    const agents = await CustomAgent.find().sort({ createdAt: -1 }).lean();
    return res.json({ success: true, count: agents.length, agents });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// GET single custom agent by ID
export const getCustomAgentById = async (req, res) => {
  try {
    const { id } = req.params;
    const agent = await CustomAgent.findOne(buildAgentQuery(id)).lean();

    if (!agent) {
      return res.status(404).json({ success: false, error: 'Custom agent not found.' });
    }

    // Fetch assigned BLs
    const assignedBls = await RfqBlEntry.find({
      customAgentId: agent.agentId
    }).sort({ createdAt: -1 }).lean();

    return res.json({
      success: true,
      agent: {
        ...agent,
        assignedBls
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// POST - Custom Agent Login
export const customAgentLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required.' 
      });
    }

    const agent = await CustomAgent.findOne({ 
      email: email.trim().toLowerCase() 
    }).select('+passwordHash');

    if (!agent) {
      return res.status(401).json({ 
        success: false, 
        error: 'Custom agent account not found. Please check your email.' 
      });
    }

    if (!agent.portalAccessEnabled || agent.status === 'Inactive') {
      return res.status(403).json({ 
        success: false, 
        error: 'Portal access has been disabled for this agent account.' 
      });
    }

    // Verify password
    const isPasswordValid = await agent.verifyPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid password. Please try again.' 
      });
    }

    // Generate JWT
    const payload = {
      id: agent.agentId,
      agencyName: agent.agencyName,
      email: agent.email,
      role: 'CustomAgent'
    };

    const token = jwt.sign(payload, config.jwtAccessSecret, { expiresIn: '7d' });

    // Get assigned BLs count
    const assignedCount = await RfqBlEntry.countDocuments({ customAgentId: agent.agentId });
    const clearedCount = await RfqBlEntry.countDocuments({ 
      customAgentId: agent.agentId, 
      status: 'custom_cleared' 
    });

    return res.json({
      success: true,
      message: 'Custom agent login successful',
      token,
      agent: {
        agentId: agent.agentId,
        agencyName: agent.agencyName,
        contactPerson: agent.contactPerson,
        email: agent.email,
        phone: agent.phone,
        portLocation: agent.portLocation,
        licenceNumber: agent.licenceNumber,
        status: agent.status,
        assignedBlCount: assignedCount,
        clearedBlCount: clearedCount,
        isLoggedIn: true
      }
    });
  } catch (err) {
    console.error('[CUSTOM AGENT LOGIN ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// POST - Create new custom agent
export const createCustomAgent = async (req, res) => {
  try {
    const { 
      agencyName, companyName, licenceNumber, chaLicense, portLocation, 
      contactPerson, fullName, phone, email, password, address,
      iecCode, paymentTerms, status, portalAccessEnabled
    } = req.body;

    const finalAgencyName = agencyName || companyName;
    const finalContactPerson = contactPerson || fullName || finalAgencyName;
    const finalLicence = licenceNumber || chaLicense || 'CHA-PENDING';
    const finalStatus = status ? (status.includes('Inactive') ? 'Inactive' : 'Active') : 'Active';

    if (!email || (!password && !req.body.isEdit)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required.' 
      });
    }

    // Check if email already exists
    const existing = await CustomAgent.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(409).json({ 
        success: false, 
        error: 'An agent with this email already exists.' 
      });
    }

    const agentId = `CHA-${Date.now().toString().slice(-6)}`;
    const passwordHash = await CustomAgent.hashPassword(password || 'Agent@2026');

    const newAgent = await CustomAgent.create({
      agentId,
      agencyName: finalAgencyName || finalContactPerson || 'Clearing Agent',
      licenceNumber: finalLicence,
      iecCode: iecCode || '',
      paymentTerms: paymentTerms || '30',
      portLocation: portLocation || 'NHAVA SHEVA',
      contactPerson: finalContactPerson,
      phone: phone || '+91 9800000000',
      email: email.trim().toLowerCase(),
      address: address || '',
      passwordHash,
      status: finalStatus,
      portalAccessEnabled: portalAccessEnabled !== undefined ? portalAccessEnabled : (finalStatus === 'Active'),
      assignedBlCount: 0,
      clearedBlCount: 0
    });

    return res.status(201).json({
      success: true,
      message: 'Custom agent created successfully',
      agent: newAgent
    });
  } catch (err) {
    console.error('Error creating custom agent:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// PUT - Update custom agent
export const updateCustomAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    delete updates.agentId;

    // Handle password update if password string is provided
    if (updates.password && updates.password.trim().length >= 6) {
      updates.passwordHash = await CustomAgent.hashPassword(updates.password.trim());
      delete updates.password;
    } else {
      delete updates.password;
      delete updates.passwordHash;
    }

    const agent = await CustomAgent.findOneAndUpdate(
      buildAgentQuery(id),
      updates,
      { new: true }
    );

    if (!agent) {
      return res.status(404).json({ success: false, error: 'Custom agent not found.' });
    }

    return res.json({
      success: true,
      message: 'Custom agent updated successfully',
      agent
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// POST - Enable or disable customs-agent portal login
export const updateCustomAgentPortalAccess = async (req, res) => {
  try {
    const { id } = req.params;
    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'The enabled field must be true or false.' });
    }

    const agent = await CustomAgent.findOneAndUpdate(
      buildAgentQuery(id),
      { $set: { portalAccessEnabled: enabled } },
      { new: true, runValidators: true }
    );
    if (!agent) return res.status(404).json({ success: false, error: 'Custom agent not found.' });

    return res.json({
      success: true,
      message: `Portal access ${enabled ? 'enabled' : 'disabled'} successfully.`,
      agent
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// POST - Generate a one-time temporary password for an agent
export const generateCustomAgentPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const temporaryPassword = `RyznCHA@${crypto.randomInt(100000, 1000000)}`;
    const passwordHash = await CustomAgent.hashPassword(temporaryPassword);
    const agent = await CustomAgent.findOneAndUpdate(
      buildAgentQuery(id),
      { $set: { passwordHash } },
      { new: true, runValidators: true }
    ).select('+passwordHash');

    if (!agent) return res.status(404).json({ success: false, error: 'Custom agent not found. Password was not changed.' });
    if (!await agent.verifyPassword(temporaryPassword)) {
      return res.status(500).json({ success: false, error: 'Password could not be saved. Please try again.' });
    }

    return res.json({
      success: true,
      message: 'Temporary password generated. It will only be displayed once.',
      temporaryPassword,
      agent: { agentId: agent.agentId, email: agent.email }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// POST - Change password
export const customAgentChangePassword = async (req, res) => {
  try {
    const { agentId, email, currentPassword, newPassword } = req.body;
    const identifier = agentId || email || req.user?.id;

    if (!identifier || !currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Current password and new password are required.' 
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ 
        success: false, 
        error: 'New password must be at least 8 characters long.' 
      });
    }

    const agent = await CustomAgent.findOne({
      $or: [
        { agentId: identifier },
        { email: identifier }
      ]
    }).select('+passwordHash');

    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent account not found.' });
    }

    // Verify current password
    const isPasswordValid = await agent.verifyPassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
    }

    // Hash and save new password
    agent.passwordHash = await CustomAgent.hashPassword(newPassword);
    await agent.save();

    return res.json({
      success: true,
      message: 'Password updated successfully.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE - Delete custom agent
export const deleteCustomAgent = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deleted = await CustomAgent.findOneAndDelete(buildAgentQuery(id));

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Custom agent record not found.' });
    }

    return res.json({
      success: true,
      message: 'Custom agent deleted successfully'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
