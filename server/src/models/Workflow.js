import mongoose from 'mongoose';

const workflowSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  category: { type: String, required: true },
  name: { type: String, required: true },
  minAmount: { type: Number, default: 0 },
  maxAmount: { type: Number, default: null },
  formattedRange: { type: String },
  description: { type: String },
  status: { type: String, default: 'Active' },
  steps: [{
    step: Number,
    title: String,
    roleKey: String,
    roleName: String
  }]
}, { timestamps: true });

export const Workflow = mongoose.models.Workflow || mongoose.model('Workflow', workflowSchema);
