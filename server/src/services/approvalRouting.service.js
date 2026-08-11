// services/approvalRouting.service.js

import { User } from '../models/User.js';
import { Approval } from '../models/Approval.js';

// Constants for approval thresholds
export const FINANCIAL_REVIEW_THRESHOLD = 5000000; // ₹50 Lakhs
export const STRATEGIC_REVIEW_THRESHOLD = 10000000; // ₹1 Crore

export function isRoleMatchingStep(userRole = '', targetStepRole = '') {
  const u = String(userRole || '').toLowerCase().replace(/[\s_-]+/g, '_').trim();
  const t = String(targetStepRole || '').toLowerCase().replace(/[\s_-]+/g, '_').trim();
  if (!u || !t) return false;

  if (u === t) return true;

  if (['admin', 'superadmin', 'system_admin', 'systemadmin'].includes(u)) return true;

  if ((t === 'md' || t.includes('director')) && (u === 'md' || u.includes('director'))) return true;

  if ((t === 'cfo' || t.includes('cfo_approval') || t.includes('cfo_signoff')) && (u === 'cfo' || u.includes('cfo'))) return true;

  if ((t.includes('cfo_inner') || t.includes('account_finance') || t.includes('accounts')) &&
      (u.includes('cfo_inner') || u.includes('account_finance') || u.includes('accounts') || u.includes('cfo'))) return true;

  if ((t.includes('procurement_head') || t.includes('procurement_lead') || t.includes('purchase_head')) && 
      (u.includes('procurement_head') || u.includes('procurement_lead') || u.includes('purchase_head'))) return true;

  if ((t.includes('procurement_manager') || t.includes('purchase_manager') || t === 'manager') &&
      (u.includes('procurement_manager') || u.includes('purchase_manager') || u.includes('manager'))) return true;

  if ((t.includes('inner_team') || t.includes('procurement_executive')) &&
      (u.includes('inner_team') || u.includes('procurement_executive'))) return true;

  if (t.includes('exim') && u.includes('exim')) return true;

  if (t.includes('logistics') && u.includes('logistics')) return true;

  return u.includes(t) || t.includes(u);
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

      const isRequesterManagerInRole = isRoleMatchingStep(requesterUser.role, roleKey);
      const isChildUser = Boolean(requesterUser.managerId) && !isRequesterManagerInRole;

      if (isChildUser) {
        // 1. Child user created request: Route ONLY to direct parent line manager
        approver = await findParentManager(requesterUser, roleKey);
        isPoolApproval = false;
      } else {
        // 2. Parent / Manager user created request: Route to BOTH / ALL managers in role tier
        const allRoleManagers = await User.find({
          status: 'Active'
        }).lean().then(users => users.filter(u => isRoleMatchingStep(u.role, roleKey)));

        if (allRoleManagers && allRoleManagers.length > 0) {
          isPoolApproval = true;
          approverPool = allRoleManagers.map(u => ({
            id: u.id,
            name: u.name,
            role: u.role,
            email: u.email
          }));
          approver = {
            id: null,
            name: allRoleManagers.map(u => u.name).join(', '),
            role: roleKey,
            email: null,
            resolutionMethod: 'manager_peer_pool'
          };
        } else if (requesterUser.managerId) {
          approver = await findParentManager(requesterUser, roleKey);
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
  if (!requester.managerId) return null;

  let current = requester;
  let firstLineManager = null;
  const visited = new Set([requester.id]);

  while (current && current.managerId && !visited.has(current.managerId)) {
    visited.add(current.managerId);
    const manager = await User.findOne({
      $or: [
        { id: current.managerId },
        { userId: current.managerId },
        { employeeId: current.managerId }
      ],
      status: 'Active'
    }).lean();

    if (!manager) break;
    if (!firstLineManager) firstLineManager = manager;

    if (isRoleMatchingStep(manager.role, roleKey)) {
      return { ...manager, resolutionMethod: 'parent_manager' };
    }

    current = manager;
  }

  // If no specific role matched higher up, return direct parent line manager
  if (firstLineManager) {
    return { ...firstLineManager, resolutionMethod: 'direct_line_manager' };
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
 */
export async function resolveApprovalChain(moduleType, amount, requester) {
  // Get the user with hierarchy
  const requesterUser = await User.findOne({
    $or: [
      { id: requester?.id || requester?.userId },
      { email: requester?.email }
    ]
  }).lean();

  // Determine if financial review is needed
  const needsFinancialReview = amount >= FINANCIAL_REVIEW_THRESHOLD;
  const needsStrategicReview = amount >= STRATEGIC_REVIEW_THRESHOLD;

  // Build the approval chain
  let chain = [];

  // Step 1: Always start with Procurement Head (if not already)
  chain.push({
    step: 1,
    title: 'Procurement Head Approval',
    roleKey: 'procurement_head',
    statusKey: 'Pending Procurement Head Approval',
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