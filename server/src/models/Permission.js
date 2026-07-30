import mongoose from 'mongoose';

const permissionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  key: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/
  },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  module: { type: String, required: true, trim: true, maxlength: 80 },
  action: { type: String, required: true, lowercase: true, trim: true, maxlength: 40 },
  description: { type: String, trim: true, maxlength: 240, default: '' },
  type: { type: String, enum: ['System', 'Custom'], default: 'Custom' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
}, { timestamps: true });

export const Permission = mongoose.models.Permission || mongoose.model('Permission', permissionSchema);
