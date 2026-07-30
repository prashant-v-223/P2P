import mongoose from 'mongoose';

const approvalSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  vendorName: { type: String, required: true },
  amountOriginal: { type: String, required: true },
  amountINR: { type: String, required: true },
  currency: { type: String, default: 'USD' },
  requestedBy: { type: String, default: 'Aarav Patel' },
  currentSlab: { type: String },
  status: { type: String, default: 'Pending Procurement Head Approval' },
  submittedAt: { type: Date, default: Date.now },
  remarks: { type: String, default: '' },
  actionedBy: { type: String },
  actionedAt: { type: Date }
}, { timestamps: true });

export const Approval = mongoose.models.Approval || mongoose.model('Approval', approvalSchema);
