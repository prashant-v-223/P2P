import mongoose from 'mongoose';

const actionRecordSchema = new mongoose.Schema({
  action:        { type: String, required: true }, // 'approve' | 'reject' | 'return'
  step:          { type: Number, default: 1 },
  statusAtAction:{ type: String },
  role:          { type: String },
  actionedBy:    { type: String, required: true },
  actionedAt:    { type: Date, default: Date.now },
  remarks:       { type: String, default: '' },
  idempotencyKey: String
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
  workflowVersion:{ type: Number, default: 1 },
  workflowSnapshot: { type: mongoose.Schema.Types.Mixed },
  transactionSnapshot: { type: mongoose.Schema.Types.Mixed },
  requestedById: { type: String, index: true },
  requestedByTeam: { type: String, default: null, index: true },
  assignedApprover: { type: String, default: null, index: true },
  assignedApproverName: { type: String, default: null },
  assignedApproverRole: { type: String, default: null },
  requestId: String,
  version: { type: Number, default: 0 },
  completedAt: Date,
  workflowSteps:  { type: String },                                  // JSON string: [{step, title, roleName, roleKey, statusKey}]
  currentStep:    { type: Number, default: 1 },                      // 1-based active step
  totalSteps:     { type: Number, default: 2 },
  status: {
    type: String,
    default: 'Pending Procurement Head Approval'
  },
  submittedAt:   { type: Date, default: Date.now },
  slaHours:      { type: Number, default: 48 },                     // 48 hours default SLA
  dueDate:       { type: Date },                                    // Calculated deadline
  isOverdue:     { type: Boolean, default: false },
  remarks:       { type: String, default: '' },
  containersCount: { type: Number, default: 0 },
  allocations: [{
    quoteId: String,
    vendorId: String,
    vendorName: String,
    vendorCode: String,
    containers: Number,
    ratePerContainer: Number,
    allocationAmount: Number,
    remark: String
  }],
  actionedBy:    { type: String },
  actionedAt:    { type: Date },
  actionHistory: [actionRecordSchema],                             // Audit log storing ALL approvals, rejections, returns
  legacyMysqlId: { type: Number, index: true, sparse: true },
  legacyImportedAt: Date
}, { timestamps: true });

approvalSchema.index({ workflowId: 1, status: 1 });

export const Approval = mongoose.models.Approval || mongoose.model('Approval', approvalSchema);
