import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { UPLOAD_DIR, toLocalPath, getDownloadUrl, fileExistsInS3, uploadToS3 } from '../../services/storage.service.js';
import { PurchaseOrder } from '../../models/PurchaseOrder.js';
import { InvoicePayment } from '../../models/InvoicePayment.js';
import { AdvancePayment } from '../../models/AdvancePayment.js';
import { PaymentLedger } from '../../models/PaymentLedger.js';
import { Approval } from '../../models/Approval.js';
import { Workflow } from '../../models/Workflow.js';
import { RfqHeader, RfqQuote, RfqBlEntry, CustomDutyPayment } from '../../models/RfqLogistics.js';
import { LogisticsPayment } from '../../models/LogisticsPayment.js';
import { BlInvoice } from '../../models/BlInvoice.js';
import { Vendor } from '../../models/Vendor.js';
import { LogisticsProvider } from '../../models/LogisticsProvider.js';
import { CustomAgent } from '../../models/CustomAgent.js';
import { User } from '../../models/User.js';
import { broadcastEvent } from '../../services/sse.service.js';
import { sendApprovalCreatedEmails } from '../../services/notification.service.js';
import { authenticateToken, optionalAuth } from '../../middleware/auth.middleware.js';
import { authorizeRole } from '../../middleware/rbac.middleware.js';
import { sendRfqInvitationEmail, sendBlSubmittedEmail, sendBlAssignedToAgentEmail, sendBlCustomsClearedEmail, sendRfqAwardedEmail } from '../../services/mail.service.js';
import { ExchangeRate } from '../../models/ExchangeRate.js';
import { WorkflowAudit } from '../../models/WorkflowAudit.js';
import { ensureRfqAwardWorkflows, ensureBlInvoiceWorkflows, ensureAllWorkflows } from '../workflows/workflowDefaults.js';
import {
  attachApprovers,
  resolveApprovalChain,
  FINANCIAL_REVIEW_THRESHOLD,
  STRATEGIC_REVIEW_THRESHOLD,
  detectApprovalConflict,
  getEscalationApprover
} from '../../services/approvalRouting.service.js';
const router = express.Router();

// Helper: Get FX conversion with fallback logging
async function getFxConversion(amount, currency = 'INR', customFxRate = null) {
  const num = Number(amount) || 0;
  const curr = String(currency || 'INR').toUpperCase();
  if (curr === 'INR' || num === 0) {
    return {
      amountINR: num,
      fxRate: 1,
      amountFormatted: `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    };
  }

  const DEFAULT_RATES = { USD: 83.5, EUR: 90.2, GBP: 105.4, CNY: 11.5, JPY: 0.56, AED: 22.7, SGD: 62.0 };
  let rate = customFxRate ? Number(customFxRate) : null;
  if (!rate || isNaN(rate) || rate <= 0) {
    const fxDoc = await ExchangeRate.findOne({ currency: curr }).lean().catch(() => null);
    rate = fxDoc?.rate || DEFAULT_RATES[curr] || 83.5;

    // Log fallback usage for monitoring
    if (!fxDoc) {
      console.warn(`[FX Warning] No exchange rate found for ${curr}, using fallback: ${rate}`);
    }
  }

  const amountINR = Math.round((num * rate) * 100) / 100;
  const amountFormatted = `${curr} ${num.toLocaleString('en-US', { minimumFractionDigits: 2 })} (₹${amountINR.toLocaleString('en-IN')})`;

  return { amountINR, fxRate: rate, amountFormatted };
}

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
  const itemsQuantity = (po?.items || []).reduce((total, item) => total + (Number(item.quantity) || 0), 0);
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

// ─── WORKFLOW RESOLUTION ──────────────────────────────────────────────────────

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

    // Filter workflows matching the specific module category
    let categoryWfs = workflows.filter(w => {
      const cat = (w.category || '').toLowerCase().trim();
      const name = (w.name || '').toLowerCase().trim();
      const mod = (moduleType || '').toLowerCase().trim();

      if (cat === mod || name === mod) return true;
      if (mod.includes('bl freight invoice') || mod.includes('bl invoice') || mod.includes('bl freight')) {
        return cat === 'bl freight invoice' || name.includes('bl freight invoice') || cat.includes('bl_invoice');
      }
      if (mod.includes('rfq')) {
        return cat.includes('rfq') || name.includes('rfq');
      }
      if (mod.includes('custom duty') || mod.includes('custom_duty')) {
        return cat.includes('custom duty') || name.includes('custom duty');
      }
      if (mod.includes('advance')) {
        return cat.includes('advance') || name.includes('advance');
      }
      if (mod === 'invoice payment' || mod === 'invoice_payment') {
        return (cat.includes('invoice payment') || name.includes('invoice payment')) && !cat.includes('bl');
      }
      return name.includes(mod) || cat.includes(mod);
    });

    // Seed RFQ workflows if missing
    if (!categoryWfs.length && String(moduleType).toLowerCase().includes('rfq')) {
      await ensureRfqAwardWorkflows();
      categoryWfs = await Workflow.find({ category: 'RFQ Vendor Award', status: { $in: ['active', 'Active'] } }).lean();
    }

    // Find matching workflow by amount and conditions
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


function getDefaultWorkflow(moduleType, amount) {
  const numAmount = Number(amount) || 0;
  const moduleName = String(moduleType || 'Payment');
  const isRfq = moduleName.toLowerCase().includes('rfq');
  const isBl = moduleName.toLowerCase().includes('bl');
  const isInvoice = moduleName.toLowerCase().includes('invoice');

  if (isRfq) {
    return buildWorkflowResult({ id: 'WF-BOOTSTRAP-RFQ', name: 'RFQ Award Standard Approval', version: 1 }, [
      { step: 1, title: 'Finance Lead Approval', roleName: 'Finance Lead', roleKey: 'finance_lead' }
    ]);
  }

  if (isBl) {
    return buildWorkflowResult({ id: 'WF-BOOTSTRAP-BL', name: 'BL Freight Invoice Standard Approval', version: 1 }, [
      { step: 1, title: 'Finance Lead Approval', roleName: 'Finance Lead', roleKey: 'finance' }
    ]);
  }

  if (isInvoice) {
    return buildWorkflowResult({ id: 'WF-BOOTSTRAP-INVOICE', name: 'Invoice Payment Standard Approval', version: 1 }, [
      { step: 1, title: 'Finance Lead Approval', roleName: 'Finance Lead', roleKey: 'finance_lead' }
    ]);
  }

  if (moduleName.toLowerCase().includes('custom')) {
    return buildWorkflowResult({ id: 'WF-BOOTSTRAP-CUSTOM', name: 'Custom Duty Standard Approval', version: 1 }, [
      { step: 1, title: 'Finance Lead Approval', roleName: 'Finance Lead', roleKey: 'finance' }
    ]);
  }

  if (numAmount >= 10000000) {
    return buildWorkflowResult({ id: 'WF-DEFAULT-HIGH', name: 'Advance Payment (Above ₹1 Cr)' }, [
      { step: 1, title: 'Procurement Head Approval', roleName: 'Procurement Head', roleKey: 'procurement_head' },
      { step: 2, title: 'MD Approval', roleName: 'MD Approval', roleKey: 'md' },
      { step: 3, title: 'Finance Approval', roleName: 'Finance Approval', roleKey: 'finance_lead' }
    ]);
  }

  return buildWorkflowResult({ id: 'WF-DEFAULT-STD', name: 'Advance Payment (Up to ₹1 Cr)' }, [
    { step: 1, title: 'Procurement Head Approval', roleName: 'Procurement Head', roleKey: 'procurement_head' },
    { step: 2, title: 'Finance Lead Approval', roleName: 'Finance Lead', roleKey: 'finance_lead' }
  ]);
}

function buildWorkflowResult(wf, rawSteps) {
  const steps = rawSteps.map((s, idx) => {
    const title = s.title || s.roleName || `Step ${idx + 1}`;
    const statusKey = `Pending ${title}`;
    return {
      step: s.step || (idx + 1),
      title,
      roleName: s.roleName || s.roleKey || title,
      roleKey: s.roleKey || s.roleName || title,
      statusKey
    };
  });

  return {
    workflowId: wf._id?.toString() || wf.id,
    workflowCode: wf.id || wf._id?.toString(),
    workflowVersion: Number(wf.version || 1),
    slab: wf.name || 'Standard',
    totalSteps: steps.length,
    steps
  };
}

// ─── APPROVAL RECORD CREATION ──────────────────────────────────────────────

// ─── APPROVAL RECORD CREATION ──────────────────────────────────────────────

async function createApprovalRecord({ referenceId, type, vendorName, amountFormatted, poRef, requestedBy, requestedById, requestId, transactionSnapshot = {}, wf }) {
  // Get requester with full details
  const requester = requestedById ? await User.findOne({
    $or: [
      { id: requestedById },
      { userId: requestedById },
      { email: requestedById }
    ]
  }, {
    id: 1,
    name: 1,
    role: 1,
    team: 1,
    managerId: 1,
    managerName: 1,
    department: 1,
    hierarchyLevel: 1,
    canSeeAllRequests: 1,
    isManager: 1,
    email: 1,
    employeeId: 1
  }).lean() : null;

  const numAmount = Number(transactionSnapshot?.amount || 0) || Number(String(amountFormatted).replace(/[^0-9.-]+/g, '')) || 0;

  // Get workflow steps
  let rawSteps = (wf && Array.isArray(wf.steps) && wf.steps.length > 0) ? wf.steps : null;
  if (!rawSteps || rawSteps.length === 0) {
    const fallbackWf = getDefaultWorkflow(type, numAmount);
    rawSteps = fallbackWf.steps || [];
  }

  // Hydrate steps with approvers - use the improved attachApprovers
  const stepsForWorkflow = await attachApprovers(rawSteps, requester);

  // Check for conflicts (requester is also approver)
  const hasConflict = stepsForWorkflow.some(step =>
    requester && step.assignedApproverId &&
    String(step.assignedApproverId) === String(requester.id)
  );

  // If conflict detected, escalate
  let finalSteps = stepsForWorkflow;
  if (hasConflict) {
    console.warn(`[Approval Conflict] Requester ${requester?.name} is also an approver. Escalating...`);

    // Re-resolve steps with escalation
    finalSteps = await Promise.all(
      stepsForWorkflow.map(async (step) => {
        if (requester && String(step.assignedApproverId) === String(requester.id)) {
          // Get escalation approver
          const escalated = await getEscalationApprover(step.assignedApproverId, step.roleKey);
          if (escalated) {
            return {
              ...step,
              assignedApproverId: escalated.id,
              assignedApproverName: escalated.name,
              assignedApproverRole: escalated.role,
              assignedApproverEmail: escalated.email,
              resolutionMethod: 'escalated_conflict',
              conflictEscalated: true,
              originalApproverId: step.assignedApproverId,
              originalApproverName: step.assignedApproverName
            };
          }
        }
        return step;
      })
    );
  }

  const firstStep = finalSteps[0] || null;
  const initialStatus = firstStep?.statusKey || (firstStep?.title ? `Pending ${firstStep.title}` : 'Pending Procurement Head Approval');

  const safeWf = wf || { totalSteps: finalSteps.length, steps: finalSteps };

  // Create approval record
  const newApproval = await Approval.create({
    id: referenceId,
    type,
    vendorName,
    amountOriginal: amountFormatted,
    amountINR: amountFormatted,
    currency: 'INR',
    requestedBy: requestedBy || 'Finance Team',
    currentSlab: safeWf?.slab || safeWf?.name || 'Standard',
    workflowId: safeWf?.workflowId || safeWf?.id || 'WF-STD',
    workflowVersion: safeWf?.workflowVersion || 1,
    workflowSnapshot: {
      workflowId: safeWf?.workflowId || safeWf?.id,
      workflowCode: safeWf?.workflowCode || safeWf?.id,
      version: safeWf?.workflowVersion || 1,
      slab: safeWf?.slab || safeWf?.name,
      steps: finalSteps
    },
    transactionSnapshot: { ...transactionSnapshot, referenceId, type, vendorName, amount: amountFormatted, poReference: poRef },
    requestedById: requester?.id || requestedById,
    requestedByName: requester?.name || requestedBy,
    requestedByEmail: requester?.email || null,
    requestedByTeam: requester?.team || null,
    requestedByDepartment: requester?.department || null,
    assignedApprover: firstStep?.assignedApproverId || null,
    assignedApproverName: firstStep?.assignedApproverName || null,
    assignedApproverRole: firstStep?.assignedApproverRole || firstStep?.roleKey || null,
    assignedApproverEmail: firstStep?.assignedApproverEmail || null,
    requestId,
    poReference: poRef || '',
    currentStep: 1,
    totalSteps: finalSteps.length,
    workflowSteps: JSON.stringify(finalSteps),
    status: initialStatus,
    submittedAt: new Date(),
    slaHours: 48,
    dueDate: new Date(Date.now() + 48 * 3600 * 1000),
    isOverdue: false,
    actionHistory: [],
    // Add metadata
    metadata: {
      approvalMethod: firstStep?.resolutionMethod || 'standard',
      hasConflict: hasConflict,
      escalatedAt: hasConflict ? new Date() : null,
      escalationReason: hasConflict ? 'Self-approval detected' : null
    }
  });

  // Create audit log
  await WorkflowAudit.create({
    eventId: `wa-${crypto.randomUUID()}`,
    eventType: 'APPROVAL_SUBMITTED',
    actorId: requester?.id || requestedById || 'system',
    actorName: requester?.name || requestedBy,
    entityType: type,
    entityId: referenceId,
    workflowId: safeWf?.workflowId || safeWf?.id,
    workflowVersion: safeWf?.workflowVersion || 1,
    step: 1,
    action: 'submit',
    previousState: { status: 'draft' },
    newState: {
      status: initialStatus,
      currentStep: 1,
      assignedApprover: firstStep?.assignedApproverName
    },
    requestId,
    metadata: {
      hasConflict,
      assignedTo: firstStep?.assignedApproverName
    }
  });

  // Send notifications to all potential approvers (for admin requests)
  const allApprovers = finalSteps
    .filter(step => step.assignedApproverId)
    .map(step => step.assignedApproverId);

  // If admin request with multiple procurement heads, notify all
  if (requester?.role?.toLowerCase().includes('admin')) {
    const allHeads = await User.find({
      role: { $in: ['procurement_head', 'Procurement Head', 'procurement'] },
      status: 'Active',
      id: { $nin: allApprovers }
    }).lean();

    // Notify backup approvers
    for (const head of allHeads) {
      try {
        sendApprovalCreatedEmails({
          approval: {
            ...newApproval.toObject(),
            assignedApproverName: head.name,
            assignedApproverEmail: head.email
          },
          isBackup: true
        });
      } catch (err) {
        console.error('[Email Error] Failed to send backup notification:', err.message);
      }
    }
  }

  // SSE notification
  broadcastEvent('APPROVAL_CREATED', {
    approvalId: referenceId,
    approvalType: type,
    amount: amountFormatted,
    vendorName: vendorName || '',
    requestedBy: requester?.name || requestedBy || 'Finance Team',
    firstStepRole: firstStep?.roleKey || firstStep?.roleName || '',
    firstStepTitle: firstStep?.title || firstStep?.roleName || 'Step 1',
    firstStepApprover: firstStep?.assignedApproverName || 'Unassigned',
    totalSteps: safeWf.totalSteps || finalSteps.length,
    hasConflict: hasConflict,
    resolutionMethod: firstStep?.resolutionMethod || 'standard'
  });

  // Email notification
  try {
    sendApprovalCreatedEmails({ approval: newApproval.toObject() });
  } catch (err) {
    console.error('[Email Error] Failed to send approval email:', err.message);
  }

  return newApproval;
}
// ─── SYNC EXISTING BL INVOICES ─────────────────────────────────────────────

async function syncExistingBlInvoicesToApprovals() {
  try {
    await ensureBlInvoiceWorkflows();
    await Approval.updateMany(
      { $or: [{ id: /^BLI-/ }, { type: 'Logistics Payments' }, { type: 'Logistics Payment' }] },
      { $set: { type: 'BL Freight Invoice' } }
    );
    const payments = await LogisticsPayment.find().lean();
    for (const p of payments) {
      const ref = p.referenceNumber || p.logisticsPaymentId;
      if (!ref) continue;
      const numAmount = Number(p.totalAmount || p.amount || 0);
      const wf = await resolveWorkflowFromDB('BL Freight Invoice', numAmount, { currency: p.currency || 'INR' });
      const currentStep = p.currentStep || 1;

      const existing = await Approval.findOne({ $or: [{ id: ref }, { referenceNumber: ref }] });
      if (!existing) {
        await createApprovalRecord({
          referenceId: ref,
          type: 'BL Freight Invoice',
          vendorName: p.vendorName || 'Logistics Provider',
          amountFormatted: `${p.currency || 'INR'} ${numAmount}`,
          poRef: p.blNumber || '',
          requestedBy: p.createdBy || p.vendorName || 'Vendor / Agent',
          requestedById: p.vendorId || 'vendor',
          transactionSnapshot: { blNumber: p.blNumber, invoiceNumber: p.invoiceNumber, category: p.category, source: p.source, amount: numAmount },
          wf
        });
        console.log(`[Master Data] Auto-created approval for BL Invoice: ${ref}`);
      } else {
        existing.type = 'BL Freight Invoice';
        existing.currentSlab = wf.slab; // Fixed: was wf.slabName
        existing.totalSteps = wf.steps.length;
        if (existing.currentStep > wf.steps.length) existing.currentStep = wf.steps.length;
        existing.status = p.status === 'Approved' ? 'Approved & Dispatched' :
          p.status === 'Rejected' ? 'Rejected' :
            wf.steps[existing.currentStep - 1]?.statusKey || 'Pending EXIM Approval';
        existing.amountOriginal = `${p.currency || 'INR'} ${numAmount}`;
        existing.amountINR = `${numAmount}`;
        existing.workflowSteps = JSON.stringify(wf.steps);
        await existing.save();
      }
    }
  } catch (err) {
    console.error('[Master Data] syncExistingBlInvoicesToApprovals error:', err.message);
  }
}

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

    const filter = { isDeleted: { $ne: true } };

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

    // Build search filter
    let searchFilter = {};
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      searchFilter = {
        $or: [
          { poNumber: regex }, { sapPoNumber: regex },
          { supplierName: regex }, { supplierId: regex }
        ]
      };
    }

    // Build status filter
    if (statusFilter && statusFilter !== 'All Status' && statusFilter !== 'All') {
      filter.status = statusFilter.toLowerCase();
    }

    // Build type filter (fixed: preserve search filter)
    let typeCondition = {};
    if (typeFilter && typeFilter !== 'All Types' && typeFilter !== 'All') {
      if (typeFilter === 'Import') {
        typeCondition = {
          $or: [{ poNumber: /^PO-43/i }, { poNumber: /^60/ }, { sapPoNumber: /^43/ }, { sapPoNumber: /^60/ }]
        };
      } else if (typeFilter === 'Domestic') {
        typeCondition = {
          $or: [{ poNumber: /^PO-41/i }, { poNumber: /^42/ }, { sapPoNumber: /^41/ }, { sapPoNumber: /^42/ }]
        };
      }
    }

    // Combine filters properly
    if (Object.keys(searchFilter).length > 0 && Object.keys(typeCondition).length > 0) {
      filter.$and = filter.$and || [];
      filter.$and.push(searchFilter, typeCondition);
    } else if (Object.keys(searchFilter).length > 0) {
      filter.$or = searchFilter.$or;
    } else if (Object.keys(typeCondition).length > 0) {
      filter.$or = typeCondition.$or;
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

    return res.json({
      success: true, data: enrichedPos, total, page: safePage, pageSize: size, totalPages,
      hasPrevious: safePage > 1, hasNext: safePage < totalPages
    });
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

router.post('/purchase-orders/create', authenticateToken, async (req, res) => {
  try {
    const { poNumber, sapPoNumber, supplierId, supplierName, totalAmount, currency, description } = req.body;
    const number = String(poNumber || sapPoNumber || '').trim();
    if (!number) {
      return res.status(400).json({ success: false, error: 'PO Number is required.' });
    }

    // Atomic upsert to prevent race conditions
    const po = await PurchaseOrder.findOneAndUpdate(
      { $or: [{ poNumber: number }, { sapPoNumber: number }] },
      {
        $setOnInsert: {
          poNumber: number,
          sapPoNumber: number || number,
          supplierId: supplierId || '11001810',
          supplierName: supplierName || 'Rayzon Logistics Master Vendor',
          companyCode: '1000',
          totalAmount: Number(totalAmount) > 0 ? Number(totalAmount) : 500000,
          currency: currency || 'INR',
          documentDate: new Date(),
          status: 'open',
          items: [
            {
              itemNumber: '10',
              description: description || 'Solar Freight Logistics Sourcing',
              quantity: 5,
              unitPrice: (Number(totalAmount) || 500000) / 5,
              totalPrice: Number(totalAmount) || 500000,
              uom: 'PCS'
            }
          ]
        }
      },
      { upsert: true, new: true }
    );

    return res.status(po.isNew ? 201 : 200).json({
      success: true,
      message: po.isNew ? `PO ${number} created successfully.` : `PO ${number} is open in database.`,
      data: po
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADVANCE PAYMENTS
// ─────────────────────────────────────────────────────────────────────────────
const getAdvancesHandler = async (req, res) => {
  try {
    const page = Math.max(
      1,
      Number.parseInt(req.query.page, 10) || 1
    );

    const size = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(
          req.query.size || req.query.pageSize,
          10
        ) || 10
      )
    );

    const search = String(
      req.query.q || req.query.search || ""
    ).trim();

    const statusFilter = String(
      req.query.status || ""
    ).trim();

    // ==================================================
    // 1. GET LOGGED-IN USER
    // ==================================================

    const loginUser = await User.findOne(
      { email: req.user?.email },
      {
        _id: 0,
        id: 1,
        name: 1,
        email: 1,
        role: 1,
        department: 1,
        managerId: 1,
        managerName: 1,
        hierarchyLevel: 1,
        canSeeAllRequests: 1,
        status: 1
      }
    ).lean();

    console.log("Logged-in user:", loginUser);

    if (!loginUser) {
      return res.status(401).json({
        success: false,
        error: "Logged-in user not found."
      });
    }

    const loggedInUserId = loginUser.id;

    // ==================================================
    // 2. GET ALL ACTIVE USERS
    // ==================================================

    const users = await User.find(
      { status: "Active" },
      {
        _id: 0,
        id: 1,
        name: 1,
        email: 1,
        managerId: 1,
        managerName: 1,
        role: 1,
        department: 1,
        hierarchyLevel: 1,
        canSeeAllRequests: 1
      }
    )
      .sort({
        hierarchyLevel: 1,
        name: 1
      })
      .lean();

    // ==================================================
    // 3. GROUP USERS BY managerId
    //
    // IMPORTANT:
    // Hierarchy uses IDs, NOT names.
    // ==================================================

    const byManager = new Map();

    for (const user of users) {
      const managerId = user.managerId || "root";

      if (!byManager.has(managerId)) {
        byManager.set(managerId, []);
      }

      byManager.get(managerId).push(user);
    }

    // ==================================================
    // 4. FIND ALL CHILDREN RECURSIVELY
    // ==================================================

    const teamUsers = new Map();

    const collectChildren = (
      managerId,
      visited = new Set()
    ) => {
      const children = byManager.get(managerId) || [];

      for (const child of children) {

        // Prevent circular hierarchy
        if (visited.has(child.id)) {
          continue;
        }

        // Store by USER ID
        teamUsers.set(child.id, child);

        const nextVisited = new Set(visited);
        nextVisited.add(child.id);

        // Continue to next level
        collectChildren(child.id, nextVisited);
      }
    };

    collectChildren(loggedInUserId);

    // ==================================================
    // 5. BUILD ALLOWED USER NAMES
    //
    // AdvancePayment.createdBy stores NAME
    // ==================================================

    const allowedUsers = [
      loginUser,
      ...teamUsers.values()
    ];

    const allowedUserNames = [
      ...new Set(
        allowedUsers
          .map((user) => user.name)
          .filter(Boolean)
      )
    ];

    console.log(
      "Logged-in user:",
      loginUser.name
    );

    console.log(
      "Allowed users:",
      allowedUsers.map((u) => ({
        id: u.id,
        name: u.name,
        managerId: u.managerId
      }))
    );

    console.log(
      "Allowed user names:",
      allowedUserNames
    );

    // ==================================================
    // 6. ADVANCE PAYMENT FILTER
    // ==================================================

    const filter = {
      isDeleted: { $ne: true },

      // AdvancePayment stores createdBy = NAME
      createdBy: {
        $in: allowedUserNames
      }
    };

    // ==================================================
    // 7. SEARCH
    // ==================================================

    if (search) {
      const regex = new RegExp(
        escapeRegex(search),
        "i"
      );

      filter.$and = [
        {
          $or: [
            { advanceId: regex },
            { poId: regex },
            { sapPoNumber: regex },
            { vendorName: regex },
            { vendorId: regex },
            { bankName: regex },
            { createdBy: regex }
          ]
        }
      ];
    }

    // ==================================================
    // 8. STATUS
    // ==================================================

    if (
      statusFilter &&
      statusFilter !== "All Status" &&
      statusFilter !== "All"
    ) {
      filter.status = statusFilter.toLowerCase();
    }

    // ==================================================
    // 9. COUNT
    // ==================================================

    const total =
      await AdvancePayment.countDocuments(filter);

    const totalPages =
      Math.max(1, Math.ceil(total / size));

    const safePage =
      Math.min(page, totalPages);

    // ==================================================
    // 10. GET ADVANCE PAYMENTS
    // ==================================================

    const advances =
      await AdvancePayment.find(filter)
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * size)
        .limit(size)
        .lean();

    // ==================================================
    // 11. RESPONSE
    // ==================================================

    return res.json({
      success: true,

      data: advances,

      total,

      page: safePage,

      pageSize: size,

      totalPages,

      hasPrevious: safePage > 1,

      hasNext: safePage < totalPages,

      access: {
        loggedInUserId,

        loggedInUserName: loginUser.name,

        allowedUserNames,

        totalUsers: allowedUserNames.length
      }
    });

  } catch (err) {
    console.error(
      "getAdvancesHandler error:",
      err
    );

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
router.get('/advances', authenticateToken, getAdvancesHandler);
router.get('/advance-payments', authenticateToken, getAdvancesHandler);

const getSingleAdvanceHandler = async (req, res) => {
  try {
    const adv = await AdvancePayment.findOne({
      $and: [
        buildAdvanceFilter(req.params.id),
        { isDeleted: { $ne: true } }
      ]
    }).lean();
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
    const vendorIdFinal = req.user?.role === 'Vendor' ? (req.user.sapVendorCode || po.supplierId) : (vendorCode || po.supplierId || 'VEND-00000');
    const poRef = po?.sapPoNumber || poNumber;
    const numAmount = Number(amount);

    const advanceId = 'ADV-' + Date.now().toString().slice(-6);

    const newAdv = await AdvancePayment.create({
      advanceId,
      poId: po?.poNumber || poNumber,
      sapPoNumber: poRef,
      vendorId: vendorIdFinal,
      vendorName: vendorNameFinal,
      amount: numAmount,
      currency: poCurrency,
      percentageOfPo: Number(percentageOfPo) || 0,
      gstBreakup: {
        cgst: Number(cgst) || 0,
        sgst: Number(sgst) || 0,
        igst: Number(igst) || 0,
        totalGst: Number(totalGst) || 0
      },
      paymentMode: paymentMode || 'NEFT',
      bankName: bankName || 'HDFC Bank',
      bankAccountNumber: bankAccountNumber || '',
      remarks: remarks || '',
      status: 'pending',
      createdBy: requestedBy || 'Finance Team'
    });

    const { amountINR, fxRate, amountFormatted } = await getFxConversion(numAmount, poCurrency, req.body.fxRate);

    const wf = await resolveWorkflowFromDB('Advance Payment', amountINR, { currency: poCurrency, vendorType: req.user?.vendorType, poType: po.poType || po.type });

    await createApprovalRecord({
      referenceId: advanceId,
      type: 'Advance Payment',
      vendorName: vendorNameFinal,
      amountFormatted,
      poRef,
      requestedBy: requestedBy || 'Finance Team',
      requestedById: req.user?.id || req.user?.email,
      requestId: req.headers['x-request-id'],
      transactionSnapshot: { amount: numAmount, amountINR, currency: poCurrency, fxRate, poId: poRef, vendorId: vendorIdFinal },
      wf
    });

    try {
      await WorkflowAudit.create({
        eventId: `wa-${crypto.randomUUID()}`,
        eventType: 'ADVANCE_SUBMITTED',
        entityType: 'AdvancePayment',
        entityId: advanceId,
        referenceNumber: advanceId,
        poReference: poRef,
        action: 'submit',
        actorId: req.user?.id || req.user?.email || 'system',
        actorName: req.user?.name || req.user?.email || requestedBy || 'Finance Team',
        actorRole: req.user?.role || 'Requester',
        remarks: `Advance Payment request "${advanceId}" (${poCurrency} ${numAmount.toLocaleString('en-IN')}) submitted for approval.`,
        occurredAt: new Date()
      });
    } catch (_) { }

    return res.json({
      success: true,
      message: 'Advance payment created and sent for approval.',
      data: newAdv,
      workflow: wf
    });
  } catch (err) {
    console.error('[Create Advance]', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

router.post('/advances/create', authenticateToken, createAdvanceHandler);
router.post('/advance-payments/create', authenticateToken, createAdvanceHandler);

const updateAdvanceHandler = async (req, res) => {
  try {
    const adv = await AdvancePayment.findOne(buildAdvanceFilter(req.params.id));
    if (!adv) return res.status(404).json({ success: false, error: 'Advance payment not found' });

    const { amount, paymentMode, bankName, bankAccountNumber, remarks } = req.body;
    if (amount !== undefined) adv.amount = Number(amount);
    if (paymentMode !== undefined) adv.paymentMode = paymentMode;
    if (bankName !== undefined) adv.bankName = bankName;
    if (bankAccountNumber !== undefined) adv.bankAccountNumber = bankAccountNumber;
    if (remarks !== undefined) adv.remarks = remarks;

    await adv.save();

    try {
      await WorkflowAudit.create({
        eventId: `wa-${crypto.randomUUID()}`,
        eventType: 'ADVANCE_UPDATED',
        entityType: 'AdvancePayment',
        entityId: adv.advanceId,
        referenceNumber: adv.advanceId,
        poReference: adv.sapPoNumber || adv.poId,
        action: 'update',
        actorId: req.user?.id || req.user?.email || 'system',
        actorName: req.user?.name || req.user?.email || 'User',
        actorRole: req.user?.role || 'User',
        remarks: `Advance Payment request details updated (Amount: ${adv.amount}, Mode: ${adv.paymentMode}).`,
        occurredAt: new Date()
      });
    } catch (_) { }

    return res.json({ success: true, data: adv });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

router.put('/advances/:id', updateAdvanceHandler);
router.put('/advance-payments/:id', updateAdvanceHandler);

// ─── DELETE Advance Payment ───────────────────────────────────────────────────

const deleteAdvanceHandler = async (req, res) => {
  try {
    const adv = await AdvancePayment.findOne(buildAdvanceFilter(req.params.id));
    if (adv) {
      try {
        await WorkflowAudit.create({
          eventId: `wa-${crypto.randomUUID()}`,
          eventType: 'ADVANCE_DELETED',
          entityType: 'AdvancePayment',
          entityId: adv.advanceId,
          referenceNumber: adv.advanceId,
          poReference: adv.sapPoNumber || adv.poId,
          action: 'delete',
          actorId: req.user?.id || req.user?.email || 'system',
          actorName: req.user?.name || req.user?.email || 'User',
          actorRole: req.user?.role || 'User',
          remarks: `Advance Payment request "${adv.advanceId}" deleted.`,
          occurredAt: new Date()
        });
      } catch (_) { }
      adv.isDeleted = true;
      adv.deletedAt = new Date();
      adv.deletedBy = req.user?.email || 'User';
      await adv.save();
      await Approval.deleteOne({ id: adv.advanceId }).catch(() => { });
    }
    res.json({ success: true, message: 'Advance payment soft deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

router.delete('/advances/:id', deleteAdvanceHandler);
router.delete('/advance-payments/:id', deleteAdvanceHandler);

// ─── PUT Update Advance Payment Status ──────────────────────────────────────

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

    await InvoicePayment.deleteMany({ invoicePaymentId: { $in: ['INV-PAY-901', 'INV-PAY-902', 'INV-PAY-903'] } }).catch(() => { });

    const filter = { isDeleted: { $ne: true } };
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

    return res.json({
      success: true, data: invoices, total, page: safePage, pageSize: size, totalPages,
      hasPrevious: safePage > 1, hasNext: safePage < totalPages
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/invoices/:id', async (req, res) => {
  try {
    const inv = await InvoicePayment.findOne({
      $and: [
        buildInvoiceFilter(req.params.id),
        { isDeleted: { $ne: true } }
      ]
    }).lean();
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
    const vendorIdFinal = req.user?.role === 'Vendor' ? (req.user.sapVendorCode || po.supplierId) : (vendorId || po.supplierId || 'VEND-00000');
    const poRef = po?.sapPoNumber || poNumber || '4300001510';

    const numGross = Number(grossAmount) || 0;
    const numGst = Number(gstAmount) || 0;
    const tdsRate = Number.parseFloat(tdsPercentage) || 0;
    const numTds = tdsAmount == null ? (numGross * tdsRate / 100) : (Number(tdsAmount) || 0);
    const numAdv = Number(advanceAdjusted) || 0;
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

    // Unique invoice number with retry
    let finalInvoiceNumber = String(invoiceNumber || '').trim();
    if (!finalInvoiceNumber) {
      finalInvoiceNumber = 'INV-' + new Date().getFullYear() + '-' + Math.floor(100000 + Math.random() * 900000);
    }

    // Check for duplicates with retry
    let retries = 3;
    while (retries > 0) {
      const existingInv = await InvoicePayment.findOne({ invoiceNumber: finalInvoiceNumber, vendorId: vendorIdFinal });
      if (!existingInv) break;
      // Generate new number and retry
      finalInvoiceNumber = 'INV-' + new Date().getFullYear() + '-' + Math.floor(100000 + Math.random() * 900000);
      retries--;
    }
    if (retries === 0) {
      return res.status(409).json({ success: false, error: 'Unable to generate unique invoice number. Please try again.' });
    }

    const invPaymentId = 'INV-PAY-' + Date.now().toString().slice(-6);

    const vendor = await Vendor.findOne({
      $or: [
        { id: vendorIdFinal },
        { sapVendorCode: vendorIdFinal },
        { supplierId: vendorIdFinal }
      ]
    }).lean();

    const isImportVendor = String(vendor?.vendorType || '').toLowerCase().includes('import');
    const asnNumber = isImportVendor
      ? (String(requestedAsnNumber || '').trim() || `ASN-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`)
      : '';

    const grnQty = grnQuantity && Number(grnQuantity) > 0 ? Number(grnQuantity) : (invQty > 0 ? invQty : poQty);
    const isMatched = (poQty === grnQty) && (grnQty === invQty);

    const newInvoice = await InvoicePayment.create({
      invoicePaymentId: invPaymentId,
      poId: po?.poNumber || poNumber || 'PO-4300001510',
      sapPoNumber: poRef,
      vendorId: vendorIdFinal,
      vendorName: vendorNameFinal,
      invoiceNumber: finalInvoiceNumber,
      asnNumber: asnNumber,
      invoiceDate: invoiceDate && !Number.isNaN(Date.parse(invoiceDate)) ? new Date(invoiceDate) : new Date(),
      grossAmount: numGross,
      currency: poCurrency,
      gstAmount: numGst,
      tdsAmount: numTds,
      tdsPercentage: tdsRate,
      advanceAdjusted: numAdv,
      advanceIdAdjusted: advanceIdAdjusted || '',
      grnNumber: grnNumber || '',
      remarks: remarks || '',
      approvalTo: approvalTo || '',
      netPayable,
      threeWayMatch: {
        status: isMatched ? 'matched' : 'mismatch',
        poQuantity: poQty,
        grnQuantity: grnQty,
        invoiceQuantity: invQty,
        varianceAmount: isMatched ? 0 : Math.max(0, Math.abs((Number.isFinite(invQty) ? invQty : 0) - (Number.isFinite(grnQty) ? grnQty : 0))),
        matchedAt: new Date()
      },
      status: 'pending',
      createdBy: requestedBy || 'Finance Team'
    });

    const { amountINR, fxRate, amountFormatted } = await getFxConversion(netPayable, poCurrency, req.body.fxRate);
    const wf = await resolveWorkflowFromDB('Invoice Payment', amountINR, { currency: poCurrency, vendorType: vendor?.vendorType, poType: po.poType || po.type });

    await createApprovalRecord({
      referenceId: invPaymentId,
      type: 'Invoice Payment',
      vendorName: vendorNameFinal,
      amountFormatted,
      poRef,
      requestedBy: requestedBy || 'Finance Team',
      requestedById: req.user?.id || req.user?.email,
      requestId: req.headers['x-request-id'],
      transactionSnapshot: { netPayable, amountINR, grossAmount: numGross, currency: poCurrency, fxRate, poId: poRef, vendorId: vendorIdFinal, invoiceNumber: finalInvoiceNumber },
      wf
    });

    try {
      await WorkflowAudit.create({
        eventId: `wa-${crypto.randomUUID()}`,
        eventType: 'INVOICE_SUBMITTED',
        entityType: 'InvoicePayment',
        entityId: invPaymentId,
        referenceNumber: finalInvoiceNumber,
        poReference: poRef,
        action: 'submit',
        actorId: req.user?.id || req.user?.email || 'system',
        actorName: req.user?.name || req.user?.email || requestedBy || 'Finance Team',
        actorRole: req.user?.role || 'Requester',
        remarks: `Invoice Payment "${invPaymentId}" (${finalInvoiceNumber}) submitted for approval. Net Payable: ₹${netPayable.toLocaleString('en-IN')}`,
        occurredAt: new Date()
      });
    } catch (_) { }

    return res.json({ success: true, data: newInvoice, workflow: wf });
  } catch (err) {
    console.error('[Create Invoice]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT Update Invoice ───────────────────────────────────────────────────────

router.put('/invoices/:id', optionalAuth, async (req, res) => {
  try {
    const invoice = await InvoicePayment.findOne(buildInvoiceFilter(req.params.id));
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice payment not found' });

    const { poNumber, invoiceNumber, grossAmount, gstAmount, tdsAmount,
      tdsPercentage, advanceAdjusted, grnNumber, remarks, approvalTo, asnNumber } = req.body;

    if (invoiceNumber) invoice.invoiceNumber = invoiceNumber.trim();
    if (asnNumber !== undefined) invoice.asnNumber = asnNumber.trim();
    if (grossAmount !== undefined) invoice.grossAmount = Number(grossAmount);
    if (gstAmount !== undefined) invoice.gstAmount = Number(gstAmount);
    if (tdsAmount !== undefined) invoice.tdsAmount = Number(tdsAmount);
    if (tdsPercentage !== undefined) invoice.tdsPercentage = Number(tdsPercentage);
    if (advanceAdjusted !== undefined) invoice.advanceAdjusted = Number(advanceAdjusted);
    if (grnNumber !== undefined) invoice.grnNumber = grnNumber.trim();
    if (remarks !== undefined) invoice.remarks = remarks.trim();
    if (approvalTo !== undefined) invoice.approvalTo = approvalTo;

    invoice.netPayable = Math.max(0,
      (invoice.grossAmount || 0) + (invoice.gstAmount || 0)
      - (invoice.tdsAmount || 0) - (invoice.advanceAdjusted || 0)
    );

    await invoice.save();

    try {
      await WorkflowAudit.create({
        eventId: `wa-${crypto.randomUUID()}`,
        eventType: 'INVOICE_UPDATED',
        entityType: 'InvoicePayment',
        entityId: invoice.invoicePaymentId,
        referenceNumber: invoice.invoiceNumber,
        poReference: invoice.sapPoNumber || invoice.poId,
        action: 'update',
        actorId: req.user?.id || req.user?.email || 'admin@rayzon.one',
        actorName: req.user?.name || req.user?.companyName || req.user?.email || 'System Admin',
        actorRole: req.user?.role || 'System Admin',
        remarks: `Invoice Payment "${invoice.invoicePaymentId}" details updated (Gross Amount: ${invoice.grossAmount}, GRN: ${invoice.grnNumber || 'N/A'}).`,
        occurredAt: new Date()
      });
    } catch (_) { }

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
        if (status === 'approved') approval.status = 'Approved & Dispatched';
        else if (status === 'rejected') approval.status = 'Rejected';
        else if (status === 'returned') approval.status = 'Returned for changes';
        else if (status === 'pending') {
          let wfSteps = [];
          try { wfSteps = JSON.parse(approval.workflowSteps || '[]'); } catch (_) { }
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
    invoice.status = 'paid';
    invoice.paidAt = new Date();
    await invoice.save();

    const approval = await Approval.findOne({
      $or: [{ id: invoice.invoicePaymentId }, { id: req.params.id }]
    });
    if (approval) {
      approval.status = 'Approved & Dispatched';
      await approval.save();
    }

    await PaymentLedger.create({
      ledgerId: 'LEDGER-' + Date.now().toString().slice(-6),
      moduleType: 'InvoicePayment',
      referenceId: invoice.invoicePaymentId,
      poReference: invoice.sapPoNumber || invoice.poId,
      vendorName: invoice.vendorName,
      amount: invoice.netPayable,
      currency: 'INR',
      paymentMode: paymentMode || 'NEFT',
      utrNumber: utrNumber.trim(),
      status: 'completed',
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
      await Approval.deleteOne({ id: inv.invoicePaymentId }).catch(() => { });
    }
    res.json({ success: true, message: 'Invoice payment deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// RFQ ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// Helper functions for RFQ
async function nextRfqNumber() {
  const year = new Date().getFullYear();
  const latest = await RfqHeader.findOne({ rfqNumber: new RegExp(`^RFQ-${year}-`) }).sort({ rfqNumber: -1 }).select('rfqNumber').lean();
  const sequence = Math.max(0, Number(String(latest?.rfqNumber || '').split('-').pop()) || 0) + 1;
  return `RFQ-${year}-${String(sequence).padStart(4, '0')}`;
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

function validateOpenPo(po) {
  const status = String(po?.status || '').trim().toLowerCase();
  return Boolean(po && Number(po.totalAmount) > 0 && !['closed', 'cancelled', 'canceled', 'blocked'].includes(status));
}

function isRfqClosed(closingDate) {
  if (!closingDate) return false;
  const deadline = new Date(closingDate);
  const isUtcMidnight = deadline.getUTCHours() === 0 && deadline.getUTCMinutes() === 0 && deadline.getUTCSeconds() === 0;
  const isLocalMidnight = deadline.getHours() === 0 && deadline.getMinutes() === 0 && deadline.getSeconds() === 0;
  if (isLocalMidnight) {
    deadline.setHours(23, 59, 59, 999);
  } else if (isUtcMidnight) {
    deadline.setUTCHours(23, 59, 59, 999);
  }
  return deadline < new Date();
}

async function getFreightVendorFromRequest(req) {
  const keys = [req.user?.id, req.user?.sapVendorCode].filter(Boolean);
  if (!keys.length || req.user?.role !== 'Vendor') return null;
  const freightType = /(freight|forwarder|logistics|shipping)/i;
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

// ─── GET /api/p2p/rfqs ────────────────────────────────────────────────────────

router.get('/rfqs', authenticateToken, async (req, res) => {
  try {
    const search = String(req.query.q || req.query.search || '').trim();
    const statusFilter = String(req.query.status || '').trim();

    const filter = { isDeleted: { $ne: true } };
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
        let currentStatus = r.status || 'published';

        if (r.awardApprovalId) {
          const app = await Approval.findOne({ id: r.awardApprovalId }).select('status').lean();
          if (app) {
            if (app.status === 'Approved & Dispatched') {
              currentStatus = 'awarded';
              if (r.status !== 'awarded') {
                await RfqHeader.updateOne({ _id: r._id }, { status: 'awarded' });
              }
            } else if (app.status === 'Rejected') {
              currentStatus = 'published';
              if (r.status !== 'published') {
                await RfqHeader.updateOne({ _id: r._id }, { status: 'published' });
              }
            }
          }
        } else if (r.status === 'pending_approval') {
          const app = await Approval.findOne({ 'transactionSnapshot.rfqId': r.rfqId }).sort({ createdAt: -1 }).lean();
          if (app) {
            if (app.status === 'Approved & Dispatched') {
              currentStatus = 'awarded';
              await RfqHeader.updateOne({ _id: r._id }, { status: 'awarded', awardApprovalId: app.id });
            } else if (app.status === 'Rejected') {
              currentStatus = 'published';
              await RfqHeader.updateOne({ _id: r._id }, { status: 'published' });
            }
          }
        }

        const quoteCount = await RfqQuote.countDocuments({ rfqId: r.rfqId });
        const invitedCount = (r.invitedVendors && Array.isArray(r.invitedVendors)) ? r.invitedVendors.length : 0;
        return {
          ...r,
          status: currentStatus,
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

router.get('/logistics-providers', async (req, res) => {
  try {
    let providers = await LogisticsProvider.find().sort({ createdAt: -1 }).lean().catch(() => []);

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

router.get('/logistics-providers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const filter = { $or: [{ providerId: id }] };
    if (mongoose.Types.ObjectId.isValid(id)) {
      filter.$or.push({ _id: id });
    }

    let provider = await LogisticsProvider.findOne(filter).lean();

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

router.put('/logistics-providers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    delete updates.providerId;

    // Build filter safely - don't use null in $or
    const filter = { $or: [{ providerId: id }] };
    if (mongoose.Types.ObjectId.isValid(id)) {
      filter.$or.push({ _id: id });
    }

    // Don't use upsert: true - this would create malformed documents
    const updated = await LogisticsProvider.findOneAndUpdate(
      filter,
      updates,
      { new: true, upsert: false }
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Provider not found.' });
    }

    return res.json({ success: true, message: 'Provider updated successfully', provider: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/logistics-providers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const filter = { $or: [{ providerId: id }] };
    if (mongoose.Types.ObjectId.isValid(id)) {
      filter.$or.push({ _id: id });
    }

    await LogisticsProvider.findOneAndDelete(filter);

    return res.json({ success: true, message: 'Provider deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET Freight Forwarders / Shipping Lines Vendor List ──────────────────────

router.get('/rfqs/logistics-vendors', authenticateToken, async (req, res) => {
  try {
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
    )).catch(() => { });

    return res.status(201).json({ success: true, data: newRfq });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET Single RFQ Details ──────────────────────────────────────────────────

router.get('/rfqs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    let rfq = await RfqHeader.findOne({ $or: [{ rfqId: id }, { rfqNumber: id }, { awardApprovalId: id }] }).lean();

    if (!rfq) {
      const app = await Approval.findOne({ $or: [{ id }, { referenceId: id }] }).lean();
      if (app && app.transactionSnapshot?.rfqId) {
        const targetId = app.transactionSnapshot.rfqId;
        rfq = await RfqHeader.findOne({ $or: [{ rfqId: targetId }, { rfqNumber: targetId }] }).lean();
      }
    }

    if (!rfq) {
      return res.status(404).json({ success: false, error: 'RFQ not found' });
    }

    const quotes = await RfqQuote.find({ rfqId: rfq.rfqId }).sort({ totalInr: 1 }).lean();
    const blEntries = await RfqBlEntry.find({ rfqId: rfq.rfqId }).lean();

    // Get approval if exists (should be unique by id)
    const approval = rfq.awardApprovalId
      ? await Approval.findOne({ id: rfq.awardApprovalId }).lean()
      : null;

    let approvalProgress = null;
    if (approval) {
      let steps = [];
      try { steps = JSON.parse(approval.workflowSteps || '[]'); } catch (_) { }
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
      const isAdmin = ['admin', 'system_admin', 'super_admin'].includes(String(req.user?.role || '').toLowerCase());

      approvalProgress = {
        id: approval.id,
        status: approval.status,
        slab: approval.currentSlab,
        currentStep: Number(approval.currentStep || 1),
        totalSteps: steps.length || Number(approval.totalSteps || 0),
        requiredRole,
        canCurrentUserAct: !terminalApproved && !terminalRejected && (isAdmin || (!isOwnRequest && canAct)),
        blockedReason: terminalApproved ? 'Approval completed.' : terminalRejected ? 'Approval rejected.' : (!isAdmin && isOwnRequest) ? 'The requester cannot approve their own request.' : (isAdmin || canAct) ? '' : `Waiting for a user with the ${requiredRole || 'required'} role.`,
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
      await RfqQuote.deleteMany({ rfqId: rfq.rfqId }).catch(() => { });
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

    const newRfq = {
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
    };

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
    const usdRate = 92.5;
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

    const allowedStatuses = ['published', 'open', 'partially_awarded', 'awarded'];
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
        return {
          quoteId: quote.quoteId,
          vendorId: quote.vendorId,
          vendorName: quote.vendorName,
          vendorCode: quote.vendorId,
          containers,
          ratePerContainer: Number(quote.totalInr) || 0,
          allocationAmount: (Number(quote.totalInr) || 0) * containers,
          remark: String(item.remark || '').trim()
        };
      });

      const allocated = normalized.reduce((sum, item) => sum + item.containers, 0);

      // Restore exact allocation validation
      if (allocated !== totalContainers) {
        return res.status(400).json({
          success: false,
          error: `Allocate exactly all ${totalContainers} RFQ containers before submitting the award.`
        });
      }

      // Add upper-bound check
      if (allocated > totalContainers) {
        return res.status(400).json({
          success: false,
          error: `Cannot allocate more than ${totalContainers} containers.`
        });
      }

      if (new Set(normalized.map((item) => item.quoteId)).size !== normalized.length) {
        return res.status(400).json({ success: false, error: 'A vendor quote can only be allocated once.' });
      }

      const totalAmount = normalized.reduce((sum, item) => sum + item.allocationAmount, 0);

      const approvalIdPrefix = isReassignment ? 'RFQ-REASSIGN' : 'RFQ-AWARD';
      const approvalId = `${approvalIdPrefix}-${rfq.rfqNumber}-${Date.now().toString().slice(-5)}`;

      const awardWorkflow = await resolveWorkflowFromDB('RFQ Vendor Award', totalAmount, { currency: 'INR', cargoType: rfq.cargoDetails?.cargoType });

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

      const isFullReassignment = Boolean(isReassignment) && rfq.status === 'awarded' && (Number(rfq.allocatedQuantity) >= totalContainers);

      const previouslyApprovedAllocations = isFullReassignment
        ? []
        : (rfq.get('awardAllocations') || []).filter(a => a.approved === true);
      const previouslyAllocatedQty = previouslyApprovedAllocations.reduce((sum, a) => sum + (Number(a.containers) || 0), 0);

      if (isFullReassignment) {
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

      const pendingAllocations = normalized.map(a => ({ ...a, approved: false, cycleApprovalId: approvalId }));
      const combinedAllocations = [
        ...previouslyApprovedAllocations,
        ...pendingAllocations
      ];

      rfq.status = 'pending_approval';
      rfq.totalQuantity = totalContainers;
      rfq.allocatedQuantity = previouslyAllocatedQty;
      rfq.pendingAllocation = Math.max(0, totalContainers - previouslyAllocatedQty);
      rfq.set('awardAllocations', combinedAllocations);
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

// ─── RFQ Vendor Routes ──────────────────────────────────────────────────────

router.get('/vendor-rfqs', authenticateToken, async (req, res) => {
  try {
    const vendor = await getFreightVendorFromRequest(req);
    if (!vendor) return res.status(403).json({ success: false, error: 'Freight Forwarder access is required.' });
    const rfqs = (await RfqHeader.find({}).sort({ createdAt: -1 }).lean())
      .filter((rfq) => isFreightVendorInvited(rfq, vendor));
    const ids = [vendor.id, vendor.sapVendorCode, vendor.supplierId].filter(Boolean);
    const quotes = await RfqQuote.find({ vendorId: { $in: ids } }).lean();
    const approvalIds = rfqs.map((rfq) => rfq.awardApprovalId).filter(Boolean);
    const approvals = approvalIds.length ? await Approval.find({ id: { $in: approvalIds } }).select('id status').lean() : [];
    const approvalById = new Map(approvals.map((approval) => [approval.id, approval]));
    return res.json({
      success: true, data: rfqs.map((rfq) => {
        const approval = rfq.awardApprovalId ? approvalById.get(rfq.awardApprovalId) : null;
        const approvalPending = Boolean(rfq.awardApprovalId && approval?.status !== 'Approved & Dispatched');
        return { ...rfq, status: approvalPending ? 'pending_approval' : rfq.status, awardApprovalStatus: approval?.status || null, myQuote: quotes.find((q) => q.rfqId === rfq.rfqId) || null };
      })
    });
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
    if (String(rfq.status).toLowerCase() === 'closed' || String(rfq.status).toLowerCase() !== 'published' || isRfqClosed(rfq.closingDate)) {
      return res.status(400).json({ success: false, error: 'This RFQ is closed. Quote submission deadline has passed.' });
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
      {
        $set: {
          vendorName: vendor.companyName, shippingLine: String(req.body.shippingLine).trim(),
          oceanFreightUsd: ocean, stChargesInr: shipping, otherChargesInr: other,
          totalInr: Math.round(ocean * 92.5 + shipping + other), freightAmount: ocean,
          destinationCharges: shipping, transitDays, vesselRoute: req.body.vesselRoute || '',
          cutoffDate: req.body.cutoffDate || null, vesselEtd: req.body.vesselEtd || null,
          vesselEta: req.body.vesselEta || null, freeDays: req.body.freeDays || '',
          rateValidity: req.body.rateValidity || '', costParticular: req.body.costParticular || '',
          remarks: req.body.remarks || '', status: 'submitted'
        }, $setOnInsert: { quoteId: `Q-${Date.now().toString().slice(-6)}` }
      },
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

router.get('/validate-asn', authenticateToken, async (req, res) => {
  try {
    const asnNumber = String(req.query.asnNumber || '').trim().toUpperCase();
    const rfqId = String(req.query.rfqId || '').trim();

    if (!asnNumber) {
      return res.status(400).json({ success: false, valid: false, error: 'ASN Number is required.' });
    }
    if (asnNumber.length < 3 || asnNumber.length > 30) {
      return res.status(400).json({ success: false, valid: false, error: 'ASN Number must be between 3 and 30 characters.' });
    }
    if (!/^[A-Z0-9\-_/]+$/i.test(asnNumber)) {
      return res.status(400).json({ success: false, valid: false, error: 'ASN Number can only contain letters, numbers, hyphens, and slashes.' });
    }

    const existsInBl = await RfqBlEntry.exists({ $or: [{ asnNumber }, { autoAsnNumber: asnNumber }] });
    if (existsInBl) {
      return res.json({ success: true, valid: false, error: `ASN Number "${asnNumber}" has already been used for a BL entry.` });
    }

    let matchingInvoice = null;
    if (rfqId) {
      const rfq = await RfqHeader.findOne({ $or: [{ rfqId }, { rfqNumber: rfqId }] }).lean();
      const poKeys = rfq ? [rfq.poId, rfq.sapPoNumber, rfq.poNumber, rfq.rfqId, rfq.rfqNumber].filter(Boolean) : [rfqId];
      matchingInvoice = await InvoicePayment.findOne({
        $and: [
          { asnNumber: { $regex: new RegExp(`^${asnNumber.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') } },
          { $or: [{ poId: { $in: poKeys } }, { sapPoNumber: { $in: poKeys } }, { poNumber: { $in: poKeys } }, { asnNumber: { $exists: true, $ne: '' } }] }
        ]
      }).lean();
    } else {
      matchingInvoice = await InvoicePayment.findOne({
        asnNumber: { $regex: new RegExp(`^${asnNumber.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
      }).lean();
    }

    if (!matchingInvoice) {
      return res.json({
        success: true,
        valid: false,
        error: `ASN Number "${asnNumber}" does not match any invoice record for the linked Purchase Order (PO).`
      });
    }

    return res.json({ success: true, valid: true, message: `ASN Number "${asnNumber}" is valid and matched with Purchase Order (PO) invoice records.` });
  } catch (err) {
    return res.status(500).json({ success: false, valid: false, error: err.message });
  }
});

router.post('/vendor-rfqs/:id/bl-entries', authenticateToken, async (req, res) => {
  try {
    const context = await resolveVendorAwardedRfq(req);
    if (context.error) return res.status(context.status).json({ success: false, error: context.error });
    const blNumber = String(req.body.blNumber || '').trim().toUpperCase();
    if (!blNumber) {
      return res.status(400).json({ success: false, error: 'BL Number is required.' });
    }
    if (!/^[A-Z0-9\-_/]{3,30}$/i.test(blNumber)) {
      return res.status(400).json({ success: false, error: 'BL Number must be between 3 and 30 characters (letters, numbers, hyphens, slashes).' });
    }

    const asnNumber = String(req.body.asnNumber || '').trim().toUpperCase();
    if (!asnNumber) {
      return res.status(400).json({ success: false, error: 'ASN Number (Advance Shipping Notice) is required to link with RFQ & PO records.' });
    }
    if (!/^[A-Z0-9\-_/]{3,30}$/i.test(asnNumber)) {
      return res.status(400).json({ success: false, error: 'ASN Number must be between 3 and 30 characters (letters, numbers, hyphens, slashes).' });
    }

    const containerCount = Number(req.body.containerCount);
    const duplicateBl = await RfqBlEntry.exists({ blNumber });
    if (duplicateBl) {
      return res.status(400).json({ success: false, error: `BL Number "${blNumber}" already exists in the system.` });
    }

    const duplicateAsn = await RfqBlEntry.exists({ $or: [{ asnNumber }, { autoAsnNumber: asnNumber }] });
    if (duplicateAsn) {
      return res.status(400).json({ success: false, error: `ASN Number "${asnNumber}" has already been used for a BL entry.` });
    }

    const poKeys = [context.rfq?.poId, context.rfq?.sapPoNumber, context.rfq?.poNumber, context.rfq?.rfqId, context.rfq?.rfqNumber].filter(Boolean);
    const matchingInvoice = await InvoicePayment.findOne({
      $and: [
        { asnNumber: { $regex: new RegExp(`^${asnNumber.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') } },
        { $or: [{ poId: { $in: poKeys } }, { sapPoNumber: { $in: poKeys } }, { poNumber: { $in: poKeys } }, { asnNumber: { $exists: true, $ne: '' } }] }
      ]
    }).lean();

    if (!matchingInvoice) {
      return res.status(400).json({
        success: false,
        error: `ASN Number "${asnNumber}" does not match any invoice record for the linked Purchase Order (PO).`
      });
    }
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
      asnNumber, autoAsnNumber: asnNumber, status: 'submitted', documents
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
    const blCollInvoices = await BlInvoice.find({ blId: entry.blId }).sort({ createdAt: -1 }).lean();
    const legacyInvoices = await LogisticsPayment.find({ blId: entry.blId }).sort({ createdAt: -1 }).lean();
    const rawInvoices = [...blCollInvoices, ...legacyInvoices];
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
    if (!['submitted', 'in_progress', 'custom_cleared', 'invoice_pending'].includes(bl.status)) return res.status(400).json({ success: false, error: 'Logistics invoice cannot be raised for this BL status.' });
    const invoiceNumber = String(req.body.invoiceNumber || '').trim().toUpperCase();
    const amount = Number(req.body.amount);
    const ref = `BLI-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const category = req.body.category || 'freight';
    const typeDisplay = category === 'freight' ? 'Freight Invoice' : category === 'destination_charges' ? 'Destination Charges (Shipping Line)' : category === 'recepted_charges' ? 'Recepted Charges' : category === 'agency_fee' ? 'Agency Charges' : category === 'port_storage' ? 'Port Storage' : 'BL Charge Invoice';
    const numAmount = Number(amount);
    const curr = String(req.body.currency || 'INR').toUpperCase();
    const blWorkflow = await resolveWorkflowFromDB('BL Freight Invoice', numAmount, { currency: curr });

    const approval = await createApprovalRecord({
      referenceId: ref,
      type: 'BL Freight Invoice',
      vendorName: bl.vendorName || context.vendor?.companyName || 'Vendor',
      amountFormatted: `${curr} ${numAmount}`,
      poRef: bl.blNumber,
      requestedBy: context.vendor?.companyName || 'Vendor',
      requestedById: context.vendor?.id || 'vendor',
      requestId: req.headers['x-request-id'],
      transactionSnapshot: { blId: bl.blId, blNumber: bl.blNumber, invoiceNumber, category, typeDisplay, source: 'Vendor', amount: numAmount },
      wf: blWorkflow
    });

    const rawFile = String(req.body.fileName || req.body.fileUrl || '').trim();
    const docList = Array.isArray(req.body.documents) && req.body.documents.length > 0
      ? req.body.documents
      : (rawFile ? [{ docType: typeDisplay, fileName: rawFile, fileUrl: rawFile, uploadedBy: bl.vendorName || 'Vendor' }] : []);

    const payment = await LogisticsPayment.create({
      logisticsPaymentId: ref, referenceNumber: ref, blId: bl.blId, blNumber: bl.blNumber,
      vendorId: bl.vendorId, vendorName: bl.vendorName, category, typeDisplay, source: 'Vendor', invoiceNumber,
      amount: numAmount, totalAmount: numAmount, currency: curr, remarks: String(req.body.remarks || '').trim(),
      invoiceFile: rawFile, fileUrl: rawFile, fileName: rawFile, documents: docList,
      status: approval.status, currentStep: approval.currentStep || 1, totalSteps: approval.totalSteps || 2, submittedAt: new Date()
    });
    broadcastEvent('LOGISTICS_INVOICE_SUBMITTED', { logisticsPaymentId: payment.logisticsPaymentId, blId: bl.blId, vendorId: bl.vendorId, amount: numAmount });
    return res.status(201).json({ success: true, message: 'Logistics invoice submitted for approval.', data: payment, approval });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.post('/rfqs/:id/reopen', authenticateToken, async (req, res) => {
  try {
    const rfq = await RfqHeader.findOne({ $or: [{ rfqId: req.params.id }, { rfqNumber: req.params.id }] });
    if (!rfq) return res.status(404).json({ success: false, error: 'RFQ not found.' });

    const newClosingDate = req.body.closingDate ? new Date(req.body.closingDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    rfq.status = 'published';
    rfq.closingDate = newClosingDate;
    await rfq.save();

    broadcastEvent('RFQ_REOPENED', { rfqId: rfq.rfqId, rfqNumber: rfq.rfqNumber, closingDate: rfq.closingDate });

    return res.json({
      success: true,
      message: `RFQ ${rfq.rfqNumber} reopened successfully until ${new Date(rfq.closingDate).toLocaleDateString('en-IN')}.`,
      data: rfq
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── CUSTOMS BROKER & BL ASSIGNMENT ROUTES ──────────────────────────────────

router.get('/custom-agents/bl-entries', optionalAuth, async (req, res) => {
  try {
    const entries = await RfqBlEntry.find().sort({ createdAt: -1 }).lean();
    const agents = await CustomAgent.find({ status: 'Active' }).select('agentId agencyName contactPerson email').sort({ agencyName: 1 }).lean();
    return res.json({ success: true, blEntries: entries, data: entries, agents });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.get('/exim/bl-entries', optionalAuth, async (req, res) => {
  try {
    const entries = await RfqBlEntry.find().sort({ createdAt: -1 }).lean();
    const agents = await CustomAgent.find({ status: 'Active' }).select('agentId agencyName contactPerson email').sort({ agencyName: 1 }).lean();
    return res.json({ success: true, data: entries, blEntries: entries, agents });
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

router.post('/exim/bl-entries/:blId/action', authenticateToken, async (req, res) => {
  try {
    const { action, remarks } = req.body;
    const bl = await RfqBlEntry.findOne({ $or: [{ blId: req.params.blId }, { blNumber: req.params.blId }] });
    if (!bl) return res.status(404).json({ success: false, error: 'BL entry not found.' });

    let nextStatus = bl.status;
    if (action === 'approve') {
      nextStatus = bl.customAgentId ? 'assigned_to_agent' : 'exim_review';
      bl.eximReviewedAt = new Date();
    } else if (action === 'return') {
      nextStatus = 'returned_for_correction';
    } else if (action === 'reject') {
      nextStatus = 'rejected';
    } else {
      return res.status(400).json({ success: false, error: 'Invalid action type.' });
    }

    bl.status = nextStatus;
    if (!bl.eximApprovalHistory) bl.eximApprovalHistory = [];
    bl.eximApprovalHistory.push({
      action,
      actionedBy: req.user?.name || req.user?.email || 'EXIM Manager',
      role: req.user?.role || 'EXIM Manager',
      actionedAt: new Date(),
      remarks: remarks || `BL Entry ${action.toUpperCase()} action processed.`
    });

    await bl.save();
    broadcastEvent('BL_EXIM_ACTION', { blId: bl.blId, blNumber: bl.blNumber, action, status: nextStatus });
    return res.json({ success: true, message: `BL Entry ${action}d successfully.`, data: bl });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
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
    if (!bl.boeNumber) bl.boeReference = `DOCUMENT:${boeDocument.fileUrl}`;

    bl.status = 'custom_cleared';
    bl.customsClearedAt = new Date();
    bl.customsClearanceNotes = String(req.body.notes || '').trim();
    await bl.save();

    broadcastEvent('BL_CUSTOMS_CLEARED', { blId: bl.blId, blNumber: bl.blNumber, rfqId: bl.rfqId, vendorId: bl.vendorId, clearedAt: bl.customsClearedAt });

    sendBlCustomsClearedEmail({
      to: 'vendor@rayzon.com',
      vendorName: bl.vendorName,
      blNumber: bl.blNumber,
      asnNumber: bl.asnNumber || bl.autoAsnNumber,
      rfqNumber: bl.rfqNumber,
      clearedDate: new Date(bl.customsClearedAt).toLocaleDateString('en-IN'),
      agentNotes: bl.customsClearanceNotes
    }).catch((err) => console.warn('[BL Email] sendBlCustomsClearedEmail error:', err.message));

    return res.json({ success: true, message: 'Marked as Customs Cleared! Invoicing options enabled.', bl });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/customs-agent/invoices', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role !== 'CustomAgent') return res.status(403).json({ success: false, error: 'Customs Agent access is required.' });
    const { blId, invoiceNumber, amount, currency, category, remarks, fileName } = req.body;
    const bl = await RfqBlEntry.findOne({ customAgentId: req.user.id, $or: [{ blId }, { blNumber: blId }] });
    if (!bl) return res.status(404).json({ success: false, error: 'BL entry not found.' });

    const numAmount = Number(amount);
    if (!String(invoiceNumber || '').trim() || !(numAmount > 0)) {
      return res.status(400).json({ success: false, error: 'Invoice Number and a positive amount are required.' });
    }

    const ref = `BLI-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const cat = category || 'agency_fee';
    const typeDisplay = cat === 'agency_fee' ? 'Agency Charges' : cat === 'recepted_charges' ? 'Recepted Charges' : cat === 'port_storage' ? 'Port Storage' : 'Customs Clearance Fee';

    const blWorkflow = await resolveWorkflowFromDB('BL Freight Invoice', numAmount, { currency: currency || 'INR' });

    const approval = await createApprovalRecord({
      referenceId: ref,
      type: 'BL Freight Invoice',
      vendorName: req.user.agencyName || req.user.contactPerson || 'Customs Agent',
      amountFormatted: `${currency || 'INR'} ${numAmount}`,
      poRef: bl.blNumber,
      requestedBy: req.user.agencyName || req.user.contactPerson || req.user.email || 'Customs Agent',
      requestedById: req.user.id || req.user.agentId,
      requestId: req.headers['x-request-id'],
      transactionSnapshot: { blId: bl.blId, blNumber: bl.blNumber, invoiceNumber, category: cat, typeDisplay, source: 'Agent', amount: numAmount },
      wf: blWorkflow
    });

    const payment = await BlInvoice.create({
      logisticsPaymentId: ref,
      referenceNumber: ref,
      blId: bl.blId,
      blNumber: bl.blNumber,
      vendorId: req.user.agentId || bl.customAgentId || 'AGENT-101',
      vendorName: req.user.agencyName || req.user.contactPerson || 'Customs Agent',
      category: cat,
      typeDisplay,
      source: 'Agent',
      invoiceNumber: String(invoiceNumber).trim().toUpperCase(),
      amount: numAmount,
      totalAmount: numAmount,
      currency: String(currency || 'INR').toUpperCase(),
      remarks: String(remarks || '').trim(),
      invoiceFile: String(fileName || '').trim(),
      status: approval.status,
      currentStep: approval.currentStep || 1,
      totalSteps: approval.totalSteps || 2,
      submittedAt: new Date()
    });

    broadcastEvent('AGENT_INVOICE_SUBMITTED', { id: payment.logisticsPaymentId, referenceNumber: ref, blNumber: bl.blNumber, amount: numAmount });

    return res.status(201).json({ success: true, message: 'Agent customs charge invoice submitted for approval.', data: payment, approval });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── LOGISTICS PAYMENTS ROUTES ──────────────────────────────────────────────

router.get('/logistics-payments', optionalAuth, async (req, res) => {
  try {
    let items = await LogisticsPayment.find().sort({ createdAt: -1 }).lean();

    const q = String(req.query.q || '').toLowerCase().trim();
    const statusFilter = String(req.query.status || 'All').trim();
    const includeBli = String(req.query.includeBli || 'false').toLowerCase() === 'true';

    let filtered = await Promise.all(items.map(async (item) => {
      const ref = item.referenceNumber || item.logisticsPaymentId || '';
      const isLOG = ref.startsWith('LOG-') || item.source === 'Logistics' || item.source === 'Logistics Payment';
      const isBLI = ref.startsWith('BLI-');

      const typeDisplay = item.typeDisplay || (isLOG ? 'Logistics Freight Payment' : 'Freight Invoice');
      const source = item.source || (isLOG ? 'Logistics' : 'Vendor');
      const amount = item.totalAmount || item.amount || 0;
      const currency = item.currency || 'INR';

      const app = await Approval.findOne({ $or: [{ id: ref }, { referenceNumber: ref }] }).lean();

      let rawStatus = app?.status || item.status || 'Approved';
      let status = isLOG ? (rawStatus.toLowerCase().includes('pending') ? 'Approved' : rawStatus) : rawStatus;
      let currentStep = isLOG ? 1 : (app?.currentStep || item.currentStep || 1);
      let totalSteps = isLOG ? 1 : (app?.totalSteps || item.totalSteps || 1);
      let workflowSteps = null;
      if (app?.workflowSteps) {
        try { workflowSteps = JSON.parse(app.workflowSteps); } catch (_) { }
      }

      return {
        ...item,
        id: item.logisticsPaymentId || item._id,
        referenceNumber: ref,
        recordType: isLOG ? 'LOG' : (isBLI ? 'BLI' : 'LOG'),
        typeDisplay,
        source,
        amount,
        currency,
        status,
        currentStep,
        totalSteps,
        currentSlab: isLOG ? 'Direct Approval (No Workflow)' : (app?.currentSlab || 'BL Freight Invoice Workflow'),
        workflowSteps: app?.workflowSteps,
        parsedSteps: workflowSteps,
        submittedAt: item.submittedAt || item.createdAt
      };
    }));

    if (!includeBli) {
      filtered = filtered.filter(i => i.recordType === 'LOG');
    }

    if (q) {
      filtered = filtered.filter(i =>
        i.referenceNumber?.toLowerCase().includes(q) ||
        i.invoiceNumber?.toLowerCase().includes(q) ||
        i.blNumber?.toLowerCase().includes(q) ||
        i.vendorName?.toLowerCase().includes(q) ||
        i.typeDisplay?.toLowerCase().includes(q)
      );
    }

    if (statusFilter && statusFilter !== 'All') {
      filtered = filtered.filter(i => (i.status || '').toLowerCase() === statusFilter.toLowerCase());
    }

    const stats = {
      total: filtered.length,
      approved: filtered.filter(i => (i.status || '').toLowerCase() === 'approved').length,
      pending: filtered.filter(i => (i.status || '').toLowerCase().includes('pending')).length,
      rejected: filtered.filter(i => (i.status || '').toLowerCase() === 'rejected').length
    };

    return res.json({ success: true, payments: filtered, invoices: filtered, stats });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/logistics-payments', authenticateToken, async (req, res) => {
  try {
    const { blNumber, typeDisplay, category, source, invoiceNumber, vendorName, amount, currency, remarks } = req.body;
    if (!invoiceNumber || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Invoice Number and a valid positive amount are required.' });
    }

    const numAmount = Number(amount);
    const ref = `LOG-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const approval = await createApprovalRecord({
      referenceId: ref,
      type: 'Logistics Payment',
      vendorName: vendorName || 'Logistics Provider',
      amountFormatted: `${currency || 'INR'} ${numAmount}`,
      poRef: blNumber || 'N/A',
      requestedBy: req.user?.name || req.user?.email || 'System User',
      requestedById: req.user?.id || req.user?.email,
      requestId: req.headers['x-request-id'],
      transactionSnapshot: { blNumber: blNumber || '', invoiceNumber, category: category || 'freight', typeDisplay: typeDisplay || 'Logistics Freight Payment', source: source || 'Logistics', amount: numAmount },
      wf: { status: 'Approved', currentStep: 1, totalSteps: 1, steps: [] }
    });

    if (approval) {
      approval.status = 'Approved';
      approval.currentStep = 1;
      approval.totalSteps = 1;
      await approval.save().catch(() => { });
    }

    const payment = await LogisticsPayment.create({
      logisticsPaymentId: ref,
      referenceNumber: ref,
      blNumber: blNumber ? String(blNumber).trim().toUpperCase() : 'N/A',
      category: category || 'freight',
      typeDisplay: typeDisplay || 'Logistics Freight Payment',
      source: source || 'Logistics',
      invoiceNumber: String(invoiceNumber).trim().toUpperCase(),
      vendorId: `VEND-${Math.floor(100 + Math.random() * 900)}`,
      vendorName: vendorName || 'Logistics Provider',
      amount: numAmount,
      totalAmount: numAmount,
      currency: currency || 'INR',
      status: 'Approved',
      currentStep: 1,
      totalSteps: 1,
      remarks: remarks || '',
      submittedAt: new Date(),
      createdBy: req.user?.name || req.user?.email || 'System User',
      actionHistory: [
        { action: 'submit', step: 1, role: 'Requester', actionedBy: req.user?.name || req.user?.email || 'User', actionedAt: new Date(), remarks: 'Submitted Logistics Payment (Directly Approved)' }
      ]
    });

    broadcastEvent('LOGISTICS_PAYMENT_SUBMITTED', { id: payment.logisticsPaymentId, referenceNumber: ref, blNumber, amount: numAmount, status: 'Approved' });

    return res.status(201).json({ success: true, message: 'Logistics Payment submitted and directly approved.', payment, approval });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/logistics-payments/clear-bli', authenticateToken, async (req, res) => {
  try {
    const bliQuery = {
      $or: [
        { referenceNumber: /^BLI-/ },
        { logisticsPaymentId: /^BLI-/ },
        { category: 'bl_invoice' }
      ]
    };

    const countBlColl = await BlInvoice.countDocuments({});
    const countLegacy = await LogisticsPayment.countDocuments(bliQuery);
    const totalCount = countBlColl + countLegacy;

    const blRecords = await BlInvoice.find({}, { referenceNumber: 1, logisticsPaymentId: 1 }).lean();
    const legacyRecords = await LogisticsPayment.find(bliQuery, { referenceNumber: 1, logisticsPaymentId: 1 }).lean();
    const bliRefs = [...blRecords, ...legacyRecords].map(r => r.referenceNumber || r.logisticsPaymentId).filter(Boolean);

    await BlInvoice.deleteMany({});
    await LogisticsPayment.deleteMany(bliQuery);
    if (bliRefs.length > 0) {
      await Approval.deleteMany({ $or: [{ id: { $in: bliRefs } }, { referenceNumber: { $in: bliRefs } }] });
    }

    return res.json({ success: true, message: `Successfully purged ${totalCount} BLI record(s) from database.`, deletedCount: totalCount });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/logistics-payments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const target = await LogisticsPayment.findOne({
      $or: [{ logisticsPaymentId: id }, { referenceNumber: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }]
    });

    if (!target) {
      return res.status(404).json({ success: false, error: 'Payment record not found.' });
    }

    const ref = target.referenceNumber || target.logisticsPaymentId;
    await LogisticsPayment.deleteOne({ _id: target._id });
    if (ref) {
      await Approval.deleteMany({ $or: [{ id: ref }, { referenceNumber: ref }] });
    }

    return res.json({ success: true, message: `Payment record ${ref || id} deleted successfully.` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── BL INVOICES ROUTES ──────────────────────────────────────────────────────

router.get('/bl-invoices', optionalAuth, async (req, res) => {
  try {
    let itemsFromBlColl = await BlInvoice.find().sort({ createdAt: -1 }).lean();
    let legacyBlItems = await LogisticsPayment.find({ $or: [{ referenceNumber: /^BLI-/ }, { logisticsPaymentId: /^BLI-/ }] }).sort({ createdAt: -1 }).lean();

    const seenRefs = new Set();
    let items = [];
    for (const item of [...itemsFromBlColl, ...legacyBlItems]) {
      const ref = item.referenceNumber || item.logisticsPaymentId || String(item._id);
      if (!seenRefs.has(ref)) {
        seenRefs.add(ref);
        items.push(item);
      }
    }

    const q = String(req.query.q || '').toLowerCase().trim();
    const statusFilter = String(req.query.status || 'All').trim();
    const sourceFilter = String(req.query.source || 'All').trim();

    let filtered = await Promise.all(items.map(async (item) => {
      const typeDisplay = item.typeDisplay || (
        item.category === 'freight' ? 'Freight Invoice' :
          item.category === 'destination_charges' ? 'Destination Charges (Shipping Line)' :
            item.category === 'recepted_charges' ? 'Recepted Charges' :
              item.category === 'agency_fee' ? 'Agency Charges' :
                item.category === 'port_storage' ? 'Port Storage' : 'BL Charge Invoice'
      );
      const source = item.source || (item.vendorName?.toLowerCase().includes('agent') ? 'Agent' : 'Vendor');
      const amount = item.totalAmount || item.amount || 0;
      const currency = item.currency || 'INR';

      const app = await Approval.findOne({ $or: [{ id: item.referenceNumber }, { id: item.logisticsPaymentId }] }).lean();

      let status = app?.status || item.status || 'Pending EXIM Approval';
      let currentStep = app?.currentStep || item.currentStep || 1;
      let totalSteps = app?.totalSteps || item.totalSteps || 1;
      let workflowSteps = null;
      if (app?.workflowSteps) {
        try { workflowSteps = JSON.parse(app.workflowSteps); } catch (_) { }
      }

      const fileTarget = String(item.fileName || item.fileUrl || item.invoiceFile || app?.transactionSnapshot?.fileName || app?.documents?.[0]?.fileUrl || 'Invoice_Document.pdf').trim();
      const documentsList = (Array.isArray(item.documents) && item.documents.length > 0)
        ? item.documents
        : (fileTarget ? [{ docType: typeDisplay, fileName: fileTarget, fileUrl: fileTarget, uploadedBy: item.vendorName || 'Vendor' }] : []);

      return {
        ...item,
        id: item.logisticsPaymentId || item.referenceNumber || item._id,
        referenceNumber: item.referenceNumber || item.logisticsPaymentId,
        fileName: fileTarget,
        fileUrl: fileTarget,
        invoiceFile: fileTarget,
        documents: documentsList,
        typeDisplay,
        source,
        amount,
        currency,
        status,
        currentStep,
        totalSteps,
        currentSlab: app?.currentSlab || 'BL Freight Invoice Workflow',
        workflowSteps: app?.workflowSteps,
        parsedSteps: workflowSteps,
        submittedAt: item.submittedAt || item.createdAt
      };
    }));

    if (q) {
      filtered = filtered.filter(i =>
        i.referenceNumber?.toLowerCase().includes(q) ||
        i.invoiceNumber?.toLowerCase().includes(q) ||
        i.blNumber?.toLowerCase().includes(q) ||
        i.vendorName?.toLowerCase().includes(q) ||
        i.typeDisplay?.toLowerCase().includes(q)
      );
    }

    if (statusFilter && statusFilter !== 'All') {
      filtered = filtered.filter(i => (i.status || '').toLowerCase() === statusFilter.toLowerCase());
    }

    if (sourceFilter && sourceFilter !== 'All') {
      filtered = filtered.filter(i => (i.source || '').toLowerCase() === sourceFilter.toLowerCase());
    }

    const stats = {
      total: items.length,
      approved: items.filter(i => (i.status || '').toLowerCase() === 'approved').length,
      pending: items.filter(i => (i.status || '').toLowerCase().includes('pending')).length,
      rejected: items.filter(i => (i.status || '').toLowerCase() === 'rejected').length
    };

    return res.json({ success: true, invoices: filtered, stats });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/bl-invoices', authenticateToken, async (req, res) => {
  try {
    const { blNumber, typeDisplay, category, source, invoiceNumber, vendorName, amount, currency, remarks } = req.body;
    if (!blNumber || !invoiceNumber || !amount) {
      return res.status(400).json({ success: false, error: 'BL Number, Invoice Number, and Amount are required.' });
    }

    const numAmount = Number(amount);
    const ref = `BLI-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const blWorkflow = await resolveWorkflowFromDB('BL Freight Invoice', numAmount, { currency: currency || 'INR' });

    const approval = await createApprovalRecord({
      referenceId: ref,
      type: 'BL Freight Invoice',
      vendorName: vendorName || 'Logistics Provider',
      amountFormatted: `${currency || 'INR'} ${numAmount}`,
      poRef: blNumber,
      requestedBy: req.user?.name || req.user?.email || 'System User',
      requestedById: req.user?.id || req.user?.email,
      requestId: req.headers['x-request-id'],
      transactionSnapshot: { blNumber, invoiceNumber, category, typeDisplay, source, amount: numAmount },
      wf: blWorkflow
    });

    const payment = await BlInvoice.create({
      logisticsPaymentId: ref,
      referenceNumber: ref,
      blNumber: String(blNumber).trim().toUpperCase(),
      category: category || 'freight',
      typeDisplay: typeDisplay || 'Freight Invoice',
      source: source || 'Vendor',
      invoiceNumber: String(invoiceNumber).trim().toUpperCase(),
      vendorId: `VEND-${Math.floor(100 + Math.random() * 900)}`,
      vendorName: vendorName || 'Logistics Provider',
      amount: numAmount,
      totalAmount: numAmount,
      currency: currency || 'INR',
      status: approval.status,
      currentStep: approval.currentStep || 1,
      totalSteps: approval.totalSteps || 2,
      remarks: remarks || '',
      submittedAt: new Date(),
      createdBy: req.user?.name || req.user?.email || 'System User',
      actionHistory: [
        { action: 'submit', step: 1, role: 'Requester', actionedBy: req.user?.name || req.user?.email || 'User', actionedAt: new Date(), remarks: 'Submitted BL Freight Invoice' }
      ]
    });

    broadcastEvent('BL_INVOICE_SUBMITTED', { id: payment.logisticsPaymentId, referenceNumber: ref, blNumber, amount });

    return res.status(201).json({ success: true, message: 'BL Invoice submitted for approval.', invoice: payment, approval });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/bl-invoices/:id/action', authenticateToken, async (req, res) => {
  try {
    const { action, remarks } = req.body;
    let invoice = await BlInvoice.findOne({
      $or: [{ logisticsPaymentId: req.params.id }, { referenceNumber: req.params.id }]
    });

    if (!invoice) {
      invoice = await LogisticsPayment.findOne({
        $or: [{ logisticsPaymentId: req.params.id }, { referenceNumber: req.params.id }]
      });
    }

    if (!invoice) return res.status(404).json({ success: false, error: 'BL Invoice not found.' });

    const currentStep = invoice.currentStep || 1;
    let nextStatus = invoice.status;

    if (action === 'approve') {
      if (currentStep < 2) {
        invoice.currentStep = 2;
        nextStatus = 'Pending Finance Approval';
      } else {
        nextStatus = 'Approved';
      }
    } else if (action === 'reject') {
      nextStatus = 'Rejected';
    } else if (action === 'return') {
      nextStatus = 'Returned';
    } else {
      return res.status(400).json({ success: false, error: 'Invalid action type.' });
    }

    invoice.status = nextStatus;
    if (!invoice.actionHistory) invoice.actionHistory = [];
    invoice.actionHistory.push({
      action,
      step: currentStep,
      role: req.user?.role || 'Approver',
      actionedBy: req.user?.name || req.user?.email || 'Approver',
      actionedAt: new Date(),
      remarks: remarks || `${action.toUpperCase()} action processed.`
    });

    await invoice.save();

    try {
      const appRecord = await Approval.findOne({ referenceNumber: invoice.referenceNumber });
      if (appRecord) {
        appRecord.status = nextStatus;
        appRecord.currentStep = invoice.currentStep;
        await appRecord.save();
      }
    } catch (_) { }

    try {
      await WorkflowAudit.create({
        entityType: 'LogisticsPayment',
        entityId: invoice.logisticsPaymentId,
        referenceNumber: invoice.referenceNumber,
        action,
        actorId: req.user?.id || 'system',
        actorName: req.user?.name || req.user?.email || 'User',
        actorRole: req.user?.role || 'Approver',
        remarks: remarks || `${action.toUpperCase()} action taken on BL Invoice.`
      });
    } catch (_) { }

    broadcastEvent('BL_INVOICE_ACTION', { id: invoice.logisticsPaymentId, action, status: nextStatus });

    return res.json({ success: true, message: `BL Invoice ${action}d successfully.`, invoice });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── CUSTOM DUTIES CRUD ROUTES ─────────────────────────────────────────────

router.get('/custom-duties', optionalAuth, async (req, res) => {
  try {
    const duties = await CustomDutyPayment.find().sort({ createdAt: -1 }).lean();
    return res.json({ success: true, duties, count: duties.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/custom-duties', authenticateToken, async (req, res) => {
  try {
    const { blNumber, boeNumber, dutyAmount, portCode, customAgentName, vesselName, icegateRef, remarks, documents } = req.body;
    if (!blNumber || !dutyAmount) {
      return res.status(400).json({ success: false, error: 'BL Number and Duty Amount are required.' });
    }

    const numAmount = Number(dutyAmount);
    const dutyId = `DUTY-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const wf = await resolveWorkflowFromDB('Custom Duty', numAmount, { currency: 'INR' });
    const approval = await createApprovalRecord({
      referenceId: dutyId,
      type: 'Custom Duty',
      vendorName: customAgentName || 'Customs House Agent',
      amountFormatted: `INR ${numAmount}`,
      poRef: blNumber,
      requestedBy: req.user?.name || req.user?.email || 'System User',
      requestedById: req.user?.id || req.user?.email,
      requestId: req.headers['x-request-id'],
      transactionSnapshot: { blNumber, boeNumber, dutyAmount: numAmount, portCode, customAgentName, icegateRef },
      wf
    });

    const duty = await CustomDutyPayment.create({
      dutyId,
      blId: String(blNumber).trim().toUpperCase(),
      blNumber: String(blNumber).trim().toUpperCase(),
      boeNumber: boeNumber || `BOE-${blNumber.slice(-6)}`,
      vesselName: vesselName || 'EVER GIVEN V-104E',
      portCode: portCode || 'INNHAV (Nhava Sheva)',
      dutyAmount: numAmount,
      customAgentName: customAgentName || 'Magnesh - Fast Forward Logistics India',
      icegateRef: icegateRef || `ICEGATE-${Math.floor(1000000 + Math.random() * 9000000)}`,
      status: approval.status,
      remarks: remarks || '',
      documents: documents || [],
      approvalInstanceId: approval._id,
      createdBy: req.user?.name || req.user?.email || 'System User'
    });

    return res.status(201).json({ success: true, message: 'Custom Duty payment created successfully.', duty, approval });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/custom-duties/:id', authenticateToken, async (req, res) => {
  try {
    const duty = await CustomDutyPayment.findOneAndDelete({ $or: [{ dutyId: req.params.id }, { _id: req.params.id }] });
    if (!duty) return res.status(404).json({ success: false, error: 'Custom Duty record not found.' });
    return res.json({ success: true, message: 'Custom Duty record deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── FILE UPLOAD/DOWNLOAD ROUTES ────────────────────────────────────────────

const uploadMiddleware = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.post('/upload-file', optionalAuth, uploadMiddleware.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded.' });

    const folder = req.body.folder || 'documents';
    const storageResult = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      folder
    );

    return res.status(200).json({
      success: true,
      message: 'File uploaded successfully to storage.',
      fileUrl: storageResult.url,
      fileName: storageResult.key || req.file.originalname,
      originalName: req.file.originalname,
      size: storageResult.size,
      storage: storageResult.storage
    });
  } catch (err) {
    console.error('[Upload API] File upload error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/download-file', optionalAuth, async (req, res) => {
  try {
    const rawTarget = req.query.fileUrl || req.query.url || req.query.name;
    if (!rawTarget) return res.status(400).json({ success: false, error: 'File path or name required.' });

    const cleanTarget = String(rawTarget).trim();
    const filename = path.basename(cleanTarget);

    try {
      if (typeof fileExistsInS3 === 'function' && typeof getDownloadUrl === 'function') {
        const existsInS3 = await fileExistsInS3(cleanTarget);
        if (existsInS3) {
          const s3Url = await getDownloadUrl(cleanTarget, 3600);
          if (s3Url) return res.redirect(s3Url);
        }
      }
    } catch (_) { }

    let localPath = toLocalPath(cleanTarget);
    if (!localPath || !fs.existsSync(localPath)) {
      const findFile = (dir) => {
        if (!fs.existsSync(dir)) return null;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            const found = findFile(fullPath);
            if (found) return found;
          } else if (entry.name.toLowerCase() === filename.toLowerCase() || entry.name.toLowerCase().includes(filename.toLowerCase())) {
            return fullPath;
          }
        }
        return null;
      };
      localPath = findFile(UPLOAD_DIR);
    }

    if (localPath && fs.existsSync(localPath)) {
      return res.download(localPath, filename);
    }

    const lowerName = filename.toLowerCase();

    if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
      const docxBuffer = Buffer.from(
        'PK\x03\x04\x14\x00\x06\x00\x08\x00\x00\x00!\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00[Content_Types].xml',
        'binary'
      );
      res.setHeader('Content-Type', lowerName.endsWith('.docx')
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/msword');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(docxBuffer);
    }

    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      const xlsxBuffer = Buffer.from('PK\x03\x04\x14\x00\x06\x00\x08\x00\x00\x00', 'binary');
      res.setHeader('Content-Type', lowerName.endsWith('.xlsx')
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/vnd.ms-excel');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(xlsxBuffer);
    }

    if (lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
      const pngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );
      res.setHeader('Content-Type', lowerName.endsWith('.png') ? 'image/png' : 'image/jpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(pngBuffer);
    } else {
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n'
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename.endsWith('.pdf') ? filename : filename + '.pdf'}"`);
      return res.send(pdfBuffer);
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── AUDIT TRAIL ─────────────────────────────────────────────────────────────

router.get('/audit/:entityId', optionalAuth, async (req, res) => {
  try {
    const { entityId } = req.params;
    const matcher = new RegExp(escapeRegex(entityId), 'i');

    const [invDoc, advDoc, rfqDoc, poDoc, appDoc] = await Promise.all([
      InvoicePayment.findOne({ $or: [{ invoicePaymentId: entityId }, { invoiceNumber: entityId }, { invoicePaymentId: matcher }, { invoiceNumber: matcher }] }).lean().catch(() => null),
      AdvancePayment.findOne({ $or: [{ advanceId: entityId }, { advanceId: matcher }] }).lean().catch(() => null),
      RfqHeader.findOne({ $or: [{ rfqId: entityId }, { rfqNumber: entityId }, { rfqId: matcher }, { rfqNumber: matcher }] }).lean().catch(() => null),
      PurchaseOrder.findOne({ $or: [{ poNumber: entityId }, { sapPoNumber: entityId }, { poNumber: matcher }, { sapPoNumber: matcher }] }).lean().catch(() => null),
      Approval.findOne({ $or: [{ id: entityId }, { id: matcher }, { referenceNumber: entityId }, { poReference: entityId }] }).lean().catch(() => null)
    ]);

    const idSet = new Set([
      entityId,
      invDoc?.invoicePaymentId, invDoc?.invoiceNumber, invDoc?.poId, invDoc?.sapPoNumber,
      advDoc?.advanceId, advDoc?.poId, advDoc?.sapPoNumber,
      rfqDoc?.rfqId, rfqDoc?.rfqNumber, rfqDoc?.linkedPoId,
      poDoc?.poNumber, poDoc?.sapPoNumber, poDoc?.id,
      appDoc?.id, appDoc?.referenceNumber, appDoc?.poReference
    ].filter(Boolean).map(String));

    const idList = Array.from(idSet);
    const regexList = idList.map((val) => new RegExp(escapeRegex(val), 'i'));

    const [rawAudits, approvalDocs] = await Promise.all([
      WorkflowAudit.find({
        $or: [
          { entityId: { $in: idList } },
          { referenceNumber: { $in: idList } },
          { workflowId: { $in: idList } },
          { entityId: { $in: regexList } },
          { referenceNumber: { $in: regexList } }
        ]
      }).sort({ createdAt: -1, occurredAt: -1 }).lean(),
      Approval.find({
        $or: [
          { id: { $in: idList } },
          { referenceNumber: { $in: idList } },
          { poReference: { $in: idList } },
          { id: { $in: regexList } }
        ]
      }).lean()
    ]);

    const approvalActionLogs = approvalDocs.flatMap((doc) =>
      (doc.actionHistory || []).map((act, idx) => ({
        _id: `act-${doc.id}-${idx}`,
        eventId: `act-${doc.id}-${idx}`,
        eventType: (act.action || 'APPROVAL_STEP').toUpperCase(),
        action: act.action || 'Approval Action',
        actorName: act.performedBy || act.actorName || 'Approver',
        actorRole: act.role || act.actorRole || 'Approver',
        remarks: act.remarks || act.reason || `Action "${act.action}" taken on step ${act.step || idx + 1}`,
        createdAt: act.timestamp || act.occurredAt || doc.updatedAt || Date.now(),
        occurredAt: act.timestamp || act.occurredAt || doc.updatedAt || Date.now()
      }))
    );

    const fallbackEvents = [];
    if (invDoc && !rawAudits.some(a => (a.action || '').toLowerCase().includes('submit') || (a.action || '').toLowerCase().includes('create'))) {
      fallbackEvents.push({
        _id: `sys-create-${invDoc.invoicePaymentId}`,
        eventType: 'INVOICE_SUBMITTED',
        action: 'submit',
        actorName: invDoc.createdBy || 'Finance Team',
        actorRole: 'Requester',
        remarks: `Invoice Payment request "${invDoc.invoicePaymentId}" (${invDoc.invoiceNumber}) submitted.`,
        createdAt: invDoc.createdAt || Date.now()
      });
    }

    if (advDoc && !rawAudits.some(a => (a.action || '').toLowerCase().includes('submit') || (a.action || '').toLowerCase().includes('create'))) {
      fallbackEvents.push({
        _id: `sys-create-${advDoc.advanceId}`,
        eventType: 'ADVANCE_SUBMITTED',
        action: 'submit',
        actorName: advDoc.createdBy || 'Finance Team',
        actorRole: 'Requester',
        remarks: `Advance Payment request "${advDoc.advanceId}" submitted.`,
        createdAt: advDoc.createdAt || Date.now()
      });
    }

    if (rfqDoc && !rawAudits.some(a => (a.action || '').toLowerCase().includes('create') || (a.action || '').toLowerCase().includes('publish'))) {
      fallbackEvents.push({
        _id: `sys-create-${rfqDoc.rfqId}`,
        eventType: 'RFQ_CREATED',
        action: 'create',
        actorName: rfqDoc.createdBy || 'System Admin',
        actorRole: 'Procurement Head',
        remarks: `Freight RFQ "${rfqDoc.rfqNumber}" (${rfqDoc.title}) published.`,
        createdAt: rfqDoc.createdAt || Date.now()
      });
    }

    const seen = new Set();
    const combined = [];
    for (const log of [...rawAudits, ...approvalActionLogs, ...fallbackEvents]) {
      const key = `${log.action || log.eventType}-${log.createdAt || log.occurredAt}-${log.actorName}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(log);
      }
    }

    combined.sort((a, b) => new Date(b.createdAt || b.occurredAt || 0).getTime() - new Date(a.createdAt || a.occurredAt || 0).getTime());

    return res.json({
      success: true,
      entityId,
      count: combined.length,
      auditLogs: combined
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DASHBOARD ANALYTICS ─────────────────────────────────────────────────────

router.get('/dashboard/analytics', optionalAuth, async (req, res) => {
  try {
    const appReg = /approved|dispatched|paid/i;
    const range = (req.query.range || '7d').toLowerCase();

    let daysCount = 7;
    if (range === '30d') daysCount = 30;
    else if (range === '90d') daysCount = 90;
    else if (range === '1y') daysCount = 365;

    const now = new Date();
    const rangeStartDate = new Date(now.getTime() - daysCount * 24 * 60 * 60 * 1000);
    const prevPeriodStartDate = new Date(now.getTime() - (daysCount * 2) * 24 * 60 * 60 * 1000);

    const [
      poCount,
      prevPoCount,
      pendingCount,
      rfqCount,
      prevRfqCount,
      rfqAwardedCount,
      rfqDraftCount,
      rfqPublishedCount,
      blCount,
      blClearedCount,
      vendorCount,
      activeUserCount,
      advancesList,
      invoicesList,
      dutiesList,
      blInvoicesList,
      pendingList,
      allApprovals,
      recentPos,
      recentRfqs
    ] = await Promise.all([
      PurchaseOrder.countDocuments().catch(() => 0),
      PurchaseOrder.countDocuments({ createdAt: { $gte: prevPeriodStartDate, $lt: rangeStartDate } }).catch(() => 0),
      Approval.countDocuments({ status: { $nin: ['Approved & Dispatched', 'Approved', 'Rejected'] } }).catch(() => 0),
      RfqHeader.countDocuments().catch(() => 0),
      RfqHeader.countDocuments({ createdAt: { $gte: prevPeriodStartDate, $lt: rangeStartDate } }).catch(() => 0),
      RfqHeader.countDocuments({ status: 'awarded' }).catch(() => 0),
      RfqHeader.countDocuments({ status: 'draft' }).catch(() => 0),
      RfqHeader.countDocuments({ status: { $in: ['published', 'active', 'open'] } }).catch(() => 0),
      BlInvoice.countDocuments().catch(() => 0),
      BlInvoice.countDocuments({ status: { $in: ['cleared', 'Customs Cleared', 'Approved', 'Approved & Dispatched'] } }).catch(() => 0),
      Vendor.countDocuments().catch(() => 0),
      User.countDocuments({ status: 'Active' }).catch(() => 0),
      AdvancePayment.find().lean().catch(() => []),
      InvoicePayment.find().lean().catch(() => []),
      CustomDutyPayment.find().lean().catch(() => []),
      BlInvoice.find().lean().catch(() => []),
      Approval.find({ status: { $nin: ['Approved & Dispatched', 'Approved', 'Rejected'] } }).sort({ createdAt: -1 }).limit(10).lean().catch(() => []),
      Approval.find().lean().catch(() => []),
      PurchaseOrder.find().sort({ createdAt: -1 }).limit(5).lean().catch(() => []),
      RfqHeader.find().sort({ createdAt: -1 }).limit(5).lean().catch(() => [])
    ]);

    const approvedAdvances = advancesList.filter(a => appReg.test(a.status || ''));
    const approvedInvoices = invoicesList.filter(i => appReg.test(i.status || ''));
    const approvedDuties = dutiesList.filter(d => appReg.test(d.status || ''));

    const sumAdvances = approvedAdvances.reduce((acc, curr) => acc + (Number(curr.amount || curr.amountINR || 0)), 0);
    const sumInvoices = approvedInvoices.reduce((acc, curr) => acc + (Number(curr.amount || curr.amountINR || 0)), 0);
    const sumDuties = approvedDuties.reduce((acc, curr) => acc + (Number(curr.amount || curr.amountINR || 0)), 0);

    const approvalPipeline = {
      advance: {
        pending: advancesList.filter(a => !appReg.test(a.status || '') && !(a.status || '').toLowerCase().includes('reject')).length,
        approved: approvedAdvances.length,
        rejected: advancesList.filter(a => (a.status || '').toLowerCase().includes('reject')).length
      },
      invoice: {
        pending: invoicesList.filter(i => !appReg.test(i.status || '') && !(i.status || '').toLowerCase().includes('reject')).length,
        approved: approvedInvoices.length,
        rejected: invoicesList.filter(i => (i.status || '').toLowerCase().includes('reject')).length
      },
      rfq: {
        pending: allApprovals.filter(a => (a.type || '').toLowerCase().includes('rfq') && !appReg.test(a.status || '')).length,
        approved: rfqAwardedCount || allApprovals.filter(a => (a.type || '').toLowerCase().includes('rfq') && appReg.test(a.status || '')).length,
        rejected: allApprovals.filter(a => (a.type || '').toLowerCase().includes('rfq') && (a.status || '').toLowerCase().includes('reject')).length
      },
      blInvoice: {
        pending: blInvoicesList.filter(b => !appReg.test(b.status || '') && !(b.status || '').toLowerCase().includes('reject')).length,
        approved: blInvoicesList.filter(b => appReg.test(b.status || '')).length,
        rejected: blInvoicesList.filter(b => (b.status || '').toLowerCase().includes('reject')).length
      }
    };

    const inrInvoices = invoicesList.filter(i => (i.currency || 'INR').toUpperCase() === 'INR').length;
    const usdInvoices = invoicesList.filter(i => (i.currency || '').toUpperCase() === 'USD').length;
    const inrAdvances = advancesList.filter(a => (a.currency || 'INR').toUpperCase() === 'INR').length;
    const usdAdvances = advancesList.filter(a => (a.currency || '').toUpperCase() === 'USD').length;

    const currencyDistribution = {
      inrTxns: inrInvoices + inrAdvances,
      usdTxns: usdInvoices + usdAdvances,
      inrAdvances,
      usdAdvances,
      inrInvoices,
      usdInvoices
    };

    const statusMix = {
      draft: allApprovals.filter(a => (a.status || '').toLowerCase().includes('draft')).length,
      pending: pendingCount || allApprovals.filter(a => (a.status || '').toLowerCase().includes('pending')).length,
      approved: allApprovals.filter(a => appReg.test(a.status || '')).length,
      rejected: allApprovals.filter(a => (a.status || '').toLowerCase().includes('reject')).length,
      total: allApprovals.length
    };

    const poTrend = prevPoCount > 0 ? Math.round(((poCount - prevPoCount) / prevPoCount) * 100) : 0;
    const rfqTrend = prevRfqCount > 0 ? Math.round(((rfqCount - prevRfqCount) / prevRfqCount) * 100) : 0;

    const monthNames6 = [];
    for (let i = 5; i >= 0; i--) {
      const mDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthNames6.push({
        label: mDate.toLocaleDateString('en-IN', { month: 'short' }),
        start: mDate,
        end: new Date(mDate.getFullYear(), mDate.getMonth() + 1, 1)
      });
    }

    const last6MonthsActivity = await Promise.all(
      monthNames6.map(async ({ label, start, end }) => {
        const query = { createdAt: { $gte: start, $lt: end } };
        const [advCount, invCount, rCount, bCount] = await Promise.all([
          AdvancePayment.countDocuments(query).catch(() => 0),
          InvoicePayment.countDocuments(query).catch(() => 0),
          RfqHeader.countDocuments(query).catch(() => 0),
          RfqBlEntry.countDocuments(query).catch(() => 0),
        ]);
        return {
          month: label,
          Advances: advCount,
          Invoices: invCount,
          RFQs: rCount,
          BlEntries: bCount
        };
      })
    );

    const stepCount = daysCount <= 7 ? 7 : daysCount <= 30 ? 6 : 6;
    const intervalMs = (daysCount * 24 * 60 * 60 * 1000) / stepCount;

    const chartData = await Promise.all(
      Array.from({ length: stepCount }, (_, i) => {
        const stepStart = new Date(rangeStartDate.getTime() + i * intervalMs);
        const stepEnd = new Date(stepStart.getTime() + intervalMs);
        const queryRange = { createdAt: { $gte: stepStart, $lt: stepEnd } };

        let label = '';
        if (daysCount <= 7) {
          label = stepStart.toLocaleDateString('en-IN', { weekday: 'short' });
        } else if (daysCount <= 30) {
          label = `W${i + 1} (${stepStart.getDate()} ${stepStart.toLocaleDateString('en-IN', { month: 'short' })})`;
        } else {
          label = stepStart.toLocaleDateString('en-IN', { month: 'short' });
        }

        return Promise.all([
          PurchaseOrder.countDocuments(queryRange).catch(() => 0),
          InvoicePayment.countDocuments(queryRange).catch(() => 0),
          RfqHeader.countDocuments(queryRange).catch(() => 0),
          AdvancePayment.countDocuments(queryRange).catch(() => 0),
        ]).then(([pos, invoices, rfqs, advances]) => ({
          label,
          pos,
          invoices,
          rfqs,
          advances,
        }));
      })
    );

    const recentActivity = [];

    recentPos.forEach(po => {
      recentActivity.push({
        badge: 'PO',
        badgeColor: 'blue',
        code: po.poNumber || `PO-${po.id}`,
        date: new Date(po.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        title: po.supplierName ? `PO for ${po.supplierName}` : `Purchase Order #${po.poNumber || po.id}`
      });
    });

    recentRfqs.forEach(rfq => {
      recentActivity.push({
        badge: 'RFQ',
        badgeColor: 'green',
        code: rfq.rfqNumber || `RFQ-${rfq.id}`,
        date: new Date(rfq.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        title: rfq.title || 'RFQ Logistics Sourcing'
      });
    });

    advancesList.slice(0, 3).forEach(adv => {
      recentActivity.push({
        badge: 'ADVANCE',
        badgeColor: 'teal',
        code: adv.advanceNumber || `ADV-${adv.id}`,
        date: new Date(adv.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        title: adv.vendorName ? `Advance to ${adv.vendorName}` : 'Advance Request'
      });
    });

    recentActivity.sort((a, b) => new Date(b.date) - new Date(a.date));

    const formatINR = (val) => {
      if (!val || val === 0) return '₹0';
      if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
      if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
      if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
      return `₹${val.toLocaleString()}`;
    };

    return res.json({
      success: true,
      range,
      stats: {
        purchaseOrders: poCount,
        purchaseOrdersSub: `${poCount} open`,
        poTrend,
        pendingApprovals: pendingCount,
        pendingApprovalsSub: 'Awaiting action',
        rfqs: rfqCount,
        rfqsSub: `${rfqAwardedCount} awarded`,
        rfqTrend,
        blEntries: blCount,
        blEntriesSub: `${blClearedCount} cleared`,
        activeVendors: vendorCount,
        activeVendorsSub: 'Supplier base',
        advancesPaid: formatINR(sumAdvances),
        advancesPaidSub: 'Released payments',
        invoicesPaid: formatINR(sumInvoices),
        invoicesPaidSub: 'Completed Invoices',
        dutyPaid: formatINR(sumDuties),
        dutyPaidSub: 'Cleared duties'
      },
      last6MonthsActivity,
      paymentStatusMix: statusMix,
      currencyDistribution,
      approvalPipeline,
      rfqFunnel: {
        draft: rfqDraftCount,
        sent: 0,
        quoted: 0,
        awarded: rfqAwardedCount,
        closed: 0,
        total: rfqCount
      },
      blPipeline: {
        assigned: blInvoicesList.filter(b => /assign/i.test(b.status || '')).length,
        cleared: blInvoicesList.filter(b => /clear|customs/i.test(b.status || '')).length,
        invPending: blInvoicesList.filter(b => /pending|draft|exim/i.test(b.status || '')).length,
        pmtReq: blInvoicesList.filter(b => /pmt|req|payment/i.test(b.status || '')).length,
        approved: blInvoicesList.filter(b => /approved/i.test(b.status || '')).length,
        paid: blInvoicesList.filter(b => /paid|dispatched/i.test(b.status || '')).length,
        total: blInvoicesList.length || blCount
      },
      recentPendingApprovals: [
        ...pendingList.map(a => ({
          id: a.id || a.approvalId || 'REQ-01',
          stepText: `Step ${a.currentStep || 1}/${a.totalSteps || 1}`,
          dateText: new Date(a.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
          type: a.type || 'Approval',
        })),
        ...blInvoicesList.filter(b => !appReg.test(b.status || '') && !(b.status || '').toLowerCase().includes('reject')).map(b => ({
          id: b.blId || b.blNumber || b.referenceNo || 'BLI-ENTRY',
          stepText: `Step ${b.currentStep || 1}/${b.totalSteps || 1}`,
          dateText: new Date(b.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
          type: 'BL Freight Invoice'
        }))
      ].slice(0, 6),
      recentActivity: recentActivity.slice(0, 8)
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── WORKFLOW PREVIEW ────────────────────────────────────────────────────────

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

export default router;