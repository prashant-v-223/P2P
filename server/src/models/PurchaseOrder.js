import mongoose from 'mongoose';

const poItemSchema = new mongoose.Schema({
  itemNumber: String,
  materialCode: String,
  description: String,
  quantity: Number,
  unitPrice: Number,
  totalPrice: Number,
  uom: { type: String, default: 'PCS' }
});

const purchaseOrderSchema = new mongoose.Schema({
  poNumber: { type: String, required: true, unique: true, index: true },
  sapPoNumber: { type: String, index: true },
  supplierId: { type: String, index: true },
  supplierName: String,
  companyCode: { type: String, default: '1000' },
  currency: { type: String, default: 'INR' },
  fxRate: { type: Number, default: 1 },
  amountINR: { type: Number },
  totalAmount: { type: Number, required: true },
  advancePaid: { type: Number, default: 0 },
  advanceCommitted: { type: Number, default: 0 },
  amountLocked: { type: Boolean, default: false },
  previousTotalAmount: Number,
  documentDate: { type: Date, default: Date.now },
  dueDate: { type: Date },
  status: { 
    type: String, 
    enum: ['open', 'partially_delivered', 'delivered', 'closed', 'cancelled'], 
    default: 'open', 
    index: true 
  },
  items: [poItemSchema],
  sapUpdatedAt: Date,
  sapPayload: { type: mongoose.Schema.Types.Mixed, select: false },
  lastSyncedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export const PurchaseOrder = mongoose.models.PurchaseOrder || mongoose.model('PurchaseOrder', purchaseOrderSchema);
