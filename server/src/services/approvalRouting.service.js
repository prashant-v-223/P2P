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

  if ((t.includes('procurement_manager') || t.includes('purchase_manager') || t === 'manager' || t.includes('team_manager')) &&
      (u.includes('procurement_manager') || u.includes('purchase_manager') || u.includes('manager') || u.includes('team_manager'))) return true;

  if ((t.includes('inner_team') || t.includes('procurement_executive') || t === 'procurement') &&
      (u.includes('inner_team') || u.includes('procurement_executive') || u === 'procurement')) return true;

  if (t.includes('exim') && u.includes('exim')) return true;

  if (t.includes('logistics') && u.includes('logistics')) return true;

  return false;
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
  const requesterUser = await User.findOne({
    $or: [
      { id: requester.id || requester.userId },
      { email: requester.email },
      { userId: requester.id || requester.userId }
    ]
  }).lean();

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

      // 1. Check parent manager first if requester has a managerId
      if (requesterUser.managerId) {
        approver = await findParentManager(requesterUser, roleKey);
      }

      // 2. If requester has NO parent manager, self-approval is ON if requester matches step role!
      if (!approver && !requesterUser.managerId && isRequesterRoleMatch) {
        approver = {
          id: requesterUser.id || requesterUser.userId,
          name: requesterUser.name,
          role: requesterUser.role,
          email: requesterUser.email,
          resolutionMethod: 'self_approval_no_parent'
        };
      }

      // 3. Fallback: If still unassigned, assign to designated active role manager (single assigned approver, no multi-user pool string)
      if (!approver) {
        const allRoleManagers = await User.find({
          status: 'Active'
        }).lean().then(users => users.filter(u => isRoleMatchingStep(u.role, roleKey, false)));

        if (allRoleManagers && allRoleManagers.length > 0) {
          const designated = allRoleManagers.find(u => u.isManager || ['Head', 'Manager', 'CFO', 'MD'].includes(u.hierarchyLevel) || ['Procurement Head', 'CFO', 'Managing Director (MD)'].includes(u.role)) || allRoleManagers[0];
          approver = {
            id: designated.id || designated.userId,
            name: designated.name,
            role: designated.role,
            email: designated.email,
            resolutionMethod: 'designated_role_manager'
          };
        }
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
      const approver = await findAnyUserWithRole(roleKey);
      
      return {
        ...step,
        step: step.step || (index + 1),
        assignedApproverId: approver?.id || null,
        assignedApproverName: approver?.name || null,
        assignedApproverRole: approver?.role || roleKey,
        assignedApproverEmail: approver?.email || null,
        statusKey: step.statusKey || `Pending ${step.title || 'Approval'}`,
        resolutionMethod: approver?.resolutionMethod || 'fallback'
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
  const needsFinancialReview = amount >= FINANCIAL_REVIEW_THRESHOLD;
  const needsStrategicReview = amount >= STRATEGIC_REVIEW_THRESHOLD;

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

  // Step 2: Financial review for large amounts
  if (needsFinancialReview) {
    chain.push({
      step: 2,
      title: 'Finance Lead Approval',
      roleKey: 'finance_lead',
      statusKey: 'Pending Finance Lead Approval',
      required: true
    });
  }

  // Step 3: Strategic review for very large amounts
  if (needsStrategicReview) {
    chain.push({
      step: needsFinancialReview ? 3 : 2,
      title: 'MD/Director Approval',
      roleKey: 'md',
      statusKey: 'Pending MD Approval',
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
    const { Vendor } = await import('../models/Vendor.js');
    const { PurchaseOrder } = await import('../models/PurchaseOrder.js');

    let connectedUser = null;

    // 1. Check PO for connected procurement user
    const poRef = poNumber || transactionSnapshot?.poNumber;
    if (poRef) {
      const po = await PurchaseOrder.findOne({ $or: [{ poNumber: poRef }, { sapPoNumber: poRef }] }).lean();
      if (po) {
        const creatorRef = po.createdById || po.createdBy || po.purchaseManagerId || po.buyerEmail;
        if (creatorRef) {
          connectedUser = await User.findOne({
            $or: [{ id: creatorRef }, { userId: creatorRef }, { email: creatorRef }, { name: creatorRef }],
            status: 'Active'
          }).lean();
        }
      }
    }

    // 2. Check Vendor record if PO connection not found
    if (!connectedUser && vendorId) {
      const vendor = await Vendor.findOne({
        $or: [{ id: vendorId }, { sapVendorCode: vendorId }, { supplierId: vendorId }, { vendorId }]
      }).lean();

      const mgrRef = vendor?.purchaseManagerId || vendor?.assignedPurchaseManager || vendor?.userId;
      if (mgrRef) {
        const vUser = await User.findOne({
          $or: [{ id: mgrRef }, { userId: mgrRef }, { email: mgrRef }]
        }).lean();

        if (vUser) {
          if (['procurement', 'procurement_head', 'procurement_manager', 'purchase_manager', 'purchase_head'].some(r => (vUser.role || '').toLowerCase().includes(r))) {
            connectedUser = vUser;
          } else if (vUser.managerId || vUser.managerName) {
            connectedUser = await User.findOne({
              $or: [{ id: vUser.managerId }, { userId: vUser.managerId }, { name: vUser.managerName }],
              status: 'Active'
            }).lean();
          }
        }
      }
    }

    // CASE A: Connected Procurement user exists! Send to connected user's SENIOR manager!
    if (connectedUser) {
      const seniorManager = await findParentManager(connectedUser, 'procurement_head');
      const targetUser = seniorManager || connectedUser;
      return {
        id: targetUser.id || targetUser.userId,
        name: targetUser.name,
        role: targetUser.role || 'Procurement Head',
        email: targetUser.email,
        resolutionMethod: seniorManager ? 'vendor_connected_senior_manager' : 'vendor_connected_manager'
      };
    }

    // CASE B: NO connected Procurement user! Route to 2nd Level Senior Procurement Managers (Pooja Bhat, Vaibhav Parekh, Yash Naik)
    const level2Seniors = await User.find({
      $or: [
        { name: { $in: ['Pooja Bhat', 'Vaibhav Parekh', 'Yash Naik'] } },
        { id: { $in: ['Pooja Bhat', 'Vaibhav Parekh', 'Yash Naik'] } }
      ],
      status: 'Active'
    }).lean();

    if (level2Seniors && level2Seniors.length > 0) {
      const senior = level2Seniors[0];
      return {
        id: senior.id || senior.userId,
        name: senior.name,
        role: senior.role || 'Procurement Head',
        email: senior.email,
        resolutionMethod: 'level2_senior_procurement'
      };
    }

    // Fallback: search by senior procurement role
    const fallbackSeniors = await User.find({
      role: { $in: ['procurement_head', 'Procurement Head', 'purchase_head', 'Purchase Head', 'procurement_manager'] },
      status: 'Active'
    }).lean();

    if (fallbackSeniors && fallbackSeniors.length > 0) {
      const senior = fallbackSeniors[0];
      return {
        id: senior.id || senior.userId,
        name: senior.name,
        role: senior.role || 'Procurement Head',
        email: senior.email,
        resolutionMethod: 'level2_senior_procurement_fallback'
      };
    }

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

      const freshSteps = await attachApprovers(rawSteps, requester);
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
      repairedCount++;
    }

    console.log(`[Approval Repair] Successfully repaired ${repairedCount} active approval workflow records.`);
  } catch (err) {
    console.error('[Approval Repair] Failed to repair active approvals:', err.message);
  }
}