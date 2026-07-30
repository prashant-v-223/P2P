import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  roleName: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
  usersCount: { type: Number, default: 0 },
  description: { type: String, trim: true, maxlength: 240, default: '' },
  type: { type: String, enum: ['System', 'Custom'], default: 'Custom' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  permissions: { type: Object, default: {} }
}, { timestamps: true });

export const Role = mongoose.models.Role || mongoose.model('Role', roleSchema);
