import mongoose from 'mongoose';

const vendorSchema = new mongoose.Schema({
  id: { type: String, required: true },
  supplierId: { type: String },
  sapVendorCode: { type: String, required: true },
  companyName: { type: String, required: true },
  contactPerson: { type: String },
  phone: { type: String },
  email: { type: String, required: true },
  vendorType: { type: String, default: 'DOMESTIC' },
  paymentTerms: { type: String, default: '30 Days' },
  status: { type: String, default: 'Active' },
  category: { type: String, default: 'Manufacturing' },
  
  // Tax Info
  gstin: { type: String },
  pan: { type: String },
  
  // Bank Details
  bankName: { type: String },
  branch: { type: String },
  accountNumber: { type: String },
  ifscCode: { type: String },

  // Portal Credentials & Status
  portalAccessEnabled: { type: Boolean, default: true },
  loginUrl: { type: String, default: '/vendor/login' },
  passwordHash: { type: String, select: false }, // Properly hashed password

  // Summary Metrics
  purchaseOrdersCount: { type: Number, default: 30 },
  advancePaymentsCount: { type: Number, default: 0 },
  totalInvoicesCount: { type: Number, default: 0 },
  invoicesPaidCount: { type: Number, default: 0 },

  // Historical Tables
  recentPOs: [{
    poNumber: String,
    date: String,
    type: String,
    amount: String,
    status: String
  }],
  recentPayments: [{
    reference: String,
    invoiceNo: String,
    netPayable: String,
    status: String,
    date: String
  }]
}, { timestamps: true, strict: false });

export const Vendor = mongoose.models.Vendor || mongoose.model('Vendor', vendorSchema);
