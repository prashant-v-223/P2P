import mongoose from 'mongoose';

// Customs Duty Payments
const customDutyPaymentSchema = new mongoose.Schema({
  dutyId: { type: String, required: true, unique: true, index: true },
  blId: { type: String, required: true, index: true },
  blNumber: { type: String, required: true },
  boeNumber: { type: String },
  portCode: { type: String, default: 'INMUN1' },
  dutyAmount: { type: Number, required: true },
  customAgentName: String,
  icegateRef: { type: String },
  vesselName: String,
  remarks: String,
  documents: [{
    name: String,
    size: Number,
    storage: String,
    fileUrl: String,
    fileName: String,
    docType: String,
    uploadedBy: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
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
      'Pending EXIM Approval',
      'Approved & Dispatched'
    ],
    default: 'draft',
    index: true
  },
  approvalInstanceId: String,
  utrNumber: String,
  paidAt: Date,
  createdBy: { type: String, default: 'Finance Team' }
}, { timestamps: true, strict: false });

export const CustomDutyPayment = mongoose.models.CustomDutyPayment || mongoose.model('CustomDutyPayment', customDutyPaymentSchema);

