import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Role } from '../../models/Role.js';
import { User } from '../../models/User.js';
import { DEFAULT_ROLES } from '../../db/seed.js';

export const getRoles = async (_req, res) => {
  if (mongoose.connection.readyState !== 1) {
    const result = DEFAULT_ROLES.map((role) => ({ ...role, usersCount: 1 }));
    return res.json({ success: true, count: result.length, roles: result });
  }

  let roles = await Role.find().sort({ roleName: 1 }).lean();

  if (!roles || roles.length === 0) {
    console.log('[DB] No roles found. Seeding default system roles...');
    await Role.insertMany(DEFAULT_ROLES);
    roles = await Role.find().sort({ roleName: 1 }).lean();
  }

  const counts = await User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]);
  const countMap = new Map(counts.map((item) => [item._id, item.count]));
  const result = roles.map((role) => ({ ...role, usersCount: countMap.get(role.roleName) || 0 }));
  return res.json({ success: true, count: result.length, roles: result });
};

export const updateRolePermissions = async (req, res) => {
  const { permissions } = req.body;
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
    return res.status(400).json({ success: false, error: 'A permissions object is required.' });
  }
  const role = await Role.findOneAndUpdate(
    { $or: [{ id: req.params.id }, { roleName: req.params.id }] },
    { permissions },
    { new: true, runValidators: true }
  );
  if (!role) return res.status(404).json({ success: false, error: 'Role not found.' });
  return res.json({ success: true, message: 'Role permissions updated.', role });
};

export const createRole = async (req, res) => {
  const roleName = req.body.roleName?.trim();
  if (!roleName) return res.status(400).json({ success: false, error: 'Role name is required.' });
  if (mongoose.connection.readyState !== 1) {
    const dummyRole = { id: `role-${crypto.randomUUID()}`, roleName, description: req.body.description || '', type: 'Custom', status: req.body.status || 'Active', permissions: req.body.permissions || {}, usersCount: 0 };
    return res.status(201).json({ success: true, message: 'Role created.', role: dummyRole });
  }
  if (await Role.exists({ roleName: { $regex: `^${roleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } })) {
    return res.status(409).json({ success: false, error: 'A role with this name already exists.' });
  }
  const role = await Role.create({
    id: `role-${crypto.randomUUID()}`,
    roleName,
    description: req.body.description || '',
    type: 'Custom',
    status: req.body.status || 'Active',
    permissions: req.body.permissions || {}
  });
  return res.status(201).json({ success: true, message: 'Role created.', role: { ...role.toObject(), usersCount: 0 } });
};

export const updateRole = async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.json({ success: true, message: 'Role updated.', role: { id: req.params.id, ...req.body } });
  }
  const role = await Role.findOne({ id: req.params.id });
  if (!role) return res.status(404).json({ success: false, error: 'Role not found.' });
  const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => ['roleName', 'description', 'status'].includes(key)));
  if (updates.roleName) updates.roleName = updates.roleName.trim();
  Object.assign(role, updates);
  await role.save();
  return res.json({ success: true, message: 'Role updated.', role });
};

export const deleteRole = async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.json({ success: true, message: 'Role deleted.', id: req.params.id });
  }
  const role = await Role.findOne({ id: req.params.id });
  if (!role) return res.status(404).json({ success: false, error: 'Role not found.' });
  if (role.type === 'System' || role.roleName === 'System Admin') {
    return res.status(400).json({ success: false, error: 'System roles cannot be deleted.' });
  }
  const usersCount = await User.countDocuments({ role: role.roleName });
  if (usersCount) return res.status(409).json({ success: false, error: `Reassign ${usersCount} user(s) before deleting this role.` });
  await role.deleteOne();
  return res.json({ success: true, message: 'Role deleted.', id: req.params.id });
};
