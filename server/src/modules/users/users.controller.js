import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { User } from '../../models/User.js';

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const hierarchyFor = ({ role, manager }) => {
  const normalizedRole = String(role || '').toLowerCase().replace(/[-\s]+/g, '_');
  if (['admin', 'superadmin', 'md'].includes(normalizedRole)) {
    return { managerId: null, managerName: null, hierarchyLevel: 0, canSeeAllRequests: true, team: null };
  }
  if (normalizedRole === 'finance') {
    return { managerId: null, managerName: null, hierarchyLevel: 1, canSeeAllRequests: true, team: null };
  }
  if (!manager) {
    return { managerId: null, managerName: null, hierarchyLevel: 3, canSeeAllRequests: false, team: null };
  }
  const isDirectMdReport = manager.hierarchyLevel === 0;
  const managerTeam = normalizedRole === 'procurement_head' ? 'East' : normalizedRole === 'exim_manager' ? 'West' : manager.team || null;
  return {
    managerId: manager.id,
    managerName: manager.name,
    hierarchyLevel: isDirectMdReport ? 2 : Math.min((manager.hierarchyLevel || 2) + 1, 10),
    canSeeAllRequests: false,
    team: isDirectMdReport ? managerTeam : manager.team || null
  };
};

const hasManagerCycle = async (userId, managerId) => {
  const visited = new Set([userId]);
  let currentManagerId = managerId;

  while (currentManagerId) {
    if (visited.has(currentManagerId)) return true;
    visited.add(currentManagerId);
    const manager = await User.findOne({ id: currentManagerId }, { managerId: 1 }).lean();
    if (!manager) return false;
    currentManagerId = manager.managerId;
  }

  return false;
};

const refreshReportingHierarchy = async (managerId) => {
  const reports = await User.find({ managerId }, { id: 1, role: 1 }).lean();
  for (const report of reports) {
    const manager = await User.findOne({ id: managerId }, { id: 1, name: 1, hierarchyLevel: 1, team: 1 }).lean();
    if (!manager) continue;
    const hierarchy = hierarchyFor({ role: report.role, manager });
    await User.updateOne({ id: report.id }, hierarchy);
    await refreshReportingHierarchy(report.id);
  }
};

export const getUsers = async (req, res) => {
  const requestedPage = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const size = Math.min(100, Math.max(1, Number.parseInt(req.query.size, 10) || 10));
  const query = String(req.query.q || '').trim();
  const role = String(req.query.role || '').trim();
  const status = String(req.query.status || '').trim();

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, error: 'User directory is unavailable because the database is disconnected.' });
  }
  const filter = {};

  if (role && role !== 'All') filter.role = role;
  if (status && status !== 'All') filter.status = status;
  if (query) {
    const matcher = new RegExp(escapeRegex(query), 'i');
    filter.$or = [
      { name: matcher },
      { email: matcher },
      { role: matcher },
      { department: matcher }
    ];
  }

  const sortOptions = {
    name: { name: 1 },
    oldest: { createdAt: 1 },
    newest: { createdAt: -1 }
  };
  const [total, activeUsers, inactiveUsers] = await Promise.all([
    User.countDocuments(filter),
    User.countDocuments({ status: 'Active' }),
    User.countDocuments({ status: { $ne: 'Active' } })
  ]);
  const totalPages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(requestedPage, totalPages);
  const users = await User.find(filter)
    .sort(sortOptions[req.query.sort] || sortOptions.newest)
    .skip((page - 1) * size)
    .limit(size)
    .lean();

  // Populate parent user names for display
  const parentIds = [...new Set(users.map((u) => u.parentUserId).filter(Boolean))];
  let parentMap = {};
  if (parentIds.length) {
    const parents = await User.find({ id: { $in: parentIds } }, { id: 1, name: 1, avatar: 1, role: 1 }).lean();
    parentMap = Object.fromEntries(parents.map((p) => [p.id, p]));
  }
  const enriched = users.map((u) => ({
    ...u,
    parentUser: u.parentUserId ? (parentMap[u.parentUserId] || null) : null
  }));

  return res.json({
    success: true,
    users: enriched,
    total,
    page,
    size,
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
    stats: { activeUsers, inactiveUsers, totalUsers: activeUsers + inactiveUsers }
  });
};

export const createUser = async (req, res) => {
  const { name, email, password, role, department, managerId } = req.body;
  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, error: 'Password must contain at least 8 characters.' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (await User.exists({ email: normalizedEmail })) {
    return res.status(409).json({ success: false, error: 'A user with this email already exists.' });
  }
  const cleanName = name.trim();
  const manager = managerId ? await User.findOne({ id: managerId, status: 'Active' }, { id: 1, name: 1, hierarchyLevel: 1, team: 1 }) : null;
  if (managerId && !manager) return res.status(404).json({ success: false, error: 'Selected manager was not found or is inactive.' });
  const user = await User.create({
    id: `usr-${crypto.randomUUID()}`,
    name: cleanName,
    email: normalizedEmail,
    passwordHash: await User.hashPassword(password),
    role: role || 'procurement',
    department: department || 'Procurement',
    avatar: cleanName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
    ...hierarchyFor({ role, manager })
  });
  return res.status(201).json({ success: true, message: 'User created.', user });
};

export const updateUser = async (req, res) => {
  const allowed = ['name', 'email', 'role', 'department', 'status', 'avatar', 'password', 'parentUserId', 'delegationActive', 'delegationStartAt', 'delegationEndAt', 'delegationNote', 'managerId'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  if (updates.email) updates.email = updates.email.trim().toLowerCase();
  if (updates.password) {
    if (updates.password.length < 8) return res.status(400).json({ success: false, error: 'Password must contain at least 8 characters.' });
    updates.passwordHash = await User.hashPassword(updates.password);
    delete updates.password;
  }

  // Validate parentUserId
  if (updates.parentUserId) {
    if (updates.parentUserId === req.params.id) {
      return res.status(400).json({ success: false, error: 'A user cannot delegate to themselves.' });
    }
    const parentExists = await User.exists({ id: updates.parentUserId, status: 'Active' });
    if (!parentExists) {
      return res.status(404).json({ success: false, error: 'Parent/delegate user not found or not active.' });
    }
  }
  if (updates.parentUserId === null || updates.parentUserId === '') {
    updates.parentUserId = null;
    updates.delegationActive = false;
  }
  const existingUser = await User.findOne({ id: req.params.id }, { id: 1, role: 1, managerId: 1 }).lean();
  if (!existingUser) return res.status(404).json({ success: false, error: 'User not found.' });

  if (updates.status === 'Inactive' && req.user?.id === req.params.id) {
    return res.status(400).json({ success: false, error: 'You cannot deactivate your own account.' });
  }
  if (updates.status === 'Inactive') {
    const activeReportCount = await User.countDocuments({ managerId: req.params.id, status: 'Active' });
    if (activeReportCount) {
      return res.status(409).json({ success: false, error: 'Reassign or deactivate this user\'s active reports before deactivating the account.' });
    }
  }

  if (Object.hasOwn(updates, 'managerId')) {
    if (updates.managerId === req.params.id) {
      return res.status(400).json({ success: false, error: 'A user cannot report to themselves.' });
    }
    if (updates.managerId) {
      const manager = await User.findOne({ id: updates.managerId, status: 'Active' }, { id: 1, name: 1, managerId: 1, hierarchyLevel: 1, team: 1 }).lean();
      if (!manager) return res.status(404).json({ success: false, error: 'Selected manager was not found or is inactive.' });
      if (await hasManagerCycle(req.params.id, manager.id)) {
        return res.status(400).json({ success: false, error: 'This change would create a reporting cycle.' });
      }
      Object.assign(updates, hierarchyFor({ role: updates.role || existingUser.role, manager }));
    } else {
      Object.assign(updates, hierarchyFor({ role: updates.role || existingUser.role, manager: null }));
    }
  }
  if (Object.hasOwn(updates, 'role') && !Object.hasOwn(updates, 'managerId')) {
    const manager = existingUser?.managerId ? await User.findOne({ id: existingUser.managerId, status: 'Active' }, { id: 1, name: 1, hierarchyLevel: 1, team: 1 }).lean() : null;
    Object.assign(updates, hierarchyFor({ role: updates.role, manager }));
  }
  if (updates.delegationStartAt) updates.delegationStartAt = new Date(updates.delegationStartAt);
  if (updates.delegationEndAt) updates.delegationEndAt = new Date(updates.delegationEndAt);

  const user = await User.findOneAndUpdate({ id: req.params.id }, updates, {
    new: true,
    runValidators: true
  });
  if (!user) return res.status(404).json({ success: false, error: 'User not found.' });
  if (Object.hasOwn(updates, 'managerId') || Object.hasOwn(updates, 'role')) {
    await refreshReportingHierarchy(user.id);
  }
  return res.json({ success: true, message: 'User updated.', user });
};

export const getUserHierarchy = async (_req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, error: 'Organisation hierarchy is unavailable because the database is disconnected.' });
  }
  const users = await User.find({}, { passwordHash: 0 }).sort({ hierarchyLevel: 1, name: 1 }).lean();
  const byManager = new Map();
  for (const user of users) {
    const key = user.managerId || 'root';
    byManager.set(key, [...(byManager.get(key) || []), user]);
  }
  const buildTree = (managerId, seen = new Set()) => (byManager.get(managerId) || []).map((user) => {
    if (seen.has(user.id)) return { ...user, reports: [] };
    const branchSeen = new Set(seen);
    branchSeen.add(user.id);
    return { ...user, reports: buildTree(user.id, branchSeen) };
  });
  return res.json({ success: true, users, tree: buildTree('root') });
};

export const deleteUser = async (req, res) => {
  const directReports = await User.find({ managerId: req.params.id }, { id: 1, role: 1 }).lean();
  const user = await User.findOneAndDelete({ id: req.params.id });
  if (!user) return res.status(404).json({ success: false, error: 'User not found.' });
  // Clear any delegations pointing to this user
  await User.updateMany({ parentUserId: req.params.id }, { parentUserId: null, delegationActive: false });
  for (const report of directReports) {
    await User.updateOne(
      { id: report.id },
      hierarchyFor({ role: report.role, manager: null })
    );
    await refreshReportingHierarchy(report.id);
  }
  return res.json({ success: true, message: 'User deleted.', id: req.params.id });
};

// Admin: get delegation info for a specific user
export const getUserDelegation = async (req, res) => {
  const user = await User.findOne({ id: req.params.id }).lean();
  if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

  let parentUser = null;
  if (user.parentUserId) {
    parentUser = await User.findOne({ id: user.parentUserId }, { id: 1, name: 1, email: 1, role: 1, avatar: 1 }).lean();
  }
  const delegatingTo = await User.find({ parentUserId: req.params.id }, { id: 1, name: 1, email: 1, role: 1, avatar: 1, delegationActive: 1, delegationNote: 1 }).lean();

  return res.json({
    success: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    delegation: { parentUserId: user.parentUserId, parentUser, delegationActive: user.delegationActive, delegationStartAt: user.delegationStartAt, delegationEndAt: user.delegationEndAt, delegationNote: user.delegationNote },
    delegatingTo
  });
};
