// services/approvalRouting.service.js

import { User } from '../models/User.js';
import { Approval } from '../models/Approval.js';

// Constants for approval thresholds
export const FINANCIAL_REVIEW_THRESHOLD = 5000000; // ₹50 Lakhs
export const STRATEGIC_REVIEW_THRESHOLD = 10000000; // ₹1 Crore

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
    // Fallback: find any active user with required role
    return await attachFallbackApprovers(steps);
  }

  // Process each step
  const resolvedSteps = await Promise.all(
    steps.map(async (step, index) => {
      const roleKey = step.roleKey || step.roleName;
      const stepNumber = step.step || (index + 1);
      
      // Determine if this is a procurement head step
      const isProcurementHead = roleKey && (
        roleKey.toLowerCase().includes('procurement') ||
        roleKey.toLowerCase().includes('procurement_head')
      );

      // Determine if requester is Admin/System Admin
      const isAdmin = ['admin', 'system_admin', 'system admin', 'super_admin']
        .includes(requesterUser.role?.toLowerCase() || '');

      // Determine if requester is Procurement Head
      const isProcurementHeadUser = requesterUser.role?.toLowerCase().includes('procurement');

      let approver = null;

      // --- SCENARIO 1: Admin created request ---
      if (isAdmin && isProcurementHead) {
        // Admin request needs Procurement Head approval
        // Strategy: Find the MOST SUITABLE Procurement Head
        approver = await findBestProcurementHead(requesterUser);
      }
      // --- SCENARIO 2: Child user created request ---
      else if (requesterUser.managerId && isProcurementHead) {
        // Child user's request should go to their parent Procurement Head
        approver = await findParentManager(requesterUser, roleKey);
      }
      // --- SCENARIO 3: Procurement Head created request ---
      else if (isProcurementHeadUser && isProcurementHead) {
        // Procurement Head created request - route to another Head or escalate
        approver = await findPeerOrEscalate(requesterUser, roleKey);
      }
      // --- SCENARIO 4: Finance/Other roles ---
      else {
        approver = await findApproverByRole(requesterUser, roleKey);
      }

      // If no approver found, use fallback
      if (!approver) {
        approver = await findAnyUserWithRole(roleKey);
      }

      return {
        ...step,
        step: stepNumber,
        assignedApproverId: approver?.id || null,
        assignedApproverName: approver?.name || null,
        assignedApproverRole: approver?.role || roleKey,
        assignedApproverEmail: approver?.email || null,
        statusKey: step.statusKey || `Pending ${step.title || 'Approval'}`,
        // Add metadata for audit
        resolutionMethod: approver?.resolutionMethod || 'role_based',
        resolvedAt: new Date()
      };
    })
  );

  return resolvedSteps;
}

/**
 * Find the best Procurement Head based on various factors
 */
async function findBestProcurementHead(requester) {
  // Get all active procurement heads
  const allHeads = await User.find({
    role: { $in: ['procurement_head', 'Procurement Head', 'procurement'] },
    status: 'Active'
  }).lean();

  if (!allHeads || allHeads.length === 0) {
    return null;
  }

  // If only one head, return them
  if (allHeads.length === 1) {
    return { ...allHeads[0], resolutionMethod: 'single_head' };
  }

  // Strategy: Load balancing - pick head with least pending approvals
  const withPendingCount = await Promise.all(
    allHeads.map(async (head) => {
      const pendingCount = await Approval.countDocuments({
        $or: [
          { assignedApprover: head.id },
          { assignedApproverId: head.id },
          { assignedApproverName: head.name }
        ],
        status: { 
          $nin: ['Approved & Dispatched', 'Approved', 'Rejected', 'Completed'] 
        }
      });
      return { ...head, pendingCount };
    })
  );

  // Sort by pending count (ascending)
  const sorted = withPendingCount.sort((a, b) => a.pendingCount - b.pendingCount);
  
  // Return the one with least pending
  return { ...sorted[0], resolutionMethod: 'load_balanced' };
}

/**
 * Find the parent manager based on user's managerId
 */
async function findParentManager(requester, roleKey) {
  if (!requester.managerId) {
    return null;
  }

  // Find the manager
  const manager = await User.findOne({
    $or: [
      { id: requester.managerId },
      { userId: requester.managerId },
      { employeeId: requester.managerId }
    ],
    status: 'Active'
  }).lean();

  if (!manager) {
    return null;
  }

  // Check if manager has the required role
  const roleMatches = roleKey && (
    manager.role?.toLowerCase().includes(roleKey.toLowerCase()) ||
    manager.role?.toLowerCase().includes('procurement')
  );

  if (roleMatches) {
    return { ...manager, resolutionMethod: 'parent_manager' };
  }

  // If manager doesn't have the role, find the closest manager who does
  return await findApproverByRole(manager, roleKey);
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