import mongoose from 'mongoose';

const invoicePaymentSchema = new mongoose.Schema({
  invoicePaymentId: { type: String, required: true, unique: true, index: true },
  poId:             { type: String, required: true, index: true },
  sapPoNumber:      { type: String, required: true },
  vendorId:         { type: String, required: true },
  vendorName:       { type: String, required: true },
  invoiceNumber:    { type: String, required: true },
  asnNumber:        { type: String, default: '' },
  supportingDocuments: [{
    fileName: String,
    originalName: String,
    fileUrl: String,
    size: Number,
    mimeType: String
  }],
  invoiceDate:      { type: Date, default: Date.now },
  paymentDueDate:   { type: Date },
  grossAmount:      { type: Number, required: true },
  currency:         { type: String, default: 'INR', uppercase: true, trim: true },
  gstAmount:        { type: Number, default: 0 },
  tdsAmount:        { type: Number, default: 0 },
  tdsPercentage:    { type: Number, default: 0 },
  advanceAdjusted:  { type: Number, default: 0 },
  advanceIdAdjusted:{ type: String },
  netPayable:       { type: Number, required: true },
  grnNumber:        { type: String, default: '' },
  remarks:          { type: String, default: '' },
  approvalTo:       { type: String, default: '' },
  threeWayMatch: {
    status:          { type: String, enum: ['pending', 'matched', 'mismatch'], default: 'pending' },
    poQuantity:      Number,
    grnQuantity:     Number,
    invoiceQuantity: Number,
    varianceAmount:  { type: Number, default: 0 },
    matchedAt:       Date
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected', 'returned', 'paid'],
    default: 'draft',
    index: true
  },
  approvalInstanceId: { type: String },
  utrNumber:          { type: String },
  paidAt:             { type: Date },
  createdBy:          { type: String, default: 'Finance Team' },
  createdByType:      { type: String, enum: ['user', 'vendor'], default: 'user', index: true },
  createdByVendorId:  { type: String, default: '', index: true },
  requestedBy:        { type: String, default: '' },
  requestedById:      { type: String, default: '', index: true },
  userId:             { type: String, default: '', index: true },
  requestedByTeam:    { type: String, default: null, index: true },
  assignedApprover:   { type: String, default: null, index: true },
  assignedApproverName: { type: String, default: null },
  assignedApproverRole: { type: String, default: null }
}, { timestamps: true });

export const InvoicePayment = mongoose.models.InvoicePayment || mongoose.model('InvoicePayment', invoicePaymentSchema);
