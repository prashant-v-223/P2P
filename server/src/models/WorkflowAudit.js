import mongoose from 'mongoose';
import crypto from 'node:crypto';

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
  auditKey: { type: String, unique: true, sparse: true, index: true, immutable: true },
  source: { type: String, default: 'web' },
  occurredAt: { type: Date, default: Date.now, immutable: true }
}, { timestamps: { createdAt: true, updatedAt: false }, strict: true });

workflowAuditSchema.index({ entityType: 1, entityId: 1, occurredAt: -1 });
workflowAuditSchema.index({ requestId: 1, entityId: 1 });

workflowAuditSchema.statics.record = async function record(payload) {
  const requestId = payload?.requestId;
  if (!requestId) return this.create(payload);
  const auditKey = crypto.createHash('sha256').update([
    requestId, payload.actorId, payload.entityType, payload.entityId,
    payload.eventType, payload.action, Number(payload.step || 1)
  ].map((value) => String(value || '').trim().toLowerCase()).join('|')).digest('hex');
  return this.findOneAndUpdate(
    { auditKey },
    { $setOnInsert: { ...payload, auditKey } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

export const WorkflowAudit = mongoose.models.WorkflowAudit || mongoose.model('WorkflowAudit', workflowAuditSchema);
