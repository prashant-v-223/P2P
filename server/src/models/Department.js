import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
  code: { type: String, trim: true, maxlength: 20 },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  description: { type: String, trim: true, maxlength: 250, default: '' },
}, { timestamps: true });

export const Department = mongoose.models.Department || mongoose.model('Department', departmentSchema);
