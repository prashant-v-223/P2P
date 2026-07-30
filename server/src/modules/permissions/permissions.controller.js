import crypto from 'node:crypto';
import { Permission } from '../../models/Permission.js';
import { Role } from '../../models/Role.js';
import { DEFAULT_PERMISSIONS } from '../../db/seed.js';

const normalize = (value = '') => value.trim().toLowerCase();
const splitKey = (key) => {
  const [moduleKey, action] = normalize(key).split('.');
  return { moduleKey, action };
};

const withRoleCounts = async (permissions) => {
  const roles = await Role.find({}, { permissions: 1 }).lean();
  return permissions.map((permission) => {
    const { moduleKey, action } = splitKey(permission.key);
    const rolesCount = roles.filter((role) => role.permissions?.[moduleKey]?.includes(action)).length;
    return { ...permission, rolesCount };
  });
};

export const getPermissions = async (_req, res) => {
  let permissions = await Permission.find().sort({ module: 1, action: 1 }).lean();
  
  if (!permissions || permissions.length === 0) {
    console.log('[DB] No permissions found. Seeding default permissions...');
    await Permission.insertMany(DEFAULT_PERMISSIONS);
    permissions = await Permission.find().sort({ module: 1, action: 1 }).lean();
  }

  return res.json({ success: true, count: permissions.length, permissions: await withRoleCounts(permissions) });
};

export const createPermission = async (req, res) => {
  const key = normalize(req.body.key);
  const name = req.body.name?.trim();
  const moduleName = req.body.module?.trim();
  const { action } = splitKey(key);
  if (!key || !name || !moduleName || !action) {
    return res.status(400).json({ success: false, error: 'Permission key, name, and module are required.' });
  }
  if (await Permission.exists({ key })) return res.status(409).json({ success: false, error: 'Permission key already exists.' });
  const permission = await Permission.create({
    id: `perm-${crypto.randomUUID()}`,
    key,
    name,
    module: moduleName,
    action,
    description: req.body.description || '',
    type: 'Custom',
    status: req.body.status || 'Active'
  });
  return res.status(201).json({ success: true, message: 'Permission created.', permission: { ...permission.toObject(), rolesCount: 0 } });
};

export const updatePermission = async (req, res) => {
  const permission = await Permission.findOne({ id: req.params.id });
  if (!permission) return res.status(404).json({ success: false, error: 'Permission not found.' });
  const oldKey = permission.key;
  const nextKey = req.body.key ? normalize(req.body.key) : oldKey;
  const { moduleKey: oldModule, action: oldAction } = splitKey(oldKey);
  const { moduleKey: nextModule, action: nextAction } = splitKey(nextKey);
  permission.key = nextKey;
  permission.action = nextAction;
  if (req.body.name !== undefined) permission.name = req.body.name;
  if (req.body.module !== undefined) permission.module = req.body.module;
  if (req.body.description !== undefined) permission.description = req.body.description;
  if (req.body.status !== undefined) permission.status = req.body.status;
  await permission.save();
  if (oldKey !== nextKey) {
    const roles = await Role.find({ [`permissions.${oldModule}`]: oldAction });
    await Promise.all(roles.map(async (role) => {
      role.permissions[oldModule] = (role.permissions[oldModule] || []).filter((item) => item !== oldAction);
      role.permissions[nextModule] = [...new Set([...(role.permissions[nextModule] || []), nextAction])];
      role.markModified('permissions');
      await role.save();
    }));
  }
  return res.json({ success: true, message: 'Permission updated.', permission });
};

export const deletePermission = async (req, res) => {
  const permission = await Permission.findOne({ id: req.params.id });
  if (!permission) return res.status(404).json({ success: false, error: 'Permission not found.' });
  if (permission.type === 'System') return res.status(400).json({ success: false, error: 'System permissions cannot be deleted.' });
  const { moduleKey, action } = splitKey(permission.key);
  const roles = await Role.find({ [`permissions.${moduleKey}`]: action });
  await Promise.all(roles.map(async (role) => {
    role.permissions[moduleKey] = (role.permissions[moduleKey] || []).filter((item) => item !== action);
    role.markModified('permissions');
    await role.save();
  }));
  await permission.deleteOne();
  return res.json({ success: true, message: 'Permission deleted.', id: req.params.id });
};
