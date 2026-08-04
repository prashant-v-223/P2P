import crypto from 'node:crypto';
import { User } from '../../models/User.js';

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getUsers = async (req, res) => {
  const requestedPage = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const size = Math.min(100, Math.max(1, Number.parseInt(req.query.size, 10) || 10));
  const query = String(req.query.q || '').trim();
  const role = String(req.query.role || '').trim();
  const status = String(req.query.status || '').trim();
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
  const { name, email, password, role, department } = req.body;
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
  const user = await User.create({
    id: `usr-${crypto.randomUUID()}`,
    name: cleanName,
    email: normalizedEmail,
    passwordHash: await User.hashPassword(password),
    role: role || 'procurement',
    department: department || 'Procurement',
    avatar: cleanName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  });
  return res.status(201).json({ success: true, message: 'User created.', user });
};

export const updateUser = async (req, res) => {
  const allowed = ['name', 'email', 'role', 'department', 'status', 'avatar', 'parentUserId', 'delegationActive', 'delegationStartAt', 'delegationEndAt', 'delegationNote'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  if (updates.email) updates.email = updates.email.trim().toLowerCase();

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
  if (updates.delegationStartAt) updates.delegationStartAt = new Date(updates.delegationStartAt);
  if (updates.delegationEndAt) updates.delegationEndAt = new Date(updates.delegationEndAt);

  const user = await User.findOneAndUpdate({ id: req.params.id }, updates, {
    new: true,
    runValidators: true
  });
  if (!user) return res.status(404).json({ success: false, error: 'User not found.' });
  return res.json({ success: true, message: 'User updated.', user });
};

export const deleteUser = async (req, res) => {
  const user = await User.findOneAndDelete({ id: req.params.id });
  if (!user) return res.status(404).json({ success: false, error: 'User not found.' });
  // Clear any delegations pointing to this user
  await User.updateMany({ parentUserId: req.params.id }, { parentUserId: null, delegationActive: false });
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
