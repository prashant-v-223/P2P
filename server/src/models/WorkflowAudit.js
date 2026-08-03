import mongoose from 'mongoose';

const workflowAuditSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, index: true },
  eventType: { type: String, required: true, index: true },
  actorId: { type: String, required: true, index: true },
  actorName: String,
  actorRole: String,
  entityType: { type: String, required: true, index: true },
  entityId: { type: String, required: true, index: true },
  workflowId: String,
  workflowVersion: Number,
  step: Number,
  action: String,
  previousState: mongoose.Schema.Types.Mixed,
  newState: mongoose.Schema.Types.Mixed,
  reason: String,
  requestId: String,
  source: { type: String, default: 'web' },
  occurredAt: { type: Date, default: Date.now, immutable: true }
}, { timestamps: { createdAt: true, updatedAt: false }, strict: true });

workflowAuditSchema.index({ entityType: 1, entityId: 1, occurredAt: -1 });

export const WorkflowAudit = mongoose.models.WorkflowAudit || mongoose.model('WorkflowAudit', workflowAuditSchema);
