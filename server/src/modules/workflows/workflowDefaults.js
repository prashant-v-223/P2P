import { Workflow } from '../../models/Workflow.js';

const baseSteps = [
  { step: 1, title: 'Procurement Head Approval', roleName: 'Procurement Head', roleKey: 'procurement_head', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 24 },
  { step: 2, title: 'Finance Lead Approval', roleName: 'Finance Lead', roleKey: 'finance_lead', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 24 }
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
    steps: baseSteps
  },
  {
    ...common,
    id: 'WF-RFQ-AWARD-HIGH-V1',
    definitionKey: 'rfq_vendor_award_high_value',
    name: 'RFQ Vendor Award (Above ₹1 Cr)',
    minAmount: 10000000.01,
    maxAmount: null,
    formattedRange: 'Above ₹1,00,00,000',
    description: 'High-value RFQ award approval with management authorization.',
    steps: [
      baseSteps[0],
      { step: 2, title: 'Managing Director Approval', roleName: 'Managing Director', roleKey: 'md', approverType: 'role', requiredApprovals: 1, allowSelfApproval: false, slaHours: 24 },
      { ...baseSteps[1], step: 3 }
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

