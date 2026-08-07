import mongoose from 'mongoose';

// RFQ Sourcing Header
const rfqHeaderSchema = new mongoose.Schema({
  rfqId: { type: String, required: true, unique: true, index: true },
  rfqNumber: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  poId: { type: String, index: true },
  sapPoNumber: String,
  description: String,
  cargoDetails: {
    shippingTerms: { type: String, default: 'FOB' },
    cargoType: { type: String, default: 'SOLAR CELL' },
    containerType: { type: String, default: '40 FT' },
    containerCount: { type: Number, default: 1 },
    portOfOrigin: { type: String, default: 'SHANGHAI' },
    portOfDestination: { type: String, default: 'NHAVA SHEVA' },
    weightPerContainer: String,
    estimatedReadinessDate: Date
  },
  invitedVendors: [{ vendorId: String, companyName: String, sapVendorCode: String }],
  closingDate: { type: Date },
  status: { 
    type: String, 
    enum: ['draft', 'published', 'pending_approval', 'partially_awarded', 'awarded', 'closed', 'cancelled'], 
    default: 'published',
    index: true 
  },
  awardedVendorId: String,
  awardedVendorName: String,
  awardedQuoteId: String,
  totalQuantity: { type: Number, default: 1 },
  allocatedQuantity: { type: Number, default: 0 },
  pendingAllocation: { type: Number, default: 1 },
  reassignmentHistory: [{
    reassignedAt: Date,
    reassignedBy: String,
    previousVendorId: String,
    previousVendorName: String,
    previousAllocations: Array,
    previousAllocatedQuantity: Number,
    newAllocations: Array,
    newAllocatedQuantity: Number,
    approvalId: String
  }]
}, { timestamps: true, strict: false });

// RFQ Quotes submitted by Vendors (with auto L1..L5 ranking)
const rfqQuoteSchema = new mongoose.Schema({
  quoteId: { type: String, required: true, unique: true },
  rfqId: { type: String, required: true, index: true },
  vendorId: { type: String, required: true },
  vendorName: { type: String, required: true },
  shippingLine: { type: String, default: 'MSC' },
  oceanFreightUsd: { type: Number, default: 15000 },
  stChargesInr: { type: Number, default: 25000 },
  otherChargesInr: { type: Number, default: 0 },
  totalInr: { type: Number, default: 1461531 },
  freightAmount: { type: Number, required: true },
  destinationCharges: { type: Number, default: 0 },
  transitDays: { type: Number, default: 18 },
  rank: { type: String, enum: ['L1', 'L2', 'L3', 'L4', 'L5', 'N/A'], default: 'L1' },
  status: { type: String, enum: ['submitted', 'awarded', 'rejected'], default: 'submitted' }
}, { timestamps: true, strict: false });

// Bill of Lading (BL) Entry Shipment Tracking State Machine
const rfqBlEntrySchema = new mongoose.Schema({
  blId: { type: String, required: true, unique: true, index: true },
  rfqId: { type: String, index: true },
  blNumber: { type: String, required: true, unique: true },
  vesselName: { type: String, default: 'EVER GIVEN V-104E' },
  shippingLine: { type: String, default: 'Maersk Line' },
  containerCount: { type: Number, default: 4 },
  etaDate: { type: Date },
  customAgentId: { type: String },
  customAgentName: { type: String },
  autoAsnNumber: { type: String },
  status: { 
    type: String, 
    enum: [
      'submitted', 
      'exim_review', 
      'assigned_to_agent', 
      'material_received', 
      'custom_cleared', 
      'invoice_pending', 
      'payment_requested', 
      'payment_approved', 
      'payment_paid', 
      'closed'
    ], 
    default: 'submitted',
    index: true 
  },
  documents: [{
    docType: String,
    fileUrl: String,
    uploadedBy: String,
    uploadedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true, strict: false });

// Customs Duty Payments (schema moved to ../CustomDutyPayment.js to prevent
// duplicate model registration — see server/src/models/CustomDutyPayment.js)

// Logistics & Freight Invoices
const logisticsPaymentSchema = new mongoose.Schema({
  logisticsPaymentId: { type: String, required: true, unique: true, index: true },
  blId: { type: String, required: true, index: true },
  blNumber: { type: String, required: true },
  providerId: { type: String, required: true },
  providerName: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['freight', 'destination_charges', 'detention', 'port_storage', 'agency_fee'], 
    default: 'freight' 
  },
  invoiceNumber: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { 
    type: String, 
    default: 'pending',
    index: true 
  },
  approvalInstanceId: String,
  utrNumber: String,
  paidAt: Date
}, { timestamps: true, strict: false });

export const RfqHeader = mongoose.models.RfqHeader || mongoose.model('RfqHeader', rfqHeaderSchema);
export const RfqQuote = mongoose.models.RfqQuote || mongoose.model('RfqQuote', rfqQuoteSchema);
export const RfqBlEntry = mongoose.models.RfqBlEntry || mongoose.model('RfqBlEntry', rfqBlEntrySchema);
export { CustomDutyPayment } from './CustomDutyPayment.js';
