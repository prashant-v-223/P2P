import mongoose from 'mongoose';

const exchangeRateSchema = new mongoose.Schema({
  currency: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  rate: { type: Number, required: true },
  lastUpdatedBy: { type: String, required: true }
}, { timestamps: true });

export const ExchangeRate = mongoose.models.ExchangeRate || mongoose.model('ExchangeRate', exchangeRateSchema);
