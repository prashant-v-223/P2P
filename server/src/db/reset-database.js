if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile();
}

import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { connectDB } from './index.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { Permission } from '../models/Permission.js';
import { DEFAULT_PERMISSIONS, DEFAULT_ROLES } from './seed.js';

const confirmation = process.env.RESET_CONFIRM;
const adminName = process.env.RESET_ADMIN_NAME?.trim();
const adminEmail = process.env.RESET_ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.RESET_ADMIN_PASSWORD;

if (confirmation !== 'DELETE_ALL_DATA') {
  throw new Error('Set RESET_CONFIRM=DELETE_ALL_DATA before running this command.');
}
if (!adminName || !adminEmail || !adminPassword || adminPassword.length < 12) {
  throw new Error('Set RESET_ADMIN_NAME, RESET_ADMIN_EMAIL, and a 12+ character RESET_ADMIN_PASSWORD.');
}

try {
  const connected = await connectDB({ seed: false });
  if (!connected) throw new Error('Database connection failed. Check MONGODB_URI in .env.');

  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }

  await Permission.insertMany(DEFAULT_PERMISSIONS);
  await Role.insertMany(DEFAULT_ROLES);
  const passwordHash = await User.hashPassword(adminPassword);
  await User.create({
    id: `usr-${crypto.randomUUID()}`,
    name: adminName,
    email: adminEmail,
    passwordHash,
    role: 'admin',
    department: 'System Administration',
    avatar: adminName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
    status: 'Active',
    hierarchyLevel: 0,
    canSeeAllRequests: true
  });

  console.log(`Database reset completed. Sign in with ${adminEmail} and create your organisation hierarchy from User Directory.`);
} finally {
  await mongoose.disconnect();
}
