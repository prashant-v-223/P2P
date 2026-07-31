import mongoose from 'mongoose';

const actionRecordSchema = new mongoose.Schema({
  action:        { type: String, required: true }, // 'approve' | 'reject' | 'return'
  step:          { type: Number, default: 1 },
  statusAtAction:{ type: String },
  role:          { type: String },
  actionedBy:    { type: String, required: true },
  actionedAt:    { type: Date, default: Date.now },
  remarks:       { type: String, default: '' }
}, { _id: false });

const approvalSchema = new mongoose.Schema({
  id:             { type: String, required: true, unique: true },   // matches AdvancePayment.advanceId / InvoicePayment.invoicePaymentId
  type:           { type: String, required: true },                  // 'Advance Payment' | 'Invoice Payment' etc.
  vendorName:     { type: String, required: true },
  amountOriginal: { type: String, required: true },
  amountINR:      { type: String, required: true },
  currency:       { type: String, default: 'INR' },
  requestedBy:    { type: String, default: 'Finance Team' },
  currentSlab:    { type: String },                                  // Display name of matched slab
  poReference:    { type: String },                                  // SAP PO number
  workflowId:     { type: String },                                  // Ref to Workflow._id or Workflow.id
  workflowSteps:  { type: String },                                  // JSON string: [{step, title, roleName, roleKey, statusKey}]
  currentStep:    { type: Number, default: 1 },                      // 1-based active step
  totalSteps:     { type: Number, default: 2 },
  status: {
    type: String,
    default: 'Pending Procurement Head Approval'
  },
  submittedAt:   { type: Date, default: Date.now },
  remarks:       { type: String, default: '' },
  actionedBy:    { type: String },
  actionedAt:    { type: Date },
  actionHistory: [actionRecordSchema]                              // Audit log storing ALL approvals, rejections, returns
}, { timestamps: true });

export const Approval = mongoose.models.Approval || mongoose.model('Approval', approvalSchema);
