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

const customAgentSchema = new mongoose.Schema({
  agentId: { type: String, required: true, unique: true, index: true },
  agencyName: { type: String, required: true },
  licenceNumber: { type: String, required: true },
  portLocation: { type: String, required: true },
  
  // Contact Details
  contactPerson: { type: String },
  phone: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  address: { type: String },
  
  // License & Registration
  iecCode: { type: String, default: '' },
  paymentTerms: { type: String, default: '30' },

  // Credentials
  passwordHash: { type: String, required: true, select: false },
  
  // Status
  status: { type: String, enum: ['Active', 'Inactive', 'Suspended'], default: 'Active' },
  portalAccessEnabled: { type: Boolean, default: true },
  
  // Assignments & Metrics
  assignedBlCount: { type: Number, default: 0 },
  clearedBlCount: { type: Number, default: 0 },
  
  // Password Reset
  passwordResetCodeHash: { type: String, select: false },
  passwordResetExpiresAt: { type: Date, select: false }
}, {
  timestamps: true,
  toJSON: {
    transform: (_document, value) => {
      delete value.passwordHash;
      delete value.passwordResetCodeHash;
      delete value.passwordResetExpiresAt;
      delete value.__v;
      return value;
    }
  }
});

customAgentSchema.statics.hashPassword = hashPassword;
customAgentSchema.methods.verifyPassword = function verifyCustomAgentPassword(password) {
  return verifyPassword(password, this.passwordHash);
};

export const CustomAgent = mongoose.models.CustomAgent || mongoose.model('CustomAgent', customAgentSchema);
