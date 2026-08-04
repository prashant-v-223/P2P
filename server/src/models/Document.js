import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  documentId: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  documentType: { 
    type: String, 
    required: true, 
    enum: ['vendor_invoice', 'advance_request', 'custom_duty_receipt', 'bill_of_lading', 'po_copy', 'rfq_document', 'other'],
    index: true 
  },
  fileUrl: { type: String, required: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number },
  mimeType: { type: String, default: 'application/pdf' },

  // Polymorphic reference matching documentable_type & documentable_id from SQL trace
  documentableType: {
    type: String,
    required: true,
    enum: ['AdvancePayment', 'InvoicePayment', 'CustomDutyPayment', 'LogisticsPayment', 'RfqHeader', 'PurchaseOrder'],
    index: true
  },
  documentableId: { 
    type: String, 
    required: true, 
    index: true 
  },

  storageType: { type: String, default: 's3', enum: ['s3', 'local'] },
  uploadedBy: { type: String, required: true, default: 'System User' },
  metadata: { type: Map, of: String }
}, { timestamps: true });

// Compound index for fast querying of attachments per entity
documentSchema.index({ documentableType: 1, documentableId: 1 });

export const Document = mongoose.models.Document || mongoose.model('Document', documentSchema);
