import mongoose from 'mongoose';

const customDutyPaymentSchema = new mongoose.Schema({
  customDutyId: { type: String, required: true, unique: true, index: true },
  referenceNumber: { type: String, required: true, unique: true, index: true },
  boeNumber: { type: String, required: true, index: true }, // Bill of Entry Number
  boeDate: { type: Date, default: Date.now },
  portCode: { type: String, required: true },
  dutyAmount: { type: Number, required: true },
  fineInterestAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },

  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected', 'returned', 'paid'],
    default: 'draft',
    index: true
  },
  approvalInstanceId: { type: String },
  utrNumber: { type: String },
  paidAt: { type: Date },
  createdBy: { type: String, default: 'Finance Team' }
}, { timestamps: true });

export const CustomDutyPayment = mongoose.models.CustomDutyPayment || mongoose.model('CustomDutyPayment', customDutyPaymentSchema);
