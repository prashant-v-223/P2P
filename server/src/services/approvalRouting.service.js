// services/approvalRouting.service.js

import { User } from '../models/User.js';
import { Approval } from '../models/Approval.js';

// Constants for approval thresholds
export const FINANCIAL_REVIEW_THRESHOLD = 5000000; // ₹50 Lakhs
export const STRATEGIC_REVIEW_THRESHOLD = 10000000; // ₹1 Crore

export function isRoleMatchingStep(userRole = '', targetStepRole = '', allowAdminOverride = true) {
  const u = String(userRole || '').toLowerCase().replace(/[\s_-]+/g, '_').trim();
  const t = String(targetStepRole || '').toLowerCase().replace(/[\s_-]+/g, '_').trim();
  if (!u || !t) return false;

  if (u === t) return true;

  if (allowAdminOverride && ['admin', 'superadmin', 'system_admin', 'systemadmin'].includes(u)) return true;

  if ((t === 'md' || t.includes('director') || t.includes('managing_director')) &&
      (u === 'md' || u.includes('director') || u.includes('managing_director'))) return true;

  if ((t === 'cfo' || t === 'cfo_approval' || t === 'cfo_signoff') &&
      (u === 'cfo' || u === 'cfo_approval' || u === 'cfo_signoff')) return true;

  if ((t.includes('cfo_inner') || t.includes('account_finance') || t.includes('accounts') || t === 'finance' || t.includes('finance_lead') || t.includes('finance_head')) &&
      (u.includes('cfo_inner') || u.includes('account_finance') || u.includes('accounts') || u === 'finance' || u.includes('finance_lead') || u.includes('finance_head') || u === 'cfo')) return true;

  if ((t.includes('procurement_head') || t.includes('procurement_lead') || t.includes('purchase_head') || t.includes('purchase_hod') || t.includes('procurement_hod')) && 
      (u.includes('procurement_head') || u.includes('procurement_lead') || u.includes('purchase_head') || u.includes('purchase_hod') || u.includes('procurement_hod'))) return true;

  if ((t.includes('procurement_manager') || t.includes('purchase-manager') || t === 'manager' || t.includes('team_manager')) &&
      (u.includes('procurement_manager') || u.includes('purchase-manager') || u === 'manager' || u.includes('team_manager'))) return true;

  if ((t.includes('procurement') || t.includes('purchase')) &&
      (u.includes('procurement') || u.includes('purchase'))) return true;

  if (t.includes('exim') && u.includes('exim')) return true;

  if (t.includes('logistics') && u.includes('logistics')) return true;

  return false;
}

/**
 * Resolves internal procurement owner for a vendor matching vendors.controller.js
 */
let vendorOwnerDirectoryPromise = null;
let vendorOwnerDirectoryExpiresAt = 0;

export async function resolveVendorOwnerUser(rawVendorQuery) {
  if (!rawVendorQuery) return null;
  try {
    const { Vendor } = await import('../models/Vendor.js');
    if (!vendorOwnerDirectoryPromise || Date.now() >= vendorOwnerDirectoryExpiresAt) {
      vendorOwnerDirectoryExpiresAt = Date.now() + 15_000;
      vendorOwnerDirectoryPromise = Promise.all([
        Vendor.find().sort({ createdAt: -1 }).lean().catch(() => []),
        User.find().lean().catch(() => [])
      ]).catch((error) => {
        vendorOwnerDirectoryPromise = null;
        throw error;
      });
    }
    const [vendors, users] = await vendorOwnerDirectoryPromise;

    const internalUsers = users.filter(u => u.role !== 'vendor' && u.role !== 'vendor_portal');
    const internalUsersMap = new Map();
    for (const u of internalUsers) {
      if (u.id) internalUsersMap.set(String(u.id), u);
      if (u._id) internalUsersMap.set(String(u._id), u);
      if (u.email) internalUsersMap.set(String(u.email).toLowerCase(), u);
    }

    const normalize = (str) => String(str || '')
      .toLowerCase()
      .replace(/[(),.\-_/\\]/g, ' ')
      .replace(/\b(co|ltd|limited|sdn|bhd|inc|corp|corporation|pv|products|regular|one-time|import|domestic)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    const normQuery = normalize(rawVendorQuery);

    const seenKeys = new Set();
    const uniqueVendors = [];
    for (let i = 0; i < vendors.length; i++) {
      const v = vendors[i];
      const key = v.sapVendorCode || v.supplierId || v.id || v._id?.toString();
      if (key && !seenKeys.has(key)) {
        seenKeys.add(key);

        let linkedU = internalUsersMap.get(String(v.assignedPurchaseManagerId))
          || internalUsersMap.get(String(v.buyerId))
          || internalUsersMap.get(String(v.userId))
          || internalUsers.find(u => u.name === v.assignedPurchaseManager || u.name === v.buyerName || u.name === v.createdBy);

        // Match the Vendor Directory's legacy-data behavior exactly. Older
        // vendor rows without a saved link are displayed with this stable
        // procurement owner, so approval routing must use the same person.
        if (!linkedU && internalUsers.length > 0) {
          linkedU = internalUsers[uniqueVendors.length % internalUsers.length];
        }

        v.linkedUserDoc = linkedU;
        uniqueVendors.push(v);
      }
    }

    const matchedVendor = uniqueVendors.find(v => {
      const normV = normalize(v.companyName);
      return v.sapVendorCode === rawVendorQuery || v.supplierId === rawVendorQuery || v.id === rawVendorQuery ||
        normV === normQuery || (normQuery && normV.includes(normQuery)) || (normV && normQuery.includes(normV));
    });

    return matchedVendor?.linkedUserDoc || null;
  } catch (err) {
    console.error('[resolveVendorOwnerUser Error]:', err.message);
    return null;
  }
}

/**
 * Main function to resolve approvers for each workflow step
 * Handles both admin requests and hierarchical approvals
 */
export async function attachApprovers(steps, requester) {
  if (!steps || !Array.isArray(steps)) {
    return [];
  }

  // If no requester info, find any available approver
  if (!requester) {
    return steps.map(step => ({
      ...step,
      assignedApproverId: null,
      assignedApproverName: null,
      assignedApproverRole: step.roleKey || step.roleName,
      statusKey: step.statusKey || `Pending ${step.title || 'Approval'}`
    }));
  }

  // Get the complete requester object with hierarchy
  let requesterUser = await User.findOne({
    $or: [
      { id: requester.id || requester.userId },
      { email: requester.email },
      { userId: requester.id || requester.userId }
    ]
  }).lean();

  // Vendor portal identities are not internal User records. Resolve their
  // genuine Vendor Directory link before falling back to a role pool.
  const rawVendorQuery = requester?.vendorName || requester?.supplierId || requester?.vendorId;
  const vendorOwnerUser = await resolveVendorOwnerUser(rawVendorQuery);
  if (!requesterUser && vendorOwnerUser) requesterUser = vendorOwnerUser;

  if (!requesterUser) {
    return await attachFallbackApprovers(steps);
  }

  // Process each step
  const resolvedSteps = await Promise.all(
    steps.map(async (step, index) => {
      const roleKey = step.roleKey || step.roleName;
      const stepNumber = step.step || (index + 1);

      let approver = null;
      let isPoolApproval = false;
      let approverPool = [];

      const isRequesterRoleMatch = isRoleMatchingStep(requesterUser.role, roleKey, false);

      // 1. Check parent manager first if requester or vendor owner has a managerId
      const targetUserForHierarchy = (requesterUser.managerId ? requesterUser : (vendorOwnerUser?.managerId ? vendorOwnerUser : (vendorOwnerUser || requesterUser)));
      if (targetUserForHierarchy?.managerId) {
        const hierarchyApprover = await findParentManager(targetUserForHierarchy, roleKey);
        if (hierarchyApprover && isRoleMatchingStep(hierarchyApprover.role, roleKey, false)) {
          approver = hierarchyApprover;
        }
      } else if (targetUserForHierarchy && isRoleMatchingStep(targetUserForHierarchy.role, roleKey, false)) {
        approver = {
          id: targetUserForHierarchy.id || targetUserForHierarchy.userId,
          name: targetUserForHierarchy.name,
          role: targetUserForHierarchy.role,
          email: targetUserForHierarchy.email,
          resolutionMethod: 'direct_connected_user'
        };
      }

      // 2. If requester has NO parent manager, self-approval is ON if requester matches step role!
      if (!approver && !requesterUser.managerId && !vendorOwnerUser?.managerId && isRequesterRoleMatch) {
        approver = {
          id: requesterUser.id || requesterUser.userId,
          name: requesterUser.name,
          role: requesterUser.role,
          email: requesterUser.email,
          resolutionMethod: 'self_approval_no_parent'
        };
      }

      // 3. Fallback: If no reporting manager exists, set pool approval so ALL matching role members can approve
      if (!approver) {
        isPoolApproval = true;
        const allRoleUsers = await User.find({ status: 'Active' }).lean().then(users => users.filter(u => isRoleMatchingStep(u.role, roleKey, false)));
        approverPool = allRoleUsers.map(u => ({ id: u.id || u.userId, name: u.name, role: u.role, email: u.email }));
      }

      // 3. Fallback check by role or active user if still unresolved
      if (!approver && !isPoolApproval) {
        approver = await findApproverByRole(requesterUser, roleKey);
      }

      if (!approver && !isPoolApproval) {
        approver = await findAnyUserWithRole(roleKey);
      }

      return {
        ...step,
        step: stepNumber,
        assignedApproverId: isPoolApproval ? null : (approver?.id || null),
        assignedApproverName: approver?.name || null,
        assignedApproverRole: approver?.role || roleKey,
        assignedApproverEmail: approver?.email || null,
        isPoolApproval,
        approverPool: isPoolApproval ? approverPool : [],
        statusKey: step.statusKey || `Pending ${step.title || 'Approval'}`,
        resolutionMethod: approver?.resolutionMethod || 'role_based',
        resolvedAt: new Date()
      };
    })
  );

  return resolvedSteps;
}

/**
 * Find parent manager walking up the managerId hierarchy
 */
async function findParentManager(requester, roleKey) {
  if (!requester?.managerId && !requester?.managerName) return null;

  let current = requester;
  let firstLineManager = null;
  const visited = new Set([requester.id || requester.userId]);

  while (current && (current.managerId || current.managerName)) {
    const searchConditions = [];
    if (current.managerId) {
      searchConditions.push({ id: current.managerId }, { userId: current.managerId }, { employeeId: current.managerId });
    }
    if (current.managerName) {
      searchConditions.push({ name: current.managerName });
    }

    const manager = await User.findOne({
      $or: searchConditions,
      status: 'Active'
    }).lean();

    if (!manager) break;
    const mgrId = manager.id || manager.userId;
    if (visited.has(mgrId)) break;
    visited.add(mgrId);

    if (!firstLineManager) firstLineManager = manager;

    if (isRoleMatchingStep(manager.role, roleKey, false)) {
      return { ...manager, resolutionMethod: 'parent_manager' };
    }

    current = manager;
  }

  // If a direct reporting parent manager exists, return them for procurement/manager approval steps
  if (firstLineManager) {
    return { ...firstLineManager, resolutionMethod: 'direct_parent_manager' };
  }

  return null;
}

/**
 * Find a peer or escalate when Procurement Head creates request
 */
async function findPeerOrEscalate(requester, roleKey) {
  // First, try to find another Procurement Head (peer)
  const peers = await User.find({
    role: { $in: ['procurement_head', 'Procurement Head', 'procurement'] },
    status: 'Active',
    id: { $ne: requester.id }
  }).lean();

  if (peers && peers.length > 0) {
    // Return the first peer (can be load-balanced)
    return { ...peers[0], resolutionMethod: 'peer' };
  }

  // If no peers, escalate to MD/Director
  const md = await User.findOne({
    role: { $in: ['md', 'director', 'MD', 'Director'] },
    status: 'Active'
  }).lean();

  if (md) {
    return { ...md, resolutionMethod: 'escalated_to_md' };
  }

  // If no MD, find any other senior user
  return await findApproverByRole(requester, 'director');
}

/**
 * Generic approver finder based on role
 */
async function findApproverByRole(requester, roleKey) {
  // First: Try to find someone in same department
  if (requester.department) {
    const deptApprover = await User.findOne({
      role: { $regex: new RegExp(roleKey, 'i') },
      department: requester.department,
      status: 'Active'
    }).lean();

    if (deptApprover) {
      return { ...deptApprover, resolutionMethod: 'same_department' };
    }
  }

  // Second: Try to find someone in same team
  if (requester.team) {
    const teamApprover = await User.findOne({
      role: { $regex: new RegExp(roleKey, 'i') },
      team: requester.team,
      status: 'Active'
    }).lean();

    if (teamApprover) {
      return { ...teamApprover, resolutionMethod: 'same_team' };
    }
  }

  // Third: Find any user with the required role
  const anyApprover = await User.findOne({
    role: { $regex: new RegExp(roleKey, 'i') },
    status: 'Active'
  }).lean();

  if (anyApprover) {
    return { ...anyApprover, resolutionMethod: 'any_available' };
  }

  return null;
}

/**
 * Find any user with the required role
 */
async function findAnyUserWithRole(roleKey) {
  const user = await User.findOne({
    role: { $regex: new RegExp(roleKey, 'i') },
    status: 'Active'
  }).lean();

  if (user) {
    return { ...user, resolutionMethod: 'fallback_any' };
  }

  return null;
}

/**
 * Fallback: Find any active user for each role
 */
async function attachFallbackApprovers(steps) {
  return Promise.all(
    steps.map(async (step, index) => {
      const roleKey = step.roleKey || step.roleName;
      const roleUsers = await User.find({ status: 'Active' }).lean();
      const approverPool = roleUsers
        .filter((user) => isRoleMatchingStep(user.role, roleKey, false))
        .map((user) => ({ id: user.id || user.userId, name: user.name, role: user.role, email: user.email }));
      
      return {
        ...step,
        step: step.step || (index + 1),
        assignedApproverId: null,
        assignedApproverName: null,
        assignedApproverRole: roleKey,
        assignedApproverEmail: null,
        isPoolApproval: true,
        approverPool,
        statusKey: step.statusKey || `Pending ${step.title || 'Approval'}`,
        resolutionMethod: 'role_pool_unlinked_vendor'
      };
    })
  );
}

/**
 * Resolve the approval chain based on workflow and amount
 * New flow: purchase_manager → (finance if > 50L) → (MD if > 1Cr)
 * No Procurement Head first step for standard Advance/Invoice payments
 */
export async function resolveApprovalChain(moduleType, amount, requester) {
  // Get the user with hierarchy
  const requesterUser = await User.findOne({
    $or: [
      { id: requester?.id || requester?.userId },
      { email: requester?.email }
    ]
  }).lean();

  if (String(moduleType || '').toLowerCase().includes('logistics')) {
    const chain = [
      {
        step: 1,
        title: 'Logistics Manager Approval',
        roleKey: 'logistics-manager',
        statusKey: 'Pending Logistics Manager Approval',
        required: true
      },
      {
        step: 2,
        title: 'Finance Approval',
        roleKey: 'finance',
        statusKey: 'Pending Finance Approval',
        required: true
      }
    ];

    if (amount >= STRATEGIC_REVIEW_THRESHOLD) {
      chain.push({
        step: 3,
        title: 'MD/Director Approval',
        roleKey: 'md',
        statusKey: 'Pending MD Approval',
        required: true
      });
    }

    return await attachApprovers(chain, requesterUser);
  }

  // Determine if financial review is needed
  const needsCfoReview = amount > 1000000;
  const needsMdReview = amount > FINANCIAL_REVIEW_THRESHOLD;

  // Build the approval chain — starts directly with Purchase Manager (no Procurement Head)
  let chain = [];

  // Step 1: Purchase Manager (direct, streamlined — no first approval gate)
  chain.push({
    step: 1,
    title: 'Purchase Manager Approval',
    roleKey: 'purchase_manager',
    statusKey: 'Pending Purchase Manager Approval',
    required: true
  });

  chain.push({
    step: 2,
    title: 'Purchase Head Approval',
    roleKey: 'procurement_head',
    statusKey: 'Pending Purchase Head Approval',
    required: true
  });

  if (needsCfoReview) {
    chain.push({
      step: 3,
      title: 'CFO Approval',
      roleKey: 'cfo',
      statusKey: 'Pending CFO Approval',
      required: true
    });
  }

  if (needsMdReview) {
    chain.push({
      step: needsCfoReview ? 4 : 3,
      title: 'Managing Director Approval',
      roleKey: 'md',
      statusKey: 'Pending Managing Director Approval',
      required: true
    });
  }

  // Attach approvers to the chain
  return await attachApprovers(chain, requesterUser);
}

/**
 * Resolve the purchase manager linked to a specific vendor
 * Flow: vendorId → Vendor.userId → User.managerId → Purchase Manager
 * If no direct link found, returns null (caller will use pool approval)
 */
export async function resolveVendorPurchaseManager(vendorId, poNumber = null, transactionSnapshot = {}) {
  try {
    let connectedUser = await resolveVendorOwnerUser(
      vendorId || transactionSnapshot?.vendorName || transactionSnapshot?.supplierName
    );

    // 1. Vendor Directory's explicit Linked User is authoritative.
    if (!connectedUser && vendorId) {
      const { Vendor } = await import('../models/Vendor.js');
      const vendor = await Vendor.findOne({
        $or: [{ id: vendorId }, { sapVendorCode: vendorId }, { supplierId: vendorId }, { vendorId }]
      }).lean();

      const linkRefs = [
        vendor?.assignedPurchaseManagerId, vendor?.buyerId, vendor?.userId,
        vendor?.assignedPurchaseManager, vendor?.buyerName
      ].filter(Boolean);
      if (linkRefs.length) {
        connectedUser = await User.findOne({
          status: 'Active',
          $or: [
            { id: { $in: linkRefs } }, { userId: { $in: linkRefs } },
            { email: { $in: linkRefs } }, { name: { $in: linkRefs } }
          ]
        }).lean();
      }
    }

    // The Vendor Directory's Linked User receives Procurement Manager
    // Approval directly. Their job title does not change this ownership.
    if (connectedUser) {
      return {
        id: connectedUser.id || connectedUser.userId,
        name: connectedUser.name,
        role: connectedUser.role || 'Purchase Manager',
        email: connectedUser.email,
        resolutionMethod: 'vendor_linked_user'
      };
    }
    // No genuine link: caller keeps the workflow step as a role pool.
    return null;
  } catch (err) {
    console.warn('[resolveVendorPurchaseManager] Error:', err.message);
    return null;
  }
}


/**
 * Resolve delegation chain for a specific user
 */
export async function resolveDelegationChain(userId, roleKey) {
  const user = await User.findOne({
    $or: [{ id: userId }, { userId }]
  }).lean();

  if (!user) return [];

  const chain = [];
  let currentUser = user;

  // Walk up the hierarchy
  while (currentUser) {
    chain.push({
      id: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
      level: currentUser.hierarchyLevel || chain.length + 1
    });

    // Stop if we've reached the top
    if (currentUser.role?.toLowerCase() === 'ceo' || 
        currentUser.role?.toLowerCase() === 'director') {
      break;
    }

    // Move to manager
    if (currentUser.managerId) {
      currentUser = await User.findOne({
        $or: [
          { id: currentUser.managerId },
          { userId: currentUser.managerId }
        ]
      }).lean();
    } else {
      break;
    }
  }

  return chain;
}

/**
 * Check for conflicts (requester is also approver)
 */
export async function detectApprovalConflict(requesterId, approverId) {
  if (!requesterId || !approverId) return false;
  return String(requesterId) === String(approverId);
}

/**
 * Get the best approver for escalation
 */
export async function getEscalationApprover(currentApproverId, stepRole) {
  // Find the current approver
  const currentApprover = await User.findOne({
    $or: [{ id: currentApproverId }, { userId: currentApproverId }]
  }).lean();

  if (!currentApprover) {
    return await findAnyUserWithRole(stepRole);
  }

  // Escalate to their manager
  if (currentApprover.managerId) {
    const manager = await User.findOne({
      $or: [
        { id: currentApprover.managerId },
        { userId: currentApprover.managerId }
      ]
    }).lean();

    if (manager) {
      return { ...manager, resolutionMethod: 'escalated' };
    }
  }

  // If no manager, escalate to next level
  const nextLevel = await User.findOne({
    role: { $in: ['director', 'md', 'ceo'] },
    status: 'Active'
  }).lean();

  if (nextLevel) {
    return { ...nextLevel, resolutionMethod: 'escalated_to_senior' };
  }

  return null;
}

/**
 * Repair existing active approvals in MongoDB to ensure clean approver assignments and pools
 */
export async function repairAllActiveApprovals() {
  try {
    const TERMINAL = ['Approved & Dispatched', 'Rejected', 'Cancelled'];
    const activeApprovals = await Approval.find({ status: { $nin: TERMINAL } });

    console.log(`[Approval Repair] Checking ${activeApprovals.length} active approvals...`);
    let repairedCount = 0;

    for (const app of activeApprovals) {
      let rawSteps = [];
      if (app.workflowSnapshot?.steps && Array.isArray(app.workflowSnapshot.steps) && app.workflowSnapshot.steps.length > 0) {
        rawSteps = app.workflowSnapshot.steps;
      } else if (app.workflowSteps) {
        try {
          rawSteps = typeof app.workflowSteps === 'string' ? JSON.parse(app.workflowSteps) : app.workflowSteps;
        } catch (_) {}
      }

      if (!rawSteps || rawSteps.length === 0) continue;

      const requester = app.requestedById ? await User.findOne({
        $or: [{ id: app.requestedById }, { userId: app.requestedById }, { email: app.requestedByEmail }]
      }).lean() : null;

      const freshSteps = await attachApprovers(rawSteps, {
        ...requester,
        vendorName: app.vendorName,
        vendorId: app.vendorId || app.supplierId,
        supplierId: app.supplierId || app.vendorId
      });
      const currentStepNum = app.currentStep || 1;
      const activeStep = freshSteps.find(s => (s.step || s.stepNumber) === currentStepNum) || freshSteps[0];

      app.workflowSteps = JSON.stringify(freshSteps);
      if (app.workflowSnapshot) {
        app.workflowSnapshot.steps = freshSteps;
        app.markModified('workflowSnapshot');
      }

      if (activeStep) {
        app.assignedApprover = activeStep.isPoolApproval ? null : (activeStep.assignedApproverId || null);
        app.assignedApproverName = activeStep.assignedApproverName || null;
        app.assignedApproverRole = activeStep.assignedApproverRole || activeStep.roleKey || null;
        app.assignedApproverEmail = activeStep.assignedApproverEmail || null;
      }

      await app.save();

      // Sync child payment documents to ensure MongoDB records match Approval state
      const childPayload = {
        assignedApproverRole: app.assignedApproverRole,
        assignedApproverName: app.assignedApproverName,
        assignedApprover: app.assignedApprover,
        currentStep: app.currentStep || 1
      };

      const refId = app.referenceId || app.referenceNumber || app.id;
      if (app.type === 'Advance Payment') {
        const { AdvancePayment } = await import('../models/AdvancePayment.js');
        await AdvancePayment.updateMany(
          { $or: [{ advanceId: refId }, { _id: app.id }, { advanceId: app.id }] },
          { $set: childPayload }
        ).catch(() => {});
      } else if (app.type === 'Invoice Payment') {
        const { InvoicePayment } = await import('../models/InvoicePayment.js');
        await InvoicePayment.updateMany(
          { $or: [{ invoicePaymentId: refId }, { _id: app.id }, { invoicePaymentId: app.id }] },
          { $set: childPayload }
        ).catch(() => {});
      } else if (['Logistics Payment', 'BL Freight Invoice', 'Logistics Payments'].includes(app.type)) {
        const { LogisticsPayment } = await import('../models/LogisticsPayment.js');
        await LogisticsPayment.updateMany(
          { $or: [{ logisticsPaymentId: refId }, { referenceNumber: refId }] },
          { $set: childPayload }
        ).catch(() => {});
      } else if (['Custom Duty', 'Customs Duty'].includes(app.type)) {
        const { CustomDutyPayment } = await import('../models/CustomDutyPayment.js');
        await CustomDutyPayment.updateMany(
          { $or: [{ dutyId: refId }, { _id: refId }] },
          { $set: childPayload }
        ).catch(() => {});
      }

      repairedCount++;
    }

    console.log(`[Approval Repair] Successfully repaired ${repairedCount} active approval workflow records.`);
  } catch (err) {
    console.error('[Approval Repair] Failed to repair active approvals:', err.message);
  }
}

export async function repairAllOldPaymentRecords() {
  try {
    const { AdvancePayment } = await import('../models/AdvancePayment.js');
    const { InvoicePayment } = await import('../models/InvoicePayment.js');
    const { LogisticsPayment } = await import('../models/LogisticsPayment.js');
    const { CustomDutyPayment } = await import('../models/CustomDutyPayment.js');

    let repaired = 0;

    const mapDocStatus = (appStatus, curStatus) => {
      if (curStatus === 'paid') return 'paid';
      if (appStatus === 'Approved & Dispatched') return 'approved';
      if (appStatus === 'Rejected') return 'rejected';
      if (appStatus === 'Returned for changes') return 'returned';
      return curStatus || 'pending';
    };

    const getDynamicStepRole = (app, fallbackRole, stepNum) => {
      if (app?.assignedApproverRole) return app.assignedApproverRole;
      if (app?.workflowSteps) {
        try {
          const steps = typeof app.workflowSteps === 'string' ? JSON.parse(app.workflowSteps) : app.workflowSteps;
          const active = steps.find(s => Number(s.step || s.stepNumber) === Number(stepNum));
          if (active) return active.roleKey || active.assignedApproverRole || active.roleName || active.title;
        } catch (_) {}
      }
      return fallbackRole || null;
    };

    const advances = await AdvancePayment.find({}).lean();
    for (const adv of advances) {
      const refId = adv.advanceId || adv.id || String(adv._id);
      const app = await Approval.findOne({
        $or: [{ referenceId: refId }, { id: refId }, { referenceNumber: refId }]
      }).lean();

      let step = app?.currentStep || adv.currentStep || 1;
      let role = getDynamicStepRole(app, adv.assignedApproverRole, step);
      const targetStatus = mapDocStatus(app?.status, adv.status);

      await AdvancePayment.updateOne(
        { _id: adv._id },
        {
          $set: {
            status: targetStatus,
            assignedApproverRole: role,
            assignedApproverName: app?.assignedApproverName || adv.assignedApproverName || null,
            assignedApprover: app?.assignedApprover || adv.assignedApprover || null,
            currentStep: step
          }
        }
      );
      repaired++;
    }

    const invoices = await InvoicePayment.find({}).lean();
    for (const inv of invoices) {
      const refId = inv.invoicePaymentId || inv.id || String(inv._id);
      const app = await Approval.findOne({
        $or: [{ referenceId: refId }, { id: refId }, { referenceNumber: refId }]
      }).lean();

      let step = app?.currentStep || inv.currentStep || 1;
      let role = getDynamicStepRole(app, inv.assignedApproverRole, step);
      const targetStatus = mapDocStatus(app?.status, inv.status);

      await InvoicePayment.updateOne(
        { _id: inv._id },
        {
          $set: {
            status: targetStatus,
            assignedApproverRole: role,
            assignedApproverName: app?.assignedApproverName || inv.assignedApproverName || null,
            assignedApprover: app?.assignedApprover || inv.assignedApprover || null,
            currentStep: step
          }
        }
      );
      repaired++;
    }

    const logistics = await LogisticsPayment.find({}).lean();
    for (const log of logistics) {
      const refId = log.logisticsPaymentId || log.referenceNumber || String(log._id);
      const app = await Approval.findOne({
        $or: [{ referenceId: refId }, { id: refId }, { referenceNumber: refId }]
      }).lean();

      let step = app?.currentStep || log.currentStep || 1;
      let role = getDynamicStepRole(app, log.assignedApproverRole, step);
      const targetStatus = mapDocStatus(app?.status, log.status);

      await LogisticsPayment.updateOne(
        { _id: log._id },
        {
          $set: {
            status: targetStatus,
            assignedApproverRole: role,
            assignedApproverName: app?.assignedApproverName || log.assignedApproverName || null,
            assignedApprover: app?.assignedApprover || log.assignedApprover || null,
            currentStep: step
          }
        }
      );
      repaired++;
    }

    const duties = await CustomDutyPayment.find({}).lean();
    for (const duty of duties) {
      const refId = duty.dutyId || String(duty._id);
      const app = await Approval.findOne({
        $or: [{ referenceId: refId }, { id: refId }, { referenceNumber: refId }]
      }).lean();

      let step = app?.currentStep || duty.currentStep || 1;
      let role = getDynamicStepRole(app, duty.assignedApproverRole, step);
      const targetStatus = mapDocStatus(app?.status, duty.status);

      await CustomDutyPayment.updateOne(
        { _id: duty._id },
        {
          $set: {
            status: targetStatus,
            assignedApproverRole: role,
            assignedApproverName: app?.assignedApproverName || duty.assignedApproverName || null,
            assignedApprover: app?.assignedApprover || duty.assignedApprover || null,
            currentStep: step
          }
        }
      );
      repaired++;
    }

    console.log(`[DB REPAIR SUCCESS] Repaired ${repaired} old payment records across MongoDB.`);
  } catch (err) {
    console.error('[DB REPAIR ERROR] Failed to repair old records:', err.message);
  }
}
