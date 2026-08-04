import express from 'express';
import mongoose from 'mongoose';
import { PurchaseOrder } from '../../models/PurchaseOrder.js';
import { InvoicePayment } from '../../models/InvoicePayment.js';
import { AdvancePayment } from '../../models/AdvancePayment.js';
import { PaymentLedger } from '../../models/PaymentLedger.js';
import { Approval } from '../../models/Approval.js';
import { Workflow } from '../../models/Workflow.js';
import { RfqHeader, RfqQuote, RfqBlEntry, CustomDutyPayment } from '../../models/RfqLogistics.js';
import { LogisticsPayment } from '../../models/LogisticsPayment.js';
import { Vendor } from '../../models/Vendor.js';
import { LogisticsProvider } from '../../models/LogisticsProvider.js';
import { CustomAgent } from '../../models/CustomAgent.js';
import { User } from '../../models/User.js';
import { broadcastEvent } from '../../services/sse.service.js';
import { sendApprovalCreatedEmails } from '../../services/notification.service.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { sendRfqInvitationEmail } from '../../services/mail.service.js';
import crypto from 'node:crypto';
import { WorkflowAudit } from '../../models/WorkflowAudit.js';
import { ensureRfqAwardWorkflows } from '../workflows/workflowDefaults.js';

const router = express.Router();

// Helper to escape regex search inputs
function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// Helper to build safe MongoDB filter matching ObjectId, custom string ID, or reference
function buildInvoiceFilter(idParam) {
  const filterOr = [
    { invoicePaymentId: idParam },
    { invoiceNumber: idParam }
  ];
  if (mongoose.Types.ObjectId.isValid(idParam)) {
    filterOr.push({ _id: idParam });
  }
  return { $or: filterOr };
}

function buildAdvanceFilter(idParam) {
  const filterOr = [
    { advanceId: idParam },
    { poId: idParam },
    { sapPoNumber: idParam }
  ];
  if (mongoose.Types.ObjectId.isValid(idParam)) {
    filterOr.push({ _id: idParam });
  }
  return { $or: filterOr };
}

const activePaymentStatuses = ['pending', 'approved', 'paid'];

function sameValue(left, right) {
  return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}

function normalizedRole(value = '') {
  return String(value).toLowerCase().replace(/[\s_-]+/g, ' ').trim();
}

function roleCanAct(userRole, requiredRole) {
  const roles = Array.isArray(userRole) ? userRole : [userRole];
  for (const r of roles) {
    const user = normalizedRole(r);
    const required = normalizedRole(requiredRole);
    if (['admin', 'system admin', 'systemadmin'].includes(user.replace(/\s+/g, ''))) return true;
    if (!user || !required) continue;
    if (required.includes('procurement') && user.includes('procurement')) return true;
    if (required.includes('finance') && user.includes('finance')) return true;
    if ((required === 'md' || required.includes('director')) && (user === 'md' || user.includes('director'))) return true;
    if (user === required || user.includes(required) || required.includes(user)) return true;
  }
  return false;
}

function getPoQuantity(po) {
  // Try to get quantity from items array first
  const itemsQuantity = (po?.items || []).reduce((total, item) => total + (Number(item.quantity) || 0), 0);
  // If items have quantity, return it; otherwise return totalQuantity if available, or 0 as default
  return itemsQuantity > 0 ? itemsQuantity : (Number(po?.totalQuantity) || 0);
}

async function validateVendorOwnsPo(req, po) {
  if (req.user?.role !== 'Vendor') return true;

  const tokenIdentifiers = [req.user.id, req.user.sapVendorCode].filter(Boolean);
  const vendor = await Vendor.findOne({
    $or: tokenIdentifiers.flatMap((value) => [
      { id: value }, { sapVendorCode: value }, { supplierId: value }
    ])
  }).lean();

  const vendorIdentifiers = new Set([
    req.user.id,
    req.user.sapVendorCode,
    vendor?.id,
    vendor?.sapVendorCode,
    vendor?.supplierId
  ].filter(Boolean).map((value) => String(value).trim().toLowerCase()));

  if (po.supplierId) {
    return vendorIdentifiers.has(String(po.supplierId).trim().toLowerCase());
  }
  return Boolean(po.supplierName && sameValue(po.supplierName, vendor?.companyName || req.user.companyName));
}

function validateOpenPo(po) {
  const status = String(po?.status || '').trim().toLowerCase();
  return Boolean(po && Number(po.totalAmount) > 0 && !['closed', 'cancelled', 'canceled', 'blocked'].includes(status));
}

function validateRfqPayload(body, { partial = false } = {}) {
  const required = ['title', 'linkedPoId', 'closingDate', 'shippingTerms', 'cargoType', 'portOfLoading', 'portOfDischarge', 'containerType'];
  if (!partial) {
    const missing = required.filter((key) => !String(body[key] || '').trim());
    if (missing.length) return `Missing required RFQ details: ${missing.join(', ')}.`;
  }
  const count = Number(body.containerCount);
  if (body.containerCount !== undefined && (!Number.isInteger(count) || count <= 0)) return 'Number of containers must be a positive whole number.';
  const weight = Number(body.weightPerContainer);
  if (body.weightPerContainer !== undefined && body.weightPerContainer !== '' && (!Number.isFinite(weight) || weight <= 0)) return 'Weight per container must be greater than zero.';
  if (body.portOfLoading && body.portOfDischarge && sameValue(body.portOfLoading, body.portOfDischarge)) return 'Port of loading and port of discharge must be different.';
  if (body.closingDate) {
    const closing = new Date(body.closingDate);
    if (Number.isNaN(closing.getTime())) return 'Enter a valid RFQ closing date and time.';
    if (closing <= new Date()) return 'RFQ closing date must be in the future.';
  }
  if (body.estimatedReadinessDate && Number.isNaN(new Date(body.estimatedReadinessDate).getTime())) return 'Enter a valid estimated readiness date.';
  if (!partial && (!Array.isArray(body.invitedVendors) || !body.invitedVendors.length)) return 'Invite at least one active Freight Forwarder.';
  return '';
}

async function nextRfqNumber() {
  const year = new Date().getFullYear();
  const latest = await RfqHeader.findOne({ rfqNumber: new RegExp(`^RFQ-${year}-`) }).sort({ rfqNumber: -1 }).select('rfqNumber').lean();
  const sequence = Math.max(0, Number(String(latest?.rfqNumber || '').split('-').pop()) || 0) + 1;
  return `RFQ-${year}-${String(sequence).padStart(4, '0')}`;
}

// ─── GET /api/p2p/workflows/preview ──────────────────────────────────────────
// Public endpoint - no authentication required for workflow preview
router.get('/workflows/preview', async (req, res) => {
  try {
    const moduleType = req.query.module || 'Advance Payment';
    const amount = Number(req.query.amount) || 0;
    const wf = await resolveWorkflowFromDB(moduleType, amount, req.query);
    return res.json({ success: true, workflow: wf });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
async function resolveWorkflowFromDB(moduleType, amount, facts = {}) {
  try {
    const workflows = await Workflow.find({
      status: { $in: ['active', 'Active'] },
      $and: [
        { $or: [{ effectiveFrom: { $exists: false } }, { effectiveFrom: { $lte: new Date() } }] },
        { $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gt: new Date() } }] }
      ]
    }).lean();

    const numAmount = Number(amount) || 0;

    // Filter workflows matching the module (e.g. 'Advance Payment')
    let categoryWfs = workflows.filter(w => {
      const name = (w.name || '').toLowerCase();
      const cat  = (w.category || '').toLowerCase();
      const mod  = (moduleType || '').toLowerCase();
      return name.includes(mod) || cat.includes(mod) || mod.includes(name) || mod.includes(cat) ||
        (mod.includes('advance') && (name.includes('advance') || cat.includes('advance'))) ||
        (mod.includes('invoice') && (name.includes('invoice') || cat.includes('invoice')));
    });

    // Older databases may not contain RFQ workflow slabs. Persist the default
    // RFQ slabs once so administrators can see, version and edit them normally.
    if (!categoryWfs.length && String(moduleType).toLowerCase().includes('rfq')) {
      await ensureRfqAwardWorkflows();
      categoryWfs = await Workflow.find({ category: 'RFQ Vendor Award', status: { $in: ['active', 'Active'] } }).lean();
    }

    // Find the exact workflow where minAmount <= numAmount <= maxAmount
    const matchedWf = categoryWfs.sort((a, b) => Number(b.priority || 100) - Number(a.priority || 100) || Number(b.version || 1) - Number(a.version || 1)).find(w => {
      const min = Number(w.minAmount) || 0;
      const max = (w.maxAmount == null || w.maxAmount === 0) ? Infinity : Number(w.maxAmount);
      const conditions = w.conditions || {};
      const supportedFacts = { module: moduleType, amount: numAmount, ...facts };
      const conditionsMatch = Object.entries(conditions).every(([key, expected]) => {
        if (!(key in supportedFacts)) return false;
        const actual = supportedFacts[key];
        if (Array.isArray(expected)) return expected.map(String).includes(String(actual));
        return sameValue(actual, expected);
      });
      return numAmount >= min && numAmount <= max && conditionsMatch;
    });

    if (matchedWf && Array.isArray(matchedWf.steps) && matchedWf.steps.length > 0) {
      return buildWorkflowResult(matchedWf, matchedWf.steps);
    }

    return getDefaultWorkflow(moduleType, numAmount);
  } catch (err) {
    console.error('[Workflow Resolution Error]', err.message);
    return getDefaultWorkflow(moduleType, amount);
  }
}

function buildWorkflowResult(wf, rawSteps) {
  const steps = rawSteps.map((s, idx) => {
    const title = s.title || s.roleName || `Step ${idx + 1}`;
    const statusKey = `Pending ${title}`;
    return {
      step:      s.step || idx + 1,
      title,
      roleName:  s.roleName || s.roleKey || title,
      roleKey:   s.roleKey  || s.roleName || title,
      statusKey  // Used as approval.status at this step
    };
  });

  return {
    workflowId:  wf._id?.toString() || wf.id,
    workflowCode: wf.id,
    workflowVersion: Number(wf.version || 1),
    slab:        wf.name || 'Standard',
    totalSteps:  steps.length,
    steps
  };
}

function getDefaultWorkflow(moduleType, amount) {
  const numAmount = Number(amount) || 0;
  const moduleName = String(moduleType || 'Payment');
  const isRfq = moduleName.toLowerCase().includes('rfq');
  const isInvoice = moduleName.toLowerCase().includes('invoice');

  if (isRfq) {
    return buildWorkflowResult({ id: 'WF-BOOTSTRAP-RFQ', name: 'RFQ Award Standard Approval', version: 1 }, [
      { step: 1, title: 'Procurement Head Approval', roleName: 'Procurement Head', roleKey: 'procurement_head' },
      { step: 2, title: 'Finance Lead Approval', roleName: 'Finance Lead', roleKey: 'finance_lead' }
    ]);
  }

  if (isInvoice) {
    return buildWorkflowResult({ id: 'WF-BOOTSTRAP-INVOICE', name: 'Invoice Payment Standard Approval', version: 1 }, [
      { step: 1, title: 'Finance Lead Approval', roleName: 'Finance Lead', roleKey: 'finance_lead' }
    ]);
  }

  if (numAmount >= 10000000) { // >= 1 Crore
    return buildWorkflowResult({ id: 'WF-DEFAULT-HIGH', name: 'Advance Payment (Above ₹1 Cr)' }, [
      { step: 1, title: 'Procurement Head Approval', roleName: 'Procurement Head', roleKey: 'procurement_head' },
      { step: 2, title: 'MD Approval',               roleName: 'MD Approval',       roleKey: 'md' },
      { step: 3, title: 'Finance Approval',          roleName: 'Finance Approval',  roleKey: 'finance_lead' }
    ]);
  }

  return buildWorkflowResult({ id: 'WF-DEFAULT-STD', name: 'Advance Payment (Up to ₹1 Cr)' }, [
    { step: 1, title: 'Procurement Head Approval', roleName: 'Procurement Head', roleKey: 'procurement_head' },
    { step: 2, title: 'Finance Lead Approval',     roleName: 'Finance Lead',     roleKey: 'finance_lead' }
  ]);
}

// Create Approval record from workflow result
async function createApprovalRecord({ referenceId, type, vendorName, amountFormatted, poRef, requestedBy, requestedById, requestId, transactionSnapshot = {}, wf }) {
  const firstStep = wf.steps[0];
  const initialStatus = firstStep?.statusKey || 'Pending Procurement Head Approval';

  const newApproval = await Approval.create({
    id:             referenceId,
    type,
    vendorName,
    amountOriginal: amountFormatted,
    amountINR:      amountFormatted,
    currency:       'INR',
    requestedBy:    requestedBy || 'Finance Team',
    currentSlab:    wf.slab,
    workflowId:     wf.workflowId,
    workflowVersion: wf.workflowVersion || 1,
    workflowSnapshot: { workflowId: wf.workflowId, workflowCode: wf.workflowCode, version: wf.workflowVersion || 1, slab: wf.slab, steps: wf.steps },
    transactionSnapshot: { ...transactionSnapshot, referenceId, type, vendorName, amount: amountFormatted, poReference: poRef },
    requestedById,
    requestId,
    poReference:    poRef || '',
    currentStep:    1,
    totalSteps:     wf.totalSteps,
    workflowSteps:  JSON.stringify(wf.steps),
    status:         initialStatus,
    submittedAt:    new Date(),
    actionHistory:  []
  });
  await WorkflowAudit.create({ eventId: `wa-${crypto.randomUUID()}`, eventType: 'APPROVAL_SUBMITTED', actorId: requestedById || requestedBy || 'system', actorName: requestedBy, entityType: type, entityId: referenceId, workflowId: wf.workflowId, workflowVersion: wf.workflowVersion || 1, step: 1, action: 'submit', previousState: { status: 'draft' }, newState: { status: initialStatus, currentStep: 1 }, requestId });

  // ── Real-time SSE: notify all connected clients of the new request ─────────
  broadcastEvent('APPROVAL_CREATED', {
    approvalId:    referenceId,
    approvalType:  type,
    amount:        amountFormatted,
    vendorName:    vendorName || '',
    requestedBy:   requestedBy || 'Finance Team',
    firstStepRole: firstStep?.roleKey  || firstStep?.roleName || '',
    firstStepTitle: firstStep?.title   || firstStep?.roleName || 'Step 1',
    totalSteps:    wf.totalSteps,
    workflowSteps: wf.steps,
  });

  // ── Email: notify first-step approvers ────────────────────────────────
  sendApprovalCreatedEmails({ approval: newApproval.toObject() });

  return newApproval;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED MASTER DATA
// ─────────────────────────────────────────────────────────────────────────────
async function seedMasterData() {
  await ensureRfqAwardWorkflows();
  const poCount = await PurchaseOrder.countDocuments();
  if (poCount === 0) {
    await PurchaseOrder.insertMany([
      {
        poNumber: 'PO-4300001510', sapPoNumber: '4300001510',
        supplierId: 'VEND-10029', supplierName: 'Jinko Solar (Vietnam) Industries Co., Ltd',
        companyCode: '1000', currency: 'INR', totalAmount: 18500000,
        advancePaid: 3700000, advanceCommitted: 3700000, amountLocked: true, status: 'open'
      },
      {
        poNumber: 'PO-4300001511', sapPoNumber: '4300001511',
        supplierId: 'VEND-10045', supplierName: 'Trina Solar Co. Ltd',
        companyCode: '1000', currency: 'INR', totalAmount: 12400000,
        advancePaid: 0, advanceCommitted: 0, amountLocked: false, status: 'open'
      },
      {
        poNumber: 'PO-4100004110', sapPoNumber: '4100004110',
        supplierId: 'VEND-10001', supplierName: 'Acute Systems & Solutions',
        companyCode: '1000', currency: 'INR', totalAmount: 43164.40,
        advancePaid: 12949.32, advanceCommitted: 12949.32, amountLocked: false, status: 'open'
      },
      {
        poNumber: 'PO-4100005459', sapPoNumber: '4100005459',
        supplierId: 'VEND-10002', supplierName: 'SWASTIK OIL AGENCIES',
        companyCode: '1000', currency: 'INR', totalAmount: 92500.00,
        advancePaid: 18500.00, advanceCommitted: 18500.00, amountLocked: false, status: 'open'
      },
      {
        poNumber: 'PO-6000001201', sapPoNumber: '6000001201',
        supplierId: 'VEND-10088', supplierName: 'LONGi Solar Technology Co. Ltd',
        companyCode: '1000', currency: 'INR', totalAmount: 24500000,
        advancePaid: 4900000, advanceCommitted: 4900000, amountLocked: true, status: 'open'
      },
      {
        poNumber: 'PO-4200001889', sapPoNumber: '4200001889',
        supplierId: '30000111', supplierName: 'CUBIK LOGISTICS COMPANY LIMITED',
        companyCode: '1000', currency: 'INR', totalAmount: 6500000,
        advancePaid: 0, advanceCommitted: 0, amountLocked: false, status: 'open'
      },
      {
        poNumber: 'PO-4200001990', sapPoNumber: '4200001990',
        supplierId: '30000111', supplierName: 'CUBIK LOGISTICS COMPANY LIMITED',
        companyCode: '1000', currency: 'INR', totalAmount: 8900000,
        advancePaid: 1780000, advanceCommitted: 1780000, amountLocked: false, status: 'open'
      }
    ]);
  }

  const advCount = await AdvancePayment.countDocuments();
  if (advCount === 0) {
    await AdvancePayment.insertMany([
      {
        advanceId: 'ADV-046153', poId: 'PO-4100004110', sapPoNumber: '4100004110',
        vendorId: 'VEND-10001', vendorName: 'Acute Systems & Solutions',
        amount: 12949.32, percentageOfPo: 30,
        gstBreakup: { cgst: 1165.44, sgst: 1165.44, igst: 0, totalGst: 2330.88 },
        paymentMode: 'RTGS', bankName: 'HDFC Bank', status: 'approved', createdBy: 'Finance Team'
      },
      {
        advanceId: 'ADV-520512', poId: 'PO-4100005459', sapPoNumber: '4100005459',
        vendorId: 'VEND-10002', vendorName: 'SWASTIK OIL AGENCIES',
        amount: 18500, percentageOfPo: 20,
        gstBreakup: { cgst: 1665, sgst: 1665, igst: 0, totalGst: 3330 },
        paymentMode: 'NEFT', bankName: 'ICICI Bank', status: 'pending', createdBy: 'Finance Team'
      },
      {
        advanceId: 'ADV-902144', poId: 'PO-4300001510', sapPoNumber: '4300001510',
        vendorId: 'VEND-10029', vendorName: 'Jinko Solar (Vietnam) Industries Co., Ltd',
        amount: 3700000, percentageOfPo: 20,
        gstBreakup: { cgst: 0, sgst: 0, igst: 666000, totalGst: 666000 },
        paymentMode: 'SWIFT', bankName: 'SBI International', status: 'paid', createdBy: 'Finance Team'
      },
      {
        advanceId: 'ADV-772109', poId: 'PO-6000001201', sapPoNumber: '6000001201',
        vendorId: 'VEND-10088', vendorName: 'LONGi Solar Technology Co. Ltd',
        amount: 4900000, percentageOfPo: 20,
        gstBreakup: { cgst: 0, sgst: 0, igst: 882000, totalGst: 882000 },
        paymentMode: 'RTGS', bankName: 'HDFC Bank', status: 'draft', createdBy: 'Finance Team'
      }
    ]);
  }
}

router.post('/seed', async (req, res) => {
  try {
    await seedMasterData();
    res.json({ success: true, message: 'P2P Master Data seeded' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PURCHASE ORDERS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/purchase-orders', authenticateToken, async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const size = Math.min(100, Math.max(1, Number.parseInt(req.query.size || req.query.pageSize, 10) || 10));
    const search = String(req.query.q || req.query.search || '').trim();
    const statusFilter = String(req.query.status || '').trim();
    const typeFilter = String(req.query.type || '').trim();

    let poCount = await PurchaseOrder.countDocuments();
    if (poCount === 0) await seedMasterData();

    const filter = {};
    if (req.user?.role === 'Vendor') {
      const vendorCode = String(req.user.sapVendorCode || '');
      const vendorName = String(req.user.companyName || '');
      filter.$and = [{
        $or: [
          ...(vendorCode ? [{ supplierId: new RegExp(`^${escapeRegex(vendorCode)}$`, 'i') }] : []),
          ...(vendorName ? [{ supplierName: new RegExp(`^${escapeRegex(vendorName)}$`, 'i') }] : [])
        ]
      }];
    }
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [
        { poNumber: regex }, { sapPoNumber: regex },
        { supplierName: regex }, { supplierId: regex }
      ];
    }
    if (statusFilter && statusFilter !== 'All Status' && statusFilter !== 'All') {
      filter.status = statusFilter.toLowerCase();
    }
    if (typeFilter && typeFilter !== 'All Types' && typeFilter !== 'All') {
      if (typeFilter === 'Import') {
        filter.$or = [
          { poNumber: /^PO-43/i }, { poNumber: /^60/ },
          { sapPoNumber: /^43/ }, { sapPoNumber: /^60/ }
        ];
      } else if (typeFilter === 'Domestic') {
        filter.$or = [
          { poNumber: /^PO-41/i }, { poNumber: /^42/ },
          { sapPoNumber: /^41/ }, { sapPoNumber: /^42/ }
        ];
      }
    }

    const total = await PurchaseOrder.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / size));
    const safePage = Math.min(page, totalPages);
    const pos = await PurchaseOrder.find(filter)
      .sort({ createdAt: -1 }).skip((safePage - 1) * size).limit(size).lean();

    const poRefs = pos.flatMap((po) => [po.poNumber, po.sapPoNumber]).filter(Boolean);
    const vendorKeys = pos.flatMap((po) => [po.supplierId, po.supplierName]).filter(Boolean);
    const [invoiceCommitments, advanceCommitments, poVendors] = await Promise.all([
      InvoicePayment.find({
        $or: [{ poId: { $in: poRefs } }, { sapPoNumber: { $in: poRefs } }],
        status: { $in: activePaymentStatuses }
      }).select('poId sapPoNumber grossAmount threeWayMatch.invoiceQuantity').lean(),
      AdvancePayment.find({
        $or: [{ poId: { $in: poRefs } }, { sapPoNumber: { $in: poRefs } }],
        status: { $in: activePaymentStatuses }
      }).select('poId sapPoNumber amount').lean(),
      vendorKeys.length ? Vendor.find({
        $or: [
          { id: { $in: vendorKeys } },
          { sapVendorCode: { $in: vendorKeys } },
          { supplierId: { $in: vendorKeys } },
          { companyName: { $in: vendorKeys } }
        ]
      }).select('id sapVendorCode supplierId companyName vendorType gstin pan').lean() : []
    ]);

    const enrichedPos = pos.map((po) => {
      const refs = new Set([po.poNumber, po.sapPoNumber].filter(Boolean).map(String));
      const matchingInvoices = invoiceCommitments.filter((item) => refs.has(String(item.poId)) || refs.has(String(item.sapPoNumber)));
      const matchingAdvances = advanceCommitments.filter((item) => refs.has(String(item.poId)) || refs.has(String(item.sapPoNumber)));
      const invoicedAmount = matchingInvoices.reduce((sum, item) => sum + (Number(item.grossAmount) || 0), 0);
      const invoicedQuantity = matchingInvoices.reduce((sum, item) => sum + (Number(item.threeWayMatch?.invoiceQuantity) || 0), 0);
      const advanceCommitted = matchingAdvances.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const totalQuantity = getPoQuantity(po);
      const vendor = poVendors.find((item) =>
        sameValue(item.id, po.supplierId) ||
        sameValue(item.sapVendorCode, po.supplierId) ||
        sameValue(item.supplierId, po.supplierId) ||
        sameValue(item.companyName, po.supplierName)
      );
      return {
        ...po,
        vendorType: vendor?.vendorType || '',
        vendorGstin: vendor?.gstin || '',
        vendorPan: vendor?.pan || '',
        invoicedAmount,
        remainingInvoiceAmount: Math.max(0, Number(po.totalAmount) - invoicedAmount),
        advanceCommitted,
        remainingAdvanceAmount: Math.max(0, Number(po.totalAmount) - advanceCommitted),
        totalQuantity,
        remainingQuantity: Math.max(0, totalQuantity - invoicedQuantity)
      };
    });

    return res.json({ success: true, data: enrichedPos, total, page: safePage, pageSize: size, totalPages,
      hasPrevious: safePage > 1, hasNext: safePage < totalPages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/purchase-orders/:id', async (req, res) => {
  try {
    const filterOr = [{ poNumber: req.params.id }, { sapPoNumber: req.params.id }];
    if (mongoose.Types.ObjectId.isValid(req.params.id)) filterOr.push({ _id: req.params.id });
    const po = await PurchaseOrder.findOne({ $or: filterOr }).lean();
    if (!po) return res.status(404).json({ success: false, error: 'Purchase order not found' });
    res.json({ success: true, data: po });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADVANCE PAYMENTS
// ─────────────────────────────────────────────────────────────────────────────
const getAdvancesHandler = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const size = Math.min(100, Math.max(1, Number.parseInt(req.query.size || req.query.pageSize, 10) || 10));
    const search = String(req.query.q || req.query.search || '').trim();
    const statusFilter = String(req.query.status || '').trim();

    let advCount = await AdvancePayment.countDocuments();
    if (advCount === 0) await seedMasterData();

    const filter = {};
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [
        { advanceId: regex }, { poId: regex }, { sapPoNumber: regex },
        { vendorName: regex }, { vendorId: regex }, { bankName: regex }, { createdBy: regex }
      ];
    }
    if (statusFilter && statusFilter !== 'All Status' && statusFilter !== 'All') {
      filter.status = statusFilter.toLowerCase();
    }

    const total = await AdvancePayment.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / size));
    const safePage = Math.min(page, totalPages);
    const advances = await AdvancePayment.find(filter)
      .sort({ createdAt: -1 }).skip((safePage - 1) * size).limit(size).lean();

    return res.json({ success: true, data: advances, total, page: safePage, pageSize: size, totalPages,
      hasPrevious: safePage > 1, hasNext: safePage < totalPages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

router.get('/advances', getAdvancesHandler);
router.get('/advance-payments', getAdvancesHandler);

const getSingleAdvanceHandler = async (req, res) => {
  try {
    const adv = await AdvancePayment.findOne(buildAdvanceFilter(req.params.id)).lean();
    if (!adv) return res.status(404).json({ success: false, error: 'Advance payment not found' });
    const approval = await Approval.findOne({ $or: [{ id: adv.advanceId }, { id: req.params.id }] }).lean();
    return res.json({ success: true, data: { ...adv, approval: approval || null } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

router.get('/advances/:id', getSingleAdvanceHandler);
router.get('/advance-payments/:id', getSingleAdvanceHandler);

// ─── POST Create Advance Payment ─────────────────────────────────────────────
const createAdvanceHandler = async (req, res) => {
  try {
    const {
      poNumber, vendorName, vendorCode, amount, percentageOfPo,
      cgst, sgst, igst, totalGst, grandTotal,
      paymentMode, bankName, bankAccountNumber, remarks, requestedBy, currency
    } = req.body;

    if (!poNumber) {
      return res.status(400).json({ success: false, error: 'PO Number is required.' });
    }
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Amount must be greater than zero.' });
    }
    if (req.user?.role === 'Vendor' && String(remarks || '').trim().length < 10) {
      return res.status(400).json({ success: false, error: 'Advance justification must contain at least 10 characters.' });
    }

    // All payment validation is based on the persisted PO, never browser totals.
    const po = await PurchaseOrder.findOne({ $or: [{ poNumber }, { sapPoNumber: poNumber }] }).lean();
    if (!po) {
      return res.status(404).json({ success: false, error: 'Purchase Order not found.' });
    }
    if (!validateOpenPo(po)) {
      return res.status(400).json({ success: false, error: `Advance requests are not allowed for a ${po.status} Purchase Order.` });
    }
    if (!(await validateVendorOwnsPo(req, po))) {
      return res.status(403).json({ success: false, error: 'This Purchase Order does not belong to the signed-in vendor.' });
    }

    const poCurrency = String(po.currency || 'INR').toUpperCase();
    const requestCurrency = String(currency || poCurrency).toUpperCase();
    if (requestCurrency !== poCurrency) {
      return res.status(400).json({ success: false, error: `Currency must match the Purchase Order (${poCurrency}). Convert the request before submitting.` });
    }

    const poRefs = [po.poNumber, po.sapPoNumber].filter(Boolean);
    const priorAdvances = await AdvancePayment.aggregate([
      { $match: { $or: [{ poId: { $in: poRefs } }, { sapPoNumber: { $in: poRefs } }], status: { $in: activePaymentStatuses } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const committedAdvance = Number(priorAdvances[0]?.total) || 0;
    const remainingAdvance = Math.max(0, Number(po.totalAmount) - committedAdvance);
    if (Number(amount) > remainingAdvance) {
      return res.status(400).json({
        success: false,
        error: `Advance amount exceeds the remaining PO balance. Available: ${poCurrency} ${remainingAdvance.toLocaleString('en-IN')}.`
      });
    }

    const vendorNameFinal = req.user?.role === 'Vendor' ? (req.user.companyName || po.supplierName) : (vendorName || po.supplierName || 'Vendor');
    const vendorIdFinal   = req.user?.role === 'Vendor' ? (req.user.sapVendorCode || po.supplierId) : (vendorCode || po.supplierId || 'VEND-00000');
    const poRef           = po?.sapPoNumber || poNumber;
    const numAmount       = Number(amount);

    const advanceId = 'ADV-' + Date.now().toString().slice(-6);

    const newAdv = await AdvancePayment.create({
      advanceId,
      poId:       po?.poNumber || poNumber,
      sapPoNumber: poRef,
      vendorId:   vendorIdFinal,
      vendorName: vendorNameFinal,
      amount:     numAmount,
      currency:   poCurrency,
      percentageOfPo: Number(percentageOfPo) || 0,
      gstBreakup: {
        cgst:     Number(cgst)     || 0,
        sgst:     Number(sgst)     || 0,
        igst:     Number(igst)     || 0,
        totalGst: Number(totalGst) || 0
      },
      paymentMode:       paymentMode       || 'NEFT',
      bankName:          bankName          || 'HDFC Bank',
      bankAccountNumber: bankAccountNumber || '',
      remarks:           remarks           || '',
      status:            'pending',
      createdBy:         requestedBy       || 'Finance Team'
    });

    // Resolve and create approval workflow
    const wf = await resolveWorkflowFromDB('Advance Payment', numAmount, { currency: poCurrency, vendorType: req.user?.vendorType, poType: po.poType || po.type });
    const amountFormatted = `₹${numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    await createApprovalRecord({
      referenceId: advanceId,
      type:        'Advance Payment',
      vendorName:  vendorNameFinal,
      amountFormatted,
      poRef,
      requestedBy: requestedBy || 'Finance Team',
      requestedById: req.user?.id || req.user?.email,
      requestId: req.headers['x-request-id'],
      transactionSnapshot: { amount: numAmount, currency: poCurrency, poId: poRef, vendorId: vendorIdFinal },
      wf
    });

    return res.json({
      success: true,
      message: 'Advance payment created and sent for approval.',
      data:    newAdv,
      workflow: wf
    });
  } catch (err) {
    console.error('[Create Advance]', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

router.post('/advances/create', authenticateToken, createAdvanceHandler);
router.post('/advance-payments/create', authenticateToken, createAdvanceHandler);

// ─── DELETE Advance Payment ───────────────────────────────────────────────────
const deleteAdvanceHandler = async (req, res) => {
  try {
    const adv = await AdvancePayment.findOne(buildAdvanceFilter(req.params.id));
    if (adv) {
      await AdvancePayment.deleteOne({ _id: adv._id });
      await Approval.deleteOne({ id: adv.advanceId }).catch(() => {});
    }
    res.json({ success: true, message: 'Advance payment deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

router.delete('/advances/:id', deleteAdvanceHandler);
router.delete('/advance-payments/:id', deleteAdvanceHandler);

// ─── PUT Update Advance Payment Status (from approval flow) ──────────────────
router.put('/advances/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['draft', 'pending', 'approved', 'rejected', 'returned', 'paid', 'adjusted'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value.' });
    }
    const adv = await AdvancePayment.findOne(buildAdvanceFilter(req.params.id));
    if (!adv) return res.status(404).json({ success: false, error: 'Advance not found' });
    adv.status = status;
    await adv.save();

    // Sync approval record
    const approval = await Approval.findOne({ id: adv.advanceId });
    if (approval) {
      if (status === 'approved') approval.status = 'Approved & Dispatched';
      else if (status === 'rejected') approval.status = 'Rejected';
      else if (status === 'returned') approval.status = 'Returned for changes';
      await approval.save();
    }
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// INVOICE PAYMENTS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/invoices', async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const size = Math.min(100, Math.max(1, Number.parseInt(req.query.size || req.query.pageSize, 10) || 10));
    const search = String(req.query.q || req.query.search || '').trim();
    const statusFilter = String(req.query.status || '').trim();
    const matchFilter = String(req.query.threeWayMatch || req.query.match || '').trim();

    // Remove old static seed invoices
    await InvoicePayment.deleteMany({ invoicePaymentId: { $in: ['INV-PAY-901', 'INV-PAY-902', 'INV-PAY-903'] } }).catch(() => {});

    const filter = {};
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [
        { invoiceNumber: regex }, { invoicePaymentId: regex },
        { poId: regex }, { sapPoNumber: regex },
        { vendorName: regex }, { vendorId: regex }
      ];
    }
    if (statusFilter && statusFilter !== 'All Status' && statusFilter !== 'All') {
      filter.status = statusFilter.toLowerCase();
    }
    if (matchFilter && matchFilter !== 'All Match' && matchFilter !== 'All') {
      filter['threeWayMatch.status'] = matchFilter.toLowerCase();
    }

    const total = await InvoicePayment.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / size));
    const safePage = Math.min(page, totalPages);
    const invoices = await InvoicePayment.find(filter)
      .sort({ createdAt: -1 }).skip((safePage - 1) * size).limit(size).lean();

    return res.json({ success: true, data: invoices, total, page: safePage, pageSize: size, totalPages,
      hasPrevious: safePage > 1, hasNext: safePage < totalPages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/invoices/:id', async (req, res) => {
  try {
    const inv = await InvoicePayment.findOne(buildInvoiceFilter(req.params.id)).lean();
    if (!inv) return res.status(404).json({ success: false, error: 'Invoice payment not found' });
    const approval = await Approval.findOne({ $or: [{ id: inv.invoicePaymentId }, { id: req.params.id }] }).lean();
    return res.json({ success: true, data: { ...inv, approval: approval || null } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST Create Invoice Payment ─────────────────────────────────────────────
router.post('/invoices/create', authenticateToken, async (req, res) => {
  try {
    const {
      poNumber, invoiceNumber, grossAmount, gstAmount, tdsAmount, tdsPercentage,
      advanceAdjusted, advanceIdAdjusted, poQuantity, grnQuantity, invoiceQuantity,
      grnNumber, remarks, approvalTo, requestedBy, vendorId, vendorName, asnNumber: requestedAsnNumber,
      invoiceDate, currency
    } = req.body;

    if (!poNumber) return res.status(400).json({ success: false, error: 'Purchase Order is required.' });
    if (req.user?.role === 'Vendor' && !String(grnNumber || '').trim()) {
      return res.status(400).json({ success: false, error: 'GRN / Delivery Note number is required.' });
    }
    if (invoiceDate && Date.parse(invoiceDate) > Date.now()) {
      return res.status(400).json({ success: false, error: 'Invoice date cannot be in the future.' });
    }
    const po = await PurchaseOrder.findOne({ $or: [{ poNumber }, { sapPoNumber: poNumber }] }).lean();
    if (!po) return res.status(404).json({ success: false, error: 'Purchase Order not found.' });
    if (!validateOpenPo(po)) {
      return res.status(400).json({ success: false, error: `Invoices are not allowed for a ${po.status} Purchase Order.` });
    }
    if (!(await validateVendorOwnsPo(req, po))) {
      return res.status(403).json({ success: false, error: 'This Purchase Order does not belong to the signed-in vendor.' });
    }

    const poCurrency = String(po.currency || 'INR').toUpperCase();
    const requestCurrency = String(currency || poCurrency).toUpperCase();
    if (requestCurrency !== poCurrency) {
      return res.status(400).json({ success: false, error: `Invoice currency must match the Purchase Order (${poCurrency}). Convert the invoice before submitting.` });
    }

    const vendorNameFinal = req.user?.role === 'Vendor' ? (req.user.companyName || po.supplierName) : (vendorName || requestedBy || po.supplierName || 'Vendor');
    const vendorIdFinal   = req.user?.role === 'Vendor' ? (req.user.sapVendorCode || po.supplierId) : (vendorId || po.supplierId || 'VEND-00000');
    const poRef           = po?.sapPoNumber  || poNumber || '4300001510';

    const numGross   = Number(grossAmount)   || 0;
    const numGst     = Number(gstAmount)     || 0;
    const tdsRate    = Number.parseFloat(tdsPercentage) || 0;
    const numTds     = tdsAmount == null ? (numGross * tdsRate / 100) : (Number(tdsAmount) || 0);
    const numAdv     = Number(advanceAdjusted) || 0;
    if (numGross <= 0) return res.status(400).json({ success: false, error: 'Invoice amount must be greater than zero.' });
    if ([numGst, numTds, numAdv].some((value) => value < 0) || tdsRate < 0 || tdsRate > 100) {
      return res.status(400).json({ success: false, error: 'GST, TDS, and advance adjustment cannot be negative.' });
    }

    const poRefs = [po.poNumber, po.sapPoNumber].filter(Boolean);
    const priorInvoices = await InvoicePayment.aggregate([
      { $match: { $or: [{ poId: { $in: poRefs } }, { sapPoNumber: { $in: poRefs } }], status: { $in: activePaymentStatuses } } },
      { $group: { _id: null, amount: { $sum: '$grossAmount' }, quantity: { $sum: '$threeWayMatch.invoiceQuantity' }, advanceAdjusted: { $sum: '$advanceAdjusted' } } }
    ]);
    const committedInvoiceAmount = Number(priorInvoices[0]?.amount) || 0;
    const remainingInvoiceAmount = Math.max(0, Number(po.totalAmount) - committedInvoiceAmount);
    if (numGross > remainingInvoiceAmount) {
      return res.status(400).json({
        success: false,
        error: `Invoice amount exceeds the remaining PO balance. Available: ${poCurrency} ${remainingInvoiceAmount.toLocaleString('en-IN')}.`
      });
    }

    const poQty = getPoQuantity(po);
    const invQty = invoiceQuantity ? Number(invoiceQuantity) : 0;
    if (!Number.isFinite(invQty) || invQty < 0) {
      return res.status(400).json({ success: false, error: 'Invoice quantity must be a valid number.' });
    }
    if (poQty > 0 && invQty <= 0) {
      return res.status(400).json({ success: false, error: 'Invoice quantity is required and must be greater than zero.' });
    }
    const committedQuantity = Number(priorInvoices[0]?.quantity) || 0;
    const remainingQuantity = Math.max(0, poQty - committedQuantity);
    if (poQty > 0 && invQty > remainingQuantity) {
      return res.status(400).json({ success: false, error: `Invoice quantity exceeds the remaining PO quantity. Available: ${remainingQuantity}.` });
    }

    if (numAdv > 0) {
      const availableAdvances = await AdvancePayment.aggregate([
        { $match: { $or: [{ poId: { $in: poRefs } }, { sapPoNumber: { $in: poRefs } }], status: { $in: ['approved', 'paid'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const availableToAdjust = Math.max(0, (Number(availableAdvances[0]?.total) || 0) - (Number(priorInvoices[0]?.advanceAdjusted) || 0));
      if (numAdv > availableToAdjust || numAdv > numGross + numGst) {
        return res.status(400).json({ success: false, error: `Advance adjustment exceeds the available amount (${poCurrency} ${availableToAdjust.toLocaleString('en-IN')}).` });
      }
    }
    const netPayable = Math.max(0, numGross + numGst - numTds - numAdv);

    // Unique invoice number handling
    let finalInvoiceNumber = String(invoiceNumber || '').trim();
    if (!finalInvoiceNumber) {
      finalInvoiceNumber = 'INV-' + new Date().getFullYear() + '-' + Math.floor(100000 + Math.random() * 900000);
    }
    const existingInv = await InvoicePayment.findOne({ invoiceNumber: finalInvoiceNumber, vendorId: vendorIdFinal });
    if (existingInv) {
      return res.status(409).json({ success: false, error: 'This invoice number has already been submitted.' });
    }

    const invPaymentId = 'INV-PAY-' + Date.now().toString().slice(-6);

    // Check if vendor is Import type - only then generate ASN number
    const vendor = await Vendor.findOne({
      $or: [
        { id: vendorIdFinal },
        { sapVendorCode: vendorIdFinal },
        { supplierId: vendorIdFinal }
      ]
    }).lean();

    const isImportVendor = String(vendor?.vendorType || '').toLowerCase().includes('import');

    // Generate ASN number ONLY for Import vendors
    const asnNumber = isImportVendor
      ? (String(requestedAsnNumber || '').trim() || `ASN-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`)
      : '';

    const grnQty = grnQuantity && Number(grnQuantity) > 0 ? Number(grnQuantity) : (invQty > 0 ? invQty : poQty);
    const isMatched = (poQty === grnQty) && (grnQty === invQty);

    const newInvoice = await InvoicePayment.create({
      invoicePaymentId: invPaymentId,
      poId:             po?.poNumber || poNumber || 'PO-4300001510',
      sapPoNumber:      poRef,
      vendorId:         vendorIdFinal,
      vendorName:       vendorNameFinal,
      invoiceNumber:    finalInvoiceNumber,
      asnNumber:        asnNumber,
      invoiceDate:      invoiceDate && !Number.isNaN(Date.parse(invoiceDate)) ? new Date(invoiceDate) : new Date(),
      grossAmount:      numGross,
      currency:         poCurrency,
      gstAmount:        numGst,
      tdsAmount:        numTds,
      tdsPercentage:    tdsRate,
      advanceAdjusted:  numAdv,
      advanceIdAdjusted: advanceIdAdjusted || '',
      grnNumber:        grnNumber  || '',
      remarks:          remarks    || '',
      approvalTo:       approvalTo || '',
      netPayable,
      threeWayMatch: {
        status:          isMatched ? 'matched' : 'mismatch',
        poQuantity:      poQty,
        grnQuantity:     grnQty,
        invoiceQuantity: invQty,
        varianceAmount:  isMatched ? 0 : Math.max(0, Math.abs((Number.isFinite(invQty) ? invQty : 0) - (Number.isFinite(grnQty) ? grnQty : 0))),
        matchedAt:       new Date()
      },
      status:    'pending',
      createdBy: requestedBy || 'Finance Team'
    });

    // Workflow & Approval queue creation
    const wf = await resolveWorkflowFromDB('Invoice Payment', netPayable, { currency: poCurrency, vendorType: vendor?.vendorType, poType: po.poType || po.type });
    const amountFormatted = `₹${netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    await createApprovalRecord({
      referenceId:    invPaymentId,
      type:           'Invoice Payment',
      vendorName:     vendorNameFinal,
      amountFormatted,
      poRef,
      requestedBy:    requestedBy || 'Finance Team',
      requestedById:  req.user?.id || req.user?.email,
      requestId: req.headers['x-request-id'],
      transactionSnapshot: { netPayable, grossAmount: numGross, currency: poCurrency, poId: poRef, vendorId: vendorIdFinal, invoiceNumber: finalInvoiceNumber },
      wf
    });

    return res.json({ success: true, data: newInvoice, workflow: wf });
  } catch (err) {
    console.error('[Create Invoice]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT Update Invoice ───────────────────────────────────────────────────────
router.put('/invoices/:id', async (req, res) => {
  try {
    const invoice = await InvoicePayment.findOne(buildInvoiceFilter(req.params.id));
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice payment not found' });

    const { poNumber, invoiceNumber, grossAmount, gstAmount, tdsAmount,
            tdsPercentage, advanceAdjusted, grnNumber, remarks, approvalTo, asnNumber } = req.body;

    if (invoiceNumber)      invoice.invoiceNumber    = invoiceNumber.trim();
    if (asnNumber !== undefined) invoice.asnNumber = asnNumber.trim();
    if (grossAmount !== undefined) invoice.grossAmount = Number(grossAmount);
    if (gstAmount !== undefined)   invoice.gstAmount   = Number(gstAmount);
    if (tdsAmount !== undefined)   invoice.tdsAmount   = Number(tdsAmount);
    if (tdsPercentage !== undefined) invoice.tdsPercentage = Number(tdsPercentage);
    if (advanceAdjusted !== undefined) invoice.advanceAdjusted = Number(advanceAdjusted);
    if (grnNumber !== undefined) invoice.grnNumber = grnNumber.trim();
    if (remarks !== undefined)   invoice.remarks   = remarks.trim();
    if (approvalTo !== undefined) invoice.approvalTo = approvalTo;

    invoice.netPayable = Math.max(0,
      (invoice.grossAmount || 0) + (invoice.gstAmount || 0)
      - (invoice.tdsAmount || 0) - (invoice.advanceAdjusted || 0)
    );

    await invoice.save();
    return res.json({ success: true, data: invoice });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT Update Invoice Status ────────────────────────────────────────────────
router.put('/invoices/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['draft', 'pending', 'approved', 'rejected', 'returned', 'paid'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value.' });
    }

    const invoice = await InvoicePayment.findOne(buildInvoiceFilter(req.params.id));
    if (invoice) {
      invoice.status = status;
      await invoice.save();

      const approval = await Approval.findOne({
        $or: [{ id: invoice.invoicePaymentId }, { id: req.params.id }]
      });
      if (approval) {
        if (status === 'approved')  approval.status = 'Approved & Dispatched';
        else if (status === 'rejected') approval.status = 'Rejected';
        else if (status === 'returned') approval.status = 'Returned for changes';
        else if (status === 'pending') {
          // Move to next step
          let wfSteps = [];
          try { wfSteps = JSON.parse(approval.workflowSteps || '[]'); } catch (_) {}
          const nextStepObj = wfSteps.find(s => s.step === 2);
          approval.status = nextStepObj?.statusKey || 'Pending Finance Lead Approval';
          approval.currentStep = 2;
        }
        await approval.save();
      }
    }

    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST Record Invoice Payout ───────────────────────────────────────────────
router.post('/invoices/:id/payout', async (req, res) => {
  try {
    const { utrNumber, paymentMode } = req.body;
    if (!utrNumber?.trim()) {
      return res.status(400).json({ success: false, error: 'UTR number is required.' });
    }

    const invoice = await InvoicePayment.findOne(buildInvoiceFilter(req.params.id));
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice payment not found' });

    invoice.utrNumber = utrNumber.trim();
    invoice.status    = 'paid';
    invoice.paidAt    = new Date();
    await invoice.save();

    const approval = await Approval.findOne({
      $or: [{ id: invoice.invoicePaymentId }, { id: req.params.id }]
    });
    if (approval) {
      approval.status = 'Approved & Dispatched';
      await approval.save();
    }

    await PaymentLedger.create({
      ledgerId:    'LEDGER-' + Date.now().toString().slice(-6),
      moduleType:  'InvoicePayment',
      referenceId: invoice.invoicePaymentId,
      poReference: invoice.sapPoNumber || invoice.poId,
      vendorName:  invoice.vendorName,
      amount:      invoice.netPayable,
      currency:    'INR',
      paymentMode: paymentMode || 'NEFT',
      utrNumber:   utrNumber.trim(),
      status:      'completed',
      processedAt: new Date()
    }).catch(e => console.error('[Ledger error]', e.message));

    return res.json({ success: true, message: 'Payout recorded successfully', data: invoice });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE Invoice Payment ───────────────────────────────────────────────────
router.delete('/invoices/:id', async (req, res) => {
  try {
    const inv = await InvoicePayment.findOne(buildInvoiceFilter(req.params.id));
    if (inv) {
      await InvoicePayment.deleteOne({ _id: inv._id });
      await Approval.deleteOne({ id: inv.invoicePaymentId }).catch(() => {});
    }
    res.json({ success: true, message: 'Invoice payment deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/p2p/rfqs ────────────────────────────────────────────────────────
router.get('/rfqs', authenticateToken, async (req, res) => {
  try {
    const search = String(req.query.q || req.query.search || '').trim();
    const statusFilter = String(req.query.status || '').trim();

    const filter = {};
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ rfqNumber: rx }, { title: rx }, { poId: rx }, { sapPoNumber: rx }];
    }
    if (statusFilter && statusFilter !== 'All Status' && statusFilter !== 'All') {
      if (statusFilter.toLowerCase() === 'expired') {
        filter.closingDate = { $lt: new Date() };
        filter.status = 'published';
      } else filter.status = statusFilter.toLowerCase().replace(/\s+/g, '_');
    }

    const rfqs = await RfqHeader.find(filter).sort({ createdAt: -1 }).lean();

    const enriched = await Promise.all(
      rfqs.map(async (r) => {
        const quoteCount = await RfqQuote.countDocuments({ rfqId: r.rfqId });
        const invitedCount = (r.invitedVendors && Array.isArray(r.invitedVendors)) ? r.invitedVendors.length : 0;
        return {
          ...r,
          closingDateFormatted: r.closingDate ? new Date(r.closingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not set',
          deadlinePassed: Boolean(r.closingDate && new Date(r.closingDate) < new Date()),
          invitedVendorsCount: invitedCount,
          quotesCount: quoteCount
        };
      })
    );

    return res.json({ success: true, data: enriched });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── LOGISTICS PROVIDERS CRUD API ───────────────────────────────────────────

// GET all logistics providers
router.get('/logistics-providers', async (req, res) => {
  try {
    let providers = await LogisticsProvider.find().sort({ createdAt: -1 }).lean().catch(() => []);
    
    // Fallback/sync from Vendor collection if empty
    if (providers.length === 0) {
      const dbVendors = await Vendor.find({
        $or: [
          { category: { $in: ['Logistics', 'Freight Forwarder', 'Shipping Line'] } },
          { vendorType: { $in: ['Freight Forwarder', 'Shipping Line', 'Logistics Provider'] } }
        ]
      }).lean().catch(() => []);

      if (dbVendors.length > 0) {
        providers = dbVendors.map(v => ({
          providerId: v.sapVendorCode || v.supplierId || v.id,
          name: v.companyName,
          serviceType: v.vendorType || 'Freight Forwarder',
          contactPerson: v.contactPerson || '—',
          phone: v.phone || '—',
          email: v.email || '—',
          status: v.status || 'Active',
          gstin: v.gstin || '',
          pan: v.pan || '',
          bankName: v.bankName || '',
          bankBranch: v.branch || '',
          accountNumber: v.accountNumber || '',
          ifscCode: v.ifscCode || '',
          paymentsCount: 0
        }));
      } else {
        providers = [
          { providerId: '20000215', name: 'Aquair International Freight Forwarders', serviceType: 'Freight Forwarder', contactPerson: 'Customs Manager', email: 'customs@aquairintl.com', phone: '+91 22 2345 6789', status: 'Active', paymentsCount: 0 },
          { providerId: '10002355', name: 'Babaji Shivram Clearing & Carriers', serviceType: 'Freight Forwarder', contactPerson: 'Clearing Manager', email: 'clearing@babajishivram.in', phone: '+91 99 8877 6655', status: 'Active', paymentsCount: 0 },
          { providerId: '11001450', name: 'Fairwinds Shipping Private Limited', serviceType: 'Shipping Line', contactPerson: 'Shipping Manager', email: 'ops@fairwindsshipping.com', phone: '+91 22 4455 6677', status: 'Active', paymentsCount: 0 },
          { providerId: '11001810', name: 'Fast Forward Logistics India', serviceType: 'Freight Forwarder', contactPerson: 'Magnesh Phapale', email: 'magnesh@fflindia.com', phone: '+91 98765 43210', status: 'Active', paymentsCount: 0 },
          { providerId: '11001148', name: 'Gef Global Logistics Pvt Ltd', serviceType: 'Freight Forwarder', contactPerson: 'Operations Head', email: 'ops@gefglobal.com', phone: '+91 22 3344 5566', status: 'Active', paymentsCount: 0 },
          { providerId: '50000131', name: 'Globiiz Synergy Private Limited', serviceType: 'Freight Forwarder', contactPerson: 'Freight Manager', email: 'freight@globiiz.com', phone: '+91 22 5566 7788', status: 'Active', paymentsCount: 0 }
        ];
      }
    }

    return res.json({ success: true, count: providers.length, providers });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET single logistics provider
router.get('/logistics-providers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let provider = await LogisticsProvider.findOne({
      $or: [{ providerId: id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }]
    }).lean();

    if (!provider) {
      const v = await Vendor.findOne({
        $or: [{ sapVendorCode: id }, { supplierId: id }, { id }]
      }).lean();
      if (v) {
        provider = {
          providerId: v.sapVendorCode || v.supplierId || v.id,
          name: v.companyName,
          serviceType: v.vendorType || 'Freight Forwarder',
          contactPerson: v.contactPerson || '',
          phone: v.phone || '',
          email: v.email || '',
          status: v.status || 'Active',
          gstin: v.gstin || '',
          pan: v.pan || '',
          bankName: v.bankName || '',
          bankBranch: v.branch || '',
          accountNumber: v.accountNumber || '',
          ifscCode: v.ifscCode || ''
        };
      }
    }

    if (!provider) {
      return res.status(404).json({ success: false, error: 'Provider not found.' });
    }

    return res.json({ success: true, provider });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST create logistics provider
router.post('/logistics-providers', async (req, res) => {
  try {
    const {
      name, companyName, contactPerson, phone, email, status,
      gstin, pan, bankName, bankBranch, accountNumber, ifscCode, serviceType
    } = req.body;

    const finalName = name || companyName;
    if (!finalName) {
      return res.status(400).json({ success: false, error: 'Company Name is required.' });
    }

    const providerId = `LP-${Date.now().toString().slice(-6)}`;
    const newProvider = await LogisticsProvider.create({
      providerId,
      name: finalName,
      contactPerson: contactPerson || '',
      phone: phone || '',
      email: email || '',
      status: status || 'Active',
      serviceType: serviceType || 'Freight Forwarder',
      gstin: gstin || '',
      pan: pan || '',
      bankName: bankName || '',
      bankBranch: bankBranch || '',
      accountNumber: accountNumber || '',
      ifscCode: ifscCode || '',
      paymentsCount: 0
    });

    return res.status(201).json({ success: true, message: 'Provider created successfully', provider: newProvider });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update logistics provider
router.put('/logistics-providers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    delete updates.providerId;

    const updated = await LogisticsProvider.findOneAndUpdate(
      { $or: [{ providerId: id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }] },
      updates,
      { new: true, upsert: true }
    );

    return res.json({ success: true, message: 'Provider updated successfully', provider: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE logistics provider
router.delete('/logistics-providers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await LogisticsProvider.findOneAndDelete({
      $or: [{ providerId: id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }]
    });

    return res.json({ success: true, message: 'Provider deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});


// ─── GET Freight Forwarders / Shipping Lines Vendor List ──────────────────────
router.get('/rfqs/logistics-vendors', authenticateToken, async (req, res) => {
  try {
    // Strictly query only vendors explicitly marked as Freight Forwarder or Logistics category
    const realVendors = await Vendor.find({
      $or: [
        { category: { $in: ['Logistics', 'Freight Forwarder', 'Shipping Line'] } },
        { vendorType: { $in: ['Freight Forwarder', 'Shipping Line', 'Logistics Provider'] } }
      ],
      status: 'Active'
    }).lean().catch(() => []);

    if (realVendors.length > 0) {
      return res.json({
        success: true,
        data: realVendors.map(v => ({
          id: v.id || v._id,
          sapVendorCode: v.sapVendorCode || v.supplierId,
          companyName: v.companyName,
          vendorType: v.vendorType || 'Freight Forwarder',
          category: v.category || 'Logistics'
        }))
      });
    }

    return res.json({ success: true, data: [], message: 'No active Freight Forwarder vendors are configured.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});


// ─── POST Create RFQ ─────────────────────────────────────────────────────────
// Generate a controlled test case from real PO and vendor master data. It stops
// at Published so every later transition is tested through the normal workflow.
router.post('/rfqs/demo-workflow', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role === 'Vendor') return res.status(403).json({ success: false, error: 'Only procurement users can create RFQ test workflows.' });
    const poCandidates = await PurchaseOrder.find().sort({ createdAt: -1 }).limit(50).lean();
    const po = poCandidates.find(validateOpenPo);
    if (!po) return res.status(409).json({ success: false, error: 'Create or sync an open purchase order before generating an RFQ workflow.' });
    const vendors = await Vendor.find({ status: 'Active', $or: [{ category: { $in: ['Logistics', 'Freight Forwarder', 'Shipping Line'] } }, { vendorType: { $in: ['Freight Forwarder', 'Shipping Line', 'Logistics Provider'] } }] }).limit(3).lean();
    if (!vendors.length) return res.status(409).json({ success: false, error: 'Create at least one active Freight Forwarder before generating an RFQ workflow.' });
    const rfqNumber = await nextRfqNumber();
    const poNumber = po.poId || po.sapPoNumber || po.poNumber;
    const containerCount = 5;
    const rfq = await RfqHeader.create({ rfqId: rfqNumber, rfqNumber, title: `Freight sourcing test — ${poNumber}`, poId: poNumber, sapPoNumber: poNumber, description: 'Controlled RFQ workflow test: quotation, full award allocation, BL, EXIM, customs clearance, and logistics invoice.', cargoDetails: { shippingTerms: 'FOB', cargoType: 'SOLAR MATERIAL', containerType: '40 HC', containerCount, portOfOrigin: 'SHANGHAI', portOfDestination: 'NHAVA SHEVA', weightPerContainer: 24, estimatedReadinessDate: new Date(Date.now() + 3 * 86400000) }, invitedVendors: vendors.map((vendor) => ({ vendorId: vendor.id || String(vendor._id), sapVendorCode: vendor.sapVendorCode || vendor.supplierId, companyName: vendor.companyName })), closingDate: new Date(Date.now() + 7 * 86400000), status: 'published', totalQuantity: containerCount, allocatedQuantity: 0, pendingAllocation: containerCount, isDemoWorkflow: true, createdBy: req.user?.id || req.user?.email });
    broadcastEvent('RFQ_INVITED', { rfqId: rfq.rfqId, rfqNumber: rfq.rfqNumber, title: rfq.title, closingDate: rfq.closingDate, vendorIds: vendors.flatMap((vendor) => [vendor.id, vendor.sapVendorCode]).filter(Boolean), demo: true });
    return res.status(201).json({ success: true, message: 'RFQ test workflow created without sending email.', data: rfq, nextStep: 'Sign in as an invited Freight Forwarder and submit a quotation.' });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.post('/rfqs', authenticateToken, async (req, res) => {
  try {
    const {
      title, linkedPoId, closingDate, description,
      shippingTerms, cargoType, portOfLoading, portOfDischarge,
      containerType, containerCount, weightPerContainer, estimatedReadinessDate,
      invitedVendors
    } = req.body;

    const validationError = validateRfqPayload(req.body);
    if (validationError) return res.status(400).json({ success: false, error: validationError });
    const po = await PurchaseOrder.findOne({ $or: [{ poId: linkedPoId }, { sapPoNumber: linkedPoId }, { poNumber: linkedPoId }] }).lean();
    if (!validateOpenPo(po)) return res.status(400).json({ success: false, error: 'Linked purchase order does not exist or is not open.' });
    const vendorKeys = invitedVendors.flatMap((vendor) => [vendor.vendorId, vendor.sapVendorCode]).filter(Boolean);
    const activeVendorCount = await Vendor.countDocuments({ status: 'Active', $or: [{ id: { $in: vendorKeys } }, { sapVendorCode: { $in: vendorKeys } }, { supplierId: { $in: vendorKeys } }] });
    if (activeVendorCount !== new Set(vendorKeys.map(String)).size && activeVendorCount < invitedVendors.length) return res.status(400).json({ success: false, error: 'One or more invited Freight Forwarders are invalid or inactive.' });
    const rfqNumber = await nextRfqNumber();

    const newRfq = await RfqHeader.create({
      rfqId: rfqNumber,
      rfqNumber,
      title: title.trim(),
      poId: linkedPoId,
      sapPoNumber: linkedPoId,
      description: String(description || '').trim(),
      cargoDetails: {
        containerType,
        containerCount: Number(containerCount),
        portOfOrigin: portOfLoading,
        portOfDestination: portOfDischarge,
        cargoType: cargoType,
        shippingTerms,
        weightPerContainer: weightPerContainer === '' ? undefined : Number(weightPerContainer),
        estimatedReadinessDate: estimatedReadinessDate || undefined
      },
      totalQuantity: Number(containerCount) || 1,
      allocatedQuantity: 0,
      pendingAllocation: Number(containerCount) || 1,
      closingDate: new Date(closingDate),
      status: 'published',
      invitedVendors: Array.isArray(invitedVendors) ? invitedVendors : []
    });

    const inviteKeys = (newRfq.invitedVendors || []).flatMap((vendor) => [vendor.vendorId, vendor.sapVendorCode]).filter(Boolean);
    const invitedVendorDocs = inviteKeys.length ? await Vendor.find({
      $or: [{ id: { $in: inviteKeys } }, { sapVendorCode: { $in: inviteKeys } }, { supplierId: { $in: inviteKeys } }]
    }).select('id sapVendorCode supplierId companyName email').lean() : [];

    broadcastEvent('RFQ_INVITED', {
      rfqId: newRfq.rfqId,
      rfqNumber: newRfq.rfqNumber,
      title: newRfq.title,
      closingDate: newRfq.closingDate,
      vendorIds: inviteKeys
    });
    Promise.allSettled(invitedVendorDocs.filter((vendor) => vendor.email).map((vendor) =>
      sendRfqInvitationEmail({
        to: vendor.email,
        vendorName: vendor.companyName,
        rfqNumber: newRfq.rfqNumber,
        title: newRfq.title,
        closingDate: newRfq.closingDate
      })
    )).catch(() => {});

    return res.status(201).json({ success: true, data: newRfq });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET Single RFQ Details ──────────────────────────────────────────────────
async function getFreightVendorFromRequest(req) {
  const keys = [req.user?.id, req.user?.sapVendorCode].filter(Boolean);
  if (!keys.length || req.user?.role !== 'Vendor') return null;
  const freightType = /(freight|forwarder|logistics|shipping)/i;
  // A vendor code can exist in legacy/imported duplicate records. Select the
  // newest matching Freight Forwarder record, consistent with vendor login.
  return Vendor.findOne({
    $and: [
      { $or: keys.flatMap((key) => [{ id: key }, { sapVendorCode: key }, { supplierId: key }]) },
      { $or: [{ vendorType: freightType }, { category: freightType }] }
    ]
  }).sort({ updatedAt: -1 }).lean();
}

function normaliseInviteValue(value) {
  return String(value || '').trim().toLowerCase();
}

function isFreightVendorInvited(rfq, vendor) {
  const vendorKeys = new Set([
    vendor.id, vendor.sapVendorCode, vendor.supplierId, vendor.companyName
  ].map(normaliseInviteValue).filter(Boolean));
  const invitationValues = [
    ...(Array.isArray(rfq.invitedVendorIds) ? rfq.invitedVendorIds : []),
    ...(Array.isArray(rfq.invitedVendors) ? rfq.invitedVendors.flatMap((invite) => {
      if (typeof invite === 'string' || typeof invite === 'number') return [invite];
      return [invite?.vendorId, invite?.sapVendorCode, invite?.supplierId, invite?.id, invite?.companyName];
    }) : [])
  ];
  return invitationValues.some((value) => vendorKeys.has(normaliseInviteValue(value)));
}

function freightVendorKeys(vendor) {
  return [vendor?.id, vendor?.sapVendorCode, vendor?.supplierId, vendor?.companyName]
    .map(normaliseInviteValue).filter(Boolean);
}

function getVendorAward(rfq, vendor) {
  const keys = new Set(freightVendorKeys(vendor));
  const allocations = Array.isArray(rfq.awardAllocations) ? rfq.awardAllocations : [];
  const allocation = allocations.find((item) =>
    [item.vendorId, item.vendorCode, item.vendorName].map(normaliseInviteValue).some((key) => keys.has(key))
  );
  if (allocation) return { ...allocation, containers: Number(allocation.containers) || 0 };
  const legacyMatch = [rfq.awardedVendorId, rfq.awardedVendorName]
    .map(normaliseInviteValue).some((key) => keys.has(key));
  if (!legacyMatch) return null;
  return {
    vendorId: rfq.awardedVendorId,
    vendorName: rfq.awardedVendorName,
    containers: Number(rfq.allocatedQuantity) || Number(rfq.cargoDetails?.containerCount) || Number(rfq.totalQuantity) || 0
  };
}

async function getRfqAwardApproval(rfq) {
  if (!rfq.awardApprovalId) return { required: false, approved: true, approval: null };
  const approval = await Approval.findOne({ id: rfq.awardApprovalId }).lean();
  return {
    required: true,
    approved: approval?.status === 'Approved & Dispatched',
    approval
  };
}

async function resolveVendorAwardedRfq(req) {
  const vendor = await getFreightVendorFromRequest(req);
  if (!vendor) return { error: 'Freight Forwarder access is required.', status: 403 };
  const rfq = await RfqHeader.findOne({ $or: [{ rfqId: req.params.id }, { rfqNumber: req.params.id }] });
  if (!rfq || !isFreightVendorInvited(rfq.toObject(), vendor)) return { error: 'Assigned RFQ not found.', status: 404 };
  const awardApproval = await getRfqAwardApproval(rfq.toObject());
  const allocation = getVendorAward(rfq.toObject(), vendor);
  if (!awardApproval.approved) {
    return { error: `Bill of Lading access is locked until the RFQ award approval is completed. Current approval status: ${awardApproval.approval?.status || 'Pending'}.`, status: 403 };
  }
  if (String(rfq.status).toLowerCase() !== 'awarded' || !allocation) {
    return { error: 'Only a fully approved awarded vendor can manage Bill of Lading entries.', status: 403 };
  }
  return { vendor, rfq, allocation };
}

function isRfqClosed(closingDate) {
  if (!closingDate) return false;
  const deadline = new Date(closingDate);
  // Admin RFQ forms select a calendar date. A stored midnight timestamp means
  // the RFQ remains available until the end of that calendar day.
  const isUtcMidnight = deadline.getUTCHours() === 0 && deadline.getUTCMinutes() === 0 && deadline.getUTCSeconds() === 0;
  const isLocalMidnight = deadline.getHours() === 0 && deadline.getMinutes() === 0 && deadline.getSeconds() === 0;
  if (isLocalMidnight) {
    deadline.setHours(23, 59, 59, 999);
  } else if (isUtcMidnight) {
    deadline.setUTCHours(23, 59, 59, 999);
  }
  return deadline < new Date();
}

router.get('/vendor-rfqs', authenticateToken, async (req, res) => {
  try {
    const vendor = await getFreightVendorFromRequest(req);
    if (!vendor) return res.status(403).json({ success: false, error: 'Freight Forwarder access is required.' });
    // Invitations created by older screens used strings/legacy IDs while newer
    // records use structured objects. Filter after loading so both shapes work.
    const rfqs = (await RfqHeader.find({}).sort({ createdAt: -1 }).lean())
      .filter((rfq) => isFreightVendorInvited(rfq, vendor));
    const ids = [vendor.id, vendor.sapVendorCode, vendor.supplierId].filter(Boolean);
    const quotes = await RfqQuote.find({ vendorId: { $in: ids } }).lean();
    const approvalIds = rfqs.map((rfq) => rfq.awardApprovalId).filter(Boolean);
    const approvals = approvalIds.length ? await Approval.find({ id: { $in: approvalIds } }).select('id status').lean() : [];
    const approvalById = new Map(approvals.map((approval) => [approval.id, approval]));
    return res.json({ success: true, data: rfqs.map((rfq) => {
      const approval = rfq.awardApprovalId ? approvalById.get(rfq.awardApprovalId) : null;
      const approvalPending = Boolean(rfq.awardApprovalId && approval?.status !== 'Approved & Dispatched');
      return { ...rfq, status: approvalPending ? 'pending_approval' : rfq.status, awardApprovalStatus: approval?.status || null, myQuote: quotes.find((q) => q.rfqId === rfq.rfqId) || null };
    }) });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.get('/vendor-rfqs/:id', authenticateToken, async (req, res) => {
  try {
    const vendor = await getFreightVendorFromRequest(req);
    if (!vendor) return res.status(403).json({ success: false, error: 'Freight Forwarder access is required.' });
    const rfq = await RfqHeader.findOne({ $or: [{ rfqId: req.params.id }, { rfqNumber: req.params.id }] }).lean();
    if (!rfq || !isFreightVendorInvited(rfq, vendor)) return res.status(404).json({ success: false, error: 'Assigned RFQ not found.' });
    const ids = [vendor.id, vendor.sapVendorCode, vendor.supplierId].filter(Boolean);
    const myQuote = await RfqQuote.findOne({ rfqId: rfq.rfqId, vendorId: { $in: ids } }).lean();
    const awardApproval = await getRfqAwardApproval(rfq);
    const allocation = getVendorAward(rfq, vendor);
    const awardReady = String(rfq.status).toLowerCase() === 'awarded' && awardApproval.approved;
    return res.json({ success: true, data: { ...rfq, status: awardApproval.required && !awardApproval.approved ? 'pending_approval' : rfq.status, myQuote, myAllocation: awardReady ? allocation : null, awardPending: Boolean(allocation && !awardReady), awardApprovalStatus: awardApproval.approval?.status || null } });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.post('/vendor-rfqs/:id/quote', authenticateToken, async (req, res) => {
  try {
    const vendor = await getFreightVendorFromRequest(req);
    if (!vendor) return res.status(403).json({ success: false, error: 'Freight Forwarder access is required.' });
    const rfq = await RfqHeader.findOne({ $or: [{ rfqId: req.params.id }, { rfqNumber: req.params.id }] });
    if (!rfq || !isFreightVendorInvited(rfq.toObject(), vendor)) return res.status(404).json({ success: false, error: 'Assigned RFQ not found.' });
    if (String(rfq.status).toLowerCase() !== 'published' || isRfqClosed(rfq.closingDate)) {
      return res.status(400).json({ success: false, error: 'This RFQ is not open for quotations.' });
    }
    const ocean = Number(req.body.oceanFreightUsd);
    const shipping = Number(req.body.stChargesInr);
    const other = Number(req.body.otherChargesInr) || 0;
    const transitDays = Number(req.body.transitDays);
    if (!String(req.body.shippingLine || '').trim() || ocean <= 0 || shipping < 0 || other < 0 || transitDays <= 0) {
      return res.status(400).json({ success: false, error: 'Shipping line, positive freight, valid charges, and transit days are required.' });
    }
    if (req.body.vesselEtd && req.body.vesselEta && new Date(req.body.vesselEta) < new Date(req.body.vesselEtd)) {
      return res.status(400).json({ success: false, error: 'Vessel ETA cannot be earlier than Vessel ETD.' });
    }
    const vendorId = vendor.sapVendorCode || vendor.supplierId || vendor.id;
    const quote = await RfqQuote.findOneAndUpdate(
      { rfqId: rfq.rfqId, vendorId },
      { $set: {
        vendorName: vendor.companyName, shippingLine: String(req.body.shippingLine).trim(),
        oceanFreightUsd: ocean, stChargesInr: shipping, otherChargesInr: other,
        totalInr: Math.round(ocean * 92.5 + shipping + other), freightAmount: ocean,
        destinationCharges: shipping, transitDays, vesselRoute: req.body.vesselRoute || '',
        cutoffDate: req.body.cutoffDate || null, vesselEtd: req.body.vesselEtd || null,
        vesselEta: req.body.vesselEta || null, freeDays: req.body.freeDays || '',
        rateValidity: req.body.rateValidity || '', costParticular: req.body.costParticular || '',
        remarks: req.body.remarks || '', status: 'submitted'
      }, $setOnInsert: { quoteId: `Q-${Date.now().toString().slice(-6)}` } },
      { new: true, upsert: true, runValidators: true }
    );
    const ranked = await RfqQuote.find({ rfqId: rfq.rfqId }).sort({ totalInr: 1 });
    await Promise.all(ranked.map((item, index) => RfqQuote.updateOne({ _id: item._id }, { rank: index < 5 ? `L${index + 1}` : 'N/A' })));
    broadcastEvent('RFQ_QUOTE_SUBMITTED', { rfqId: rfq.rfqId, rfqNumber: rfq.rfqNumber, vendorName: vendor.companyName, quoteId: quote.quoteId });
    return res.json({ success: true, message: 'Freight quote submitted successfully.', data: quote });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.get('/vendor-rfqs/:id/bl-entries', authenticateToken, async (req, res) => {
  try {
    const context = await resolveVendorAwardedRfq(req);
    if (context.error) return res.status(context.status).json({ success: false, error: context.error });
    const vendorKeys = freightVendorKeys(context.vendor);
    const entries = await RfqBlEntry.find({ rfqId: context.rfq.rfqId }).sort({ createdAt: -1 }).lean();
    const mine = entries.filter((entry) => vendorKeys.includes(normaliseInviteValue(entry.vendorId)) || vendorKeys.includes(normaliseInviteValue(entry.vendorName)));
    const usedContainers = mine.reduce((sum, entry) => sum + (Number(entry.containerCount) || 0), 0);
    return res.json({ success: true, data: { rfq: context.rfq.toObject(), allocation: context.allocation, usedContainers, remainingContainers: Math.max(0, context.allocation.containers - usedContainers), entries: mine } });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.post('/vendor-rfqs/:id/bl-entries', authenticateToken, async (req, res) => {
  try {
    const context = await resolveVendorAwardedRfq(req);
    if (context.error) return res.status(context.status).json({ success: false, error: context.error });
    const blNumber = String(req.body.blNumber || '').trim().toUpperCase();
    const containerCount = Number(req.body.containerCount);
    if (!blNumber) return res.status(400).json({ success: false, error: 'BL Number is required.' });
    if (!Number.isInteger(containerCount) || containerCount <= 0) return res.status(400).json({ success: false, error: 'Number of containers must be a positive whole number.' });
    const duplicate = await RfqBlEntry.exists({ blNumber });
    if (duplicate) return res.status(409).json({ success: false, error: 'This BL Number already exists.' });
    const vendorKeys = freightVendorKeys(context.vendor);
    const existing = await RfqBlEntry.find({ rfqId: context.rfq.rfqId }).lean();
    const used = existing.filter((entry) => vendorKeys.includes(normaliseInviteValue(entry.vendorId)) || vendorKeys.includes(normaliseInviteValue(entry.vendorName))).reduce((sum, entry) => sum + (Number(entry.containerCount) || 0), 0);
    const remaining = context.allocation.containers - used;
    if (containerCount > remaining) return res.status(400).json({ success: false, error: `Only ${Math.max(0, remaining)} awarded container(s) remain.` });
    const documents = (Array.isArray(req.body.documents) ? req.body.documents : []).filter((doc) => doc?.fileName).map((doc) => ({ docType: doc.docType || 'Bill of Lading', fileUrl: String(doc.fileName), uploadedBy: context.vendor.companyName, uploadedAt: new Date() }));
    if (!documents.length) return res.status(400).json({ success: false, error: 'At least one supporting document is required.' });
    const entry = await RfqBlEntry.create({
      blId: `BL-${Date.now().toString(36).toUpperCase()}`,
      rfqId: context.rfq.rfqId, rfqNumber: context.rfq.rfqNumber,
      blNumber, containerCount, vendorId: context.vendor.sapVendorCode || context.vendor.supplierId || context.vendor.id,
      vendorName: context.vendor.companyName, remarks: String(req.body.remarks || '').trim(),
      vesselName: context.rfq.title, shippingLine: context.rfq.awardedVendorName || context.vendor.companyName,
      autoAsnNumber: String(req.body.asnNumber || '').trim(), status: 'submitted', documents
    });
    broadcastEvent('BL_SUBMITTED', { blId: entry.blId, blNumber, rfqId: context.rfq.rfqId, vendorName: context.vendor.companyName });
    return res.status(201).json({ success: true, message: 'BL entry submitted for EXIM review.', data: entry });
  } catch (err) { return res.status(500).json({ success: false, error: err.code === 11000 ? 'This BL Number already exists.' : err.message }); }
});

router.get('/vendor-rfqs/:id/bl-entries/:blId', authenticateToken, async (req, res) => {
  try {
    const context = await resolveVendorAwardedRfq(req);
    if (context.error) return res.status(context.status).json({ success: false, error: context.error });
    const entry = await RfqBlEntry.findOne({ rfqId: context.rfq.rfqId, $or: [{ blId: req.params.blId }, { blNumber: req.params.blId }] }).lean();
    const keys = freightVendorKeys(context.vendor);
    if (!entry || ![entry.vendorId, entry.vendorName].map(normaliseInviteValue).some((key) => keys.includes(key))) return res.status(404).json({ success: false, error: 'BL entry not found.' });
    const rawInvoices = await LogisticsPayment.find({ blId: entry.blId }).sort({ createdAt: -1 }).lean();
    const seenDocuments = new Set();
    const documents = (entry.documents || []).filter((doc) => {
      const key = `${doc.docType || ''}|${doc.fileUrl || ''}`.toLowerCase();
      if (seenDocuments.has(key)) return false;
      seenDocuments.add(key);
      return true;
    });
    const invoices = rawInvoices.map((invoice) => {
      const candidates = [invoice.amount, invoice.invoiceAmount, invoice.totalAmount, invoice.grossAmount];
      const amount = candidates.map(Number).find(Number.isFinite);
      return { ...invoice, amount: amount ?? 0, amountMissing: amount === undefined, status: invoice.status || 'draft' };
    });
    return res.json({ success: true, data: { ...entry, documents, invoices, canInvoice: entry.status === 'custom_cleared' || entry.status === 'invoice_pending' } });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.post('/vendor-rfqs/:id/bl-entries/:blId/invoices', authenticateToken, async (req, res) => {
  try {
    const context = await resolveVendorAwardedRfq(req);
    if (context.error) return res.status(context.status).json({ success: false, error: context.error });
    const bl = await RfqBlEntry.findOne({ rfqId: context.rfq.rfqId, $or: [{ blId: req.params.blId }, { blNumber: req.params.blId }] });
    const keys = freightVendorKeys(context.vendor);
    if (!bl || ![bl.vendorId, bl.vendorName].map(normaliseInviteValue).some((key) => keys.includes(key))) return res.status(404).json({ success: false, error: 'BL entry not found.' });
    if (!['custom_cleared', 'invoice_pending'].includes(bl.status)) return res.status(400).json({ success: false, error: 'Logistics invoice can only be raised after customs clearance.' });
    const invoiceNumber = String(req.body.invoiceNumber || '').trim().toUpperCase();
    const amount = Number(req.body.amount);
    if (!invoiceNumber || !(amount > 0)) return res.status(400).json({ success: false, error: 'Invoice Number and a positive amount are required.' });
    if (await LogisticsPayment.exists({ invoiceNumber, $or: [{ vendorId: bl.vendorId }, { providerId: bl.vendorId }] })) return res.status(409).json({ success: false, error: 'This invoice number has already been submitted.' });
    const logisticsPaymentId = `LP-${Date.now().toString(36).toUpperCase()}`;
    const payment = await LogisticsPayment.create({
      logisticsPaymentId, referenceNumber: logisticsPaymentId, blId: bl.blId, blNumber: bl.blNumber,
      vendorId: bl.vendorId, vendorName: bl.vendorName, category: req.body.category || 'freight', invoiceNumber,
      amount, totalAmount: amount, currency: String(req.body.currency || 'INR').toUpperCase(), remarks: String(req.body.remarks || '').trim(),
      invoiceFile: String(req.body.fileName || '').trim(), status: 'pending'
    });
    broadcastEvent('LOGISTICS_INVOICE_SUBMITTED', { logisticsPaymentId: payment.logisticsPaymentId, blId: bl.blId, vendorId: bl.vendorId, amount });
    return res.status(201).json({ success: true, message: 'Logistics invoice submitted for approval.', data: payment });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.get('/rfqs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const rfq = await RfqHeader.findOne({ $or: [{ rfqId: id }, { rfqNumber: id }] }).lean();
    if (!rfq) {
      return res.status(404).json({ success: false, error: 'RFQ not found' });
    }

    const quotes = await RfqQuote.find({ rfqId: rfq.rfqId }).sort({ totalInr: 1 }).lean();
    const blEntries = await RfqBlEntry.find({ rfqId: rfq.rfqId }).lean();
    
    // Fix: Get ONLY the most recent approval, not all approvals
    const approval = rfq.awardApprovalId 
      ? await Approval.findOne({ id: rfq.awardApprovalId })
          .sort({ submittedAt: -1, createdAt: -1 })
          .lean() 
      : null;
    let approvalProgress = null;
    if (approval) {
      let steps = [];
      try { steps = JSON.parse(approval.workflowSteps || '[]'); } catch (_) {}
      steps = steps.sort((left, right) => Number(left.step) - Number(right.step));
      const approvedSteps = new Set((approval.actionHistory || []).filter((item) => item.action === 'approve').map((item) => Number(item.step)));
      const terminalApproved = approval.status === 'Approved & Dispatched';
      const terminalRejected = approval.status === 'Rejected';
      const activeStep = steps.find((step) => Number(step.step) === Number(approval.currentStep || 1));
      const requesterValues = [approval.requestedById, approval.requestedBy].filter(Boolean).map((value) => String(value).trim().toLowerCase());
      const userValues = [req.user?.id, req.user?.userId, req.user?.email, req.user?.name].filter(Boolean).map((value) => String(value).trim().toLowerCase());
      const isOwnRequest = requesterValues.some((value) => userValues.includes(value));
      const requiredRole = activeStep?.roleName || activeStep?.roleKey || '';

      const userRoles = [req.user?.role].filter(Boolean);
      if (req.user?.id) {
        const delegators = await User.find({ parentUserId: req.user.id, status: 'Active' }, { role: 1 }).lean();
        for (const d of delegators) {
          if (d.role && !userRoles.includes(d.role)) userRoles.push(d.role);
        }
      }

      const canAct = roleCanAct(userRoles, requiredRole);
      approvalProgress = {
        id: approval.id,
        status: approval.status,
        slab: approval.currentSlab,
        currentStep: Number(approval.currentStep || 1),
        totalSteps: steps.length || Number(approval.totalSteps || 0),
        requiredRole,
        canCurrentUserAct: !terminalApproved && !terminalRejected && !isOwnRequest && canAct,
        blockedReason: terminalApproved ? 'Approval completed.' : terminalRejected ? 'Approval rejected.' : isOwnRequest ? 'The requester cannot approve their own request.' : canAct ? '' : `Waiting for a user with the ${requiredRole || 'required'} role.`,
        submittedAt: approval.submittedAt,
        actionHistory: approval.actionHistory || [],
        steps: steps.map((step) => ({
          ...step,
          state: terminalApproved || approvedSteps.has(Number(step.step)) ? 'completed' : terminalRejected && Number(step.step) === Number(approval.currentStep) ? 'rejected' : Number(step.step) === Number(approval.currentStep) ? 'current' : 'upcoming'
        }))
      };
    }

    return res.json({
      success: true,
      data: {
        ...rfq,
        quotes,
        blEntries,
        workflow: {
          current: rfq.status,
          deadlinePassed: Boolean(rfq.closingDate && new Date(rfq.closingDate) < new Date()),
          invited: (rfq.invitedVendors || []).length,
          quotes: quotes.length,
          awardedContainers: Number(rfq.allocatedQuantity) || 0,
          blContainers: blEntries.reduce((sum, entry) => sum + (Number(entry.containerCount) || 0), 0),
          customsClearedContainers: blEntries.filter((entry) => ['custom_cleared', 'invoice_pending', 'payment_requested', 'payment_approved', 'payment_paid', 'closed'].includes(entry.status)).reduce((sum, entry) => sum + (Number(entry.containerCount) || 0), 0)
        },
        approvalProgress
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT Update RFQ ──────────────────────────────────────────────────────────
router.put('/rfqs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, linkedPoId, closingDate, description,
      shippingTerms, cargoType, portOfLoading, portOfDischarge,
      containerType, containerCount, weightPerContainer, estimatedReadinessDate,
      invitedVendors, status
    } = req.body;

    const rfq = await RfqHeader.findOne({ $or: [{ rfqId: id }, { rfqNumber: id }] });
    if (!rfq) return res.status(404).json({ success: false, error: 'RFQ not found' });
    if (['pending_approval', 'awarded', 'closed', 'cancelled'].includes(rfq.status)) return res.status(409).json({ success: false, error: `An RFQ in ${rfq.status.replace('_', ' ')} status cannot be edited.` });
    const validationError = validateRfqPayload(req.body, { partial: true });
    if (validationError) return res.status(400).json({ success: false, error: validationError });

    if (title) rfq.title = title.trim();
    if (linkedPoId) {
      rfq.poId = linkedPoId;
      rfq.sapPoNumber = linkedPoId;
    }
    if (description !== undefined) rfq.description = description;
    if (closingDate) rfq.closingDate = new Date(closingDate);
    if (status) {
      const nextStatus = String(status).toLowerCase().replace(/\s+/g, '_');
      if (!['draft', 'published', 'closed', 'cancelled'].includes(nextStatus)) return res.status(400).json({ success: false, error: 'This RFQ status transition is not allowed from the edit form.' });
      rfq.status = nextStatus;
    }

    if (!rfq.cargoDetails) rfq.cargoDetails = {};
    if (shippingTerms) rfq.cargoDetails.shippingTerms = shippingTerms;
    if (cargoType) rfq.cargoDetails.cargoType = cargoType;
    if (portOfLoading) rfq.cargoDetails.portOfOrigin = portOfLoading;
    if (portOfDischarge) rfq.cargoDetails.portOfDestination = portOfDischarge;
    if (containerType) rfq.cargoDetails.containerType = containerType;
    if (containerCount !== undefined) {
      const nextContainerCount = Number(containerCount);
      if (!Number.isFinite(nextContainerCount) || nextContainerCount <= 0) {
        return res.status(400).json({ success: false, error: 'Number of containers must be greater than zero.' });
      }
      rfq.cargoDetails.containerCount = nextContainerCount;
      rfq.totalQuantity = nextContainerCount;
      rfq.allocatedQuantity = Math.min(Number(rfq.allocatedQuantity) || 0, nextContainerCount);
      rfq.pendingAllocation = Math.max(0, nextContainerCount - rfq.allocatedQuantity);
    }
    if (weightPerContainer !== undefined) rfq.cargoDetails.weightPerContainer = weightPerContainer;
    if (estimatedReadinessDate) rfq.cargoDetails.estimatedReadinessDate = new Date(estimatedReadinessDate);

    if (invitedVendors && Array.isArray(invitedVendors)) {
      if (!invitedVendors.length) return res.status(400).json({ success: false, error: 'At least one Freight Forwarder must remain invited.' });
      const submittedQuotes = await RfqQuote.find({ rfqId: rfq.rfqId }).select('vendorId vendorName').lean();
      const retainsVendor = (quote) => invitedVendors.some((vendor) =>
        [vendor.vendorId, vendor.sapVendorCode].filter(Boolean).map(normaliseInviteValue).includes(normaliseInviteValue(quote.vendorId)) ||
        normaliseInviteValue(vendor.companyName) === normaliseInviteValue(quote.vendorName)
      );
      if (submittedQuotes.some((quote) => !retainsVendor(quote))) {
        return res.status(400).json({ success: false, error: 'A vendor that already submitted a quote cannot be removed.' });
      }
      const previousKeys = new Set((rfq.invitedVendors || []).flatMap((vendor) => [vendor.vendorId, vendor.sapVendorCode]).map(normaliseInviteValue).filter(Boolean));
      rfq.invitedVendors = invitedVendors;
      const addedVendorIds = invitedVendors.flatMap((vendor) => [vendor.vendorId, vendor.sapVendorCode]).filter((value) => value && !previousKeys.has(normaliseInviteValue(value)));
      if (addedVendorIds.length) broadcastEvent('RFQ_INVITED', { rfqId: rfq.rfqId, rfqNumber: rfq.rfqNumber, title: rfq.title, closingDate: rfq.closingDate, vendorIds: addedVendorIds });
    }

    await rfq.save();
    return res.json({ success: true, message: 'RFQ updated successfully in MongoDB.', data: rfq });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE RFQ ──────────────────────────────────────────────────────────────
router.delete('/rfqs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const rfq = await RfqHeader.findOne({ $or: [{ rfqId: id }, { rfqNumber: id }] });
    if (rfq) {
      const [quoteCount, blCount] = await Promise.all([RfqQuote.countDocuments({ rfqId: rfq.rfqId }), RfqBlEntry.countDocuments({ rfqId: rfq.rfqId })]);
      if (quoteCount || blCount || ['pending_approval', 'awarded', 'closed'].includes(rfq.status)) return res.status(409).json({ success: false, error: 'RFQ cannot be deleted after quotation, approval, award, or shipment activity has started.' });
      await RfqHeader.deleteOne({ _id: rfq._id });
      await RfqQuote.deleteMany({ rfqId: rfq.rfqId }).catch(() => {});
    }
    return res.json({ success: true, message: 'RFQ deleted from MongoDB.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST Copy/Duplicate RFQ ──────────────────────────────────────────────────
router.post('/rfqs/:id/copy', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const sourceRfq = await RfqHeader.findOne({ $or: [{ rfqId: id }, { rfqNumber: id }] }).lean();
    if (!sourceRfq) return res.status(404).json({ success: false, error: 'Source RFQ not found' });

    const newRfqNumber = await nextRfqNumber();

    const newRfq = await RfqHeader.create({
      ...sourceRfq,
      _id: undefined,
      rfqId: newRfqNumber,
      rfqNumber: newRfqNumber,
      title: `COPY - ${sourceRfq.title}`,
      status: 'draft',
      closingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      totalQuantity: Number(sourceRfq.cargoDetails?.containerCount) || Number(sourceRfq.totalQuantity) || 1,
      allocatedQuantity: 0,
      pendingAllocation: Number(sourceRfq.cargoDetails?.containerCount) || Number(sourceRfq.totalQuantity) || 1,
      awardedVendorId: undefined,
      awardedVendorName: undefined,
      awardedQuoteId: undefined,
      awardAllocations: undefined,
      awardApprovalId: undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return res.status(201).json({ success: true, message: 'RFQ copied successfully.', data: newRfq });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST Submit Vendor Quote with Auto L1..L5 Ranking ────────────────────────
router.post('/rfqs/:id/quote', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorId, vendorName, shippingLine, oceanFreightUsd, stChargesInr, otherChargesInr, transitDays } = req.body;

    const rfq = await RfqHeader.findOne({ $or: [{ rfqId: id }, { rfqNumber: id }] });
    if (!rfq) return res.status(404).json({ success: false, error: 'RFQ not found' });
    if (rfq.status !== 'published' || (rfq.closingDate && new Date(rfq.closingDate) < new Date())) return res.status(409).json({ success: false, error: 'Quotes can only be submitted to an open, published RFQ before its deadline.' });
    if (!vendorId || !vendorName || !shippingLine) return res.status(400).json({ success: false, error: 'Vendor, shipping line, and quote amounts are required.' });

    const invitedVendor = (rfq.invitedVendors || []).find((vendor) =>
      [vendor.vendorId, vendor.sapVendorCode, vendor.companyName].some((value) => normaliseInviteValue(value) === normaliseInviteValue(vendorId)) ||
      normaliseInviteValue(vendor.companyName) === normaliseInviteValue(vendorName)
    );
    if (!invitedVendor) return res.status(403).json({ success: false, error: 'Only a vendor invited to this RFQ can submit a quote.' });
    const existingQuote = await RfqQuote.findOne({
      rfqId: rfq.rfqId,
      $or: [
        { vendorId: { $in: [vendorId, invitedVendor.vendorId, invitedVendor.sapVendorCode].filter(Boolean) } },
        { vendorName: invitedVendor.companyName }
      ]
    }).lean();
    if (existingQuote) return res.status(409).json({ success: false, error: 'This vendor has already submitted a quote. Update the existing vendor quote instead.' });

    const oceanUsd = Number(oceanFreightUsd);
    const stInr = Number(stChargesInr);
    const othInr = Number(otherChargesInr || 0);
    const transit = Number(transitDays);
    if (!(oceanUsd > 0) || !Number.isFinite(stInr) || stInr < 0 || !Number.isFinite(othInr) || othInr < 0 || !Number.isInteger(transit) || transit <= 0) return res.status(400).json({ success: false, error: 'Enter valid positive freight and transit values; INR charges may be zero but not negative.' });
    const usdRate = 92.5; // Exchange rate calculation
    const totalInr = Math.round(oceanUsd * usdRate + stInr + othInr);

    const quoteId = `Q-${Date.now().toString().slice(-6)}`;
    await RfqQuote.create({
      quoteId,
      rfqId: rfq.rfqId,
      vendorId: invitedVendor.vendorId || invitedVendor.sapVendorCode || vendorId,
      vendorName: invitedVendor.companyName || vendorName,
      shippingLine,
      oceanFreightUsd: oceanUsd,
      stChargesInr: stInr,
      otherChargesInr: othInr,
      totalInr,
      freightAmount: oceanUsd,
      destinationCharges: stInr,
      transitDays: transit,
      status: 'submitted'
    });

    // Re-rank all quotes for this RFQ by totalInr ascending
    const allQuotes = await RfqQuote.find({ rfqId: rfq.rfqId }).sort({ totalInr: 1 });
    for (let i = 0; i < allQuotes.length; i++) {
      const rankLabel = `L${i + 1}`;
      allQuotes[i].rank = rankLabel;
      await allQuotes[i].save();
    }

    return res.json({ success: true, message: 'Vendor quote submitted and ranked in MongoDB.', quoteId });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST Award RFQ Quote ─────────────────────────────────────────────────────
router.post('/rfqs/:id/award', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { quoteId, vendorId, vendorName, allocations, submitForApproval, isReassignment } = req.body;

    const rfq = await RfqHeader.findOne({ $or: [{ rfqId: id }, { rfqNumber: id }] });
    if (!rfq) return res.status(404).json({ success: false, error: 'RFQ not found' });
    
    // Allow reassignment for awarded RFQs, otherwise only allow published RFQs
    const allowedStatuses = isReassignment ? ['published', 'awarded'] : ['published'];
    if (!allowedStatuses.includes(rfq.status)) {
      return res.status(409).json({ success: false, error: `RFQ cannot be awarded while it is ${rfq.status.replace('_', ' ')}.` });
    }

    if (submitForApproval && Array.isArray(allocations)) {
      const totalContainers = Number(rfq.cargoDetails?.containerCount) || Number(rfq.totalQuantity) || 0;
      if (!allocations.length) return res.status(400).json({ success: false, error: 'Add at least one vendor allocation.' });
      const quoteIds = allocations.map((item) => item.quoteId).filter(Boolean);
      const quotes = await RfqQuote.find({ rfqId: rfq.rfqId, quoteId: { $in: quoteIds } }).lean();
      if (quotes.length !== new Set(quoteIds).size) return res.status(400).json({ success: false, error: 'Every allocation must use a valid quote from this RFQ.' });
      const normalized = allocations.map((item) => {
        const quote = quotes.find((entry) => entry.quoteId === item.quoteId);
        const containers = Number(item.containers);
        if (!Number.isInteger(containers) || containers <= 0) throw new Error('Allocated containers must be positive whole numbers.');
        return { quoteId: quote.quoteId, vendorId: quote.vendorId, vendorName: quote.vendorName, vendorCode: quote.vendorId, containers, ratePerContainer: Number(quote.totalInr) || 0, allocationAmount: (Number(quote.totalInr) || 0) * containers, remark: String(item.remark || '').trim() };
      });
      const allocated = normalized.reduce((sum, item) => sum + item.containers, 0);
      
      // Remove validation for exact container match - allow any allocation count for reassignment
      // if (allocated !== totalContainers) return res.status(400).json({ success: false, error: `Allocate exactly all ${totalContainers} RFQ containers before submitting the award.` });
      
      if (new Set(normalized.map((item) => item.quoteId)).size !== normalized.length) return res.status(400).json({ success: false, error: 'A vendor quote can only be allocated once.' });
      const totalAmount = normalized.reduce((sum, item) => sum + item.allocationAmount, 0);
      
      // Generate approval ID with reassignment indicator if applicable
      const approvalIdPrefix = isReassignment ? 'RFQ-REASSIGN' : 'RFQ-AWARD';
      const approvalId = `${approvalIdPrefix}-${rfq.rfqNumber}-${Date.now().toString().slice(-5)}`;
      
      const awardWorkflow = await resolveWorkflowFromDB('RFQ Vendor Award', totalAmount, { currency: 'INR', cargoType: rfq.cargoDetails?.cargoType });
      
      // Store previous award information for reassignment tracking
      const previousAward = isReassignment && rfq.status === 'awarded' ? {
        previousVendorId: rfq.awardedVendorId,
        previousVendorName: rfq.awardedVendorName,
        previousAllocatedQuantity: rfq.allocatedQuantity,
        reassignedAt: new Date(),
        reassignedBy: req.user?.name || req.user?.email || 'System Admin'
      } : {};
      
      const approval = await createApprovalRecord({ 
        referenceId: approvalId, 
        type: 'RFQ Vendor Award', 
        vendorName: normalized.map((item) => item.vendorName).join(', '), 
        amountFormatted: `INR ${totalAmount}`, 
        poRef: rfq.poId, 
        requestedBy: req.user?.name || req.user?.email || 'System Admin', 
        requestedById: req.user?.id || req.user?.email, 
        requestId: req.headers['x-request-id'], 
        transactionSnapshot: { 
          rfqId: rfq.rfqId, 
          containers: allocated, 
          allocations: normalized, 
          totalAmount,
          isReassignment,
          ...previousAward
        }, 
        wf: awardWorkflow 
      });
      
      approval.containersCount = allocated;
      approval.allocations = normalized;
      approval.remarks = isReassignment 
        ? `Container reassignment for ${rfq.rfqNumber} (Previous: ${rfq.awardedVendorName || 'N/A'})` 
        : `Container allocation for ${rfq.rfqNumber}`;
      await approval.save();
      
      // Store reassignment history if this is a reassignment
      if (isReassignment && rfq.status === 'awarded') {
        const reassignmentHistory = rfq.get('reassignmentHistory') || [];
        reassignmentHistory.push({
          reassignedAt: new Date(),
          reassignedBy: req.user?.name || req.user?.email || 'System Admin',
          previousVendorId: rfq.awardedVendorId,
          previousVendorName: rfq.awardedVendorName,
          previousAllocations: rfq.get('awardAllocations') || [],
          previousAllocatedQuantity: rfq.allocatedQuantity,
          newAllocations: normalized,
          newAllocatedQuantity: allocated,
          approvalId
        });
        rfq.set('reassignmentHistory', reassignmentHistory);
      }
      
      rfq.status = 'pending_approval';
      rfq.totalQuantity = totalContainers;
      rfq.allocatedQuantity = 0;
      rfq.pendingAllocation = totalContainers;
      rfq.set('awardAllocations', normalized);
      rfq.set('awardApprovalId', approvalId);
      await rfq.save();
      
      const message = isReassignment 
        ? 'Vendor reassignment submitted for approval.' 
        : 'Vendor allocations submitted for approval.';
      
      return res.json({ success: true, message, data: rfq, approvalId, isReassignment });
    }

    return res.status(400).json({ success: false, error: 'RFQ awards must be submitted through the configured approval workflow.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── CUSTOMS BROKER & BL ASSIGNMENT ROUTES ──────────────────────────────────
router.get('/exim/bl-entries', authenticateToken, async (req, res) => {
  try {
    const entries = await RfqBlEntry.find().sort({ createdAt: -1 }).lean();
    const agents = await CustomAgent.find({ status: 'Active' }).select('agentId agencyName contactPerson email').sort({ agencyName: 1 }).lean();
    return res.json({ success: true, data: entries, agents });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.get('/exim/bl-entries/:blId', authenticateToken, async (req, res) => {
  try {
    const entry = await RfqBlEntry.findOne({ $or: [{ blId: req.params.blId }, { blNumber: req.params.blId }] }).lean();
    if (!entry) return res.status(404).json({ success: false, error: 'BL entry not found.' });
    const [rfq, agents] = await Promise.all([
      RfqHeader.findOne({ rfqId: entry.rfqId }).select('rfqId rfqNumber title').lean(),
      CustomAgent.find({ status: 'Active' }).select('agentId agencyName contactPerson email').sort({ agencyName: 1 }).lean()
    ]);
    return res.json({ success: true, data: { ...entry, rfq }, agents });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.post('/exim/bl-entries/:blId/documents', authenticateToken, async (req, res) => {
  try {
    const bl = await RfqBlEntry.findOne({ $or: [{ blId: req.params.blId }, { blNumber: req.params.blId }] });
    if (!bl) return res.status(404).json({ success: false, error: 'BL entry not found.' });
    const documents = Array.isArray(req.body.documents) ? req.body.documents : [];
    const valid = documents.filter((doc) => String(doc.docType || '').trim() && String(doc.fileName || '').trim());
    if (!valid.length) return res.status(400).json({ success: false, error: 'Select a document type and file.' });
    bl.documents.push(...valid.map((doc) => ({ docType: String(doc.docType).trim(), fileUrl: String(doc.fileName).trim(), uploadedBy: req.user?.name || req.user?.email || 'EXIM Team', uploadedAt: new Date(), stage: 'EXIM Review' })));
    if (bl.status === 'submitted') bl.status = 'exim_review';
    bl.eximReviewedAt = bl.eximReviewedAt || new Date();
    await bl.save();
    broadcastEvent('BL_EXIM_REVIEWED', { blId: bl.blId, vendorId: bl.vendorId });
    return res.json({ success: true, message: 'EXIM documents uploaded.', data: bl });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.post('/exim/bl-entries/:blId/assign', authenticateToken, async (req, res) => {
  try {
    const agent = await CustomAgent.findOne({ agentId: req.body.agentId, status: 'Active' }).lean();
    if (!agent) return res.status(400).json({ success: false, error: 'Select an active customs agent.' });
    const bl = await RfqBlEntry.findOne({ $or: [{ blId: req.params.blId }, { blNumber: req.params.blId }] });
    if (!bl) return res.status(404).json({ success: false, error: 'BL entry not found.' });
    if (bl.status === 'custom_cleared') return res.status(400).json({ success: false, error: 'A customs-cleared BL cannot be reassigned.' });
    bl.customAgentId = agent.agentId;
    bl.customAgentName = agent.agencyName;
    bl.eximNotes = String(req.body.notes || '').trim();
    bl.eximReviewedAt = bl.eximReviewedAt || new Date();
    bl.assignedAt = new Date();
    bl.status = 'assigned_to_agent';
    await bl.save();
    broadcastEvent('BL_ASSIGNED', { blId: bl.blId, blNumber: bl.blNumber, agentId: agent.agentId, vendorId: bl.vendorId });
    return res.json({ success: true, message: 'BL assigned to customs agent.', data: bl });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.get('/customs-agent/assigned', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role !== 'CustomAgent') return res.status(403).json({ success: false, error: 'Customs Agent access is required.' });
    const bls = await RfqBlEntry.find({ customAgentId: req.user.id }).sort({ createdAt: -1 }).lean();
    return res.json({
      success: true,
      agentName: req.user.email,
      agentCompany: req.user.agencyName,
      totalAssigned: bls.length,
      pendingClearance: bls.filter(b => b.status !== 'custom_cleared').length,
      customCleared: bls.filter(b => b.status === 'custom_cleared').length,
      assignments: bls
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/customs-agent/assigned/:blId', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role !== 'CustomAgent') return res.status(403).json({ success: false, error: 'Customs Agent access is required.' });
    const bl = await RfqBlEntry.findOne({ customAgentId: req.user.id, $or: [{ blId: req.params.blId }, { blNumber: req.params.blId }] }).lean();
    if (!bl) return res.status(404).json({ success: false, error: 'Assigned BL entry not found.' });
    const rfq = await RfqHeader.findOne({ rfqId: bl.rfqId }).select('rfqId rfqNumber title cargoDetails').lean();
    const seenDocuments = new Set();
    const documents = (bl.documents || []).filter((doc) => {
      const key = `${doc.docType || ''}|${doc.fileUrl || ''}`.toLowerCase();
      if (seenDocuments.has(key)) return false;
      seenDocuments.add(key);
      return true;
    });
    return res.json({ success: true, data: { ...bl, documents, rfq } });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.post('/customs-agent/documents', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role !== 'CustomAgent') return res.status(403).json({ success: false, error: 'Customs Agent access is required.' });
    const bl = await RfqBlEntry.findOne({ customAgentId: req.user.id, $or: [{ blId: req.body.blId }, { blNumber: req.body.blId }] });
    if (!bl) return res.status(404).json({ success: false, error: 'Assigned BL entry not found.' });
    if (bl.status === 'custom_cleared') return res.status(400).json({ success: false, error: 'Documents cannot be changed after customs clearance.' });
    const docType = String(req.body.docType || '').trim();
    const fileName = String(req.body.fileName || '').trim();
    if (!docType || !fileName) return res.status(400).json({ success: false, error: 'Document type and file are required.' });
    bl.documents.push({ docType, fileUrl: fileName, uploadedBy: `${req.user.agencyName || req.user.email} (Customs Agent)`, uploadedAt: new Date(), stage: 'Customs Clearance' });
    await bl.save();
    return res.json({ success: true, message: 'Customs document uploaded.', data: bl });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.post('/customs-agent/upload-boe', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role !== 'CustomAgent') return res.status(403).json({ success: false, error: 'Customs Agent access is required.' });
    const { blId, boeNumber, dutyAmount, fileName } = req.body;
    const bl = await RfqBlEntry.findOne({ customAgentId: req.user.id, $or: [{ blId }, { blNumber: blId }] });
    if (!bl) return res.status(404).json({ success: false, error: 'BL entry not found.' });
    if (bl.status === 'custom_cleared') return res.status(400).json({ success: false, error: 'BOE cannot be changed after customs clearance.' });
    const existingBoeDocument = bl.documents.some((doc) => doc.docType === 'Customs Bill of Entry');
    if (!String(boeNumber || '').trim()) return res.status(400).json({ success: false, error: 'BOE Number is required.' });
    if (!existingBoeDocument && !String(fileName || '').trim()) return res.status(400).json({ success: false, error: 'BOE document is required.' });

    const duplicateBoeFile = bl.documents.some((doc) => doc.docType === 'Customs Bill of Entry' && String(doc.fileUrl || '').trim() === String(fileName || '').trim());
    if (String(fileName || '').trim() && !duplicateBoeFile) {
      bl.documents.push({
        docType: 'Customs Bill of Entry',
        fileUrl: String(fileName).trim(),
        uploadedBy: `${req.user.agencyName || req.user.email} (Customs Agent)`,
        uploadedAt: new Date(),
        stage: 'Customs Clearance'
      });
    }
    bl.boeNumber = String(boeNumber).trim();
    bl.dutyAmount = Math.max(0, Number(dutyAmount) || 0);
    bl.boeUploadedAt = new Date();
    await bl.save();

    return res.json({ success: true, message: 'Bill of Entry uploaded successfully.', bl });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/customs-agent/clear', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role !== 'CustomAgent') return res.status(403).json({ success: false, error: 'Customs Agent access is required.' });
    const { blId } = req.body;
    const bl = await RfqBlEntry.findOne({ customAgentId: req.user.id, $or: [{ blId }, { blNumber: blId }] });
    if (!bl) return res.status(404).json({ success: false, error: 'BL entry not found.' });
    const boeDocument = bl.documents.find((doc) => doc.docType === 'Customs Bill of Entry');
    if (!boeDocument) return res.status(400).json({ success: false, error: 'Upload the Bill of Entry document before marking customs cleared.' });
    // Older/imported BL records stored the BOE document without a separate
    // number. The document is sufficient for clearance, while new BOE uploads
    // continue to require and persist the real BOE number.
    if (!bl.boeNumber) bl.boeReference = `DOCUMENT:${boeDocument.fileUrl}`;

    bl.status = 'custom_cleared';
    bl.customsClearedAt = new Date();
    bl.customsClearanceNotes = String(req.body.notes || '').trim();
    await bl.save();

    broadcastEvent('BL_CUSTOMS_CLEARED', { blId: bl.blId, blNumber: bl.blNumber, rfqId: bl.rfqId, vendorId: bl.vendorId, clearedAt: bl.customsClearedAt });

    return res.json({ success: true, message: 'Marked as Customs Cleared! Invoicing options enabled.', bl });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
