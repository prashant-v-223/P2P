import mongoose from 'mongoose';

const workflowSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  definitionKey: { type: String, required: true, index: true },
  version: { type: Number, default: 1, min: 1 },
  category: { type: String, required: true },
  name: { type: String, required: true },
  minAmount: { type: Number, default: 0 },
  maxAmount: { type: Number, default: null },
  formattedRange: { type: String },
  description: { type: String },
  status: { type: String, default: 'Active' },
  priority: { type: Number, default: 100 },
  conditions: { type: mongoose.Schema.Types.Mixed, default: {} },
  effectiveFrom: { type: Date, default: Date.now },
  effectiveTo: Date,
  createdBy: String,
  activatedBy: String,
  activatedAt: Date,
  steps: [{
    step: Number,
    title: String,
    roleKey: String,
    roleName: String,
    approverType: { type: String, enum: ['role', 'user'], default: 'role' },
    approverUserId: String,
    requiredApprovals: { type: Number, default: 1, min: 1 },
    allowSelfApproval: { type: Boolean, default: false },
    slaHours: { type: Number, default: 24, min: 1 },
    escalationRole: String
  }]
}, { timestamps: true });

workflowSchema.index({ definitionKey: 1, version: 1 }, { unique: true, sparse: true });
workflowSchema.index({ category: 1, status: 1, minAmount: 1, maxAmount: 1, priority: -1 });

export const Workflow = mongoose.models.Workflow || mongoose.model('Workflow', workflowSchema);
