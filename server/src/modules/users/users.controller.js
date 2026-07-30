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

  return res.json({
    success: true,
    users,
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
    role: role || 'Procurement Head',
    department: department || 'Procurement',
    avatar: cleanName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  });
  return res.status(201).json({ success: true, message: 'User created.', user });
};

export const updateUser = async (req, res) => {
  const allowed = ['name', 'email', 'role', 'department', 'status', 'avatar'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  if (updates.email) updates.email = updates.email.trim().toLowerCase();
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
  return res.json({ success: true, message: 'User deleted.', id: req.params.id });
};
