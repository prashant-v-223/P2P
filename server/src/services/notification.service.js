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

/**
 * Build an array of regex-safe role keyword variants for fuzzy matching.
 * e.g. "exim-manager" -> ["exim-manager", "exim manager", "exim"]
 *      "procurement_head" -> ["procurement_head", "procurement head", "procurement"]
 */
function buildRoleKeywords(roleKeyword) {
  const raw = String(roleKeyword || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!raw) return [];
  const variants = new Set([raw]);

  // Normalize separators: "exim-manager" == "exim_manager" == "exim manager" == "eximmanager"
  const hyphen = raw.replace(/[\s_]+/g, '-');
  const space = raw.replace(/[-_]+/g, ' ');
  const underscore = raw.replace(/[\s-]+/g, '_');
  const joined = raw.replace(/[\s_-]+/g, '');
  [hyphen, space, underscore, joined].forEach(v => variants.add(v));

  // Broader keywords — the first significant word usually maps to the team:
  // "exim-manager" -> "exim", "procurement_head" -> "procurement", "finance_lead" -> "finance"
  const firstWord = raw.split(/[\s_-]+/)[0];
  if (firstWord && firstWord.length >= 3) variants.add(firstWord);

  return Array.from(variants);
}

/** Find all active users whose role matches a keyword (with fuzzy fallback) */
async function getUsersForRole(roleKeyword) {
  if (!roleKeyword) return [];
  try {
    const keywords = buildRoleKeywords(roleKeyword);

    // 1) Exact / normalized match first (e.g. "exim-manager", "exim manager", "exim_manager")
    const exactRegexes = keywords.slice(0, 4).map(k => new RegExp(`^${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
    let users = await User.find({
      status: 'Active',
      role: { $in: exactRegexes }
    }).select('name email role').lean();

    // 2) Fuzzy "contains" match on the full role (e.g. "exim-manager" matches role "exim manager")
    if (!users.length) {
      const containsRegexes = keywords.slice(0, 4).map(k => new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
      users = await User.find({
        status: 'Active',
        role: { $in: containsRegexes }
      }).select('name email role').lean();
    }

    // 3) Fallback to the first-word team keyword (e.g. "exim", "procurement", "finance")
    if (!users.length && keywords.length > 4) {
      const teamWord = keywords[4];
      const teamRegex = new RegExp(`^${teamWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      users = await User.find({
        status: 'Active',
        role: { $in: [teamRegex] }
      }).select('name email role').lean();
    }

    // 4) Last resort — if no user has a matching role, include ALL active users
    //    so the approval request is never silently dropped.
    if (!users.length) {
      console.warn(`[notification] No user found with role "${roleKeyword}". Notifying all active users as fallback.`);
      users = await User.find({ status: 'Active' })
        .select('name email role').lean();
    }

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

    // Never send the approval email to the person who created the request
    const requesterName = String(approval.requestedBy || '').trim().toLowerCase();
    const requesterId = String(approval.requestedById || '').trim().toLowerCase();
    const recipients = approvers.filter(u => {
      const uname = String(u.name || '').trim().toLowerCase();
      const uemail = String(u.email || '').trim().toLowerCase();
      return uname !== requesterName && uemail !== requesterId;
    });
    if (!recipients.length) {
      console.warn(`[notification] All matching approvers for "${roleKey}" are the requester. Notifying all other active users.`);
      const fallback = (await User.find({ status: 'Active' }).select('name email role').lean())
        .filter(u => String(u.name || '').trim().toLowerCase() !== requesterName && String(u.email || '').trim().toLowerCase() !== requesterId);
      if (fallback.length) {
        await Promise.allSettled(
          fallback.map(u =>
            sendNewApprovalRequestEmail({
              to: u.email,
              name: u.name,
              approvalId: approval.id,
              type: approval.type || 'Payment Request',
              amount: approval.amountINR || approval.amountOriginal || '',
              vendorName: approval.vendorName || '',
              requestedBy: approval.requestedBy || 'Finance Team',
              stepTitle,
              stepNum: 1,
              totalSteps: steps.length,
            }).catch(e => console.warn('[notification] sendNewApprovalRequestEmail failed:', e.message))
          )
        );
      }
      return;
    }

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
      recipients.map(u =>
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
