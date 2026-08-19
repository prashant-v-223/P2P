import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { UPLOAD_DIR, toLocalPath, openDownloadStream, fileExistsInS3, uploadToS3 } from '../../services/storage.service.js';
import { PurchaseOrder } from '../../models/PurchaseOrder.js';
import { InvoicePayment } from '../../models/InvoicePayment.js';
import { AdvancePayment } from '../../models/AdvancePayment.js';
import { Document } from '../../models/Document.js';
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
import { Role } from '../../models/Role.js';
import { broadcastEvent } from '../../services/sse.service.js';
import { sendApprovalCreatedEmails } from '../../services/notification.service.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { authorizeRole, authorizePermission } from '../../middleware/rbac.middleware.js';
import { sendRfqInvitationEmail, sendBlSubmittedEmail, sendBlAssignedToAgentEmail, sendBlCustomsClearedEmail, sendRfqAwardedEmail } from '../../services/mail.service.js';
import { ExchangeRate } from '../../models/ExchangeRate.js';
import { WorkflowAudit } from '../../models/WorkflowAudit.js';
import { isApprovalForRole } from '../approvals/approvals.controller.js';
import {
  attachApprovers,
  resolveApprovalChain,
  resolveVendorPurchaseManager,
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

// A payment ledger is visible to its requester, every manager above that
// requester, and users explicitly granted organisation-wide visibility.
async function getPaymentVisibility(req) {
  const identity = [req.user?.id, req.user?.userId, req.user?.email].filter(Boolean);
  const loginUser = await User.findOne({
    status: 'Active',
    $or: [{ id: { $in: identity } }, { email: req.user?.email }]
  }).lean();
  if (!loginUser) return null;

  const users = await User.find({ status: 'Active' }, { id: 1, userId: 1, name: 1, email: 1, managerId: 1, managerName: 1, role: 1, canSeeAllRequests: 1 }).lean();
  const visibleIds = new Set([loginUser.id, loginUser.userId, loginUser.email].filter(Boolean));
  const visibleNames = new Set([loginUser.name].filter(Boolean));

  const userRoleLower = String(loginUser.role || req.user?.role || '').toLowerCase().trim();
  const isTopExecutive = loginUser.canSeeAllRequests ||
    ['admin', 'super_admin', 'system_admin', 'cfo', 'md', 'procurement_head', 'purchase_head'].includes(userRoleLower) ||
    userRoleLower === 'procurement head' || userRoleLower === 'purchase head';

  if (isTopExecutive) {
    return {
      user: loginUser,
      seesAll: true,
      ids: [],
      names: [],
      poNumbers: [],
      vendorRefs: []
    };
  }

  // Build children map matching managerId OR managerName
  const childrenMap = new Map();
  users.forEach((user) => {
    const mgrRefs = [user.managerId, user.managerName].filter(Boolean);
    mgrRefs.forEach(ref => {
      const key = String(ref).trim().toLowerCase();
      if (!childrenMap.has(key)) childrenMap.set(key, []);
      childrenMap.get(key).push(user);
    });
  });

  const queue = [
    String(loginUser.id || '').toLowerCase(),
    String(loginUser.userId || '').toLowerCase(),
    String(loginUser.name || '').toLowerCase()
  ].filter(Boolean);

  const visitedKeys = new Set(queue);

  while (queue.length) {
    const key = queue.shift();
    const subs = childrenMap.get(key) || [];
    for (const sub of subs) {
      const subIdKey = String(sub.id || '').toLowerCase();
      if (!visitedKeys.has(subIdKey)) {
        visitedKeys.add(subIdKey);
        visibleIds.add(sub.id);
        if (sub.userId) visibleIds.add(sub.userId);
        if (sub.name) {
          visibleNames.add(sub.name);
          queue.push(String(sub.name).toLowerCase());
        }
        if (sub.id) queue.push(String(sub.id).toLowerCase());
      }
    }
  }

  const visibleIdList = Array.from(visibleIds);
  const visibleNameList = Array.from(visibleNames);

  // Collect POs connected to visible users/subordinates
  const connectedPOs = await PurchaseOrder.find({
    $or: [
      { createdBy: { $in: visibleNameList } },
      { createdById: { $in: visibleIdList } },
      { purchaseManagerId: { $in: visibleIdList } },
      { buyerName: { $in: visibleNameList } }
    ]
  }, { poNumber: 1, sapPoNumber: 1 }).lean().catch(() => []);

  const poNumbers = connectedPOs.flatMap(p => [p.poNumber, p.sapPoNumber]).filter(Boolean);

  // Collect Vendors connected to visible users/subordinates
  const connectedVendors = await Vendor.find({
    $or: [
      { createdBy: { $in: visibleIdList } },
      { assignedPurchaseManager: { $in: visibleNameList } },
      { purchaseManagerId: { $in: visibleIdList } }
    ]
  }, { id: 1, sapVendorCode: 1, supplierId: 1, companyName: 1 }).lean().catch(() => []);

  const vendorRefs = connectedVendors.flatMap(v => [v.id, v.sapVendorCode, v.supplierId, v.companyName]).filter(Boolean);

  return {
    user: loginUser,
    seesAll: false,
    ids: visibleIdList,
    names: visibleNameList,
    poNumbers,
    vendorRefs
  };
}

function paymentOwnerFilter(visibility) {
  if (visibility.seesAll) return {};
  const identities = [...visibility.ids, ...visibility.names];
  return {
    $or: [
      { requestedById: { $in: visibility.ids } },
      { userId: { $in: visibility.ids } },
      { createdBy: { $in: identities } },
      { requestedBy: { $in: identities } }
    ]
  };
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

const activePaymentStatuses = ['pending', 'approved', 'paid', 'adjusted'];

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

async function canMutateOwnPayment(req, payment) {
  if (['admin', 'System Admin'].includes(req.user?.role)) return true;
  const identity = [req.user?.id, req.user?.userId, req.user?.email].filter(Boolean).map(String);
  const user = await User.findOne({ $or: [{ id: { $in: identity } }, { email: req.user?.email }] }, { id: 1, name: 1, email: 1 }).lean();
  const actorValues = new Set([...identity, user?.id, user?.name, user?.email].filter(Boolean).map((value) => String(value).toLowerCase()));
  return [payment.requestedById, payment.userId, payment.requestedBy, payment.createdBy]
    .filter(Boolean)
    .some((value) => actorValues.has(String(value).toLowerCase()));
}

async function canViewPayment(req, payment) {
  if (!payment) return false;

  if (req.user?.role === 'Vendor') {
    const vendorIds = [req.user?.id, req.user?.sapVendorCode, req.user?.supplierId, req.user?.companyName]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());
    return vendorIds.some(v => [
      String(payment.vendorId || '').toLowerCase(),
      String(payment.vendorName || '').toLowerCase(),
      String(payment.sapVendorCode || '').toLowerCase()
    ].includes(v));
  }

  const visibility = await getPaymentVisibility(req);
  if (!visibility) return false;

  if (visibility.seesAll) return true;

  const currentUserId = String(req.user?.id || req.user?.userId || '').toLowerCase();
  const currentUserName = String(req.user?.name || '').toLowerCase();
  const currentUserEmail = String(req.user?.email || '').toLowerCase();

  const visibleIds = new Set((visibility.ids || []).map(v => String(v).toLowerCase()));
  const visibleNames = new Set((visibility.names || []).map(v => String(v).toLowerCase()));
  const visiblePoNumbers = new Set((visibility.poNumbers || []).map(v => String(v).toLowerCase()));
  const visibleVendorRefs = new Set((visibility.vendorRefs || []).map(v => String(v).toLowerCase()));

  const paymentOwners = [payment.requestedById, payment.userId, payment.requestedBy, payment.createdBy]
    .filter(Boolean)
    .map(v => String(v).toLowerCase());

  if (paymentOwners.some(owner => visibleIds.has(owner) || visibleNames.has(owner) || owner === currentUserId || owner === currentUserName || owner === currentUserEmail)) {
    return true;
  }

  const paymentApprovers = [payment.assignedApprover, payment.assignedApproverId, payment.assignedApproverName, payment.approvalTo]
    .filter(Boolean)
    .map(v => String(v).toLowerCase());

  if (paymentApprovers.some(appr => visibleIds.has(appr) || visibleNames.has(appr) || appr === currentUserId || appr === currentUserName || appr === currentUserEmail)) {
    return true;
  }

  const paymentPOs = [payment.poId, payment.sapPoNumber, payment.poNumber]
    .filter(Boolean)
    .map(v => String(v).toLowerCase());

  if (paymentPOs.some(po => visiblePoNumbers.has(po))) {
    return true;
  }

  const paymentVendors = [payment.vendorId, payment.vendorName, payment.sapVendorCode, payment.supplierId]
    .filter(Boolean)
    .map(v => String(v).toLowerCase());

  if (paymentVendors.some(v => visibleVendorRefs.has(v))) {
    return true;
  }

  return false;
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

  // Invoice Payment → direct to Purchase Manager (no Procurement Head gate)
  if (isInvoice) {
    return buildWorkflowResult({ id: 'WF-BOOTSTRAP-INVOICE', name: 'Invoice Payment Standard Approval', version: 1 }, [
      { step: 1, title: 'Purchase Manager Approval', roleName: 'Purchase Manager', roleKey: 'purchase_manager' }
    ]);
  }

  if (moduleName.toLowerCase().includes('custom')) {
    return buildWorkflowResult({ id: 'WF-BOOTSTRAP-CUSTOM', name: 'Custom Duty Standard Approval', version: 1 }, [
      { step: 1, title: 'Finance Lead Approval', roleName: 'Finance Lead', roleKey: 'finance' }
    ]);
  }

  // Advance Payment above ₹1 Cr → purchase_manager → MD → Finance
  if (numAmount >= 10000000) {
    return buildWorkflowResult({ id: 'WF-DEFAULT-HIGH', name: 'Advance Payment (Above ₹1 Cr)' }, [
      { step: 1, title: 'Purchase Manager Approval', roleName: 'Purchase Manager', roleKey: 'purchase_manager' },
      { step: 2, title: 'MD Approval', roleName: 'MD Approval', roleKey: 'md' },
      { step: 3, title: 'Finance Approval', roleName: 'Finance Approval', roleKey: 'finance_lead' }
    ]);
  }

  // Standard Advance Payment → direct to Purchase Manager (streamlined, no first approval)
  return buildWorkflowResult({ id: 'WF-DEFAULT-STD', name: 'Advance Payment (Standard)' }, [
    { step: 1, title: 'Purchase Manager Approval', roleName: 'Purchase Manager', roleKey: 'purchase_manager' }
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

  // ── Vendor-specific manager routing ──────────────────────────────────────────
  // If the request comes from a vendor, find their linked purchase manager
  const isVendorRequest = transactionSnapshot?.createdByType === 'vendor' ||
                          String(requester?.role || '').toLowerCase().includes('vendor');
  let vendorLinkedManager = null;
  if (isVendorRequest) {
    const vendorId = transactionSnapshot?.vendorId || transactionSnapshot?.createdByVendorId;
    vendorLinkedManager = await resolveVendorPurchaseManager(vendorId, poRef, transactionSnapshot);
    if (vendorLinkedManager) {
      console.log(`[Approval Routing] Vendor request linked to senior/manager: ${vendorLinkedManager.name} (${vendorLinkedManager.role})`);
    }
  }

  // Get workflow steps
  let rawSteps = (wf && Array.isArray(wf.steps) && wf.steps.length > 0) ? wf.steps : null;
  if (!rawSteps || rawSteps.length === 0) {
    const fallbackWf = getDefaultWorkflow(type, numAmount);
    rawSteps = fallbackWf.steps || [];
  }

  // Hydrate steps with approvers - use the improved attachApprovers
  const stepsForWorkflow = await attachApprovers(rawSteps, requester);

  // Override first step assignedApprover if vendor has linked purchase manager
  if (vendorLinkedManager && stepsForWorkflow.length > 0) {
    const firstStepRole = String(stepsForWorkflow[0]?.roleKey || '').toLowerCase();
    if (firstStepRole.includes('purchase_manager') || firstStepRole.includes('procurement_manager') || firstStepRole.includes('manager')) {
      stepsForWorkflow[0] = {
        ...stepsForWorkflow[0],
        assignedApproverId: vendorLinkedManager.id,
        assignedApproverName: vendorLinkedManager.name,
        assignedApproverRole: vendorLinkedManager.role,
        assignedApproverEmail: vendorLinkedManager.email,
        isPoolApproval: false,
        resolutionMethod: 'vendor_linked_manager'
      };
    }
  }

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
  const initialStatus = firstStep?.statusKey || (firstStep?.title ? `Pending ${firstStep.title}` : 'Pending Approval');

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
    assignedApproverId: firstStep?.assignedApproverId || null,
    assignedApproverName: firstStep?.assignedApproverName || null,
    assignedApproverEmail: firstStep?.assignedApproverEmail || null,
    totalSteps: safeWf.totalSteps || finalSteps.length,
    hasConflict: hasConflict,
    resolutionMethod: firstStep?.resolutionMethod || 'standard'
  }, {
    targetUserId: firstStep?.assignedApproverId || undefined,
    targetRole: firstStep?.assignedApproverRole || firstStep?.roleKey || undefined
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
      }).select('poId sapPoNumber grossAmount status advanceAdjusted threeWayMatch.invoiceQuantity').lean(),
      AdvancePayment.find({
        $or: [{ poId: { $in: poRefs } }, { sapPoNumber: { $in: poRefs } }],
        status: { $in: activePaymentStatuses }
      }).select('poId sapPoNumber amount adjustedAmount status').lean(),
      vendorKeys.length ? Vendor.find({
        $or: [
          { id: { $in: vendorKeys } },
          { sapVendorCode: { $in: vendorKeys } },
          { supplierId: { $in: vendorKeys } },
          { companyName: { $in: vendorKeys } }
        ]
      }).select('id sapVendorCode supplierId companyName vendorType paymentTerms creditDays gstin pan').lean() : []
    ]);

    const enrichedPos = pos.map((po) => {
      const refs = new Set([po.poNumber, po.sapPoNumber].filter(Boolean).map(String));
      const matchingInvoices = invoiceCommitments.filter((item) => refs.has(String(item.poId)) || refs.has(String(item.sapPoNumber)));
      const matchingAdvances = advanceCommitments.filter((item) => refs.has(String(item.poId)) || refs.has(String(item.sapPoNumber)));
      const invoicedAmount = matchingInvoices.reduce((sum, item) => sum + (Number(item.grossAmount) || 0), 0);
      const invoicedQuantity = matchingInvoices.reduce((sum, item) => sum + (Number(item.threeWayMatch?.invoiceQuantity) || 0), 0);
      const advanceCommitted = matchingAdvances.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const approvedStatuses = new Set(['approved', 'paid', 'adjusted']);
      const approvedInvoiceAmount = matchingInvoices
        .filter((item) => approvedStatuses.has(String(item.status).toLowerCase()))
        .reduce((sum, item) => sum + (Number(item.grossAmount) || 0), 0);
      const approvedAdvanceAmount = matchingAdvances
        .filter((item) => approvedStatuses.has(String(item.status).toLowerCase()))
        .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const approvedTotal = approvedInvoiceAmount + approvedAdvanceAmount;
      const shouldClose = Number(po.totalAmount) > 0 && approvedTotal >= Number(po.totalAmount);
      const totalQuantity = getPoQuantity(po);
      const vendor = poVendors.find((item) =>
        sameValue(item.id, po.supplierId) ||
        sameValue(item.sapVendorCode, po.supplierId) ||
        sameValue(item.supplierId, po.supplierId) ||
        sameValue(item.companyName, po.supplierName)
      );
      return {
        ...po,
        paymentTerms: po.paymentTerms || vendor?.paymentTerms || (vendor?.creditDays ? `${vendor.creditDays} Days` : 'Net 30'),
        creditDays: po.creditDays || vendor?.creditDays,
        vendorType: vendor?.vendorType || '',
        vendorGstin: vendor?.gstin || '',
        vendorPan: vendor?.pan || '',
        invoicedAmount,
        remainingInvoiceAmount: Math.max(0, Number(po.totalAmount) - invoicedAmount),
        advanceCommitted,
        approvedAdvanceAmount,
        approvedInvoiceAmount,
        approvedTotal,
        status: shouldClose ? 'closed' : po.status,
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

router.get('/purchase-orders/:id', authenticateToken, async (req, res) => {
  try {
    const filterOr = [{ poNumber: req.params.id }, { sapPoNumber: req.params.id }];
    if (mongoose.Types.ObjectId.isValid(req.params.id)) filterOr.push({ _id: req.params.id });
    const po = await PurchaseOrder.findOne({ $or: filterOr }).lean();
    if (!po) return res.status(404).json({ success: false, error: 'Purchase order not found' });
    if (!(await validateVendorOwnsPo(req, po))) return res.status(403).json({ success: false, error: 'You cannot view this purchase order.' });

    const references = [...new Set([req.params.id, po.poNumber, po.sapPoNumber].filter(Boolean).map(String))];
    const relatedFilter = { $or: [{ poId: { $in: references } }, { sapPoNumber: { $in: references } }] };
    const [advances, invoices, rfqs, vendor, users] = await Promise.all([
      AdvancePayment.find({ ...relatedFilter, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).lean(),
      InvoicePayment.find({ ...relatedFilter, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).lean(),
      RfqHeader.find(relatedFilter).sort({ createdAt: -1 }).lean(),
      Vendor.findOne({ $or: [{ id: po.supplierId }, { supplierId: po.supplierId }, { sapVendorCode: po.supplierId }, { companyName: po.supplierName }] }).lean(),
      User.find({}, { id: 1, name: 1, email: 1 }).lean()
    ]);
    const userNames = new Map();
    users.forEach((user) => [user.id, user.email].filter(Boolean).forEach((key) => userNames.set(String(key).toLowerCase(), user.name)));
    const withRequesterName = (record) => {
      const requester = record.requestedById || record.userId || record.requestedBy || record.createdBy;
      return { ...record, requestedByName: userNames.get(String(requester || '').toLowerCase()) || record.requestedBy || record.createdBy || 'Unknown user' };
    };
    const enrichedAdvances = advances.map(withRequesterName);
    const enrichedInvoices = invoices.map(withRequesterName);
    const paidStatuses = new Set(['paid', 'adjusted']);
    const isInProgress = (record) => !paidStatuses.has(String(record.status).toLowerCase()) && String(record.status).toLowerCase() !== 'rejected';
    const advanceValue = (record) => Number(record.amount) || 0;
    const invoiceValue = (record) => Number(record.netPayable ?? record.grossAmount) || 0;
    const paidAmount = enrichedAdvances.filter((r) => paidStatuses.has(String(r.status).toLowerCase())).reduce((s, r) => s + advanceValue(r), 0)
      + enrichedInvoices.filter((r) => paidStatuses.has(String(r.status).toLowerCase())).reduce((s, r) => s + invoiceValue(r), 0);
    const inProgressAmount = enrichedAdvances.filter(isInProgress).reduce((s, r) => s + advanceValue(r), 0)
      + enrichedInvoices.filter(isInProgress).reduce((s, r) => s + invoiceValue(r), 0);
    const poValue = Number(po.totalAmount) || 0;

    res.json({
      success: true, data: {
        ...po,
        paymentTerms: po.paymentTerms || vendor?.paymentTerms || (vendor?.creditDays ? `${vendor.creditDays} Days` : 'Net 30'),
        creditDays: po.creditDays || vendor?.creditDays,
        vendorGstin: vendor?.gstin || '',
        vendorPan: vendor?.pan || '',
        advances: enrichedAdvances,
        invoices: enrichedInvoices,
        rfqs,
        financialSummary: { poValue, paidAmount, inProgressAmount, availableAmount: Math.max(0, poValue - paidAmount - inProgressAmount) }
      }
    });
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

router.post('/purchase-orders/:id/close', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const po = await PurchaseOrder.findOne({
      $or: [{ id: id }, { poNumber: id }, { sapPoNumber: id }, { poNumber: `PO-${id}` }]
    });
    if (!po) return res.status(404).json({ success: false, error: 'Purchase Order not found.' });
    po.status = 'Closed';
    await po.save();
    return res.json({ success: true, message: `Purchase Order ${po.poNumber || id} has been closed.`, data: po });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/purchase-orders/:id/reopen', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const po = await PurchaseOrder.findOne({
      $or: [{ id: id }, { poNumber: id }, { sapPoNumber: id }, { poNumber: `PO-${id}` }]
    });
    if (!po) return res.status(404).json({ success: false, error: 'Purchase Order not found.' });
    po.status = 'Open';
    await po.save();
    return res.json({ success: true, message: `Purchase Order ${po.poNumber || id} has been reopened.`, data: po });
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
      { status: 'Active', $or: [{ id: req.user?.id || req.user?.userId }, { email: req.user?.email }] },
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

    const userRole = String(loginUser.role || req.user?.role || '').toLowerCase().trim();
    const isProcurementRole = userRole.includes('procurement') || userRole.includes('purchase') || userRole === 'inner_team';
    const canSeeAllAdvances = loginUser.canSeeAllRequests || !isProcurementRole;
    if (canSeeAllAdvances) {
      users.forEach((user) => teamUsers.set(user.id, user));
    } else {
      collectChildren(loggedInUserId);
    }

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

    const allowedUserIds = [...new Set(allowedUsers.map((user) => user.id).filter(Boolean))];

    // ==================================================
    // 6. ADVANCE PAYMENT FILTER
    // ==================================================

    const filter = {
      isDeleted: { $ne: true },
      ...(!canSeeAllAdvances ? {
        $or: [
          { requestedById: { $in: allowedUserIds } },
          { userId: { $in: allowedUserIds } },
          { createdBy: { $in: [...allowedUserIds, ...allowedUserNames] } },
          { requestedBy: { $in: [...allowedUserIds, ...allowedUserNames] } }
        ]
      } : {})
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

    const userNameById = new Map(users.map((user) => [String(user.id), user.name]));
    const enrichedAdvances = advances.map((advance) => ({
      ...advance,
      requestedByName:
        userNameById.get(String(advance.requestedById || advance.userId || advance.createdBy)) ||
        advance.requestedBy ||
        advance.createdBy ||
        'Finance Team'
    }));

    return res.json({
      success: true,

      data: enrichedAdvances,

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

// ─────────────────────────────────────────────────────────────────────────────
// HIERARCHICAL REPORT GRID ENDPOINT
// ─────────────────────────────────────────────────────────────────────────────
router.get('/reports/hierarchy', authenticateToken, authorizePermission('reports', 'view'), async (req, res) => {
  try {
    const loginUser = await User.findOne(
      { email: req.user?.email },
      { id: 1, name: 1, email: 1, role: 1, department: 1, managerId: 1, managerName: 1, hierarchyLevel: 1, canSeeAllRequests: 1, team: 1 }
    ).lean();

    if (!loginUser) {
      return res.status(401).json({ success: false, error: 'Logged-in user not found.' });
    }

    const allUsers = await User.find(
      { status: 'Active' },
      { id: 1, name: 1, email: 1, role: 1, department: 1, managerId: 1, managerName: 1, hierarchyLevel: 1, canSeeAllRequests: 1, team: 1, avatar: 1 }
    ).sort({ hierarchyLevel: 1, name: 1 }).lean();

    // Map manager to child users
    const byManager = new Map();
    for (const u of allUsers) {
      const mgrKey = u.managerId || 'root';
      if (!byManager.has(mgrKey)) byManager.set(mgrKey, []);
      byManager.get(mgrKey).push(u);
    }

    // Determine allowed user IDs based on loginUser permissions
    const accessibleUserIds = new Set();
    accessibleUserIds.add(loginUser.id);

    const userRoleLower = String(loginUser.role || '').toLowerCase().replace(/[\s_-]+/g, '');
    const isFinanceOrAdmin = ['admin', 'systemadmin', 'superadmin', 'finance', 'cfo', 'accounts'].includes(userRoleLower)
      || userRoleLower.includes('finance') || userRoleLower.includes('account') || userRoleLower.includes('cfo');

    if (!isFinanceOrAdmin) {
      return res.status(403).json({ success: false, error: 'Hierarchy Report is accessible only to Finance and Admin teams.' });
    }

    const isTopExecutive = true;

    if (isTopExecutive) {
      allUsers.forEach((u) => accessibleUserIds.add(u.id));
    } else {
      const collectSubordinates = (mgrId, visited = new Set()) => {
        const subs = byManager.get(mgrId) || [];
        for (const sub of subs) {
          if (visited.has(sub.id)) continue;
          accessibleUserIds.add(sub.id);
          const nextVisited = new Set(visited);
          nextVisited.add(sub.id);
          collectSubordinates(sub.id, nextVisited);
        }
      };
      collectSubordinates(loginUser.id);
    }

    const allowedUserList = allUsers.filter((u) => accessibleUserIds.has(u.id));
    if (isTopExecutive) allowedUserList.push({
      id: 'external-requests', name: 'Vendor Portal / Unassigned', email: '', role: 'External',
      department: 'Vendor Portal', managerId: null, managerName: null, hierarchyLevel: 0,
      team: 'External', avatar: 'VP'
    });
    const allowedUserIds = allowedUserList.map((u) => u.id);
    const allowedUserNames = allowedUserList.map((u) => u.name).filter(Boolean);

    // Top-level users need vendor-portal and admin-created transactions too;
    // managers remain restricted to their reporting subtree.
    const hierarchyTransactionFilter = isTopExecutive ? {} : {
      $or: [
        { userId: { $in: allowedUserIds } },
        { requestedById: { $in: allowedUserIds } },
        { createdBy: { $in: [...allowedUserIds, ...allowedUserNames] } },
        { requestedBy: { $in: [...allowedUserIds, ...allowedUserNames] } }
      ]
    };

    // Fetch transactions
    const [advances, invoices, logisticsPayments, customDuties, pos, vendors] = await Promise.all([
      AdvancePayment.find({
        isDeleted: { $ne: true },
        ...hierarchyTransactionFilter
      }).lean(),
      InvoicePayment.find({
        isDeleted: { $ne: true },
        ...hierarchyTransactionFilter
      }).lean(),
      LogisticsPayment.find(hierarchyTransactionFilter).lean(),
      CustomDutyPayment.find(hierarchyTransactionFilter).lean(),
      PurchaseOrder.find().lean(),
      Vendor.find({}, { id: 1, supplierId: 1, sapVendorCode: 1, companyName: 1, vendorType: 1, paymentTerms: 1 }).lean()
    ]);

    const vendorMap = new Map();
    vendors.forEach((v) => {
      if (v.sapVendorCode) vendorMap.set(v.sapVendorCode, v);
      if (v.supplierId) vendorMap.set(v.supplierId, v);
    });

    // Group metrics by user ID
    const userMetrics = new Map();
    for (const u of allowedUserList) {
      userMetrics.set(u.id, {
        user: u,
        records: [],
        poTotalAmount: 0,
        advancePaymentTotal: 0,
        invoicePaymentTotal: 0,
        logisticsPaymentTotal: 0,
        customDutyTotal: 0,
        invoiceAdvanceAdjustedTotal: 0,
        paidAmount: 0,
        approvedAmount: 0,
        pendingAmount: 0,
        poCommittedAmount: 0,
        pendingNotApprovedAdvanceCount: 0,
        pendingNotApprovedAdvanceAmount: 0,
        verifiedRecordsCount: 0,
        associatedVendors: new Set(),
        associatedPoRefs: new Set(),
        turnaroundHoursList: [],
        latestCreatedAt: null
      });
    }

    // Process Advance Payments
    for (const adv of advances) {
      const ownerId = adv.userId || adv.requestedById || allowedUserList.find(u => u.name === adv.createdBy)?.id || 'external-requests';
      const metric = userMetrics.get(ownerId);
      if (!metric) continue;

      const amt = Number(adv.amount || 0);
      metric.advancePaymentTotal += amt;
      const advanceStatus = String(adv.status || '').toLowerCase();
      const isApproved = ['approved', 'paid', 'adjusted'].includes(advanceStatus);
      if (['paid', 'adjusted'].includes(advanceStatus)) metric.paidAmount += amt;
      else if (advanceStatus === 'approved') metric.approvedAmount += amt;
      else if (advanceStatus !== 'rejected') metric.pendingAmount += amt;
      if (advanceStatus !== 'rejected') metric.poCommittedAmount += amt;
      if (isApproved) {
        metric.verifiedRecordsCount += 1;
      } else if (!String(adv.status || '').toLowerCase().includes('reject')) {
        metric.pendingNotApprovedAdvanceCount += 1;
        metric.pendingNotApprovedAdvanceAmount += amt;
      }

      if (adv.vendorName) metric.associatedVendors.add(adv.vendorName);
      if (adv.sapPoNumber || adv.poId) metric.associatedPoRefs.add(String(adv.sapPoNumber || adv.poId));
      if (adv.createdAt) {
        const cDate = new Date(adv.createdAt);
        if (!metric.latestCreatedAt || cDate > metric.latestCreatedAt) metric.latestCreatedAt = cDate;
        if (adv.paidAt || adv.updatedAt) {
          const doneDate = new Date(adv.paidAt || adv.updatedAt);
          const diffHours = Math.max(0, (doneDate - cDate) / (1000 * 60 * 60));
          metric.turnaroundHoursList.push(diffHours);
        }
      }

      metric.records.push({
        id: adv.advanceId,
        type: 'Advance Payment',
        poNumber: adv.sapPoNumber || adv.poId,
        vendorName: adv.vendorName,
        amount: amt,
        currency: adv.currency || 'INR',
        status: adv.status,
        verified: isApproved,
        createdAt: adv.createdAt,
        advanceAdjusted: 0
      });
    }

    // Process Invoice Payments
    for (const inv of invoices) {
      const ownerId = inv.userId || inv.requestedById || allowedUserList.find(u => u.name === inv.createdBy)?.id || 'external-requests';
      const metric = userMetrics.get(ownerId);
      if (!metric) continue;

      const gross = Number(inv.grossAmount || 0);
      const payable = Number(inv.netPayable ?? inv.grossAmount) || 0;
      const advAdj = Number(inv.advanceAdjusted || 0);
      metric.invoicePaymentTotal += gross;
      metric.invoiceAdvanceAdjustedTotal += advAdj;

      const invoiceStatus = String(inv.status || '').toLowerCase();
      const isVerified = ['approved', 'paid'].includes(invoiceStatus) || inv.threeWayMatch?.status === 'matched';
      if (invoiceStatus === 'paid') metric.paidAmount += payable;
      else if (invoiceStatus === 'approved') metric.approvedAmount += payable;
      else if (invoiceStatus !== 'rejected') metric.pendingAmount += payable;
      if (invoiceStatus !== 'rejected') metric.poCommittedAmount += payable;
      if (isVerified) metric.verifiedRecordsCount += 1;

      if (inv.vendorName) metric.associatedVendors.add(inv.vendorName);
      if (inv.sapPoNumber || inv.poId) metric.associatedPoRefs.add(String(inv.sapPoNumber || inv.poId));
      if (inv.createdAt) {
        const cDate = new Date(inv.createdAt);
        if (!metric.latestCreatedAt || cDate > metric.latestCreatedAt) metric.latestCreatedAt = cDate;
        if (inv.paidAt || inv.updatedAt) {
          const doneDate = new Date(inv.paidAt || inv.updatedAt);
          const diffHours = Math.max(0, (doneDate - cDate) / (1000 * 60 * 60));
          metric.turnaroundHoursList.push(diffHours);
        }
      }

      metric.records.push({
        id: inv.invoicePaymentId || inv.invoiceNumber,
        type: 'Invoice Payment',
        poNumber: inv.sapPoNumber || inv.poId,
        vendorName: inv.vendorName,
        amount: payable,
        grossAmount: gross,
        currency: inv.currency || 'INR',
        status: inv.status,
        threeWayMatchStatus: inv.threeWayMatch?.status || 'pending',
        verified: isVerified,
        createdAt: inv.createdAt,
        advanceAdjusted: advAdj
      });
    }

    const addNonPoPayment = (payment, type, amount, vendorName) => {
      const ownerId = payment.userId || payment.requestedById || allowedUserList.find((user) => user.name === payment.createdBy)?.id || 'external-requests';
      const metric = userMetrics.get(ownerId);
      if (!metric) return;
      const status = String(payment.status || '').toLowerCase();
      if (type === 'Logistics Payment') metric.logisticsPaymentTotal += amount;
      else metric.customDutyTotal += amount;
      if (status === 'paid') metric.paidAmount += amount;
      else if (status === 'approved' || status === 'approved & dispatched') metric.approvedAmount += amount;
      else if (status !== 'rejected') metric.pendingAmount += amount;
      if (['approved', 'approved & dispatched', 'paid'].includes(status)) metric.verifiedRecordsCount += 1;
      if (vendorName) metric.associatedVendors.add(vendorName);
      metric.records.push({
        id: payment.logisticsPaymentId || payment.referenceNumber || payment.dutyId,
        type,
        poNumber: payment.sapPoNumber || payment.poId || payment.blNumber || 'Non-PO',
        vendorName: vendorName || 'Government / Service Provider',
        amount,
        currency: payment.currency || 'INR',
        status: payment.status,
        verified: ['approved', 'approved & dispatched', 'paid'].includes(status),
        createdAt: payment.createdAt,
        advanceAdjusted: 0
      });
    };
    logisticsPayments.forEach((payment) => addNonPoPayment(payment, 'Logistics Payment', Number(payment.totalAmount ?? payment.amount) || 0, payment.vendorName || payment.providerName));
    customDuties.forEach((payment) => addNonPoPayment(payment, 'Custom Duty', Number(payment.dutyAmount ?? payment.totalAmount) || 0, payment.customAgentName || 'ICEGATE / Customs'));

    const poAmountByRef = new Map();
    for (const po of pos) {
      [po.poNumber, po.sapPoNumber].filter(Boolean).forEach((ref) => poAmountByRef.set(String(ref), Number(po.totalAmount || 0)));
    }
    for (const metric of userMetrics.values()) {
      metric.poTotalAmount = [...metric.associatedPoRefs].reduce((sum, ref) => sum + (poAmountByRef.get(ref) || 0), 0);
    }

    // Build Rows
    const rows = allowedUserList.map((u) => {
      const m = userMetrics.get(u.id);
      const avgHours = m.turnaroundHoursList.length > 0
        ? Math.round(m.turnaroundHoursList.reduce((a, b) => a + b, 0) / m.turnaroundHoursList.length)
        : 0;

      return {
        userId: u.id,
        userName: u.name,
        userEmail: u.email,
        userRole: u.role,
        department: u.department,
        managerId: u.managerId,
        managerName: u.managerName,
        hierarchyLevel: u.hierarchyLevel,
        team: u.team,
        avatar: u.avatar || u.name.slice(0, 2).toUpperCase(),
        totalRecords: m.records.length,
        verifiedRecordsCount: m.verifiedRecordsCount,
        pendingNotApprovedAdvanceCount: m.pendingNotApprovedAdvanceCount,
        pendingNotApprovedAdvanceAmount: m.pendingNotApprovedAdvanceAmount,
        poTotalAmount: m.poTotalAmount,
        advancePaymentTotal: m.advancePaymentTotal,
        invoicePaymentTotal: m.invoicePaymentTotal,
        logisticsPaymentTotal: m.logisticsPaymentTotal,
        customDutyTotal: m.customDutyTotal,
        invoiceAdvanceAdjustedTotal: m.invoiceAdvanceAdjustedTotal,
        paidAmount: m.paidAmount,
        approvedAmount: m.approvedAmount,
        pendingAmount: m.pendingAmount,
        committedAmount: m.paidAmount + m.approvedAmount + m.pendingAmount,
        poCommittedAmount: m.poCommittedAmount,
        availableBalance: Math.max(0, m.poTotalAmount - m.poCommittedAmount),
        vendorRequirements: Array.from(m.associatedVendors),
        avgTurnaroundHours: avgHours,
        latestCreatedAt: m.latestCreatedAt ? m.latestCreatedAt.toISOString() : null,
        records: m.records
      };
    });

    // Vendor-centric report includes records submitted by employees, admins,
    // and vendor-portal accounts. It does not reassign unknown owners to admin.
    const vendorByKey = new Map();
    vendors.forEach((vendor) => {
      [vendor.id, vendor.sapVendorCode, vendor.supplierId, vendor.companyName]
        .filter(Boolean)
        .forEach((key) => vendorByKey.set(String(key).toLowerCase(), vendor));
    });
    const vendorMetrics = new Map();
    const addToVendorReport = (payment, type, amount) => {
      const vendor = vendorByKey.get(String(payment.vendorId || '').toLowerCase()) || vendorByKey.get(String(payment.vendorName || '').toLowerCase());
      const key = String(vendor?.id || vendor?.sapVendorCode || payment.vendorId || payment.vendorName || 'unknown-vendor');
      if (!vendorMetrics.has(key)) vendorMetrics.set(key, {
        vendorId: vendor?.id || payment.vendorId || key,
        vendorCode: vendor?.sapVendorCode || vendor?.supplierId || payment.vendorId || '',
        vendorName: vendor?.companyName || payment.vendorName || 'Unknown Vendor',
        vendorType: vendor?.vendorType || '',
        advanceTotal: 0,
        invoiceTotal: 0,
        paidTotal: 0,
        pendingTotal: 0,
        requesters: new Set(),
        records: []
      });
      const metric = vendorMetrics.get(key);
      if (type === 'Advance Payment') metric.advanceTotal += amount;
      else metric.invoiceTotal += amount;
      const status = String(payment.status || '').toLowerCase();
      if (status === 'paid') metric.paidTotal += amount;
      if (!['paid', 'approved', 'rejected'].includes(status)) metric.pendingTotal += amount;
      const requester = allowedUserList.find((user) => user.id === (payment.requestedById || payment.userId));
      const vendorCreated = payment.createdByType === 'vendor'
        || sameValue(payment.requestedById, payment.vendorId)
        || sameValue(payment.userId, payment.vendorId);
      const creatorName = vendorCreated
        ? `Vendor: ${metric.vendorName}`
        : `User: ${requester?.name || payment.requestedBy || payment.createdBy || 'Unknown'}`;
      metric.requesters.add(creatorName);
      metric.records.push({
        id: payment.advanceId || payment.invoicePaymentId || payment.invoiceNumber,
        type,
        poNumber: payment.sapPoNumber || payment.poId,
        vendorName: metric.vendorName,
        amount,
        currency: payment.currency || 'INR',
        status: payment.status,
        requestedByName: creatorName,
        createdByType: vendorCreated ? 'vendor' : 'user',
        createdByName: vendorCreated ? metric.vendorName : (requester?.name || payment.requestedBy || payment.createdBy || 'Unknown'),
        createdAt: payment.createdAt
      });
    };
    advances.forEach((payment) => addToVendorReport(payment, 'Advance Payment', Number(payment.amount || 0)));
    invoices.forEach((payment) => addToVendorReport(payment, 'Invoice Payment', Number(payment.netPayable || payment.grossAmount || 0)));
    const vendorRows = Array.from(vendorMetrics.values()).map((metric) => ({
      ...metric,
      totalRecords: metric.records.length,
      totalAmount: metric.advanceTotal + metric.invoiceTotal,
      requesters: Array.from(metric.requesters)
    })).sort((a, b) => b.totalAmount - a.totalAmount);

    // ── Build Upcoming 7-Day Payments List (Finance Approval Based) ──
    const now = new Date();
    const upcomingFinancePayments = [];

    const processUpcomingItem = (payment, type, idKey, amtKey, vendorKey, poKey) => {
      const status = String(payment.status || '').toLowerCase();
      if (['rejected', 'paid', 'adjusted'].includes(status)) return;

      const created = payment.createdAt ? new Date(payment.createdAt) : now;
      const dueDate = payment.dueDate
        ? new Date(payment.dueDate)
        : payment.expectedPaymentDate
        ? new Date(payment.expectedPaymentDate)
        : new Date(created.getTime() + 5 * 24 * 60 * 60 * 1000);

      const diffMs = dueDate - now;
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      const amount = Number(payment[amtKey] ?? payment.amount ?? payment.totalAmount) || 0;
      const fxRate = Number(payment.fxRate) || 83.5;
      const currency = payment.currency || 'INR';
      const amountINR = currency === 'INR' ? amount : (payment.amountINR || (amount * fxRate));

      let urgency = '4-7 Days';
      if (daysRemaining < 0) urgency = 'Overdue';
      else if (daysRemaining === 0) urgency = 'Due Today';
      else if (daysRemaining <= 3) urgency = '1-3 Days';

      upcomingFinancePayments.push({
        id: payment[idKey] || payment.id || payment._id,
        type,
        vendorName: payment[vendorKey] || payment.vendorName || payment.customAgentName || 'Vendor',
        poNumber: payment[poKey] || payment.sapPoNumber || payment.poId || '—',
        amount,
        amountINR,
        currency,
        status: payment.status || 'Pending Finance Approval',
        assignedApproverRole: payment.assignedApproverRole || 'Finance Lead',
        requestedBy: payment.requestedByName || payment.requestedBy || payment.createdBy || 'Finance Team',
        department: payment.department || 'Procurement',
        createdAt: payment.createdAt,
        dueDate: dueDate.toISOString(),
        daysRemaining,
        urgency
      });
    };

    advances.forEach(adv => processUpcomingItem(adv, 'Advance Payment', 'advanceId', 'amount', 'vendorName', 'sapPoNumber'));
    invoices.forEach(inv => processUpcomingItem(inv, 'Invoice Payment', 'invoicePaymentId', 'netPayable', 'vendorName', 'sapPoNumber'));
    logisticsPayments.forEach(log => processUpcomingItem(log, 'Logistics Payment', 'logisticsPaymentId', 'totalAmount', 'vendorName', 'sapPoNumber'));
    customDuties.forEach(duty => processUpcomingItem(duty, 'Custom Duty', 'dutyId', 'dutyAmount', 'customAgentName', 'sapPoNumber'));

    upcomingFinancePayments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    // ── Build Past 7-Day Payments List (Last 7 Days Approved/Paid/Processed) ──
    const last7dFinancePayments = [];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const processPastItem = (payment, type, idKey, amtKey, vendorKey, poKey) => {
      const status = String(payment.status || '').toLowerCase();
      // Include approved, paid, or processed payments
      if (!['approved', 'paid', 'adjusted', 'approved & dispatched'].some((s) => status.includes(s))) return;

      const actionDate = payment.updatedAt || payment.paidAt || payment.approvedAt || payment.createdAt;
      const dateObj = actionDate ? new Date(actionDate) : now;
      if (dateObj >= sevenDaysAgo) {
        const amount = Number(payment[amtKey] ?? payment.amount ?? payment.totalAmount) || 0;
        const fxRate = Number(payment.fxRate) || 83.5;
        const currency = payment.currency || 'INR';
        const amountINR = currency === 'INR' ? amount : (payment.amountINR || (amount * fxRate));

        last7dFinancePayments.push({
          id: payment[idKey] || payment.id || payment._id,
          type,
          vendorName: payment[vendorKey] || payment.vendorName || payment.customAgentName || 'Vendor',
          poNumber: payment[poKey] || payment.sapPoNumber || payment.poId || '—',
          amount,
          amountINR,
          currency,
          status: payment.status || 'Approved',
          actionDate: dateObj.toISOString(),
          requestedBy: payment.requestedByName || payment.requestedBy || payment.createdBy || 'Finance Team',
          department: payment.department || 'Procurement'
        });
      }
    };

    advances.forEach(adv => processPastItem(adv, 'Advance Payment', 'advanceId', 'amount', 'vendorName', 'sapPoNumber'));
    invoices.forEach(inv => processPastItem(inv, 'Invoice Payment', 'invoicePaymentId', 'netPayable', 'vendorName', 'sapPoNumber'));
    logisticsPayments.forEach(log => processPastItem(log, 'Logistics Payment', 'logisticsPaymentId', 'totalAmount', 'vendorName', 'sapPoNumber'));
    customDuties.forEach(duty => processPastItem(duty, 'Custom Duty', 'dutyId', 'dutyAmount', 'customAgentName', 'sapPoNumber'));

    last7dFinancePayments.sort((a, b) => new Date(b.actionDate) - new Date(a.actionDate));

    // Build Hierarchy Tree
    const rowMap = new Map(rows.map((r) => [r.userId, { ...r, reports: [] }]));
    const rootNodes = [];

    rows.forEach((r) => {
      const node = rowMap.get(r.userId);
      if (r.managerId && rowMap.has(r.managerId) && r.managerId !== r.userId) {
        rowMap.get(r.managerId).reports.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    return res.json({
      success: true,
      currentUser: {
        id: loginUser.id,
        name: loginUser.name,
        role: loginUser.role,
        canSeeAllRequests: isTopExecutive,
        reportScope: isTopExecutive ? 'organisation' : (allowedUserIds.length > 1 ? 'hierarchy' : 'self')
      },
      summary: {
        totalUsers: rows.length,
        totalVendors: vendorRows.length,
        totalVerifiedRecords: rows.reduce((acc, r) => acc + r.verifiedRecordsCount, 0),
        totalPendingAdvanceCount: rows.reduce((acc, r) => acc + r.pendingNotApprovedAdvanceCount, 0),
        totalPendingAdvanceAmount: rows.reduce((acc, r) => acc + r.pendingNotApprovedAdvanceAmount, 0),
        totalInvoiceAdvanceAdjusted: rows.reduce((acc, r) => acc + r.invoiceAdvanceAdjustedTotal, 0),
        totalPoValue: [...new Set([...advances, ...invoices].map((payment) => String(payment.sapPoNumber || payment.poId || '')).filter(Boolean))]
          .reduce((sum, ref) => sum + (poAmountByRef.get(ref) || 0), 0),
        totalPaidAmount: rows.reduce((acc, r) => acc + r.paidAmount, 0),
        totalApprovedAmount: rows.reduce((acc, r) => acc + r.approvedAmount, 0),
        totalPendingAmount: rows.reduce((acc, r) => acc + r.pendingAmount, 0),
        totalPoCommittedAmount: rows.reduce((acc, r) => acc + r.poCommittedAmount, 0),
        upcoming7dFinanceCount: upcomingFinancePayments.length,
        upcoming7dFinanceTotalINR: upcomingFinancePayments.reduce((sum, item) => sum + item.amountINR, 0)
      },
      rows,
      vendorRows,
      upcomingFinancePayments,
      tree: rootNodes
    });
  } catch (err) {
    console.error('getHierarchyReport error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});


const getSingleAdvanceHandler = async (req, res) => {
  try {
    const adv = await AdvancePayment.findOne({
      $and: [
        buildAdvanceFilter(req.params.id),
        { isDeleted: { $ne: true } }
      ]
    }).lean();
    if (!adv) return res.status(404).json({ success: false, error: 'Advance payment not found' });
    if (!(await canViewPayment(req, adv))) return res.status(403).json({ success: false, error: 'You cannot view this advance payment.' });
    const approval = await Approval.findOne({ $or: [{ id: adv.advanceId }, { id: req.params.id }] }).lean();
    const requester = await User.findOne(
      { $or: [{ id: adv.requestedById || adv.userId || adv.createdBy }, { email: adv.requestedById || adv.createdBy }] },
      { name: 1 }
    ).lean();
    return res.json({
      success: true,
      data: {
        ...adv,
        requestedByName: requester?.name || adv.requestedBy || adv.createdBy || 'Finance Team',
        approval: approval || null
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

router.get('/advances/:id', authenticateToken, getSingleAdvanceHandler);
router.get('/advance-payments/:id', authenticateToken, getSingleAdvanceHandler);

// ─── POST Create Advance Payment ─────────────────────────────────────────────

const createAdvanceHandler = async (req, res) => {
  try {
    if (req.user?.role === 'Vendor') {
      return res.status(403).json({
        success: false,
        error: 'Vendors are not permitted to submit advance payment requests. Advance payments must be initiated by the buyer procurement team.'
      });
    }

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

    const vendorDoc = await Vendor.findOne({
      $or: [{ id: vendorIdFinal }, { sapVendorCode: vendorIdFinal }, { supplierId: vendorIdFinal }]
    }).lean();

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
      bankName: bankName || vendorDoc?.bankName || '',
      bankAccountNumber: bankAccountNumber || vendorDoc?.bankAccountNumber || vendorDoc?.accountNumber || '',
      remarks: remarks || '',
      status: 'pending',
      createdBy: req.user?.name || req.user?.email || 'System User',
      requestedById: req.user?.id || req.user?.email || 'system',
      userId: req.user?.id || req.user?.email || 'system',
      requestedBy: req.user?.name || requestedBy || 'Finance Team'
      , createdByType: req.user?.role === 'Vendor' ? 'vendor' : 'user'
      , createdByVendorId: req.user?.role === 'Vendor' ? vendorIdFinal : ''
    });

    const { amountINR, fxRate, amountFormatted } = await getFxConversion(numAmount, poCurrency, req.body.fxRate);

    const wf = await resolveWorkflowFromDB('Advance Payment', amountINR, { currency: poCurrency, vendorType: req.user?.vendorType, poType: po.poType || po.type });

    const approval = await createApprovalRecord({
      referenceId: advanceId,
      type: 'Advance Payment',
      vendorName: vendorNameFinal,
      amountFormatted,
      poRef,
      requestedBy: req.user?.name || requestedBy || 'Finance Team',
      requestedById: req.user?.id || req.user?.email,
      requestId: req.headers['x-request-id'],
      transactionSnapshot: { amount: numAmount, amountINR, currency: poCurrency, fxRate, poId: poRef, vendorId: vendorIdFinal },
      wf
    });

    newAdv.approvalInstanceId = approval._id.toString();
    newAdv.requestedByTeam = approval.requestedByTeam || null;
    newAdv.assignedApprover = approval.assignedApprover || null;
    newAdv.assignedApproverName = approval.assignedApproverName || null;
    newAdv.assignedApproverRole = approval.assignedApproverRole || null;
    await newAdv.save();

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
    if (!['draft', 'returned'].includes(adv.status)) return res.status(409).json({ success: false, error: 'Only a draft or returned advance can be edited.' });
    if (!(await canMutateOwnPayment(req, adv))) return res.status(403).json({ success: false, error: 'Only the requester can edit this advance.' });

    const { amount, paymentMode, bankName, bankAccountNumber, remarks, updateRemark } = req.body;

    // Require updateRemark so every change is traceable and transparent
    if (!String(updateRemark || '').trim()) {
      return res.status(400).json({ success: false, error: 'An update remark is required to explain what changed and why.' });
    }

    const changedFields = [];
    if (amount !== undefined) { adv.amount = Number(amount); changedFields.push(`amount → ${amount}`); }
    if (paymentMode !== undefined) { adv.paymentMode = paymentMode; changedFields.push(`paymentMode → ${paymentMode}`); }
    if (bankName !== undefined) { adv.bankName = bankName; changedFields.push('bankName'); }
    if (bankAccountNumber !== undefined) { adv.bankAccountNumber = bankAccountNumber; changedFields.push('bankAccountNumber'); }
    if (remarks !== undefined) { adv.remarks = remarks; changedFields.push('remarks'); }

    // Append update to audit history
    if (!Array.isArray(adv.updateHistory)) adv.updateHistory = [];
    adv.updateHistory.push({
      updatedBy: req.user?.name || req.user?.email || 'User',
      updatedAt: new Date(),
      updateRemark: String(updateRemark).trim(),
      changedFields: changedFields.join(', ') || 'no field changes'
    });

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
        remarks: `Advance Payment updated. Reason: ${String(updateRemark).trim()}. Changed: ${changedFields.join(', ') || 'none'}.`,
        occurredAt: new Date()
      });
    } catch (_) { }

    return res.json({ success: true, data: adv });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};


router.put('/advances/:id', authenticateToken, updateAdvanceHandler);
router.put('/advance-payments/:id', authenticateToken, updateAdvanceHandler);

// ─── DELETE Advance Payment ───────────────────────────────────────────────────

const deleteAdvanceHandler = async (req, res) => {
  try {
    const adv = await AdvancePayment.findOne(buildAdvanceFilter(req.params.id));
    if (adv) {
      if (!['draft', 'returned'].includes(adv.status)) return res.status(409).json({ success: false, error: 'Only a draft or returned advance can be deleted.' });
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

router.delete('/advances/:id', authenticateToken, authorizePermission('advance-payments', 'delete'), deleteAdvanceHandler);
router.delete('/advance-payments/:id', authenticateToken, authorizePermission('advance-payments', 'delete'), deleteAdvanceHandler);

// ─── PUT Update Advance Payment Status ──────────────────────────────────────

router.put('/advances/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value.' });
    }
    const adv = await AdvancePayment.findOne(buildAdvanceFilter(req.params.id));
    if (!adv) return res.status(404).json({ success: false, error: 'Advance not found' });
    if (!['draft', 'returned'].includes(adv.status)) return res.status(409).json({ success: false, error: 'Only a draft or returned advance can be submitted.' });
    if (!(await canMutateOwnPayment(req, adv))) return res.status(403).json({ success: false, error: 'Only the requester can submit this advance.' });
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

async function recalculatePoMetrics(poRef) {
  if (!poRef || poRef === '—' || poRef === 'Non-PO') return;
  try {
    const cleanRef = String(poRef).trim();
    const po = await PurchaseOrder.findOne({
      $or: [
        { poNumber: cleanRef },
        { sapPoNumber: cleanRef },
        { id: cleanRef },
        { poNumber: `PO-${cleanRef}` }
      ]
    });
    if (!po) return;

    const paidAdvances = await AdvancePayment.find({
      $or: [{ sapPoNumber: cleanRef }, { poNumber: cleanRef }, { poId: cleanRef }],
      status: 'paid',
      isDeleted: { $ne: true }
    }).lean();
    const totalAdvancePaid = paidAdvances.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    const paidInvoices = await InvoicePayment.find({
      $or: [{ sapPoNumber: cleanRef }, { poNumber: cleanRef }, { poId: cleanRef }],
      status: 'paid',
      isDeleted: { $ne: true }
    }).lean();
    const totalInvoicePaid = paidInvoices.reduce((sum, item) => sum + (Number(item.netPayable || item.grossAmount) || 0), 0);

    po.advancePaid = totalAdvancePaid;
    po.paidAmount = totalInvoicePaid;
    const poTotal = Number(po.totalAmount || po.poValue) || 0;

    if (poTotal > 0 && (totalAdvancePaid + totalInvoicePaid) >= poTotal) {
      if (po.status !== 'Closed' && po.status !== 'closed') {
        po.status = 'Completed';
      }
    }
    await po.save();
  } catch (err) {
    console.warn('[PO RECALC WARN]: Failed to update PO metrics:', err.message);
  }
}

router.post('/advances/:id/payout', authenticateToken, authorizePermission('advance-payments', 'mark-paid'), async (req, res) => {
  try {
    const utrNumber = String(req.body.utrNumber || '').trim();
    if (!utrNumber) return res.status(400).json({ success: false, error: 'UTR number is required.' });
    const advance = await AdvancePayment.findOne(buildAdvanceFilter(req.params.id));
    if (!advance) return res.status(404).json({ success: false, error: 'Advance payment not found.' });

    advance.status = 'paid';
    advance.utrNumber = utrNumber;
    advance.paidAt = new Date();
    await advance.save();

    const approval = await Approval.findOne({
      $or: [{ id: advance.advanceId }, { id: req.params.id }]
    });
    if (approval) {
      approval.status = 'Approved & Dispatched';
      await approval.save();
    }

    await recalculatePoMetrics(advance.sapPoNumber || advance.poNumber || advance.poId);

    return res.json({ success: true, message: 'Advance payment marked as paid.', data: advance });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});
async function getPaymentOwnerFilter(req, visibility) {
  if (visibility.seesAll) {
    return {};
  }

  const loggedInUserId = req.user?.id;
  const loggedInUserName = req.user?.name || visibility.user?.name;

  // Vendors created by or assigned to visible users/subordinates
  const createdVendors = await Vendor.find({
    $or: [
      { createdBy: { $in: [...visibility.ids, loggedInUserId].filter(Boolean) } },
      { assignedPurchaseManager: { $in: [...visibility.names, loggedInUserName].filter(Boolean) } },
      { purchaseManagerId: { $in: [...visibility.ids, loggedInUserId].filter(Boolean) } }
    ],
    isDeleted: { $ne: true }
  }).select('id supplierId sapVendorCode companyName').lean().catch(() => []);

  const createdVendorRefs = createdVendors.flatMap(v => [v.id, v.supplierId, v.sapVendorCode, v.companyName]).filter(Boolean);
  const allVendorRefs = Array.from(new Set([...(visibility.vendorRefs || []), ...createdVendorRefs]));
  const allPoNumbers = Array.from(new Set(visibility.poNumbers || []));

  const identities = Array.from(new Set([
    ...visibility.ids,
    ...visibility.names,
    loggedInUserId,
    loggedInUserName
  ].filter(Boolean)));

  const filterConditions = [
    // 1. Normal employee/user ownership & created records in reporting subtree
    { requestedById: { $in: visibility.ids } },
    { userId: { $in: visibility.ids } },
    { createdBy: { $in: identities } },
    { requestedBy: { $in: identities } },

    // 2. Assigned approver matching user or subtree subordinates
    { assignedApprover: { $in: identities } },
    { assignedApproverId: { $in: visibility.ids } },
    { assignedApproverName: { $in: visibility.names } }
  ];

  // 3. Connected Purchase Orders (POs created by user or subtree)
  if (allPoNumbers.length > 0) {
    filterConditions.push(
      { poId: { $in: allPoNumbers } },
      { sapPoNumber: { $in: allPoNumbers } },
      { poNumber: { $in: allPoNumbers } }
    );
  }

  // 4. Connected Vendors (vendors managed/assigned to user or subtree)
  if (allVendorRefs.length > 0) {
    filterConditions.push(
      { vendorId: { $in: allVendorRefs } },
      { vendorName: { $in: allVendorRefs } },
      { sapVendorCode: { $in: allVendorRefs } },
      { supplierId: { $in: allVendorRefs } }
    );
  }

  return { $or: filterConditions };
}
router.get('/invoices', authenticateToken, async (req, res) => {
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
      req.query.q || req.query.search || ''
    ).trim();

    const statusFilter = String(
      req.query.status || ''
    ).trim();

    const matchFilter = String(
      req.query.threeWayMatch || req.query.match || ''
    ).trim();

    const visibility = await getPaymentVisibility(req);

    console.log('PAYMENT VISIBILITY:', visibility);

    if (!visibility) {
      return res.status(403).json({
        success: false,
        error: 'Your active user record could not be found.'
      });
    }

    // ---------------------------------------------------------
    // IMPORTANT:
    // Include payments created/requested by vendors
    // that were created by the logged-in user.
    // ---------------------------------------------------------

    const ownerFilter = await getPaymentOwnerFilter(
      req,
      visibility
    );

    const filter = {
      isDeleted: { $ne: true },
      ...ownerFilter
    };

    // ---------------------------------------------------------
    // SEARCH
    // ---------------------------------------------------------

    if (search) {
      const regex = new RegExp(
        escapeRegex(search),
        'i'
      );

      filter.$and = [
        {
          $or: [
            { invoiceNumber: regex },
            { invoicePaymentId: regex },
            { poId: regex },
            { sapPoNumber: regex },
            { vendorName: regex },
            { vendorId: regex }
          ]
        }
      ];
    }

    // ---------------------------------------------------------
    // STATUS
    // ---------------------------------------------------------

    if (
      statusFilter &&
      statusFilter !== 'All Status' &&
      statusFilter !== 'All'
    ) {
      filter.status = statusFilter.toLowerCase();
    }

    // ---------------------------------------------------------
    // THREE WAY MATCH
    // ---------------------------------------------------------

    if (
      matchFilter &&
      matchFilter !== 'All Match' &&
      matchFilter !== 'All'
    ) {
      filter['threeWayMatch.status'] =
        matchFilter.toLowerCase();
    }

    // ---------------------------------------------------------
    // PAGINATION
    // ---------------------------------------------------------

    const total = await InvoicePayment.countDocuments(
      filter
    );

    const totalPages = Math.max(
      1,
      Math.ceil(total / size)
    );

    const safePage = Math.min(
      page,
      totalPages
    );

    const invoices = await InvoicePayment.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * size)
      .limit(size)
      .lean();

    // Enrich invoices with Purchase Connection (Buyer / Manager Name)
    const poIds = invoices.map(i => i.poId || i.sapPoNumber || i.poNumber).filter(Boolean);
    const vendorIds = invoices.map(i => i.vendorId || i.sapVendorCode || i.supplierId).filter(Boolean);

    const [pos, vendors] = await Promise.all([
      PurchaseOrder.find({ $or: [{ poNumber: { $in: poIds } }, { sapPoNumber: { $in: poIds } }] }, { poNumber: 1, sapPoNumber: 1, createdBy: 1, buyerName: 1, purchaseManagerName: 1 }).lean().catch(() => []),
      Vendor.find({ $or: [{ id: { $in: vendorIds } }, { sapVendorCode: { $in: vendorIds } }, { supplierId: { $in: vendorIds } }] }, { id: 1, sapVendorCode: 1, supplierId: 1, assignedPurchaseManager: 1, createdBy: 1 }).lean().catch(() => [])
    ]);

    const poMap = new Map();
    pos.forEach(p => {
      const name = p.buyerName || p.purchaseManagerName || p.createdBy;
      if (p.poNumber) poMap.set(p.poNumber, name);
      if (p.sapPoNumber) poMap.set(p.sapPoNumber, name);
    });

    const vendorMap = new Map();
    vendors.forEach(v => {
      const name = v.assignedPurchaseManager || v.createdBy;
      if (v.id) vendorMap.set(v.id, name);
      if (v.sapVendorCode) vendorMap.set(v.sapVendorCode, name);
      if (v.supplierId) vendorMap.set(v.supplierId, name);
    });

    const enrichedInvoices = invoices.map(inv => {
      const pKey = inv.poId || inv.sapPoNumber || inv.poNumber;
      const vKey = inv.vendorId || inv.sapVendorCode || inv.supplierId;
      const connectionName = inv.purchaseConnectionName || poMap.get(pKey) || vendorMap.get(vKey) || inv.requestedBy || inv.createdBy || 'Procurement Team';
      return { ...inv, purchaseConnectionName: connectionName };
    });

    return res.json({
      success: true,
      data: enrichedInvoices,
      total,
      page: safePage,
      pageSize: size,
      totalPages,
      hasPrevious: safePage > 1,
      hasNext: safePage < totalPages
    });

  } catch (err) {
    console.error('GET /invoices ERROR:', err);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/invoices/check-unique', authenticateToken, async (req, res) => {
  try {
    const invNo = String(req.query.invoiceNumber || '').trim();
    const currentId = String(req.query.currentId || '').trim();
    if (!invNo || invNo.length < 3) return res.json({ success: true, unique: true });

    const query = {
      invoiceNumber: { $regex: `^${invNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    };

    if (currentId) {
      query._id = { $ne: currentId };
      query.id = { $ne: currentId };
      query.invoicePaymentId = { $ne: currentId };
    }

    const existing = await InvoicePayment.findOne(query).lean();
    return res.json({
      success: true,
      unique: !existing,
      error: existing ? `Invoice Number "${invNo}" already exists in the system.` : null
    });
  } catch (err) {
    return res.json({ success: true, unique: true });
  }
});

router.get('/invoices/next-asn', authenticateToken, async (req, res) => {
  try {
    const vendorId = req.user?.role === 'Vendor' ? (req.user.sapVendorCode || req.user.id) : String(req.query.vendorId || '');
    const filter = vendorId ? { vendorId } : {};
    const year = new Date().getFullYear();
    const used = await InvoicePayment.find({ ...filter, $or: [{ asnNumber: /^\d+$/ }, { asnNumber: new RegExp(`^ASN-${year}-\\d+$`) }] }).select('asnNumber').lean();
    const next = used.reduce((max, item) => Math.max(max, Number(String(item.asnNumber).split('-').pop()) || 0), 0) + 1;
    return res.json({ success: true, data: { asnNumber: `ASN-${year}-${String(next).padStart(3, '0')}` } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/invoices/:id', authenticateToken, async (req, res) => {
  try {
    const inv = await InvoicePayment.findOne({
      $and: [
        buildInvoiceFilter(req.params.id),
        { isDeleted: { $ne: true } }
      ]
    }).lean();
    if (!inv) return res.status(404).json({ success: false, error: 'Invoice payment not found' });
    if (!(await canViewPayment(req, inv))) return res.status(403).json({ success: false, error: 'You cannot view this invoice payment.' });
    const approval = await Approval.findOne({ $or: [{ id: inv.invoicePaymentId }, { id: req.params.id }] }).lean();
    return res.json({ success: true, data: { ...inv, approval: approval || null } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/invoices/create', authenticateToken, async (req, res) => {
  try {
    const {
      poNumber, invoiceNumber, grossAmount, gstAmount, tdsAmount, tdsPercentage,
      advanceAdjusted, advanceIdAdjusted, poQuantity, grnQuantity, invoiceQuantity,
      grnNumber, remarks, approvalTo, requestedBy, vendorId, vendorName, asnNumber: requestedAsnNumber,
      invoiceDate, paymentDueDate, currency, supportingDocuments, blDate, blNumber
    } = req.body;

    if (!poNumber) return res.status(400).json({ success: false, error: 'Purchase Order is required.' });
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
    const numCgst = Number(req.body.cgstAmount) || 0;
    const numSgst = Number(req.body.sgstAmount) || 0;
    const numIgst = Number(req.body.igstAmount) || 0;
    const numGst  = Number(gstAmount) || (numCgst + numSgst + numIgst) || 0;
    const tdsRate = Number.parseFloat(tdsPercentage) || 0;
    const numTds = tdsAmount == null ? (numGross * tdsRate / 100) : (Number(tdsAmount) || 0);
    const numAdv = Number(advanceAdjusted) || 0;
    if (numGross <= 0) return res.status(400).json({ success: false, error: 'Invoice amount must be greater than zero.' });
    if ([numGst, numTds, numAdv, numCgst, numSgst, numIgst].some((value) => value < 0) || tdsRate < 0 || tdsRate > 100) {
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
      const totalAdvances = Number(availableAdvances[0]?.total) || 0;
      const priorAdvanceAdjusted = Number(priorInvoices[0]?.advanceAdjusted) || 0;
      const availableAdvanceAdjust = Math.max(0, totalAdvances - priorAdvanceAdjusted);
      if (numAdv > availableAdvanceAdjust) {
        return res.status(400).json({
          success: false,
          error: `Advance adjustment (${numAdv}) exceeds available approved advance balance (${availableAdvanceAdjust}).`
        });
      }
    }
    const netPayable = Math.max(0, numGross + numGst - numTds - numAdv);

    const finalInvoiceNumber = String(invoiceNumber || '').trim();
    if (!finalInvoiceNumber) {
      return res.status(400).json({ success: false, error: 'Vendor Invoice Number is required.' });
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9/_-]{2,49}$/.test(finalInvoiceNumber)) {
      return res.status(400).json({ success: false, error: 'Invoice Number must be 3–50 characters and may contain letters, numbers, /, _ and - only.' });
    }
    const existingInv = await InvoicePayment.findOne({ invoiceNumber: finalInvoiceNumber, vendorId: vendorIdFinal });
    if (existingInv) {
      return res.status(409).json({ success: false, error: 'This Invoice Number already exists for the vendor.' });
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
    let asnNumber = '';
    if (isImportVendor) {
      const year = new Date().getFullYear();
      const used = await InvoicePayment.find({ vendorId: vendorIdFinal, $or: [{ asnNumber: /^\d+$/ }, { asnNumber: new RegExp(`^ASN-${year}-\\d+$`) }] }).select('asnNumber').lean();
      const next = used.reduce((max, item) => Math.max(max, Number(String(item.asnNumber).split('-').pop()) || 0), 0) + 1;
      asnNumber = `ASN-${year}-${String(next).padStart(3, '0')}`;
    }

    const normalizedSupportingDocuments = Array.isArray(supportingDocuments) ? supportingDocuments : [];
    if (req.user?.role === 'Vendor' && normalizedSupportingDocuments.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one invoice supporting document is required.' });
    }
    if (normalizedSupportingDocuments.length > 10) {
      return res.status(400).json({ success: false, error: 'A maximum of 10 supporting documents can be uploaded.' });
    }
    const allowedSupportingTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
    if (normalizedSupportingDocuments.some((document) => !document?.fileUrl || !document?.fileName)) {
      return res.status(400).json({ success: false, error: 'Every supporting document must have a valid uploaded file.' });
    }
    if (normalizedSupportingDocuments.some((document) => document.mimeType && !allowedSupportingTypes.has(String(document.mimeType)))) {
      return res.status(400).json({ success: false, error: 'Every supporting document must be a PDF, JPG, or PNG file.' });
    }
    if (normalizedSupportingDocuments.some((document) => Number(document.size) > 25 * 1024 * 1024)) {
      return res.status(400).json({ success: false, error: 'Each supporting document must not exceed 25 MB.' });
    }

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
      blNumber: blNumber ? String(blNumber).trim() : '',
      blDate: blDate && !Number.isNaN(Date.parse(blDate)) ? new Date(blDate) : undefined,
      supportingDocuments: normalizedSupportingDocuments.map((document) => ({
        fileName: String(document.fileName),
        originalName: String(document.originalName || document.fileName),
        fileUrl: String(document.fileUrl),
        size: Number(document.size) || 0,
        mimeType: String(document.mimeType || '')
      })),
      invoiceDate: invoiceDate && !Number.isNaN(Date.parse(invoiceDate)) ? new Date(invoiceDate) : new Date(),
      paymentDueDate: paymentDueDate && !Number.isNaN(Date.parse(paymentDueDate)) ? new Date(paymentDueDate) : undefined,
      grossAmount: numGross,
      currency: poCurrency,
      invoiceType: req.body.invoiceType || (numGst > 0 ? 'With GST' : 'Without GST'),
      gstSubtype: req.body.gstSubtype || (numIgst > 0 ? 'inter' : 'intra'),
      cgstAmount: numCgst,
      sgstAmount: numSgst,
      igstAmount: numIgst,
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
      createdBy: req.user?.name || req.user?.email || 'System User',
      requestedById: req.user?.id || req.user?.email || 'system',
      userId: req.user?.id || req.user?.email || 'system',
      requestedBy: req.user?.name || requestedBy || 'Finance Team'
    });

    const { amountINR, fxRate, amountFormatted } = await getFxConversion(netPayable, poCurrency, req.body.fxRate);
    const wf = await resolveWorkflowFromDB('Invoice Payment', amountINR, { currency: poCurrency, vendorType: vendor?.vendorType, poType: po.poType || po.type });

    const approval = await createApprovalRecord({
      referenceId: invPaymentId,
      type: 'Invoice Payment',
      vendorName: vendorNameFinal,
      amountFormatted,
      poRef,
      requestedBy: req.user?.name || requestedBy || 'Finance Team',
      requestedById: req.user?.id || req.user?.email,
      requestId: req.headers['x-request-id'],
      transactionSnapshot: { netPayable, amountINR, grossAmount: numGross, currency: poCurrency, fxRate, poId: poRef, vendorId: vendorIdFinal, invoiceNumber: finalInvoiceNumber },
      wf
    });

    newInvoice.approvalInstanceId = approval._id.toString();
    newInvoice.requestedByTeam = approval.requestedByTeam || null;
    newInvoice.assignedApprover = approval.assignedApprover || null;
    newInvoice.assignedApproverName = approval.assignedApproverName || null;
    newInvoice.assignedApproverRole = approval.assignedApproverRole || null;
    await newInvoice.save();

    if (numAdv > 0) {
      let remainingAdjustment = numAdv;
      const advancesToAdjust = await AdvancePayment.find({
        $or: [{ poId: { $in: poRefs } }, { sapPoNumber: { $in: poRefs } }],
        status: { $in: ['approved', 'paid', 'adjusted'] }
      }).sort({ createdAt: 1 });
      for (const advance of advancesToAdjust) {
        if (remainingAdjustment <= 0) break;
        const available = Math.max(0, Number(advance.amount) - Number(advance.adjustedAmount || 0));
        const applied = Math.min(available, remainingAdjustment);
        if (applied <= 0) continue;
        advance.adjustedAmount = Number(advance.adjustedAmount || 0) + applied;
        advance.adjustmentInvoiceId = invPaymentId;
        remainingAdjustment -= applied;
        await advance.save();
      }
    }

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

router.put('/invoices/:id', authenticateToken, async (req, res) => {
  try {
    const invoice = await InvoicePayment.findOne(buildInvoiceFilter(req.params.id));
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice payment not found' });

    const { poNumber, invoiceNumber, grossAmount, gstAmount, tdsAmount,
      tdsPercentage, advanceAdjusted, grnNumber, remarks, approvalTo, asnNumber,
      invoiceType, gstSubtype, cgstAmount, sgstAmount, igstAmount, supportingDocuments } = req.body;

    if (invoiceNumber) invoice.invoiceNumber = invoiceNumber.trim();
    if (asnNumber !== undefined) invoice.asnNumber = asnNumber.trim();
    if (grossAmount !== undefined) invoice.grossAmount = Number(grossAmount);
    if (invoiceType !== undefined) invoice.invoiceType = invoiceType;
    if (gstSubtype !== undefined) invoice.gstSubtype = gstSubtype;
    if (cgstAmount !== undefined) invoice.cgstAmount = Number(cgstAmount);
    if (sgstAmount !== undefined) invoice.sgstAmount = Number(sgstAmount);
    if (igstAmount !== undefined) invoice.igstAmount = Number(igstAmount);

    const calcGst = (invoice.cgstAmount || 0) + (invoice.sgstAmount || 0) + (invoice.igstAmount || 0);
    if (gstAmount !== undefined) invoice.gstAmount = Number(gstAmount);
    else if (calcGst > 0) invoice.gstAmount = calcGst;

    if (tdsAmount !== undefined) invoice.tdsAmount = Number(tdsAmount);
    if (tdsPercentage !== undefined) invoice.tdsPercentage = Number(tdsPercentage);
    if (advanceAdjusted !== undefined) invoice.advanceAdjusted = Number(advanceAdjusted);
    if (grnNumber !== undefined) invoice.grnNumber = grnNumber.trim();
    if (remarks !== undefined) invoice.remarks = remarks.trim();
    if (approvalTo !== undefined) invoice.approvalTo = approvalTo;
    if (Array.isArray(supportingDocuments)) {
      invoice.supportingDocuments = supportingDocuments;

      // Clean up Document collection records for removed files
      const keepIds = supportingDocuments.map(d => d.documentId).filter(Boolean);
      const keepUrls = supportingDocuments.map(d => d.fileUrl).filter(Boolean);
      const invRefs = [invoice.invoicePaymentId, invoice.invoiceNumber, invoice.id, invoice._id?.toString()].filter(Boolean);

      const filterCond = {
        documentableType: 'InvoicePayment',
        documentableId: { $in: invRefs }
      };

      if (keepIds.length > 0 || keepUrls.length > 0) {
        filterCond.$and = [
          { documentId: { $nin: keepIds } },
          { fileUrl: { $nin: keepUrls } }
        ];
      }

      await Document.deleteMany(filterCond).catch(() => {});
    }

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

router.put('/invoices/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value.' });
    }

    const invoice = await InvoicePayment.findOne(buildInvoiceFilter(req.params.id));
    if (invoice) {
      if (!['draft', 'returned'].includes(invoice.status)) return res.status(409).json({ success: false, error: 'Only a draft or returned invoice can be submitted.' });
      if (!(await canMutateOwnPayment(req, invoice))) return res.status(403).json({ success: false, error: 'Only the requester can submit this invoice.' });
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

router.post('/invoices/:id/payout', authenticateToken, authorizePermission('invoice-payments', 'mark-paid'), async (req, res) => {
  try {
    const { utrNumber, paymentMode } = req.body;
    if (!utrNumber?.trim()) {
      return res.status(400).json({ success: false, error: 'UTR number is required.' });
    }

    const invoice = await InvoicePayment.findOne(buildInvoiceFilter(req.params.id));
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice payment not found' });
    if (!['draft', 'returned'].includes(invoice.status)) return res.status(409).json({ success: false, error: 'Only a draft or returned invoice can be edited.' });
    if (!(await canMutateOwnPayment(req, invoice))) return res.status(403).json({ success: false, error: 'Only the requester can edit this invoice.' });
    if (invoice.status !== 'approved') return res.status(409).json({ success: false, error: 'Only an approved invoice can be marked paid.' });

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

router.delete('/invoices/:id', authenticateToken, authorizePermission('invoice-payments', 'delete'), async (req, res) => {
  try {
    const inv = await InvoicePayment.findOne(buildInvoiceFilter(req.params.id));
    if (inv) {
      if (!['draft', 'returned'].includes(inv.status)) return res.status(409).json({ success: false, error: 'Only a draft or returned invoice can be deleted.' });
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
  if (Array.isArray(body.invitedVendors)) {
    const inviteIds = body.invitedVendors.map((vendor) => normaliseInviteValue(vendor?.vendorId || vendor?.sapVendorCode)).filter(Boolean);
    if (inviteIds.length !== body.invitedVendors.length) return 'Every invited Freight Forwarder must have a valid vendor identifier.';
    if (new Set(inviteIds).size !== inviteIds.length) return 'The same Freight Forwarder cannot be invited more than once.';
  }
  return '';
}

function validateOpenPo(po) {
  const status = String(po?.status || '').trim().toLowerCase();
  return Boolean(po && Number(po.totalAmount) > 0 && !['closed', 'cancelled', 'canceled', 'blocked'].includes(status));
}

function requireInternalRfqUser(req, res, next) {
  if (String(req.user?.role || '').trim().toLowerCase() === 'vendor') {
    return res.status(403).json({ success: false, error: 'Use the vendor RFQ portal for vendor RFQ access.' });
  }
  return next();
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
  const allocationAlreadyApproved = allocation?.approved === true;
  if (!allocationAlreadyApproved && !awardApproval.approved) {
    return { error: `Bill of Lading access is locked until the RFQ award approval is completed. Current approval status: ${awardApproval.approval?.status || 'Pending'}.`, status: 403 };
  }
  if (!['pending_approval', 'partially_awarded', 'awarded'].includes(String(rfq.status).toLowerCase()) || !allocation || allocation.approved === false) {
    return { error: 'Only a vendor with an approved RFQ allocation can manage Bill of Lading entries.', status: 403 };
  }
  return { vendor, rfq, allocation };
}

// ─── GET /api/p2p/rfqs ────────────────────────────────────────────────────────

router.get('/rfqs', authenticateToken, requireInternalRfqUser, authorizePermission('rfq', 'view'), async (req, res) => {
  try {
    const search = String(req.query.q || req.query.search || '').trim();
    const statusFilter = String(req.query.status || '').trim();
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize || req.query.size, 10) || 10));

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

    const total = await RfqHeader.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const rfqs = await RfqHeader.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((safePage - 1) * pageSize)
      .limit(pageSize)
      .lean();

    const rfqIds = rfqs.map((rfq) => rfq.rfqId).filter(Boolean);
    const approvalIds = rfqs.map((rfq) => rfq.awardApprovalId).filter(Boolean);
    const [quoteCounts, approvals] = await Promise.all([
      RfqQuote.aggregate([
        { $match: { rfqId: { $in: rfqIds } } },
        { $group: { _id: '$rfqId', count: { $sum: 1 } } }
      ]),
      Approval.find({
        $or: [
          { id: { $in: [...approvalIds, ...rfqIds] } },
          { referenceId: { $in: rfqIds } },
          { 'transactionSnapshot.rfqId': { $in: rfqIds } }
        ]
      }).sort({ createdAt: -1 }).lean()
    ]);
    const quoteCountByRfq = new Map(quoteCounts.map((entry) => [entry._id, entry.count]));
    const approvalByKey = new Map();
    approvals.forEach((approval) => {
      [approval.id, approval.referenceId, approval.transactionSnapshot?.rfqId].filter(Boolean)
        .forEach((key) => { if (!approvalByKey.has(String(key))) approvalByKey.set(String(key), approval); });
    });
    const statusRepairs = [];
    const enriched = rfqs.map((r) => {
      let currentStatus = r.status || 'published';
      const app = approvalByKey.get(String(r.awardApprovalId || r.rfqId));
      if (app?.status === 'Approved & Dispatched') {
        const totalQuantity = Number(r.totalQuantity) || Number(r.cargoDetails?.containerCount) || 0;
        const approvedQuantity = (Array.isArray(r.awardAllocations) ? r.awardAllocations : [])
          .filter((allocation) => allocation.approved === true)
          .reduce((sum, allocation) => sum + (Number(allocation.containers) || 0), 0);
        currentStatus = totalQuantity > 0 && approvedQuantity >= totalQuantity ? 'awarded' : approvedQuantity > 0 ? 'partially_awarded' : r.status;
      }
      else if (app?.status === 'Rejected' && r.status === 'pending_approval') currentStatus = 'published';
      if (currentStatus !== r.status || (!r.awardApprovalId && app?.id)) {
        statusRepairs.push({
          updateOne: {
            filter: { _id: r._id },
            update: { $set: { status: currentStatus, ...(app?.id ? { awardApprovalId: app.id } : {}) } }
          }
        });
      }
      const invitedCount = (r.invitedVendors && Array.isArray(r.invitedVendors)) ? r.invitedVendors.length : 0;
      return {
        ...r,
        status: currentStatus,
        closingDateFormatted: r.closingDate ? new Date(r.closingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not set',
        deadlinePassed: Boolean(r.closingDate && new Date(r.closingDate) < new Date()),
        invitedVendorsCount: invitedCount,
        quotesCount: quoteCountByRfq.get(r.rfqId) || 0
      };
    });
    if (statusRepairs.length) await RfqHeader.bulkWrite(statusRepairs, { ordered: false });

    return res.json({
      success: true, data: enriched, total, page: safePage, pageSize, totalPages,
      hasPrevious: safePage > 1, hasNext: safePage < totalPages
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── LOGISTICS PROVIDERS CRUD API ───────────────────────────────────────────

router.get('/logistics-providers', authenticateToken, authorizePermission('logistics-providers', 'view'), async (req, res) => {
  try {
    const providers = await LogisticsProvider.find().sort({ createdAt: -1 }).lean().catch(() => []);

    // Fetch logistics payments to calculate paymentsCount per provider dynamically
    const payments = await LogisticsPayment.find().lean().catch(() => []);
    const countMap = {};
    payments.forEach(p => {
      const key1 = (p.vendorId || '').toLowerCase();
      const key2 = (p.vendorName || '').toLowerCase();
      if (key1) countMap[key1] = (countMap[key1] || 0) + 1;
      if (key2) countMap[key2] = (countMap[key2] || 0) + 1;
    });

    const normalized = providers.map(p => {
      const pid = (p.providerId || '').toLowerCase();
      const pname = (p.name || p.companyName || '').toLowerCase();
      const count = (countMap[pid] || 0) + (countMap[pname] || 0);

      return {
        ...p,
        name: p.name || p.companyName || 'Logistics Provider',
        companyName: p.name || p.companyName || 'Logistics Provider',
        paymentsCount: count || p.paymentsCount || 0
      };
    });

    return res.json({ success: true, count: normalized.length, providers: normalized });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/logistics-providers/:id', authenticateToken, authorizePermission('logistics-providers', 'view'), async (req, res) => {
  try {
    const { id } = req.params;
    const filter = [{ providerId: id }];
    if (mongoose.Types.ObjectId.isValid(id)) {
      filter.push({ _id: id });
    }

    const provider = await LogisticsProvider.findOne({ $or: filter }).lean();

    if (!provider) {
      return res.status(404).json({ success: false, error: 'Provider not found.' });
    }

    return res.json({
      success: true,
      provider: {
        ...provider,
        companyName: provider.name || provider.companyName,
        name: provider.name || provider.companyName
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/logistics-providers', authenticateToken, authorizePermission('logistics-providers', 'manage'), async (req, res) => {
  try {
    const {
      name, companyName, contactPerson, phone, email, status,
      gstin, pan, bankName, bankBranch, accountNumber, ifscCode, serviceType
    } = req.body;

    const finalName = (name || companyName || '').trim();
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

    const obj = newProvider.toObject();
    return res.status(201).json({
      success: true,
      message: 'Provider created successfully',
      provider: {
        ...obj,
        companyName: finalName
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/logistics-providers/:id', authenticateToken, authorizePermission('logistics-providers', 'manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    delete updates.providerId;
    delete updates._id;

    if (updates.companyName || updates.name) {
      updates.name = (updates.name || updates.companyName || '').trim();
    }
    if (updates.bankBranch || updates.branch) {
      updates.bankBranch = updates.bankBranch || updates.branch || '';
    }

    const filter = [{ providerId: id }];
    if (mongoose.Types.ObjectId.isValid(id)) {
      filter.push({ _id: id });
    }

    const updated = await LogisticsProvider.findOneAndUpdate(
      { $or: filter },
      { $set: updates },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Provider not found.' });
    }

    const obj = updated.toObject ? updated.toObject() : updated;
    return res.json({
      success: true,
      message: 'Provider updated successfully',
      provider: {
        ...obj,
        companyName: obj.name
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/logistics-providers/:id', authenticateToken, authorizePermission('logistics-providers', 'manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const filter = [{ providerId: id }];
    if (mongoose.Types.ObjectId.isValid(id)) {
      filter.push({ _id: id });
    }

    await LogisticsProvider.findOneAndDelete({ $or: filter });
    return res.json({ success: true, message: 'Provider deleted successfully', deletedId: id });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET Freight Forwarders / Shipping Lines Vendor List ──────────────────────

router.get('/rfqs/logistics-vendors', authenticateToken, requireInternalRfqUser, authorizePermission('rfq', 'view'), async (req, res) => {
  try {
    const statusRegex = /active/i;
    const catRegex = /logistics|freight|forwarder|shipping/i;

    const [realVendors] = await Promise.all([
      Vendor.find({
        status: statusRegex,
        $or: [{ vendorType: catRegex }, { category: catRegex }]
      }).lean().catch(() => [])
    ]);

    const combinedList = [];
    const seenIds = new Set();


    for (const v of realVendors) {
      const id = String(v.id || v._id);
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        combinedList.push({
          id,
          sapVendorCode: v.sapVendorCode || v.supplierId || v.id,
          companyName: v.companyName || v.name,
          vendorType: v.vendorType || 'Freight Forwarder',
          category: v.category || 'Logistics',
          email: v.email || '',
          phone: v.phone || ''
        });
      }
    }

    return res.json({
      success: true,
      data: combinedList,
      total: combinedList.length
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST Create RFQ ─────────────────────────────────────────────────────────

router.post('/rfqs/demo-workflow', authenticateToken, requireInternalRfqUser, authorizePermission('rfq', 'create'), async (req, res) => {
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

router.post('/rfqs', authenticateToken, authorizePermission('rfq', 'create'), async (req, res) => {
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
    const activeVendors = await Vendor.find({
      status: /active/i,
      $and: [
        { $or: [{ id: { $in: vendorKeys } }, { sapVendorCode: { $in: vendorKeys } }, { supplierId: { $in: vendorKeys } }] },
        { $or: [{ vendorType: /logistics|freight|forwarder|shipping/i }, { category: /logistics|freight|forwarder|shipping/i }] }
      ]
    }).select('id sapVendorCode supplierId companyName').lean();
    const matchedInviteCount = invitedVendors.filter((invite) => activeVendors.some((vendor) =>
      [vendor.id, vendor.sapVendorCode, vendor.supplierId].filter(Boolean).some((key) =>
        [invite.vendorId, invite.sapVendorCode].filter(Boolean).some((value) => sameValue(key, value))
      )
    )).length;
    if (matchedInviteCount !== invitedVendors.length) return res.status(400).json({ success: false, error: 'One or more invited Freight Forwarders are invalid, inactive, or not logistics vendors.' });
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

router.get('/rfqs/:id', authenticateToken, requireInternalRfqUser, authorizePermission('rfq', 'view'), async (req, res) => {
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

    // Imported timestamps are kept separately because Mongoose timestamps make
    // createdAt immutable on an existing document. Present the source date to
    // users while retaining Mongo's audit timestamp internally.
    if (rfq.sourceCreatedAt) rfq.createdAt = rfq.sourceCreatedAt;
    if (rfq.sourceUpdatedAt) rfq.updatedAt = rfq.sourceUpdatedAt;

    const quotes = (await RfqQuote.find({ rfqId: rfq.rfqId }).sort({ totalInr: 1 }).lean())
      .map((quote, index) => ({ ...quote, rank: `L${index + 1}` }));
    const blEntries = await RfqBlEntry.find({ rfqId: rfq.rfqId }).lean();

    // Get approval if exists (should be unique by id)
    const approval = await Approval.findOne({
      $or: [
        ...(rfq.awardApprovalId ? [{ id: rfq.awardApprovalId }] : []),
        { id: rfq.rfqNumber },
        { referenceId: rfq.rfqNumber }
      ]
    }).lean();
    if (approval && !rfq.awardApprovalId) rfq.awardApprovalId = approval.id;

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

router.put('/rfqs/:id', authenticateToken, requireInternalRfqUser, authorizePermission('rfq', 'create'), async (req, res) => {
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
      const linkedPo = await PurchaseOrder.findOne({ $or: [{ poId: linkedPoId }, { sapPoNumber: linkedPoId }, { poNumber: linkedPoId }] }).lean();
      if (!validateOpenPo(linkedPo)) return res.status(400).json({ success: false, error: 'Linked purchase order does not exist or is not open.' });
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
      const inviteKeys = invitedVendors.flatMap((vendor) => [vendor.vendorId, vendor.sapVendorCode]).filter(Boolean);
      const activeFreightVendors = await Vendor.find({
        status: /active/i,
        $and: [
          { $or: [{ id: { $in: inviteKeys } }, { sapVendorCode: { $in: inviteKeys } }, { supplierId: { $in: inviteKeys } }] },
          { $or: [{ vendorType: /logistics|freight|forwarder|shipping/i }, { category: /logistics|freight|forwarder|shipping/i }] }
        ]
      }).select('id sapVendorCode supplierId').lean();
      const validInviteCount = invitedVendors.filter((invite) => activeFreightVendors.some((vendor) =>
        [vendor.id, vendor.sapVendorCode, vendor.supplierId].filter(Boolean).some((key) =>
          [invite.vendorId, invite.sapVendorCode].filter(Boolean).some((value) => sameValue(key, value))
        )
      )).length;
      if (validInviteCount !== invitedVendors.length) return res.status(400).json({ success: false, error: 'Every invited vendor must be an active Freight Forwarder.' });
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

router.delete('/rfqs/:id', authenticateToken, authorizePermission('rfq', 'delete'), async (req, res) => {
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

router.post('/rfqs/:id/copy', authenticateToken, requireInternalRfqUser, authorizePermission('rfq', 'create'), async (req, res) => {
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

router.post('/rfqs/:id/quote', authenticateToken, requireInternalRfqUser, authorizePermission('rfq', 'create'), async (req, res) => {
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
    const usdConversion = await getFxConversion(oceanUsd, 'USD');
    const usdRate = usdConversion.fxRate;
    const totalInr = Math.round(usdConversion.amountINR + stInr + othInr);

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
      exchangeRate: usdRate,
      totalInr,
      freightAmount: oceanUsd,
      destinationCharges: stInr,
      transitDays: transit,
      status: 'submitted'
    });

    const allQuotes = await RfqQuote.find({ rfqId: rfq.rfqId }).sort({ totalInr: 1 });
    for (let i = 0; i < allQuotes.length; i++) {
      const rankLabel = i < 50 ? `L${i + 1}` : 'N/A';
      allQuotes[i].rank = rankLabel;
      await allQuotes[i].save();
    }

    return res.json({ success: true, message: 'Vendor quote submitted and ranked in MongoDB.', quoteId });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST Award RFQ Quote ─────────────────────────────────────────────────────

router.post('/rfqs/:id/award', authenticateToken, authorizePermission('rfq', 'award'), async (req, res) => {
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

      const existingAwardAllocations = Array.isArray(rfq.awardAllocations) ? rfq.awardAllocations : [];
      const previouslyApprovedAllocations = isReassignment ? [] : existingAwardAllocations.filter(a => a.approved === true);
      const previouslyAllocatedQty = previouslyApprovedAllocations.reduce((sum, a) => sum + (Number(a.containers) || 0), 0);
      const remainingToAllocate = Math.max(0, totalContainers - previouslyAllocatedQty);

      if (allocated <= 0 || allocated > remainingToAllocate) {
        return res.status(400).json({
          success: false,
          error: `You must allocate between 1 and ${remainingToAllocate} container(s).`
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

      // Keep the current approved allocation active until a reassignment is approved.
      // This also lets a rejection restore the previous award without data loss.
      const approvedAllocationsList = (rfq.get('awardAllocations') || []).filter(a => a.approved === true);
      const updatedAllocatedQty = approvedAllocationsList.reduce((sum, a) => sum + (Number(a.containers) || 0), 0);

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
        ...approvedAllocationsList,
        ...pendingAllocations
      ];

      rfq.status = 'pending_approval';
      rfq.totalQuantity = totalContainers;
      rfq.allocatedQuantity = updatedAllocatedQty;
      rfq.pendingAllocation = Math.max(0, totalContainers - updatedAllocatedQty);
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
        const approvalPending = Boolean(rfq.awardApprovalId && approval && !['Approved & Dispatched', 'Rejected'].includes(approval.status));
        const allocation = getVendorAward(rfq, vendor);
        const allocationReady = allocation?.approved === true || (['partially_awarded', 'awarded'].includes(String(rfq.status).toLowerCase()) && allocation?.approved !== false);
        return { ...rfq, status: approvalPending ? 'pending_approval' : rfq.status, awardApprovalStatus: approval?.status || null, myQuote: quotes.find((q) => q.rfqId === rfq.rfqId) || null, myAllocation: allocationReady ? allocation : null };
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
    const awardReady = allocation?.approved === true || (['partially_awarded', 'awarded'].includes(String(rfq.status).toLowerCase()) && awardApproval.approved && allocation?.approved !== false);
    const approvalIsPending = awardApproval.required && awardApproval.approval && !['Approved & Dispatched', 'Rejected'].includes(awardApproval.approval.status);
    return res.json({ success: true, data: { ...rfq, status: approvalIsPending ? 'pending_approval' : rfq.status, myQuote, myAllocation: awardReady ? allocation : null, awardPending: Boolean(allocation && approvalIsPending), awardApprovalStatus: awardApproval.approval?.status || null } });
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
    if (!String(req.body.shippingLine || '').trim() || !Number.isFinite(ocean) || ocean <= 0 || !Number.isFinite(shipping) || shipping < 0 || !Number.isFinite(other) || other < 0 || !Number.isInteger(transitDays) || transitDays <= 0) {
      return res.status(400).json({ success: false, error: 'Shipping line, positive freight, valid charges, and transit days are required.' });
    }
    if (req.body.vesselEtd && req.body.vesselEta && new Date(req.body.vesselEta) < new Date(req.body.vesselEtd)) {
      return res.status(400).json({ success: false, error: 'Vessel ETA cannot be earlier than Vessel ETD.' });
    }
    const vendorId = vendor.sapVendorCode || vendor.supplierId || vendor.id;
    const usdConversion = await getFxConversion(ocean, 'USD');
    const quote = await RfqQuote.findOneAndUpdate(
      { rfqId: rfq.rfqId, vendorId },
      {
        $set: {
          vendorName: vendor.companyName, shippingLine: String(req.body.shippingLine).trim(),
          oceanFreightUsd: ocean, stChargesInr: shipping, otherChargesInr: other,
          totalInr: Math.round(usdConversion.amountINR + shipping + other), exchangeRate: usdConversion.fxRate, freightAmount: ocean,
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
    await Promise.all(ranked.map((item, index) => RfqQuote.updateOne({ _id: item._id }, { rank: index < 50 ? `L${index + 1}` : 'N/A' })));
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
    const poRef = context.rfq.sapPoNumber || context.rfq.poId || context.rfq.poNumber;
    const linkedPo = poRef ? await PurchaseOrder.findOne({ $or: [{ poNumber: poRef }, { sapPoNumber: poRef }] }).lean() : null;
    const poNumberText = String(linkedPo?.sapPoNumber || linkedPo?.poNumber || poRef || '');
    const requiresAsn = /^(43|60|PO-43)/i.test(poNumberText);
    return res.json({ success: true, data: { rfq: context.rfq.toObject(), allocation: context.allocation, requiresAsn, usedContainers, remainingContainers: Math.max(0, context.allocation.containers - usedContainers), entries: mine } });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.get('/validate-asn', authenticateToken, async (req, res) => {
  try {
    const asnNumber = String(req.query.asnNumber || '').trim().toUpperCase();
    const rfqId = String(req.query.rfqId || '').trim();

    if (req.user?.role === 'Vendor') {
      const vendor = await getFreightVendorFromRequest(req);
      if (!vendor || !rfqId) return res.status(403).json({ success: false, valid: false, error: 'A valid assigned RFQ is required for ASN validation.' });
      const assignedRfq = await RfqHeader.findOne({ $or: [{ rfqId }, { rfqNumber: rfqId }] }).lean();
      if (!assignedRfq || !isFreightVendorInvited(assignedRfq, vendor)) return res.status(404).json({ success: false, valid: false, error: 'Assigned RFQ not found.' });
    }

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
          { $or: [{ poId: { $in: poKeys } }, { sapPoNumber: { $in: poKeys } }, { poNumber: { $in: poKeys } }] }
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
    const poRef = context.rfq.sapPoNumber || context.rfq.poId || context.rfq.poNumber;
    const linkedPo = poRef ? await PurchaseOrder.findOne({ $or: [{ poNumber: poRef }, { sapPoNumber: poRef }] }).lean() : null;
    const requiresAsn = /^(43|60|PO-43)/i.test(String(linkedPo?.sapPoNumber || linkedPo?.poNumber || poRef || ''));
    if (requiresAsn && !asnNumber) {
      return res.status(400).json({ success: false, error: 'ASN Number (Advance Shipping Notice) is required to link with RFQ & PO records.' });
    }
    if (asnNumber && !/^[A-Z0-9\-_/]{3,30}$/i.test(asnNumber)) {
      return res.status(400).json({ success: false, error: 'ASN Number must be between 3 and 30 characters (letters, numbers, hyphens, slashes).' });
    }

    const containerCount = Number(req.body.containerCount);
    const duplicateBl = await RfqBlEntry.exists({ blNumber });
    if (duplicateBl) {
      return res.status(400).json({ success: false, error: `BL Number "${blNumber}" already exists in the system.` });
    }

    const duplicateAsn = asnNumber ? await RfqBlEntry.exists({ $or: [{ asnNumber }, { autoAsnNumber: asnNumber }] }) : false;
    if (duplicateAsn) {
      return res.status(400).json({ success: false, error: `ASN Number "${asnNumber}" has already been used for a BL entry.` });
    }

    const poKeys = [context.rfq?.poId, context.rfq?.sapPoNumber, context.rfq?.poNumber, context.rfq?.rfqId, context.rfq?.rfqNumber].filter(Boolean);
    const matchingInvoice = asnNumber ? await InvoicePayment.findOne({
      $and: [
        { asnNumber: { $regex: new RegExp(`^${asnNumber.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') } },
          { $or: [{ poId: { $in: poKeys } }, { sapPoNumber: { $in: poKeys } }, { poNumber: { $in: poKeys } }] }
      ]
    }).lean() : null;

    if (requiresAsn && !matchingInvoice) {
      return res.status(400).json({
        success: false,
        error: `ASN Number "${asnNumber}" does not match any invoice record for the linked Purchase Order (PO).`
      });
    }
    const vendorKeys = freightVendorKeys(context.vendor);
    const existing = await RfqBlEntry.find({ rfqId: context.rfq.rfqId }).lean();
    const used = existing.filter((entry) => vendorKeys.includes(normaliseInviteValue(entry.vendorId)) || vendorKeys.includes(normaliseInviteValue(entry.vendorName))).reduce((sum, entry) => sum + (Number(entry.containerCount) || 0), 0);
    const remaining = context.allocation.containers - used;
    if (!Number.isInteger(containerCount) || containerCount <= 0) {
      return res.status(400).json({ success: false, error: 'Container count must be a positive whole number.' });
    }
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
    if (!['custom_cleared', 'invoice_pending'].includes(bl.status)) return res.status(400).json({ success: false, error: 'Logistics invoice can only be raised after customs clearance.' });
    const invoiceNumber = String(req.body.invoiceNumber || '').trim().toUpperCase();
    const amount = Number(req.body.amount);
    const ref = `BLI-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const category = req.body.category || 'freight';
    const allowedCategories = ['freight', 'destination_charges', 'detention', 'port_storage', 'agency_fee'];
    if (!invoiceNumber || invoiceNumber.length > 100) return res.status(400).json({ success: false, error: 'A valid invoice number is required.' });
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, error: 'Invoice amount must be greater than zero.' });
    if (!allowedCategories.includes(category)) return res.status(400).json({ success: false, error: 'Invalid logistics invoice category.' });
    const duplicateInvoice = await LogisticsPayment.exists({ vendorId: bl.vendorId, invoiceNumber });
    if (duplicateInvoice) return res.status(409).json({ success: false, error: `Invoice number "${invoiceNumber}" has already been submitted.` });
    const typeDisplay = category === 'freight' ? 'Freight Invoice' : category === 'destination_charges' ? 'Destination Charges (Shipping Line)' : category === 'recepted_charges' ? 'Recepted Charges' : category === 'agency_fee' ? 'Agency Charges' : category === 'port_storage' ? 'Port Storage' : 'BL Charge Invoice';
    const numAmount = amount;
    const curr = String(req.body.currency || 'INR').toUpperCase();
    if (!['INR', 'USD', 'EUR', 'GBP', 'CNY', 'JPY', 'AED', 'SGD'].includes(curr)) return res.status(400).json({ success: false, error: 'Unsupported invoice currency.' });
    const rawFile = String(req.body.fileName || req.body.fileUrl || '').trim();
    const docList = Array.isArray(req.body.documents) && req.body.documents.length > 0
      ? req.body.documents.filter((document) => String(document?.fileName || document?.fileUrl || '').trim())
      : (rawFile ? [{ docType: typeDisplay, fileName: rawFile, fileUrl: rawFile, uploadedBy: bl.vendorName || 'Vendor' }] : []);
    if (!docList.length) return res.status(400).json({ success: false, error: 'At least one supporting invoice document is required.' });
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

router.post('/rfqs/:id/close', authenticateToken, requireInternalRfqUser, authorizePermission('rfq', 'create'), async (req, res) => {
  try {
    const isObjId = mongoose.Types.ObjectId.isValid(req.params.id);
    const query = isObjId
      ? { $or: [{ _id: req.params.id }, { rfqId: req.params.id }, { rfqNumber: req.params.id }] }
      : { $or: [{ rfqId: req.params.id }, { rfqNumber: req.params.id }] };

    const rfq = await RfqHeader.findOne(query);
    if (!rfq) return res.status(404).json({ success: false, error: 'RFQ not found.' });
    if (!['published', 'partially_awarded'].includes(String(rfq.status).toLowerCase())) {
      return res.status(409).json({ success: false, error: `RFQ cannot be closed while it is ${String(rfq.status).replace(/_/g, ' ')}.` });
    }

    rfq.status = 'closed';
    rfq.closedAt = new Date();
    await rfq.save();

    broadcastEvent('RFQ_CLOSED', { rfqId: rfq.rfqId, rfqNumber: rfq.rfqNumber });

    return res.json({
      success: true,
      message: `RFQ ${rfq.rfqNumber || rfq.rfqId} closed successfully.`,
      data: rfq
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/rfqs/:id/reopen', authenticateToken, requireInternalRfqUser, authorizePermission('rfq', 'create'), async (req, res) => {
  try {
    const isObjId = mongoose.Types.ObjectId.isValid(req.params.id);
    const query = isObjId
      ? { $or: [{ _id: req.params.id }, { rfqId: req.params.id }, { rfqNumber: req.params.id }] }
      : { $or: [{ rfqId: req.params.id }, { rfqNumber: req.params.id }] };

    const rfq = await RfqHeader.findOne(query);
    if (!rfq) return res.status(404).json({ success: false, error: 'RFQ not found.' });
    const status = String(rfq.status).toLowerCase();
    const expiredPublishedRfq = status === 'published' && isRfqClosed(rfq.closingDate);
    if (status !== 'closed' && !expiredPublishedRfq) {
      return res.status(409).json({ success: false, error: `Only a closed RFQ can be reopened. Current status: ${String(rfq.status).replace(/_/g, ' ')}.` });
    }

    const newClosingDate = req.body.closingDate ? new Date(req.body.closingDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(newClosingDate.getTime()) || newClosingDate <= new Date()) {
      return res.status(400).json({ success: false, error: 'Reopened RFQ closing date must be a valid future date and time.' });
    }
    rfq.status = 'published';
    rfq.closingDate = newClosingDate;
    await rfq.save();

    broadcastEvent('RFQ_REOPENED', { rfqId: rfq.rfqId, rfqNumber: rfq.rfqNumber, closingDate: rfq.closingDate });

    return res.json({
      success: true,
      message: `RFQ ${rfq.rfqNumber || rfq.rfqId} reopened successfully until ${new Date(rfq.closingDate).toLocaleDateString('en-IN')}.`,
      data: rfq
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── CUSTOMS BROKER & BL ASSIGNMENT ROUTES ──────────────────────────────────

router.get('/custom-agents/bl-entries', authenticateToken, async (req, res) => {
  try {
    const entries = await RfqBlEntry.find().sort({ createdAt: -1 }).lean();
    const agents = await CustomAgent.find({ status: 'Active' }).select('agentId agencyName contactPerson email').sort({ agencyName: 1 }).lean();
    return res.json({ success: true, blEntries: entries, data: entries, agents });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.get('/exim/bl-entries', authenticateToken, requireInternalRfqUser, authorizePermission('rfq', 'view'), async (req, res) => {
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
    const [rfq, agents, assignedAgent, invoices] = await Promise.all([
      RfqHeader.findOne({ rfqId: entry.rfqId }).select('rfqId rfqNumber title').lean(),
      CustomAgent.find({ status: 'Active' }).select('agentId agencyName contactPerson email').sort({ agencyName: 1 }).lean(),
      entry.customAgentId ? CustomAgent.findOne({ agentId: entry.customAgentId }).select('agentId agencyName contactPerson email').lean() : null,
      BlInvoice.find({ $or: [{ blId: entry.blId }, { blNumber: entry.blNumber }] }).sort({ submittedAt: 1, createdAt: 1 }).lean()
    ]);
    return res.json({
      success: true, data: {
        ...entry,
        customAgentName: assignedAgent?.contactPerson || entry.customAgentName,
        customAgentAgencyName: assignedAgent?.agencyName || entry.customAgentAgencyName,
        rfq,
        invoices
      }, agents
    });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.post('/exim/bl-entries/:blId/documents', authenticateToken, async (req, res) => {
  try {
    const bl = await RfqBlEntry.findOne({ $or: [{ blId: req.params.blId }, { blNumber: req.params.blId }] });
    if (!bl) return res.status(404).json({ success: false, error: 'BL entry not found.' });
    if (bl.status === 'custom_cleared') return res.status(400).json({ success: false, error: 'Documents cannot be changed after customs clearance.' });
    const documents = Array.isArray(req.body.documents) ? req.body.documents : [];
    const valid = documents.filter((doc) => String(doc.docType || '').trim() && String(doc.fileName || '').trim());
    if (!valid.length) return res.status(400).json({ success: false, error: 'Select a document type and file.' });
    bl.documents.push(...valid.map((doc) => ({ docType: String(doc.docType).trim(), fileUrl: String(doc.fileName).trim(), fileName: String(doc.fileName).trim(), uploadedBy: req.user?.name || req.user?.email || 'EXIM Team', uploadedAt: new Date(), stage: 'EXIM Review' })));
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
    bl.customAgentAgencyName = agent.agencyName;
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
    if (req.user?.role === 'Vendor') return res.status(403).json({ success: false, error: 'Customs Agent or internal access is required.' });
    let filter = {};
    if (req.user?.role === 'CustomAgent') {
      filter = { customAgentId: req.user.id };
    }
    const bls = await RfqBlEntry.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({
      success: true,
      agentName: req.user?.email || 'All Agents',
      agentCompany: req.user?.agencyName || 'Internal View',
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
    if (req.user?.role === 'Vendor') return res.status(403).json({ success: false, error: 'Customs Agent or internal access is required.' });
    let query = { $or: [{ blId: req.params.blId }, { blNumber: req.params.blId }] };
    if (req.user?.role === 'CustomAgent') {
      query.customAgentId = req.user.id;
    }
    const bl = await RfqBlEntry.findOne(query).lean();
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

router.get('/logistics-payments', authenticateToken, async (req, res) => {
  try {
    const visibility = await getPaymentVisibility(req);
    if (!visibility) return res.status(403).json({ success: false, error: 'Your active user record could not be found.' });
    let items = await LogisticsPayment.find(paymentOwnerFilter(visibility)).sort({ createdAt: -1 }).lean();

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
      let status = rawStatus;
      let currentStep = app?.currentStep || item.currentStep || 1;
      let totalSteps = app?.totalSteps || item.totalSteps || 1;
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
        currentSlab: app?.currentSlab || (isLOG ? 'Logistics Payment Workflow' : 'BL Freight Invoice Workflow'),
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

router.post('/logistics-payments', authenticateToken, authorizePermission('logistics-payments', 'create'), async (req, res) => {
  try {
    const { blNumber, typeDisplay, category, source, invoiceNumber, vendorName, amount, currency, remarks } = req.body;
    if (!invoiceNumber || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Invoice Number and a valid positive amount are required.' });
    }

    const numAmount = Number(amount);
    const ref = `LOG-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const wf = await resolveWorkflowFromDB('Logistics Payment', numAmount, { currency: currency || 'INR', category: category || 'freight' });
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
      wf
    });

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
      status: approval.status,
      currentStep: approval.currentStep || 1,
      totalSteps: approval.totalSteps || 1,
      remarks: remarks || '',
      submittedAt: new Date(),
      createdBy: req.user?.name || req.user?.email || 'System User',
      requestedBy: req.user?.name || req.user?.email || 'System User',
      requestedById: req.user?.id || req.user?.email,
      requestedByTeam: approval.requestedByTeam || null,
      assignedApprover: approval.assignedApprover || null,
      assignedApproverName: approval.assignedApproverName || null,
      assignedApproverRole: approval.assignedApproverRole || null,
      actionHistory: [
        { action: 'submit', step: 1, role: 'Requester', actionedBy: req.user?.name || req.user?.email || 'User', actionedAt: new Date(), remarks: 'Submitted Logistics Payment for approval' }
      ]
    });

    broadcastEvent('LOGISTICS_PAYMENT_SUBMITTED', { id: payment.logisticsPaymentId, referenceNumber: ref, blNumber, amount: numAmount, status: approval.status });

    return res.status(201).json({ success: true, message: 'Logistics Payment submitted for approval.', payment, approval });
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

router.delete('/logistics-payments/:id', authenticateToken, authorizePermission('logistics-payments', 'delete'), async (req, res) => {
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

router.get('/bl-invoices', authenticateToken, requireInternalRfqUser, authorizePermission('rfq', 'view'), async (req, res) => {
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

    const normalizeInvoiceDocument = (doc, fallbackType, fallbackUploader) => {
      const fileUrl = String(doc?.fileUrl || doc?.filePath || doc?.fileName || doc?.originalFilename || '').trim();
      if (!fileUrl) return null;
      return {
        ...doc,
        docType: doc?.docType || doc?.documentType || doc?.label || fallbackType || 'Supporting Document',
        fileUrl,
        fileName: doc?.fileName || doc?.originalFilename || path.basename(fileUrl),
        uploadedBy: doc?.uploadedBy || fallbackUploader || 'Vendor'
      };
    };

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

      const fileTarget = String(item.fileUrl || item.fileName || item.invoiceFile || app?.transactionSnapshot?.fileUrl || app?.transactionSnapshot?.fileName || app?.documents?.[0]?.fileUrl || '').trim();
      const documentsList = (Array.isArray(item.documents) ? item.documents : [])
        .map((doc) => normalizeInvoiceDocument(doc, typeDisplay, item.vendorName))
        .filter(Boolean);
      if (!documentsList.length && fileTarget) {
        documentsList.push(normalizeInvoiceDocument({ fileUrl: fileTarget }, typeDisplay, item.vendorName));
      }

      const blEntry = item.blId
        ? await RfqBlEntry.findOne({ blId: item.blId }, { documents: 1 }).lean()
        : await RfqBlEntry.findOne({ blNumber: item.blNumber }, { documents: 1 }).lean();
      const blEntryDocuments = (blEntry?.documents || [])
        .map((doc) => normalizeInvoiceDocument(doc, 'Bill of Lading', item.vendorName))
        .filter(Boolean);

      return {
        ...item,
        id: item.logisticsPaymentId || item.referenceNumber || item._id,
        referenceNumber: item.referenceNumber || item.logisticsPaymentId,
        fileName: fileTarget,
        fileUrl: fileTarget,
        invoiceFile: fileTarget,
        documents: documentsList,
        blEntryDocuments,
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

router.get('/custom-duties', authenticateToken, async (req, res) => {
  try {
    const visibility = await getPaymentVisibility(req);
    if (!visibility) return res.status(403).json({ success: false, error: 'Your active user record could not be found.' });
    const duties = await CustomDutyPayment.find(paymentOwnerFilter(visibility)).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, duties, count: duties.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/custom-duties', authenticateToken, authorizePermission('custom-duty', 'create'), async (req, res) => {
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
      createdBy: req.user?.name || req.user?.email || 'System User',
      requestedBy: req.user?.name || req.user?.email || 'System User',
      requestedById: req.user?.id || req.user?.email,
      requestedByTeam: approval.requestedByTeam || null,
      assignedApprover: approval.assignedApprover || null,
      assignedApproverName: approval.assignedApproverName || null,
      assignedApproverRole: approval.assignedApproverRole || null
    });

    return res.status(201).json({ success: true, message: 'Custom Duty payment created successfully.', duty, approval });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/custom-duties/:id', authenticateToken, authorizePermission('custom-duty', 'delete'), async (req, res) => {
  try {
    const duty = await CustomDutyPayment.findOneAndDelete({ $or: [{ dutyId: req.params.id }, { _id: req.params.id }] });
    if (!duty) return res.status(404).json({ success: false, error: 'Custom Duty record not found.' });
    return res.json({ success: true, message: 'Custom Duty record deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/logistics-payments/:id/payout', authenticateToken, authorizePermission('logistics-payments', 'mark-paid'), async (req, res) => {
  try {
    const utrNumber = String(req.body.utrNumber || '').trim();
    if (!utrNumber) return res.status(400).json({ success: false, error: 'UTR number is required.' });
    const payment = await LogisticsPayment.findOne({
      $or: [{ logisticsPaymentId: req.params.id }, { referenceNumber: req.params.id }, ...(mongoose.Types.ObjectId.isValid(req.params.id) ? [{ _id: req.params.id }] : [])]
    });
    if (!payment) return res.status(404).json({ success: false, error: 'Logistics payment not found.' });

    payment.status = 'paid';
    payment.utrNumber = utrNumber;
    payment.paidAt = new Date();
    await payment.save();

    const approval = await Approval.findOne({
      $or: [{ id: payment.logisticsPaymentId }, { id: payment.referenceNumber }, { id: req.params.id }]
    });
    if (approval) {
      approval.status = 'Approved & Dispatched';
      await approval.save();
    }

    await recalculatePoMetrics(payment.sapPoNumber || payment.poId || payment.blNumber);

    return res.json({ success: true, message: 'Logistics payment marked as paid.', data: payment });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

router.post('/custom-duties/:id/payout', authenticateToken, authorizePermission('custom-duty', 'mark-paid'), async (req, res) => {
  try {
    const utrNumber = String(req.body.utrNumber || '').trim();
    if (!utrNumber) return res.status(400).json({ success: false, error: 'ICEGATE UTR/reference number is required.' });
    const duty = await CustomDutyPayment.findOne({ $or: [{ dutyId: req.params.id }, ...(mongoose.Types.ObjectId.isValid(req.params.id) ? [{ _id: req.params.id }] : [])] });
    if (!duty) return res.status(404).json({ success: false, error: 'Custom Duty record not found.' });

    duty.status = 'paid';
    duty.utrNumber = utrNumber;
    duty.paidAt = new Date();
    await duty.save();

    const approval = await Approval.findOne({
      $or: [{ id: duty.dutyId }, { id: req.params.id }]
    });
    if (approval) {
      approval.status = 'Approved & Dispatched';
      await approval.save();
    }

    await recalculatePoMetrics(duty.blNumber || duty.poId);

    return res.json({ success: true, message: 'Custom Duty payment marked as paid.', data: duty });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
});

// ─── FILE UPLOAD/DOWNLOAD ROUTES ────────────────────────────────────────────

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 }
});

router.post('/upload-file', authenticateToken, uploadMiddleware.single('file'), async (req, res) => {
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

router.post('/upload-files', authenticateToken, uploadMiddleware.array('files', 10), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ success: false, error: 'No files uploaded.' });

    const folder = req.body.folder || 'documents';
    const uploadedFiles = await Promise.all(req.files.map(async (file) => {
      const storageResult = await uploadToS3(file.buffer, file.originalname, file.mimetype, folder);
      return {
        fileUrl: storageResult.url,
        fileName: storageResult.key || file.originalname,
        originalName: file.originalname,
        size: storageResult.size,
        mimeType: file.mimetype,
        storage: storageResult.storage
      };
    }));

    return res.status(200).json({
      success: true,
      message: `${uploadedFiles.length} files uploaded successfully.`,
      files: uploadedFiles
    });

    const newlyClosed = enrichedPos.filter((po) => po.status === 'closed' && pos.find((item) => String(item._id) === String(po._id))?.status !== 'closed');
    if (newlyClosed.length) {
      await PurchaseOrder.bulkWrite(newlyClosed.map((po) => ({
        updateOne: { filter: { _id: po._id }, update: { $set: { status: 'closed' } } }
      })));
    }
  } catch (err) {
    console.error('[Batch Upload API] File upload error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/download-file', authenticateToken, async (req, res) => {
  try {
    const rawTarget = req.query.fileUrl || req.query.url || req.query.name;
    if (!rawTarget) return res.status(400).json({ success: false, error: 'File path or name required.' });

    const cleanTarget = String(rawTarget).trim();
    const filename = path.basename(String(req.query.name || cleanTarget).trim());
    const storageFilename = path.basename(cleanTarget);

    try {
      if (typeof fileExistsInS3 === 'function' && typeof openDownloadStream === 'function') {
        const existsInS3 = await fileExistsInS3(cleanTarget);
        if (existsInS3) {
          const storedFile = await openDownloadStream(cleanTarget);
          res.setHeader('Content-Type', storedFile.contentType);
          res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/["\r\n]/g, '_')}"`);
          if (storedFile.contentLength != null) res.setHeader('Content-Length', storedFile.contentLength);
          storedFile.body.on('error', (streamError) => {
            console.error('[Download API] Storage stream failed:', streamError);
            if (!res.headersSent) res.status(500).json({ success: false, error: 'Document stream failed.' });
            else res.destroy(streamError);
          });
          return storedFile.body.pipe(res);
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
          } else if (entry.name.toLowerCase() === storageFilename.toLowerCase() || entry.name.toLowerCase().includes(storageFilename.toLowerCase())) {
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

    return res.status(404).json({
      success: false,
      error: 'This legacy document is referenced in the database, but its physical file is not available in local or configured cloud storage.'
    });

    /* istanbul ignore next -- retained only for compatibility with old builds */
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

router.get('/audit/:entityId', authenticateToken, async (req, res) => {
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

router.get('/dashboard/analytics', authenticateToken, async (req, res) => {
  try {
    const approvedReg = /approved|dispatched|paid/i;
    const paidReg = /(^|\s)paid($|\s)|payment[_\s-]?paid/i;
    const terminalApprovalStatuses = ['Approved & Dispatched', 'Approved', 'Rejected', 'Cancelled'];
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
      rawPendingCount,
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
      blEntriesList,
      pendingList,
      allApprovals,
      recentPos,
      recentRfqs
    ] = await Promise.all([
      PurchaseOrder.countDocuments().catch(() => 0),
      PurchaseOrder.countDocuments({ createdAt: { $gte: prevPeriodStartDate, $lt: rangeStartDate } }).catch(() => 0),
      Approval.countDocuments({ status: { $nin: terminalApprovalStatuses } }).catch(() => 0),
      RfqHeader.countDocuments().catch(() => 0),
      RfqHeader.countDocuments({ createdAt: { $gte: prevPeriodStartDate, $lt: rangeStartDate } }).catch(() => 0),
      RfqHeader.countDocuments({ status: 'awarded' }).catch(() => 0),
      RfqHeader.countDocuments({ status: 'draft' }).catch(() => 0),
      RfqHeader.countDocuments({ status: { $in: ['published', 'active', 'open'] } }).catch(() => 0),
      RfqBlEntry.countDocuments().catch(() => 0),
      RfqBlEntry.countDocuments({ status: { $in: ['custom_cleared', 'invoice_pending', 'payment_requested', 'payment_approved', 'payment_paid', 'closed'] } }).catch(() => 0),
      Vendor.countDocuments().catch(() => 0),
      User.countDocuments({ status: 'Active' }).catch(() => 0),
      AdvancePayment.find().lean().catch(() => []),
      InvoicePayment.find().lean().catch(() => []),
      CustomDutyPayment.find().lean().catch(() => []),
      BlInvoice.find().lean().catch(() => []),
      RfqBlEntry.find().lean().catch(() => []),
      Approval.find({ status: { $nin: terminalApprovalStatuses } }).sort({ createdAt: -1 }).limit(10).lean().catch(() => []),
      Approval.find().lean().catch(() => []),
      PurchaseOrder.find().sort({ createdAt: -1 }).limit(5).lean().catch(() => []),
      RfqHeader.find().sort({ createdAt: -1 }).limit(5).lean().catch(() => [])
    ]);

    const userRole = req.user?.role || '';
    const userId = req.user?.id || req.user?.userId;
    const pendingNonTerminalApprovals = allApprovals.filter(a => !terminalApprovalStatuses.includes(a.status));
    const userActionableApprovals = pendingNonTerminalApprovals.filter(a => isApprovalForRole(a, userRole, userId));
    const pendingCount = userActionableApprovals.length;

    const approvedAdvances = advancesList.filter(a => approvedReg.test(a.status || ''));
    const approvedInvoices = invoicesList.filter(i => approvedReg.test(i.status || ''));
    const approvedDuties = dutiesList.filter(d => approvedReg.test(d.status || ''));
    const paidAdvances = advancesList.filter(a => paidReg.test(a.status || ''));
    const paidInvoices = invoicesList.filter(i => paidReg.test(i.status || ''));
    const paidDuties = dutiesList.filter(d => paidReg.test(d.status || ''));

    const sumAdvances = paidAdvances.reduce((acc, curr) => acc + (Number(curr.amount || curr.amountINR || 0)), 0);
    const sumInvoices = paidInvoices.reduce((acc, curr) => acc + (Number(curr.netPayable || curr.amount || curr.amountINR || 0)), 0);
    const sumDuties = paidDuties.reduce((acc, curr) => acc + (Number(curr.dutyAmount || curr.amount || curr.amountINR || 0)), 0);

    const approvalPipeline = {
      advance: {
        pending: advancesList.filter(a => !approvedReg.test(a.status || '') && !(a.status || '').toLowerCase().includes('reject')).length,
        approved: approvedAdvances.length,
        rejected: advancesList.filter(a => (a.status || '').toLowerCase().includes('reject')).length
      },
      invoice: {
        pending: invoicesList.filter(i => !approvedReg.test(i.status || '') && !(i.status || '').toLowerCase().includes('reject')).length,
        approved: approvedInvoices.length,
        rejected: invoicesList.filter(i => (i.status || '').toLowerCase().includes('reject')).length
      },
      rfq: {
        pending: allApprovals.filter(a => (a.type || '').toLowerCase().includes('rfq') && !approvedReg.test(a.status || '')).length,
        approved: rfqAwardedCount || allApprovals.filter(a => (a.type || '').toLowerCase().includes('rfq') && approvedReg.test(a.status || '')).length,
        rejected: allApprovals.filter(a => (a.type || '').toLowerCase().includes('rfq') && (a.status || '').toLowerCase().includes('reject')).length
      },
      blInvoice: {
        pending: blInvoicesList.filter(b => !approvedReg.test(b.status || '') && !(b.status || '').toLowerCase().includes('reject')).length,
        approved: blInvoicesList.filter(b => approvedReg.test(b.status || '')).length,
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

    const paymentTransactions = [...advancesList, ...invoicesList];
    const isRejected = (item) => String(item.status || '').toLowerCase().includes('reject');
    const isDraft = (item) => String(item.status || '').toLowerCase().includes('draft');
    const isFinalized = (item) => approvedReg.test(item.status || '');
    const statusMix = {
      draft: paymentTransactions.filter(isDraft).length,
      pending: paymentTransactions.filter(item => !isDraft(item) && !isRejected(item) && !isFinalized(item)).length,
      approved: paymentTransactions.filter(isFinalized).length,
      rejected: paymentTransactions.filter(isRejected).length,
      total: paymentTransactions.filter(item => !isFinalized(item)).length
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
        assigned: blEntriesList.filter(b => b.status === 'assigned_to_agent').length,
        cleared: blEntriesList.filter(b => b.status === 'custom_cleared').length,
        invPending: blEntriesList.filter(b => b.status === 'invoice_pending').length,
        pmtReq: blEntriesList.filter(b => b.status === 'payment_requested').length,
        approved: blEntriesList.filter(b => b.status === 'payment_approved').length,
        paid: blEntriesList.filter(b => ['payment_paid', 'closed'].includes(b.status)).length,
        total: blEntriesList.length
      },
      recentPendingApprovals: [
        ...pendingList.map(a => ({
          id: a.id || a.approvalId || 'REQ-01',
          stepText: `Step ${a.currentStep || 1}/${a.totalSteps || 1}`,
          dateText: new Date(a.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
          type: a.type || 'Approval',
        })),
        ...blInvoicesList.filter(b => !approvedReg.test(b.status || '') && !(b.status || '').toLowerCase().includes('reject')).map(b => ({
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
