import mongoose from 'mongoose';

// RFQ Sourcing Header
const rfqHeaderSchema = new mongoose.Schema({
  rfqId: { type: String, required: true, unique: true, index: true },
  rfqNumber: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  poId: { type: String, index: true },
  sapPoNumber: String,
  cargoDetails: {
    containerType: { type: String, default: '40ft High Cube' },
    containerCount: { type: Number, default: 4 },
    portOfOrigin: { type: String, default: 'Shanghai Port, CN' },
    portOfDestination: { type: String, default: 'Mundra Port, IN' }
  },
  closingDate: { type: Date },
  status: { 
    type: String, 
    enum: ['draft', 'published', 'pending_approval', 'awarded', 'closed', 'cancelled'], 
    default: 'draft',
    index: true 
  },
  awardedVendorId: String,
  awardedVendorName: String
}, { timestamps: true });

// RFQ Quotes submitted by Vendors (with auto L1..L5 ranking)
const rfqQuoteSchema = new mongoose.Schema({
  quoteId: { type: String, required: true, unique: true },
  rfqId: { type: String, required: true, index: true },
  vendorId: { type: String, required: true },
  vendorName: { type: String, required: true },
  freightAmount: { type: Number, required: true },
  destinationCharges: { type: Number, default: 0 },
  transitDays: { type: Number, default: 18 },
  rank: { type: String, enum: ['L1', 'L2', 'L3', 'L4', 'L5', 'N/A'], default: 'N/A' },
  status: { type: String, enum: ['submitted', 'awarded', 'rejected'], default: 'submitted' }
}, { timestamps: true });

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
    docType: String, // e.g. 'Bill of Lading', 'Commercial Invoice', 'Customs Bill of Entry'
    fileUrl: String,
    uploadedBy: String,
    uploadedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Customs Duty Payments
const customDutyPaymentSchema = new mongoose.Schema({
  dutyId: { type: String, required: true, unique: true, index: true },
  blId: { type: String, required: true, index: true },
  blNumber: { type: String, required: true },
  portCode: { type: String, default: 'INMUN1' }, // Mundra Port
  dutyAmount: { type: Number, required: true },
  icegateRef: { type: String },
  status: { 
    type: String, 
    enum: ['draft', 'pending', 'approved', 'rejected', 'paid'], 
    default: 'draft',
    index: true 
  },
  approvalInstanceId: String,
  utrNumber: String,
  paidAt: Date
}, { timestamps: true });

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
    enum: ['draft', 'pending', 'approved', 'rejected', 'paid'], 
    default: 'draft',
    index: true 
  },
  approvalInstanceId: String,
  utrNumber: String,
  paidAt: Date
}, { timestamps: true });

export const RfqHeader = mongoose.models.RfqHeader || mongoose.model('RfqHeader', rfqHeaderSchema);
export const RfqQuote = mongoose.models.RfqQuote || mongoose.model('RfqQuote', rfqQuoteSchema);
export const RfqBlEntry = mongoose.models.RfqBlEntry || mongoose.model('RfqBlEntry', rfqBlEntrySchema);
export const CustomDutyPayment = mongoose.models.CustomDutyPayment || mongoose.model('CustomDutyPayment', customDutyPaymentSchema);
export const LogisticsPayment = mongoose.models.LogisticsPayment || mongoose.model('LogisticsPayment', logisticsPaymentSchema);
