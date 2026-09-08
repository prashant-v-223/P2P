import mongoose from 'mongoose';

const referenceSequenceSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  value: { type: Number, required: true, default: 0 }
}, { timestamps: true });

export const ReferenceSequence = mongoose.models.ReferenceSequence || mongoose.model('ReferenceSequence', referenceSequenceSchema);
