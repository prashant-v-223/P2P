/**
 * notification.service.js  — Workflow-aware approval notification engine
 *
 * FLOW MATRIX:
 * ┌──────────────────────┬───────────────────────────────────────────────────┐
 * │ Event                │ Who gets notified                                 │
 * ├──────────────────────┼───────────────────────────────────────────────────┤
 * │ Request CREATED      │ Step-1 approvers by role (email + SSE)            │
 * │ Step N APPROVED      │ Step-(N+1) approvers by role + Requester progress │
 * │ FULLY APPROVED       │ Requester — "All clear, approved!"                │
 * │ REJECTED             │ Requester only — no further steps notified        │
 * │ RETURNED             │ Requester OR prev-step approver                   │
 * └──────────────────────┴───────────────────────────────────────────────────┘
 */

import { User } from '../models/User.js';
import {
  sendNewApprovalRequestEmail,
  sendStepProgressEmail,
  sendApprovalCompleteEmail,
  sendApprovalRejectedEmail,
  sendReturnedEmail,
  sendNextApproverEmail,
} from './mail.service.js';

// ─── User lookup helpers ───────────────────────────────────────────────────

/** Find all active users whose role matches a keyword */
async function getUsersForRole(roleKeyword) {
  if (!roleKeyword) return [];
  try {
    const regex = new RegExp(roleKeyword.replace(/[_\s-]+/g, '[_\\s\\-]+'), 'i');
    const users = await User.find({ status: 'Active', role: { $regex: regex } })
      .select('name email role').lean();
    return users;
  } catch (err) {
    console.warn('[notification] getUsersForRole error:', err.message);
    return [];
  }
}

/** Find a single user by their display name (the requestedBy field value) */
async function findRequesterUser(requestedBy) {
  if (!requestedBy) return null;
  try {
    // Exact match first
    let user = await User.findOne({ name: requestedBy, status: 'Active' })
      .select('name email role').lean();
    if (!user) {
      const rx = new RegExp(requestedBy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      user = await User.findOne({ name: { $regex: rx }, status: 'Active' })
        .select('name email role').lean();
    }
    return user;
  } catch (err) {
    console.warn('[notification] findRequesterUser error:', err.message);
    return null;
  }
}

/** Extract workflow steps array from the Approval document */
function parseWorkflowSteps(approval) {
  if (!approval.workflowSteps) return [];
  try {
    return JSON.parse(approval.workflowSteps).sort((a, b) => (a.step || 0) - (b.step || 0));
  } catch {
    return [];
  }
}

/** Return step-N object (1-based) from parsed steps */
function getStep(steps, stepNum) {
  return steps.find(s => s.step === stepNum) || steps[stepNum - 1] || null;
}

// ─── Fire-and-forget wrapper ───────────────────────────────────────────────
function fireAndForget(fn) {
  setImmediate(async () => {
    try { await fn(); }
    catch (err) { console.warn('[notification] fire-and-forget error:', err.message); }
  });
}

// ─── 1. New approval request CREATED ──────────────────────────────────────
/**
 * Called immediately after createApprovalRecord in p2pRoutes.
 * Notifies the first-step approvers that a new request needs their action.
 */
export async function sendApprovalCreatedEmails({ approval }) {
  fireAndForget(async () => {
    const steps = parseWorkflowSteps(approval);
    const step1 = steps[0];
    if (!step1) return;

    const roleKey = step1.roleKey || step1.roleName || '';
    const stepTitle = step1.title || step1.roleName || 'Approval';

    const approvers = await getUsersForRole(roleKey);
    if (!approvers.length) return;

    const meta = {
      approvalId: approval.id,
      type:       approval.type || 'Payment Request',
      amount:     approval.amountINR || approval.amountOriginal || '',
      vendorName: approval.vendorName || '',
      requestedBy: approval.requestedBy || 'Finance Team',
      stepTitle,
      stepNum: 1,
      totalSteps: steps.length,
    };

    await Promise.allSettled(
      approvers.map(u =>
        sendNewApprovalRequestEmail({ to: u.email, name: u.name, ...meta })
          .catch(e => console.warn('[notification] sendNewApprovalRequestEmail failed:', e.message))
      )
    );
  });
}

// ─── 2. Approval action (approve / reject / return) ───────────────────────
/**
 * Called after approval.save() in approvals.controller.
 * Routes emails to the right people based on the action taken.
 */
export async function sendApprovalEmails({ approval, action, newStatus, actingUser }) {
  fireAndForget(async () => {
    const steps     = parseWorkflowSteps(approval);
    const totalSteps = steps.length || approval.totalSteps || 2;
    const isFullyApproved = newStatus === 'Approved & Dispatched';
    const isRejected      = newStatus === 'Rejected';
    const isReturned      = newStatus === 'Returned for changes';
    const isAdvanced      = action === 'approve' && !isFullyApproved;

    const meta = {
      approvalId: approval.id,
      type:       approval.type || 'Payment Request',
      amount:     approval.amountINR || approval.amountOriginal || '',
      vendorName: approval.vendorName || '',
      actingUser,
    };

    // ── Always notify the requester about any action on their request ────
    const requester = await findRequesterUser(approval.requestedBy);

    if (requester?.email) {
      if (isFullyApproved) {
        await sendApprovalCompleteEmail({ to: requester.email, name: requester.name, ...meta, totalSteps })
          .catch(e => console.warn('[notification] sendApprovalCompleteEmail error:', e.message));

      } else if (isRejected) {
        const rejectedStep = getStep(steps, approval.currentStep);
        await sendApprovalRejectedEmail({
          to: requester.email,
          name: requester.name,
          ...meta,
          stepNum: approval.currentStep || 1,
          stepTitle: rejectedStep?.title || 'Approval',
          remarks: approval.remarks || '',
        }).catch(e => console.warn('[notification] sendApprovalRejectedEmail error:', e.message));

      } else if (isReturned) {
        await sendReturnedEmail({
          to: requester.email,
          name: requester.name,
          ...meta,
          remarks: approval.remarks || '',
        }).catch(e => console.warn('[notification] sendReturnedEmail error:', e.message));

      } else if (isAdvanced) {
        // Step N approved — tell requester about progress
        const completedStep = getStep(steps, (approval.currentStep || 2) - 1) || getStep(steps, 1);
        const nextStep      = getStep(steps, approval.currentStep);
        await sendStepProgressEmail({
          to: requester.email,
          name: requester.name,
          ...meta,
          completedStepNum:   completedStep?.step || (approval.currentStep - 1),
          completedStepTitle: completedStep?.title || 'Previous Step',
          nextStepNum:        nextStep?.step || approval.currentStep,
          nextStepTitle:      nextStep?.title || 'Next Approver',
          totalSteps,
        }).catch(e => console.warn('[notification] sendStepProgressEmail error:', e.message));
      }
    }

    // ── Notify next-step approvers when request advances ────────────────
    if (isAdvanced) {
      const nextStep = getStep(steps, approval.currentStep);
      const nextRoleKey = nextStep?.roleKey || nextStep?.roleName || '';
      if (nextRoleKey) {
        const nextApprovers = await getUsersForRole(nextRoleKey);
        await Promise.allSettled(
          nextApprovers.map(u =>
            sendNextApproverEmail({
              to: u.email,
              name: u.name,
              ...meta,
              stepTitle:   nextStep.title || nextRoleKey,
              stepNum:     nextStep.step,
              totalSteps,
              requestedBy: approval.requestedBy || 'Finance Team',
            }).catch(e => console.warn('[notification] sendNextApproverEmail error:', e.message))
          )
        );
      }
    }
  });
}
