import mongoose from 'mongoose';

const blInvoiceSchema = new mongoose.Schema({
  referenceNumber: { type: String, required: true, unique: true, index: true },
  logisticsPaymentId: { type: String, index: true },
  blId: { type: String, index: true },
  blNumber: { type: String, required: true, index: true },
  invoiceNumber: { type: String, required: true },
  vendorId: { type: String },
  vendorName: { type: String, required: true },
  category: { type: String, default: 'freight' },
  typeDisplay: { type: String, default: 'Freight Invoice' },
  source: { type: String, default: 'Vendor' },
  amount: { type: Number, required: true },
  totalAmount: { type: Number },
  currency: { type: String, default: 'INR' },
  remarks: String,
  invoiceFile: String,
  invoiceDate: Date,
  paymentDueDate: Date,
  utrNumber: String,
  paidAt: Date,
  financeNotes: String,
  documents: [{
    documentType: String,
    label: String,
    filePath: String,
    originalFilename: String,
    uploadedAt: Date
  }],
  legacyMysqlId: Number,
  legacyImportedAt: Date,
  status: { type: String, default: 'Pending EXIM Approval', index: true },
  currentStep: { type: Number, default: 1 },
  totalSteps: { type: Number, default: 2 },
  submittedAt: { type: Date, default: Date.now },
  createdBy: String,
  actionHistory: [mongoose.Schema.Types.Mixed]
}, { timestamps: true });

export const BlInvoice = mongoose.models.BlInvoice || mongoose.model('BlInvoice', blInvoiceSchema);
