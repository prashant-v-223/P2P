import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
  supplierId: { type: String },
  sapVendorCode: { type: String },
  companyName: { type: String },
  name: { type: String },
  contactPerson: { type: String },
  phone: { type: String },
  email: { type: String },
  gstin: { type: String },
  pan: { type: String },
  taxNumber: { type: String },
  address: { type: String },
  city: { type: String },
  postalCode: { type: String },
  country: { type: String },
  bankName: { type: String },
  branch: { type: String },
  accountNumber: { type: String },
  ifscCode: { type: String },
  vendorType: { type: String, default: 'DOMESTIC' },
  paymentTerms: { type: String, default: '30 Days' },
  sapPayload: { type: Object }
}, { timestamps: true, strict: false });

supplierSchema.index({ supplierId: 1 });
supplierSchema.index({ companyName: 1 });
supplierSchema.index({ name: 1 });
supplierSchema.index({ gstin: 1 });

export const Supplier = mongoose.models.Supplier || mongoose.model('Supplier', supplierSchema);
