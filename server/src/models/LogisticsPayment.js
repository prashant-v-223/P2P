import mongoose from 'mongoose';

const logisticsPaymentSchema = new mongoose.Schema({
  logisticsPaymentId: { type: String, required: true, unique: true, index: true },
  referenceNumber: { type: String, required: true, unique: true, index: true },
  blId: { type: String, index: true },
  vendorId: { type: String, required: true },
  vendorName: { type: String, required: true },
  invoiceNumber: { type: String, required: true },
  blNumber: { type: String, required: true, index: true }, // Bill of Lading
  freightCharges: { type: Number, default: 0 },
  detentionCharges: { type: Number, default: 0 },
  terminalHandlingCharges: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  amount: { type: Number },
  currency: { type: String, default: 'INR' },
  category: { type: String, enum: ['freight', 'destination_charges', 'detention', 'port_storage', 'agency_fee'], default: 'freight' },
  invoiceFile: String,
  remarks: String,

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

export const LogisticsPayment = mongoose.models.LogisticsPayment || mongoose.model('LogisticsPayment', logisticsPaymentSchema);
