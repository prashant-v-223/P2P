import mongoose from 'mongoose';

/**
 * CustomDutyPayment — Customs Duty & ICEGATE settlement records.
 *
 * This is the single source of truth for the CustomDutyPayment collection.
 * Older code (seed.js) imported an outdated schema that required
 * customDutyId/referenceNumber/totalAmount. The POST /api/p2p/custom-duties
 * route persists records shaped like { dutyId, blId, blNumber, dutyAmount, ... }
 * and stores the workflow status ("Pending EXIM Manager Approval", etc.) until
 * an approver acts on it. This schema is kept flexible (strict:false) so the
 * many shapes produced across the app always persist cleanly.
 */
const customDutyPaymentSchema = new mongoose.Schema({
  dutyId: { type: String, required: true, unique: true, index: true },
  blId: { type: String, index: true },
  blNumber: { type: String },
  boeNumber: { type: String },
  portCode: { type: String, default: 'INMUN1' },
  vesselName: { type: String },
  dutyAmount: { type: Number, required: true },
  customAgentName: String,
  icegateRef: { type: String },
  // Workflow status passthrough. Store the verbose approval status until an
  // approver completes the flow, at which point the sync step maps it to a
  // canonical value below. `strict:false` tolerates any additional status
  // strings written by older clients without throwing.
  status: {
    type: String,
    enum: [
      'draft',
      'pending',
      'approved',
      'rejected',
      'returned',
      'paid',
      'Pending EXIM Manager Approval',
      'Pending Finance Lead Approval',
      'Pending Finance Approval',
      'Approved & Dispatched',
      'Returned for changes'
    ],
    default: 'pending',
    index: true
  },
  remarks: String,
  documents: [{
    docType: String,
    name: String,
    fileName: String,
    fileUrl: String,
    size: Number,
    storage: String,
    uploadedBy: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  approvalInstanceId: String,
  utrNumber: String,
  paidAt: Date,
  createdBy: { type: String, default: 'Finance Team' }
}, { timestamps: true, strict: false });

export const CustomDutyPayment = mongoose.models.CustomDutyPayment || mongoose.model('CustomDutyPayment', customDutyPaymentSchema);

