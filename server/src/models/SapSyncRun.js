import mongoose from 'mongoose';

const sapSyncRunSchema = new mongoose.Schema({
  entity: { type: String, required: true, index: true },
  mode: { type: String, enum: ['full', 'manual'], default: 'full' },
  requestedBy: String,
  fetched: { type: Number, default: 0 },
  created: { type: Number, default: 0 },
  updated: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  status: { type: String, enum: ['running', 'completed', 'failed'], default: 'running', index: true },
  error: String,
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  durationMs: Number
}, { timestamps: true });

export const SapSyncRun = mongoose.models.SapSyncRun || mongoose.model('SapSyncRun', sapSyncRunSchema);
