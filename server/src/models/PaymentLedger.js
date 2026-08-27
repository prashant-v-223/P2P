import mongoose from 'mongoose';

const paymentLedgerSchema = new mongoose.Schema({
  paymentId: { type: String, required: true, unique: true, index: true },
  payableType: { 
    type: String, 
    required: true, 
    enum: ['AdvancePayment', 'InvoicePayment', 'RfqPayment', 'RfqBlInvoice', 'CustomDutyPayment', 'LogisticsPayment'],
    index: true 
  },
  payableId: { type: String, required: true, index: true },
  referenceNumber: { type: String }, // e.g. PO-4300001510 or BL-MAEU987456
  vendorId: { type: String, required: true },
  vendorName: { type: String, required: true },
  grossAmount: { type: Number, required: true },
  tdsAmount: { type: Number, default: 0 },
  netAmount: { type: Number, required: true },
  paymentMode: { 
    type: String, 
    enum: ['NEFT', 'RTGS', 'Cheque', 'SWIFT', 'ICEGATE'], 
    default: 'RTGS' 
  },
  bankName: { type: String, default: 'HDFC Bank - Main Corporate' },
  bankAccountNumber: { type: String, default: '50200049281745' },
  utrNumber: { type: String, default: null },
  status: { 
    type: String, 
    enum: ['draft', 'processed', 'failed'], 
    default: 'processed',
    index: true 
  },
  paidAt: { type: Date, default: Date.now },
  processedBy: { type: String, default: 'Treasury / Finance Admin' }
}, { timestamps: true });

export const PaymentLedger = mongoose.models.PaymentLedger || mongoose.model('PaymentLedger', paymentLedgerSchema);
