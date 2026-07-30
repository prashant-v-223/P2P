import mongoose from 'mongoose';

const purchaseOrderSchema = new mongoose.Schema({
  poNumber: { type: String, required: true, unique: true, index: true },
  supplierId: { type: String, index: true },
  supplierName: String,
  companyCode: String,
  currency: String,
  totalAmount: Number,
  documentDate: Date,
  status: { type: String, default: 'Open', index: true },
  sapUpdatedAt: Date,
  sapPayload: { type: mongoose.Schema.Types.Mixed, select: false },
  lastSyncedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export const PurchaseOrder = mongoose.models.PurchaseOrder || mongoose.model('PurchaseOrder', purchaseOrderSchema);
