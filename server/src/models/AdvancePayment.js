import mongoose from 'mongoose';

const advancePaymentSchema = new mongoose.Schema({
  advanceId: { type: String, required: true, unique: true, index: true },
  poId: { type: String, required: true, index: true },
  sapPoNumber: { type: String, required: true },
  vendorId: { type: String, required: true },
  vendorName: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR', uppercase: true, trim: true },
  percentageOfPo: { type: Number, default: 0 },
  gstBreakup: {
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    totalGst: { type: Number, default: 0 }
  },
  paymentMode: { type: String, enum: ['NEFT', 'RTGS', 'Cheque', 'SWIFT'], default: 'RTGS' },
  bankName: { type: String, default: 'HDFC Bank' },
  bankAccountNumber: { type: String },
  remarks: { type: String },
  status: { 
    type: String, 
    enum: ['draft', 'pending', 'approved', 'rejected', 'returned', 'paid', 'adjusted'], 
    default: 'draft',
    index: true 
  },
  approvalInstanceId: { type: String },
  utrNumber: { type: String },
  paidAt: { type: Date },
  adjustedAmount: { type: Number, default: 0 },
  adjustmentInvoiceId: { type: String },
  createdBy: { type: String, default: 'Finance Team' },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date },
  deletedBy: { type: String }
}, { timestamps: true });

export const AdvancePayment = mongoose.models.AdvancePayment || mongoose.model('AdvancePayment', advancePaymentSchema);
