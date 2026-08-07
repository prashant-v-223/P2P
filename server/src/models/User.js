import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
};

const verifyPassword = async (password, storedHash) => {
  if (!storedHash?.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const derivedKey = await scrypt(password, salt, 64);
  const storedKey = Buffer.from(key, 'hex');
  return storedKey.length === derivedKey.length &&
    crypto.timingSafeEqual(storedKey, derivedKey);
};

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, default: 'procurement_head', trim: true },
  department: { type: String, default: 'Procurement', trim: true },
  status: { type: String, enum: ['Active', 'Inactive', 'Suspended'], default: 'Active' },
  avatar: { type: String, default: 'NA' },
  passwordResetCodeHash: { type: String, select: false },
  passwordResetExpiresAt: { type: Date, select: false },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorCodeHash: { type: String, select: false },
  twoFactorCodeExpiresAt: { type: Date, select: false },
  // Delegation / Parent-user feature
  parentUserId: { type: String, default: null, index: true },  // ID of the user who acts on behalf
  delegationActive: { type: Boolean, default: false },          // When true, parent can act for this user
  delegationStartAt: { type: Date, default: null },
  delegationEndAt: { type: Date, default: null },
  delegationNote: { type: String, default: '', maxlength: 240 }, // e.g. "Annual leave until Aug 15"
  managerId: { type: String, default: null, index: true },
  managerName: { type: String, default: null, trim: true },
  team: { type: String, default: null, trim: true, index: true },
  hierarchyLevel: { type: Number, min: 0, max: 10, default: 3, index: true },
  canSeeAllRequests: { type: Boolean, default: false },
  isManager: { type: Boolean, default: false, index: true }
}, {
  timestamps: true,
  toJSON: {
    transform: (_document, value) => {
      delete value.passwordHash;
      delete value.passwordResetCodeHash;
      delete value.passwordResetExpiresAt;
      delete value.twoFactorCodeHash;
      delete value.twoFactorCodeExpiresAt;
      delete value.__v;
      return value;
    }
  }
});

userSchema.statics.hashPassword = hashPassword;
userSchema.methods.verifyPassword = function verifyUserPassword(password) {
  return verifyPassword(password, this.passwordHash);
};

export const User = mongoose.models.User || mongoose.model('User', userSchema);

