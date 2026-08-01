import mongoose from 'mongoose';

const logisticsProviderSchema = new mongoose.Schema({
  providerId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  contactPerson: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  serviceType: { type: String, default: 'Freight Forwarder' },
  gstin: { type: String, default: '' },
  pan: { type: String, default: '' },
  
  // Bank Details
  bankName: { type: String, default: '' },
  bankBranch: { type: String, default: '' },
  accountNumber: { type: String, default: '' },
  ifscCode: { type: String, default: '' },

  // Metrics
  paymentsCount: { type: Number, default: 0 }
}, {
  timestamps: true
});

export const LogisticsProvider = mongoose.models.LogisticsProvider || mongoose.model('LogisticsProvider', logisticsProviderSchema);
