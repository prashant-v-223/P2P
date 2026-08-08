import { Workflow } from '../../models/Workflow.js';

const baseSteps = [
  { step: 1, title: 'Purchase Manager Review', roleName: 'Purchase Manager', roleKey: 'purchase-manager', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 24 },
  { step: 2, title: 'Purchase Head Approval', roleName: 'Purchase Head', roleKey: 'procurement_head', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 24 }
];

const common = {
  category: 'RFQ Vendor Award',
  status: 'Active',
  priority: 100,
  conditions: {},
  version: 1,
  createdBy: 'system-bootstrap',
  activatedBy: 'system-bootstrap'
};

const rfqAwardDefaults = [
  {
    ...common,
    id: 'WF-RFQ-AWARD-STANDARD-V1',
    definitionKey: 'rfq_vendor_award_standard',
    name: 'RFQ Vendor Award (Up to ₹1 Cr)',
    minAmount: 0,
    maxAmount: 10000000,
    formattedRange: '₹0 - ₹1,00,00,000',
    description: 'Full RFQ container allocation approval up to ₹1 crore.',
    steps: [
      { step: 1, title: 'Purchase Head Review', roleName: 'Purchase Head', roleKey: 'procurement_head', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 24 },
      { step: 2, title: 'CFO Signoff', roleName: 'CFO', roleKey: 'cfo', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 24 }
    ]
  },
  {
    ...common,
    id: 'WF-RFQ-AWARD-HIGH-V1',
    definitionKey: 'rfq_vendor_award_high_value',
    name: 'RFQ Vendor Award (Above ₹1 Cr)',
    minAmount: 10000000.01,
    maxAmount: null,
    formattedRange: 'Above ₹1,00,00,000',
    description: 'High-value RFQ award approval with MD authorization.',
    steps: [
      { step: 1, title: 'Purchase Head Review', roleName: 'Purchase Head', roleKey: 'procurement_head', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 24 },
      { step: 2, title: 'CFO Signoff', roleName: 'CFO', roleKey: 'cfo', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 24 },
      { step: 3, title: 'Managing Director Approval', roleName: 'Managing Director', roleKey: 'md', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 48 }
    ]
  }
];

// Advance Payment Workflow Defaults
const advancePaymentDefaults = [
  {
    id: 'WF-ADV-PAY-STANDARD-V1',
    definitionKey: 'advance_payment_standard',
    name: 'Advance Payment (Up to ₹10 Lakhs)',
    category: 'Advance Payment',
    minAmount: 0,
    maxAmount: 1000000,
    formattedRange: '₹0 - ₹10,00,000',
    description: 'Standard advance payment approval — Purchase Manager → Purchase Head.',
    status: 'Active',
    priority: 100,
    conditions: {},
    version: 1,
    createdBy: 'system-bootstrap',
    activatedBy: 'system-bootstrap',
    steps: [
      { step: 1, title: 'Purchase Manager Review', roleName: 'Purchase Manager', roleKey: 'purchase-manager', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 24 },
      { step: 2, title: 'Purchase Head Approval', roleName: 'Purchase Head', roleKey: 'procurement_head', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 24 }
    ]
  },
  {
    id: 'WF-ADV-PAY-MEDIUM-V1',
    definitionKey: 'advance_payment_medium',
    name: 'Advance Payment (₹10L - ₹50L)',
    category: 'Advance Payment',
    minAmount: 1000000.01,
    maxAmount: 5000000,
    formattedRange: '₹10,00,001 - ₹50,00,000',
    description: 'Medium-value advance payment — Purchase Manager → Purchase Head → CFO.',
    status: 'Active',
    priority: 100,
    conditions: {},
    version: 1,
    createdBy: 'system-bootstrap',
    activatedBy: 'system-bootstrap',
    steps: [
      { step: 1, title: 'Purchase Manager Review', roleName: 'Purchase Manager', roleKey: 'purchase-manager', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 24 },
      { step: 2, title: 'Purchase Head Approval', roleName: 'Purchase Head', roleKey: 'procurement_head', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 24 },
      { step: 3, title: 'CFO Approval', roleName: 'CFO', roleKey: 'cfo', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 48 }
    ]
  },
  {
    id: 'WF-ADV-PAY-HIGH-V1',
    definitionKey: 'advance_payment_high',
    name: 'Advance Payment (Above ₹50L)',
    category: 'Advance Payment',
    minAmount: 5000000.01,
    maxAmount: null,
    formattedRange: 'Above ₹50,00,000',
    description: 'High-value advance payment — Purchase Manager → Purchase Head → CFO → MD.',
    status: 'Active',
    priority: 100,
    conditions: {},
    version: 1,
    createdBy: 'system-bootstrap',
    activatedBy: 'system-bootstrap',
    steps: [
      { step: 1, title: 'Purchase Manager Review', roleName: 'Purchase Manager', roleKey: 'purchase-manager', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 24 },
      { step: 2, title: 'Purchase Head Approval', roleName: 'Purchase Head', roleKey: 'procurement_head', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 24 },
      { step: 3, title: 'CFO Approval', roleName: 'CFO', roleKey: 'cfo', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 48 },
      { step: 4, title: 'Managing Director Approval', roleName: 'Managing Director', roleKey: 'md', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 48 }
    ]
  }
];

// Invoice Payment Workflow Defaults
const invoicePaymentDefaults = [
  {
    id: 'WF-INV-PAY-STANDARD-V1',
    definitionKey: 'invoice_payment_standard',
    name: 'Invoice Payment (Up to ₹20 Lakhs)',
    category: 'Invoice Payment',
    minAmount: 0,
    maxAmount: 2000000,
    formattedRange: '₹0 - ₹20,00,000',
    description: 'Standard invoice payment — Purchase Head → CFO Inner.',
    status: 'Active',
    priority: 100,
    conditions: {},
    version: 1,
    createdBy: 'system-bootstrap',
    activatedBy: 'system-bootstrap',
    steps: [
      { step: 1, title: 'Purchase Head Review', roleName: 'Purchase Head', roleKey: 'procurement_head', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 24 },
      { step: 2, title: 'CFO Inner Verification', roleName: 'CFO Inner / Account Finance', roleKey: 'cfo-inner', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 24 }
    ]
  },
  {
    id: 'WF-INV-PAY-MEDIUM-V1',
    definitionKey: 'invoice_payment_medium',
    name: 'Invoice Payment (₹20L - ₹1Cr)',
    category: 'Invoice Payment',
    minAmount: 2000000.01,
    maxAmount: 10000000,
    formattedRange: '₹20,00,001 - ₹1,00,00,000',
    description: 'Medium-value invoice — Purchase Head → CFO Inner → CFO.',
    status: 'Active',
    priority: 100,
    conditions: {},
    version: 1,
    createdBy: 'system-bootstrap',
    activatedBy: 'system-bootstrap',
    steps: [
      { step: 1, title: 'Purchase Head Review', roleName: 'Purchase Head', roleKey: 'procurement_head', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 24 },
      { step: 2, title: 'CFO Inner Verification', roleName: 'CFO Inner / Account Finance', roleKey: 'cfo-inner', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 24 },
      { step: 3, title: 'CFO Approval', roleName: 'CFO', roleKey: 'cfo', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 48 }
    ]
  },
  {
    id: 'WF-INV-PAY-HIGH-V1',
    definitionKey: 'invoice_payment_high',
    name: 'Invoice Payment (Above ₹1 Cr)',
    category: 'Invoice Payment',
    minAmount: 10000000.01,
    maxAmount: null,
    formattedRange: 'Above ₹1,00,00,000',
    description: 'High-value invoice — Purchase Head → CFO Inner → CFO → MD.',
    status: 'Active',
    priority: 100,
    conditions: {},
    version: 1,
    createdBy: 'system-bootstrap',
    activatedBy: 'system-bootstrap',
    steps: [
      { step: 1, title: 'Purchase Head Review', roleName: 'Purchase Head', roleKey: 'procurement_head', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 24 },
      { step: 2, title: 'CFO Inner Verification', roleName: 'CFO Inner / Account Finance', roleKey: 'cfo-inner', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 24 },
      { step: 3, title: 'CFO Approval', roleName: 'CFO', roleKey: 'cfo', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 48 },
      { step: 4, title: 'Managing Director Approval', roleName: 'Managing Director', roleKey: 'md', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 48 }
    ]
  }
];

// BL Freight Invoice Workflow Defaults
const blInvoiceDefaults = [
  {
    id: 'WF-BL-INV-STANDARD-V1',
    definitionKey: 'bl_invoice_standard',
    name: 'BL Freight Invoice (Up to ₹5 Lakhs)',
    category: 'BL Freight Invoice',
    minAmount: 0,
    maxAmount: 500000,
    formattedRange: '₹0 - ₹5,00,000',
    description: 'Standard BL freight & destination charge invoice EXIM approval.',
    status: 'Active',
    priority: 100,
    conditions: {},
    version: 1,
    createdBy: 'system-bootstrap',
    activatedBy: 'system-bootstrap',
    steps: [
      { step: 1, title: 'EXIM Manager Approval', roleName: 'EXIM Manager', roleKey: 'exim-manager', statusKey: 'Pending EXIM Approval', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 24 }
    ]
  },
  {
    id: 'WF-BL-INV-HIGH-V1',
    definitionKey: 'bl_invoice_high',
    name: 'BL Freight Invoice (Above ₹5 Lakhs)',
    category: 'BL Freight Invoice',
    minAmount: 500000.01,
    maxAmount: null,
    formattedRange: 'Above ₹5,00,000',
    description: 'High-value BL invoice requiring EXIM and Finance Lead approval.',
    status: 'Active',
    priority: 100,
    conditions: {},
    version: 1,
    createdBy: 'system-bootstrap',
    activatedBy: 'system-bootstrap',
    steps: [
      { step: 1, title: 'EXIM Manager Approval', roleName: 'EXIM Manager', roleKey: 'exim-manager', statusKey: 'Pending EXIM Approval', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 24 },
      { step: 2, title: 'Finance Lead Approval', roleName: 'Finance Lead', roleKey: 'finance', statusKey: 'Pending Finance Approval', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 24 }
    ]
  }
];

export async function ensureRfqAwardWorkflows() {
  const now = new Date();
  await Promise.all(rfqAwardDefaults.map(({ id, ...defaults }) => Workflow.updateOne(
    { id },
    { $setOnInsert: { id, ...defaults, effectiveFrom: now, activatedAt: now } },
    { upsert: true }
  )));
}

export async function ensureAdvancePaymentWorkflows() {
  const now = new Date();
  await Promise.all(advancePaymentDefaults.map(({ id, ...defaults }) => Workflow.updateOne(
    { id },
    { $setOnInsert: { id, ...defaults, effectiveFrom: now, activatedAt: now } },
    { upsert: true }
  )));
  console.log('[Workflows] Advance Payment workflows ensured.');
}

export async function ensureInvoicePaymentWorkflows() {
  const now = new Date();
  await Promise.all(invoicePaymentDefaults.map(({ id, ...defaults }) => Workflow.updateOne(
    { id },
    { $setOnInsert: { id, ...defaults, effectiveFrom: now, activatedAt: now } },
    { upsert: true }
  )));
  console.log('[Workflows] Invoice Payment workflows ensured.');
}

export async function ensureBlInvoiceWorkflows() {
  const now = new Date();
  await Promise.all(blInvoiceDefaults.map(({ id, ...defaults }) => Workflow.updateOne(
    { id },
    { $setOnInsert: { id, ...defaults, effectiveFrom: now, activatedAt: now } },
    { upsert: true }
  )));
  console.log('[Workflows] BL Freight Invoice workflows ensured.');
}

export async function ensureAllWorkflows() {
  await ensureRfqAwardWorkflows();
  await ensureAdvancePaymentWorkflows();
  await ensureInvoicePaymentWorkflows();
  await ensureBlInvoiceWorkflows();
  console.log('[Workflows] All default workflows ensured.');
}
