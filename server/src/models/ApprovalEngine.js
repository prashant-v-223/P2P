import mongoose from 'mongoose';

// Workflow definition schema
const approvalWorkflowStepSchema = new mongoose.Schema({
  stepNumber: { type: Number, required: true },
  stepName: { type: String, required: true },
  approverRole: { type: String, required: true }, // e.g. 'finance_head', 'procurement_manager'
  escalationHours: { type: Number, default: 24 }
});

const approvalWorkflowSchema = new mongoose.Schema({
  workflowId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  module: { 
    type: String, 
    required: true, 
    enum: ['advance_payment', 'invoice_payment', 'rfq', 'rfq_payment', 'bl_invoice_payment', 'logistics_payment', 'custom_duty'],
    index: true 
  },
  minAmount: { type: Number, default: 0 },
  maxAmount: { type: Number, default: Infinity },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  steps: [approvalWorkflowStepSchema]
}, { timestamps: true });

// Live workflow execution instance schema
const approvalInstanceSchema = new mongoose.Schema({
  instanceId: { type: String, required: true, unique: true, index: true },
  approvableType: { 
    type: String, 
    required: true, 
    enum: ['AdvancePayment', 'InvoicePayment', 'RfqHeader', 'RfqBlInvoice', 'CustomDutyPayment', 'LogisticsPayment'] 
  },
  approvableId: { type: String, required: true, index: true },
  workflowId: { type: String, required: true },
  currentStep: { type: Number, default: 1 },
  totalSteps: { type: Number, required: true },
  assignedApproverRole: { type: String },
  assignedApproverId: { type: String },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'returned', 'cancelled'], 
    default: 'pending',
    index: true 
  }
}, { timestamps: true });

// Audit log action schema
const approvalActionSchema = new mongoose.Schema({
  actionId: { type: String, required: true, unique: true },
  instanceId: { type: String, required: true, index: true },
  stepIndex: { type: Number, required: true },
  action: { type: String, enum: ['approve', 'reject', 'return'], required: true },
  performedBy: { type: String, required: true },
  performedByName: { type: String, default: 'Internal User' },
  comments: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

export const ApprovalWorkflow = mongoose.models.ApprovalWorkflow || mongoose.model('ApprovalWorkflow', approvalWorkflowSchema);
export const ApprovalInstance = mongoose.models.ApprovalInstance || mongoose.model('ApprovalInstance', approvalInstanceSchema);
export const ApprovalAction = mongoose.models.ApprovalAction || mongoose.model('ApprovalAction', approvalActionSchema);
