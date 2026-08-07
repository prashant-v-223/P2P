import { User } from '../models/User.js';

// ─────────────────────────────────────────────────────────────────────────────
// HIERARCHICAL APPROVAL ROUTING SERVICE
// ─────────────────────────────────────────────────────────────────────────────
// Central place that decides the ordered approval chain for a request based on:
//   • The submitter's role / hierarchy level
//   • The request amount (₹50,000 financial review, ₹2,00,000 strategic review)
//   • Self-approval prevention (skip the submitter's own level)
//   • EXIM / Purchase-Manager / Procurement-Head / CFO / MD special-casing
//
// Role keys are kept workflow-compatible with the existing Approval model and
// frontend journey labels (`procurement_head`, `finance`, `md`, `exim-manager`).
// `assignedApproverId` is populated with the exact user who must act at each
// step so routing is hierarchy-aware instead of role-string fuzzy matching.
// ─────────────────────────────────────────────────────────────────────────────

export const FINANCIAL_REVIEW_THRESHOLD = 50000;   // > ₹50,000  → CFO/finance review
export const STRATEGIC_REVIEW_THRESHOLD = 200000;  // > ₹2,00,000 → MD review

const normRole = (role = '') => String(role).toLowerCase().replace(/[\s_-]+/g, ' ').trim();

const isAnyRole = (role, ...targets) => targets.map(normRole).includes(normRole(role));

const amountIsAbove = (amount, threshold) => Number(amount) > threshold;

// Build a step object with a fresh statusKey and workflow-compatible keys.
function step(seq, roleKey, roleName, title) {
  return {
    step: seq,
    title: title || roleName,
    roleKey,
    roleName,
    approverType: 'role',
    allowSelfApproval: false,
    slaHours: 24,
    statusKey: `Pending ${title || roleName} Approval`
  };
}

async function findUserByRole(roleKey, { team = null, department = null } = {}) {
  const roleNorm = normRole(roleKey);
  const flatRole = roleNorm.replace(/\s+/g, '_');
  const regexes = [new RegExp(`^${flatRole.replace(/./g, (c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))}$`, 'i')];
  // Build a tolerant regex that matches both "procurement_head" and "procurement head"
  const looseRegex = new RegExp('^' + roleNorm.split(' ').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s_-]*') + '$', 'i');
  const query = { status: 'Active', $or: [{ role: { $regex: looseRegex } }, { role: { $regex: flatRole, $options: 'i' } }] };

  if (team) {
    const teamMatch = await User.findOne({ ...query, team }).lean();
    if (teamMatch) return teamMatch;
  }
  if (department) {
    const deptMatch = await User.findOne({ ...query, department }).lean();
    if (deptMatch) return deptMatch;
  }
  return User.findOne(query).lean();
}

async function findManagerOf(requester) {
  if (!requester?.managerId) return null;
  return User.findOne({ id: requester.managerId, status: 'Active' }).lean();
}

async function findProcurementHead() {
  return User.findOne({ status: 'Active', role: /procurement[\s_-]*head/i }).lean();
}

async function findCFO() {
  return User.findOne({ status: 'Active', role: /^cfo$/i }).lean();
}

async function findMD() {
  return User.findOne({ status: 'Active', role: /^md$/i }).lean();
}

async function findEximManager() {
  return User.findOne({ status: 'Active', role: /exim[\s_-]*manager/i }).lean();
}

// Resolve the actual approver users for a chain, attaching names/ids.
// `requestedById` is passed so self-approval can be blocked at the last step.
async function attachApprovers(steps, requester) {
  const hydrated = [];
  for (const s of steps) {
    const roleNorm = normRole(s.roleKey);
    let approver = null;

    if (roleNorm === 'manager') {
      approver = await findManagerOf(requester);
    } else if (roleNorm === 'procurement head') {
      approver = await findProcurementHead();
    } else if (roleNorm === 'cfo' || roleNorm === 'finance') {
      approver = await findCFO();
    } else if (roleNorm === 'md') {
      approver = await findMD();
    } else if (roleNorm === 'exim manager') {
      approver = await findEximManager();
    } else {
      approver = await findUserByRole(s.roleKey, { team: requester?.team, department: requester?.department });
    }

    // When the resolved approver is the requester (self), skip this step so it
    // stays non-actionable by the requester (self-approval prevention).
    const isSelf = approver?.id && requester?.id && approver.id === requester.id;
    hydrated.push({
      ...s,
      isSelfApproval: isSelf,
      assignedApproverId: isSelf ? null : (approver?.id || null),
      assignedApproverName: isSelf ? null : (approver?.name || null),
      assignedApproverRole: approver?.role || s.roleKey
    });
  }
  return hydrated;
}

/**
 * Determine the full ordered approval chain for a request.
 * @param {object} params
 * @param {object} params.requester  - The user submitting the request (lean doc).
 * @param {number} params.amount     - Request amount in INR.
 * @returns {Promise<Array>} Ordered steps with approver info.
 */
export async function resolveApprovalChain({ requester, amount }) {
  const numAmount = Number(amount) || 0;
  const role = normRole(requester?.role || '');
  const isManager = Boolean(requester?.isManager);
  const isExim = role.includes('exim') && !role.includes('manager');
  const isProcTeam = role === 'procurement' || role.includes('procurement');
  const reqRole = requester?.role;

  // ── MD / Director / Admin (Level 0) ──────────────────────────────────────
  // Skip all department levels. CFO review if above ₹50K, then MD self-approves.
  if (isAnyRole(reqRole, 'md', 'director', 'admin', 'superadmin')) {
    const steps = [];
    if (amountIsAbove(numAmount, FINANCIAL_REVIEW_THRESHOLD)) {
      steps.push(step(1, 'cfo', 'CFO', 'CFO Financial Review'));
    }
    steps.push(step(steps.length + 1, 'md', 'Managing Director', 'MD Final Approval'));
    return attachApprovers(steps, requester);
  }

  // ── CFO / Finance Head (Level 1) ─────────────────────────────────────────
  if (isAnyRole(reqRole, 'cfo', 'finance head', 'finance lead', 'finance')) {
    if (!amountIsAbove(numAmount, FINANCIAL_REVIEW_THRESHOLD)) {
      const steps = [step(1, 'finance', 'Finance', 'Finance Approval')];
      return attachApprovers(steps, requester);
    }
    const steps = [step(1, 'md', 'Managing Director', 'MD Executive Review')];
    return attachApprovers(steps, requester);
  }

  // ── Department Head — Procurement Head (Level 1) ─────────────────────────
  if (isAnyRole(reqRole, 'procurement head', 'procurement_head')) {
    if (!amountIsAbove(numAmount, FINANCIAL_REVIEW_THRESHOLD)) {
      const steps = [step(1, 'procurement_head', 'Procurement Head', 'Procurement Head Approval')];
      return attachApprovers(steps, requester);
    }
    const steps = [step(1, 'cfo', 'CFO', 'CFO Financial Review')];
    if (amountIsAbove(numAmount, STRATEGIC_REVIEW_THRESHOLD)) {
      steps.push(step(2, 'md', 'Managing Director', 'MD Strategic Review'));
    }
    return attachApprovers(steps, requester);
  }

  // ── EXIM Manager (Level 1) ───────────────────────────────────────────────
  if (isAnyRole(reqRole, 'exim manager', 'exim-manager')) {
    if (!amountIsAbove(numAmount, FINANCIAL_REVIEW_THRESHOLD)) {
      const steps = [step(1, 'exim-manager', 'EXIM Manager', 'EXIM Manager Approval')];
      return attachApprovers(steps, requester);
    }
    const steps = [step(1, 'cfo', 'CFO', 'CFO Financial Review')];
    if (amountIsAbove(numAmount, STRATEGIC_REVIEW_THRESHOLD)) {
      steps.push(step(2, 'md', 'Managing Director', 'MD Strategic Review'));
    }
    return attachApprovers(steps, requester);
  }

  // ── Purchase Manager (Level 2, isManager) ────────────────────────────────
  // Manager's own request skips their own level → starts at Procurement Head.
  if (isManager && isProcTeam) {
    const steps = [step(1, 'procurement_head', 'Procurement Head', 'Procurement Head Approval')];
    if (amountIsAbove(numAmount, FINANCIAL_REVIEW_THRESHOLD)) {
      steps.push(step(2, 'cfo', 'CFO', 'CFO Financial Review'));
    }
    if (amountIsAbove(numAmount, STRATEGIC_REVIEW_THRESHOLD)) {
      steps.push(step(3, 'md', 'Managing Director', 'MD Strategic Review'));
    }
    return attachApprovers(steps, requester);
  }

  // ── Standard team member (Level 2/3) ─────────────────────────────────────
  // Start at the direct manager (or EXIM manager for EXIM team).
  const steps = [];
  if (isExim) {
    steps.push(step(1, 'exim-manager', 'EXIM Manager', 'EXIM Manager Approval'));
  } else {
    steps.push(step(1, 'manager', 'Team Manager', 'Manager Approval'));
  }
  // Department head approval is ALWAYS required for procurement/EXIM requests.
  steps.push(step(2, 'procurement_head', 'Procurement Head', 'Procurement Head Approval'));
  if (amountIsAbove(numAmount, FINANCIAL_REVIEW_THRESHOLD)) {
    steps.push(step(3, 'cfo', 'CFO', 'CFO Financial Review'));
  }
  if (amountIsAbove(numAmount, STRATEGIC_REVIEW_THRESHOLD)) {
    steps.push(step(4, 'md', 'Managing Director', 'MD Strategic Review'));
  }
  return attachApprovers(steps, requester);
}

// ─────────────────────────────────────────────────────────────────────────────
// VISIBILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a Mongo filter that restricts which approvals a user may see.
 * Mirrors the ROLE-BASED VISIBILITY MATRIX from the spec.
 */
export function buildVisibilityFilter(user) {
  const role = normRole(user?.role || '');
  const isSuper = ['admin', 'superadmin', 'system admin', 'md', 'director', 'cfo'].some((r) => role.includes(r));

  // Executives see everything.
  if (isSuper || user?.canSeeAllRequests) return {};

  // Finance team see all requests above the financial review threshold.
  if (role.includes('finance')) {
    return { amountINR: { $gt: FINANCIAL_REVIEW_THRESHOLD } };
  }

  // Procurement Head sees all procurement requests.
  if (role === 'procurement head' || role.includes('procurement')) {
    return {};
  }

  // EXIM Manager sees only their team's requests.
  if (role.includes('exim') && role.includes('manager')) {
    return { requestedByTeam: user?.team || 'EXIM & Logistics' };
  }

  // Purchase Managers see only their own team's requests.
  if (user?.isManager && user?.team) {
    return { requestedByTeam: user.team };
  }

  // Team members / others see only their own requests.
  if (user?.id) {
    return { requestedById: user.id };
  }

  return {};
}

// ─────────────────────────────────────────────────────────────────────────────
// APPROVER RESOLUTION FOR NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the specific users who should be notified for the current active step
 * of an approval. Returns an array of user lean docs (never the requester).
 */
export async function resolveStepApprovers(requester, approval = {}) {
  const currentStep = Number(approval.currentStep) || 1;

  // If an explicit approver was assigned, notify exactly that person.
  if (approval.assignedApproverId) {
    const assigned = await User.findOne({ id: approval.assignedApproverId, status: 'Active' }).lean();
    if (assigned) return [assigned];
  }

  // Otherwise recompute the chain and pick the approver of the active step.
  const amount = Number(
    approval.amountINR
      ? String(approval.amountINR).replace(/[^0-9.-]+/g, '')
      : 0
  ) || 0;
  const chain = await resolveApprovalChain({ requester, amount });
  const activeStepObj = chain.find((s) => Number(s.step) === currentStep) || chain[0];
  if (!activeStepObj || !activeStepObj.assignedApproverId) return [];

  const approver = await User.findOne({ id: activeStepObj.assignedApproverId, status: 'Active' }).lean();
  if (!approver) return [];
  // Scream if the approver is the requester (self-approval).
  if (requester?.id && approver.id === requester.id) return [];
  return [approver];
}
