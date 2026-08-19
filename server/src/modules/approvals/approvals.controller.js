import mongoose from 'mongoose';
import { Approval } from '../../models/Approval.js';
import { User } from '../../models/User.js';
import { sendApprovalEmails } from '../../services/notification.service.js';
import { broadcastEvent } from '../../services/sse.service.js';
import { postSettlementLedgerEntry } from '../../services/settlement.service.js';
import crypto from 'node:crypto';
import { WorkflowAudit } from '../../models/WorkflowAudit.js';

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const DUMMY_PENDING_APPROVALS = [
  {
    id: 'ADV-PAY-1001',
    type: 'Advance Payment',
    vendorName: 'Global Silicon Supplies',
    amountOriginal: '50000',
    amountINR: '50000',
    currency: 'INR',
    requestedBy: 'Neha Gupta',
    poReference: 'PO-2026-8801',
    currentStep: 1,
    totalSteps: 2,
    status: 'Pending Procurement Head Approval',
    submittedAt: new Date().toISOString(),
    remarks: '50% Advance for solar cell shipment'
  }
];

// ── Normalize Role Keys for Strict Hierarchical Matching ─────────────────────
function normalizeRoleKey(role = '') {
  return String(role || '').toLowerCase().replace(/[\s_-]+/g, '_').trim();
}

function isRoleMatchingStep(userRole, targetStepRole, allowAdminOverride = true) {
  const u = normalizeRoleKey(userRole);
  const t = normalizeRoleKey(targetStepRole);
  if (!u || !t) return false;

  // Exact match
  if (u === t) return true;

  // System Admin / Admin / Superadmin override
  if (allowAdminOverride && ['admin', 'superadmin', 'system_admin', 'systemadmin'].includes(u)) return true;

  // MD equivalences
  if ((t === 'md' || t.includes('director') || t.includes('managing_director')) &&
      (u === 'md' || u.includes('director') || u.includes('managing_director'))) return true;

  // CFO equivalences
  if ((t === 'cfo' || t === 'cfo_approval' || t === 'cfo_signoff') &&
      (u === 'cfo' || u === 'cfo_approval' || u === 'cfo_signoff')) return true;

  // CFO Inner / Account Finance equivalences
  if ((t.includes('cfo_inner') || t.includes('account_finance') || t.includes('accounts') || t === 'finance' || t.includes('finance_lead') || t.includes('finance_head')) &&
      (u.includes('cfo_inner') || u.includes('account_finance') || u.includes('accounts') || u === 'finance' || u.includes('finance_lead') || u.includes('finance_head') || u === 'cfo')) return true;

  // Purchase Head / Procurement Head equivalences
  if ((t.includes('procurement_head') || t.includes('procurement_lead') || t.includes('purchase_head') || t.includes('purchase_hod') || t.includes('procurement_hod')) && 
      (u.includes('procurement_head') || u.includes('procurement_lead') || u.includes('purchase_head') || u.includes('purchase_hod') || u.includes('procurement_hod'))) return true;

  // Purchase Manager / Procurement Manager equivalences
  if ((t.includes('procurement_manager') || t.includes('purchase_manager') || t === 'manager' || t.includes('team_manager')) &&
      (u.includes('procurement_manager') || u.includes('purchase_manager') || u.includes('manager') || u.includes('team_manager'))) return true;

  // Inner Team / Procurement Executive equivalences
  if ((t.includes('inner_team') || t.includes('procurement_executive') || t === 'procurement') &&
      (u.includes('inner_team') || u.includes('procurement_executive') || u === 'procurement')) return true;

  // EXIM Manager equivalences
  if (t.includes('exim') && u.includes('exim')) return true;

  // Logistics equivalences
  if (t.includes('logistics') && u.includes('logistics')) return true;

  return false;
}

// ── Strict Active-Step Role & Assigned Approver Matching ──────────────────────────
export function isApprovalForRole(approval, roleFilter, userId = null) {
  const roles = Array.isArray(roleFilter) ? roleFilter : [roleFilter];

  // 1. System Admins can view all requests
  const isSuperUser = roles.some(r => {
    const u = normalizeRoleKey(r);
    return ['admin', 'superadmin', 'system_admin', 'systemadmin'].includes(u);
  });

  // Self-approval prevention: Requester cannot approve their own request (unless superadmin)
  if (userId && (String(approval.requestedById) === String(userId) || String(approval.requestedBy) === String(userId)) && !isSuperUser) {
    return false;
  }

  // 2. Active Step check (from workflowSteps JSON)
  const currentStepNum = approval.currentStep || 1;
  let activeStepObj = null;

  if (approval.workflowSteps) {
    try {
      const steps = typeof approval.workflowSteps === 'string'
        ? JSON.parse(approval.workflowSteps)
        : approval.workflowSteps;
      if (Array.isArray(steps)) {
        activeStepObj = steps.find(s => (s.step || s.stepNumber) === currentStepNum);
      }
    } catch (_) {}
  }

  // 3. STRICT ASSIGNED APPROVER MATCHING:
  // If the active step or approval record has an explicit assignedApproverId (and is NOT pool approval),
  // ONLY that specific user ID (or superadmin) is authorized! Cross users are strictly blocked.
  const assignedId = activeStepObj?.assignedApproverId || approval.assignedApprover;
  const isPool = activeStepObj?.isPoolApproval;

  if (assignedId && !isPool) {
    if (userId && String(assignedId) === String(userId)) return true;
    return isSuperUser; // Strict isolation: cross-users with same role cannot act
  }

  // 4. POOL APPROVAL MATCHING:
  if (isPool) {
    if (activeStepObj?.approverPool && Array.isArray(activeStepObj.approverPool) && userId) {
      const inPool = activeStepObj.approverPool.some(p => String(p.id) === String(userId));
      if (inPool) return true;
    }
    const targetRole = activeStepObj?.roleKey || activeStepObj?.roleName || activeStepObj?.title || '';
    for (const r of roles) {
      if (isRoleMatchingStep(r, targetRole)) return true;
    }
    return isSuperUser;
  }

  // 5. UNASSIGNED STEP ROLE MATCHING:
  if (activeStepObj) {
    const targetRole = activeStepObj.roleKey || activeStepObj.roleName || activeStepObj.title || '';
    for (const r of roles) {
      if (isRoleMatchingStep(r, targetRole)) return true;
    }
    return isSuperUser;
  }

  // Fallback: infer from approval.status string (e.g. "Pending Purchase Manager Approval")
  const statusLower = (approval.status || '').toLowerCase();
  for (const r of roles) {
    const u = normalizeRoleKey(r);
    if (isSuperUser) return true;
    if (statusLower.includes('purchase manager') && (u.includes('purchase_manager') || u.includes('procurement_manager') || u === 'manager')) return true;
    if (statusLower.includes('procurement head') && (u.includes('procurement_head') || u.includes('procurement_lead'))) return true;
    if (statusLower.includes('procurement manager') && (u.includes('procurement_manager') || u === 'manager')) return true;
    if (statusLower.includes('finance') && (u.includes('finance') || u.includes('cfo'))) return true;
    if (statusLower.includes('md') && (u === 'md' || u.includes('director'))) return true;
    if (statusLower.includes('exim') && u.includes('exim')) return true;
    if (statusLower.includes('logistics') && u.includes('logistics')) return true;
  }

  return isSuperUser;
}

// ── Advance to next step using stored workflowSteps JSON ─────────────────────
function getNextStepStatus(approval) {
  if (approval.workflowSteps) {
    try {
      const steps = typeof approval.workflowSteps === 'string' ? JSON.parse(approval.workflowSteps) : approval.workflowSteps;
      if (Array.isArray(steps) && steps.length > 0) {
        const sorted = steps.sort((a, b) => (a.step || 0) - (b.step || 0));
        const currentStepNum = approval.currentStep || 1;
        const currentIdx = sorted.findIndex(s => (s.step || s.stepNumber) === currentStepNum);
        if (currentIdx >= 0 && currentIdx < sorted.length - 1) {
          const nextStep = sorted[currentIdx + 1];
          return nextStep.statusKey || `Pending ${nextStep.title || nextStep.roleName || 'Approval'}`;
        }
        return 'Approved & Dispatched';
      }
    } catch (e) {
      console.error('[getNextStepStatus] parse error:', e.message);
    }
  }

  const NEXT_STEP = {
    'Pending Purchase Manager Approval': 'Approved & Dispatched',  // New default single-step flow
    'Pending Procurement Head Approval': 'Approved & Dispatched',  // Legacy fallback
    'Pending Finance Approval':          'Approved & Dispatched'
  };
  return NEXT_STEP[approval.status] || 'Approved & Dispatched';
}

// ── Helper: determine which role should act on the current step ───────────
function getCurrentStepRole(approval) {
  const status = approval.status || '';
  const statusLower = status.toLowerCase();

  // Try workflowSteps first
  if (approval.workflowSteps) {
    try {
      const steps = typeof approval.workflowSteps === 'string' ? JSON.parse(approval.workflowSteps) : approval.workflowSteps;
      if (Array.isArray(steps)) {
        const activeStepObj = steps.find(s => (s.step || s.stepNumber) === (approval.currentStep || 1));
        if (activeStepObj) {
          return (activeStepObj.roleName || activeStepObj.roleKey || activeStepObj.title || '').toLowerCase();
        }
      }
    } catch (_) {}
  }

  // Fallback: infer from status string
  if (statusLower.includes('purchase manager')) return 'purchase manager';
  if (statusLower.includes('procurement head')) return 'procurement head';
  if (statusLower.includes('procurement manager')) return 'procurement manager';
  if (statusLower.includes('procurement')) return 'purchase manager';
  if (statusLower.includes('finance')) return 'finance';
  if (statusLower.includes('md') || statusLower.includes('director')) return 'md';
  if (statusLower.includes('exim')) return 'exim';
  if (statusLower.includes('logistics')) return 'logistics';
  return '';
}

async function getStepAssignment(approval, stepNumber) {
  let stepObj = null;
  try {
    const steps = typeof approval.workflowSteps === 'string'
      ? JSON.parse(approval.workflowSteps || '[]')
      : (approval.workflowSteps || []);
    if (Array.isArray(steps)) {
      stepObj = steps.find((item) => (item.step || item.stepNumber) === stepNumber);
    }
  } catch (_) {}

  // Pool approval step → reuse pool names from stepObj
  if (stepObj?.isPoolApproval) {
    return {
      assignedApprover: null,
      assignedApproverName: stepObj.assignedApproverName || null,
      assignedApproverRole: stepObj.assignedApproverRole || stepObj.roleKey || null
    };
  }

  // Single approver was hydrated at creation time → reuse it
  if (stepObj?.assignedApproverId) {
    return {
      assignedApprover: stepObj.assignedApproverId,
      assignedApproverName: stepObj.assignedApproverName || null,
      assignedApproverRole: stepObj.assignedApproverRole || stepObj.roleKey || null
    };
  }

  // Derive role from step
  const role = String(stepObj?.roleKey || stepObj?.roleName || '').replace(/[\s-]+/g, '_').toLowerCase();

  // Finance / CFO / MD steps → no explicit user assignment needed (role-based)
  if (!role || role.includes('finance') || role === 'md' || role.includes('director') || role.includes('cfo')) {
    return { assignedApprover: null, assignedApproverName: null, assignedApproverRole: role || null };
  }

  // Manager step: find requester's direct manager
  if (role === 'manager' || role.includes('team_manager') || role.includes('procurement_manager')) {
    if (approval.requestedById) {
      const requester = await User.findOne(
        { id: approval.requestedById },
        { id: 1, name: 1, role: 1, managerId: 1, managerName: 1, team: 1 }
      ).lean();
      if (requester?.managerId) {
        const manager = await User.findOne(
          { id: requester.managerId, status: 'Active' },
          { id: 1, name: 1, role: 1 }
        ).lean();
        if (manager) {
          return {
            assignedApprover: manager.id,
            assignedApproverName: manager.name,
            assignedApproverRole: manager.role || role
          };
        }
      }
      if (requester?.team) {
        const teamManager = await User.findOne(
          { status: 'Active', team: requester.team, isManager: true },
          { id: 1, name: 1, role: 1 }
        ).lean();
        if (teamManager) {
          return {
            assignedApprover: teamManager.id,
            assignedApproverName: teamManager.name,
            assignedApproverRole: teamManager.role || role
          };
        }
      }
    }
    return { assignedApprover: null, assignedApproverName: null, assignedApproverRole: role || null };
  }

  // Procurement Head / EXIM Manager step
  const PH_REGEX = /procurement[\s_-]*head/i;
  if (PH_REGEX.test(role) || role.includes('exim')) {
    const manager = await User.findOne(
      { status: 'Active', role: PH_REGEX },
      { id: 1, name: 1, role: 1 }
    ).lean();
    return {
      assignedApprover: manager?.id || null,
      assignedApproverName: manager?.name || null,
      assignedApproverRole: manager?.role || role
    };
  }

  return { assignedApprover: null, assignedApproverName: null, assignedApproverRole: role || null };
}

// ── Check if user role(s) can act on current step ────────────────────────────
function canActOnStep(userRole, approval, userId = null) {
  return isApprovalForRole(approval, userRole, userId);
}

// ── GET /api/approvals/pending ───────────────────────────────────────────────
export const getPendingApprovals = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const size = Math.min(100, Math.max(1, Number.parseInt(req.query.size, 10) || 10));
    const query = String(req.query.q || '').trim();
    const type = String(req.query.type || '').trim();

    if (mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        count: DUMMY_PENDING_APPROVALS.length,
        total: DUMMY_PENDING_APPROVALS.length,
        page: 1,
        size,
        totalPages: 1,
        hasPrevious: false,
        hasNext: false,
        approvals: DUMMY_PENDING_APPROVALS
      });
    }

    // Primary role from JWT
    const primaryRole = String(req.user?.role || '').trim();
    const effectiveRoles = [primaryRole];
    const delegatorMap = {}; // role -> array of delegator users

    // Find all users who delegated to this user (so both delegator and delegate can see & act)
    if (req.user?.id) {
      const delegators = await User.find({ parentUserId: req.user.id, status: 'Active' }, { id: 1, name: 1, email: 1, role: 1, delegationActive: 1, delegationNote: 1 }).lean();
      for (const d of delegators) {
        if (d.role) {
          if (!effectiveRoles.includes(d.role)) effectiveRoles.push(d.role);
          if (!delegatorMap[d.role]) delegatorMap[d.role] = [];
          delegatorMap[d.role].push(d);
        }
      }
    }

    const TERMINAL = ['Approved & Dispatched', 'Rejected', 'Returned for changes'];
    const filter = { status: { $nin: TERMINAL } };

    if (type && type !== 'All') filter.type = type;
    if (query) {
      const matcher = new RegExp(escapeRegex(query), 'i');
      const orConditions = [
        { id:          matcher },
        { type:        matcher },
        { vendorName:  matcher },
        { requestedBy: matcher },
        { currentSlab: matcher },
        { poReference: matcher }
      ];
      if (!isNaN(Number(query))) {
        orConditions.push({ amountINR: Number(query) });
      }
      filter.$or = orConditions;
    }

    const sort = req.query.sort === 'oldest'
      ? { submittedAt: 1, createdAt: 1 }
      : { submittedAt: -1, createdAt: -1 };

    let allApprovals = await Approval.find(filter).sort(sort).lean();

    // ── Role-based filtering across effectiveRoles ─────────────────────────
    const isSuperUser = effectiveRoles.some((r) => {
      const rNorm = r.toLowerCase().replace(/[\s_-]+/g, ' ').trim();
      return rNorm === 'admin' || rNorm.replace(/\s+/g, '') === 'systemadmin';
    });

    // Primary user ID
    const currentUserId = req.user?.id || req.user?.userId;

    // Actionable items specifically assigned to user's role step or direct assignment
    const actionableApprovals = allApprovals.filter(a => isApprovalForRole(a, effectiveRoles, currentUserId));
    const actionableCount = actionableApprovals.length;
    const allCount = allApprovals.length;

    const scope = String(req.query.scope || (isSuperUser ? 'all' : 'actionable')).toLowerCase().trim();
    let approvals = (scope === 'actionable' || req.query.actionableOnly === 'true') ? actionableApprovals : allApprovals;

    if (!isSuperUser && scope !== 'all') {
      approvals = approvals.filter(a => isApprovalForRole(a, effectiveRoles, currentUserId));
    }

    // ── Self-submission exclusion ────────────────────────────────────────
    const currentUserName  = (req.query.me  || '').toLowerCase().trim();
    const currentUserEmail = (req.query.meEmail || '').toLowerCase().trim();

    if (req.query.excludeSelf === 'true' && (currentUserName || currentUserEmail)) {
      approvals = approvals.filter(a => {
        const submitter = (a.requestedBy || '').toLowerCase().trim();
        if (!submitter) return true;
        const matchesName  = currentUserName  && submitter === currentUserName;
        const matchesEmail = currentUserEmail && (submitter === currentUserEmail || submitter === currentUserEmail.split('@')[0]);
        return !matchesName && !matchesEmail;
      });
    }

    const total      = (scope === 'actionable' || req.query.actionableOnly === 'true') ? actionableCount : approvals.length;
    const totalPages = Math.max(1, Math.ceil(approvals.length / size));
    const safePage   = Math.min(page, totalPages);
    const paginated  = approvals.slice((safePage - 1) * size, safePage * size);

    const enriched = paginated.map(a => {
      let parsedSteps = null;
      if (a.workflowSteps) {
        try { parsedSteps = typeof a.workflowSteps === 'string' ? JSON.parse(a.workflowSteps) : a.workflowSteps; } catch (_) {}
      }
      const stepRole = getCurrentStepRole(a);
      // Check if this approval was matched via delegation
      let matchedDelegator = null;
      if (delegatorMap[stepRole] && !isApprovalForRole(a, primaryRole, currentUserId)) {
        matchedDelegator = delegatorMap[stepRole][0];
      }

      const isUserTurnToApprove = isApprovalForRole(a, effectiveRoles, currentUserId);

      return {
        ...a,
        amountFormatted:  a.amountFormatted || `INR ${(a.amountINR || 0).toLocaleString('en-IN')}`,
        workflowId:       a.workflowId || 'WF-STD-001',
        workflowCode:     a.workflowCode || 'WF-STD',
        workflowVersion:  a.workflowVersion || 1,
        delegationActive: !!matchedDelegator,
        delegatorName:    matchedDelegator?.name || null,
        delegatorEmail:   matchedDelegator?.email || null,
        delegatorRole:    matchedDelegator?.role || null,
        parsedSteps,
        currentStepRole: stepRole,
        isUserTurnToApprove,
        delegatedFrom: matchedDelegator ? {
          id: matchedDelegator.id,
          name: matchedDelegator.name,
          role: matchedDelegator.role,
          note: matchedDelegator.delegationNote
        } : null
      };
    });

    return res.json({
      success: true,
      count:      enriched.length,
      total,
      page:       safePage,
      size,
      totalPages,
      hasPrevious: safePage > 1,
      hasNext:     safePage < totalPages,
      approvals:  enriched
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Helper to resolve previous step for multi-level Return ───────────────
function getPreviousStepInfo(approval) {
  const currentStep = approval.currentStep || 1;
  if (currentStep <= 1) {
    return { stepNum: 1, statusKey: 'Returned for changes', toRequester: true };
  }

  const prevStepNum = currentStep - 1;
  let prevStatusKey = 'Pending Procurement Head Approval';

  if (approval.workflowSteps) {
    try {
      const steps = JSON.parse(approval.workflowSteps);
      const prevStepObj = steps.find(s => s.step === prevStepNum);
      if (prevStepObj) {
        prevStatusKey = prevStepObj.statusKey || `Pending ${prevStepObj.title}`;
      }
    } catch (_) {}
  }

  return { stepNum: prevStepNum, statusKey: prevStatusKey, toRequester: false };
}

// ── POST /api/approvals/:id/action ───────────────────────────────────────────
export const processApprovalAction = async (req, res) => {
  try {
    const rawAction = (req.body.action || '').toLowerCase();
    if (!['approve', 'return', 'reject'].includes(rawAction)) {
      return res.status(400).json({ success: false, error: 'Action must be Approve, Return, or Reject.' });
    }

    let approval = await Approval.findOne({
      $or: [
        { id: req.params.id },
        { referenceId: req.params.id },
        { referenceNumber: req.params.id },
        { 'transactionSnapshot.rfqId': req.params.id }
      ]
    }).sort({ createdAt: -1 });

    if (!approval) {
      const { RfqHeader } = await import('../../models/RfqLogistics.js');
      const rfq = await RfqHeader.findOne({ $or: [{ rfqId: req.params.id }, { rfqNumber: req.params.id }] }).lean();
      if (rfq?.awardApprovalId) {
        approval = await Approval.findOne({ id: rfq.awardApprovalId });
      }
    }

    if (!approval) {
      return res.status(404).json({ success: false, error: 'Approval not found.' });
    }
    if (['Approved & Dispatched', 'Rejected', 'Cancelled'].includes(approval.status)) return res.status(409).json({ success: false, error: `This request is already ${approval.status.toLowerCase()}.` });

    // ── Role Authorization Check with Effective Delegated Roles ───────────
    const actingUserId = req.user?.id || req.user?.userId || req.user?.email;
    const actingUser = req.user?.name || req.user?.email || actingUserId;
    const primaryRole = req.user?.role || '';
    const actingRole = primaryRole; // The role of the user performing the action
    
    if (!actingUserId) return res.status(401).json({ success: false, error: 'A verified user identity is required.' });
    
    if (['reject', 'return'].includes(rawAction) && !String(req.body.remarks || '').trim()) return res.status(400).json({ success: false, error: 'A reason is required when returning or rejecting a request.' });
    const idempotencyKey = String(req.headers['idempotency-key'] || req.body.idempotencyKey || '').trim();
    if (idempotencyKey && approval.actionHistory?.some((record) => record.idempotencyKey === idempotencyKey)) return res.json({ success: true, message: 'This approval action was already processed.', data: { id: approval.id, status: approval.status, currentStep: approval.currentStep, actionHistory: approval.actionHistory } });

    // Gather user's effective roles (own role + delegated roles)
    const effectiveRoles = [primaryRole];
    if (req.user?.id) {
      const delegators = await User.find({ parentUserId: req.user.id, status: 'Active' }, { role: 1 }).lean();
      for (const d of delegators) {
        if (d.role && !effectiveRoles.includes(d.role)) effectiveRoles.push(d.role);
      }
    }

    const isAssignedApprover = approval.assignedApprover && approval.assignedApprover === actingUserId;
    if (!isAssignedApprover && !canActOnStep(effectiveRoles, approval, actingUserId)) {
      const requiredRole = getCurrentStepRole(approval);
      return res.status(403).json({
        success: false,
        error: `Access denied. This step requires "${requiredRole}" role. Your role is "${primaryRole}".`,
        requiredRole,
        yourRole: primaryRole
      });
    }

    // ── Compute new status ────────────────────────────────────────────────
    let newStatus;
    let newStep = approval.currentStep || 1;

    if (rawAction === 'approve') {
      newStatus = getNextStepStatus(approval);
      const isFullyApproved = newStatus === 'Approved & Dispatched';
      if (!isFullyApproved) newStep = (approval.currentStep || 1) + 1;
    } else if (rawAction === 'return') {
      const prevInfo = getPreviousStepInfo(approval);
      newStatus = prevInfo.statusKey;
      newStep   = prevInfo.stepNum;
    } else {
      newStatus = 'Rejected';
    }

    const nextAssignment = ['Approved & Dispatched', 'Rejected'].includes(newStatus)
      ? { assignedApprover: null, assignedApproverName: null, assignedApproverRole: null }
      : await getStepAssignment(approval, newStep);

    const actionRemarks = (req.body.remarks || '').trim() || `${rawAction.charAt(0).toUpperCase() + rawAction.slice(1)} by ${actingUser}`;

    // ── Audit History Log ─────────────────────────────────────────────────
    const previousState = { status: approval.status, currentStep: approval.currentStep, version: approval.version || 0 };
    const actionRecord = {
      action:         rawAction,
      step:           approval.currentStep || 1,
      statusAtAction: newStatus,
      role:           actingRole,
      actionedBy:     actingUser,
      actionedAt:     new Date(),
      remarks:        actionRemarks,
      idempotencyKey: idempotencyKey || undefined
    };

    const expectedVersion = Number(approval.version || 0);
    const actionTime = new Date();
    approval = await Approval.findOneAndUpdate(
      { _id: approval._id, version: expectedVersion, status: previousState.status, currentStep: previousState.currentStep },
      {
        $set: { status: newStatus, currentStep: newStep, remarks: actionRemarks, actionedBy: actingUser, actionedAt: actionTime, ...nextAssignment, ...(['Approved & Dispatched', 'Rejected'].includes(newStatus) ? { completedAt: actionTime } : {}) },
        $inc: { version: 1 },
        $push: { actionHistory: actionRecord }
      },
      { new: true, runValidators: true }
    );
    if (!approval) return res.status(409).json({ success: false, error: 'This approval changed while you were reviewing it. Refresh and try again.' });
    await WorkflowAudit.create({ eventId: `wa-${crypto.randomUUID()}`, eventType: `APPROVAL_${rawAction.toUpperCase()}`, actorId: actingUserId, actorName: actingUser, actorRole: actingRole, entityType: approval.type, entityId: approval.id, workflowId: approval.workflowId, workflowVersion: approval.workflowVersion || 1, step: actionRecord.step, action: rawAction, previousState, newState: { status: newStatus, currentStep: newStep, version: approval.version }, reason: actionRemarks, requestId: req.headers['x-request-id'], source: req.headers['x-client-source'] || 'web' });

    // ── Fire-and-forget email notifications ───────────────────────────────
    sendApprovalEmails({ approval: approval.toObject(), action: rawAction, newStatus, actingUser });

    // ── Real-time SSE broadcast to all connected clients ─────────────────
    broadcastEvent('APPROVAL_ACTION', {
      approvalId:   approval.id,
      action:       rawAction,          // 'approve' | 'reject' | 'return'
      newStatus,
      actingUser,
      actingRole,
      requestedBy:  approval.requestedBy,
      approvalType: approval.type,
      amount:       approval.amountINR || approval.amountOriginal || '',
      vendorName:   approval.vendorName || '',
      isFullyApproved: newStatus === 'Approved & Dispatched',
      isRejected:      newStatus === 'Rejected',
      isReturned:      newStatus === 'Returned for changes',
    });

    // ── Sync child model status ───────────────────────────────────────────
    const terminalMap = (s) =>
      s === 'Approved & Dispatched' ? 'approved' :
      s === 'Rejected'              ? 'rejected' :
      s === 'Returned for changes'  ? 'returned' :
      'pending';

    if (approval.type === 'Advance Payment') {
      try {
        const { AdvancePayment } = await import('../../models/AdvancePayment.js');
        await AdvancePayment.findOneAndUpdate({ advanceId: approval.id }, { status: terminalMap(newStatus) });
      } catch (e) {
        console.error('[Approvals] Sync AdvancePayment failed:', e.message);
      }
    } else if (approval.type === 'Invoice Payment') {
      try {
        const { InvoicePayment } = await import('../../models/InvoicePayment.js');
        await InvoicePayment.findOneAndUpdate({ invoicePaymentId: approval.id }, { status: terminalMap(newStatus) });
      } catch (e) {
        console.error('[Approvals] Sync InvoicePayment failed:', e.message);
      }
    } else if (['Logistics Payment', 'BL Freight Invoice', 'Logistics Payments'].includes(approval.type)) {
      try {
        const { LogisticsPayment } = await import('../../models/LogisticsPayment.js');
        const refId = approval.referenceId || approval.id;
        await LogisticsPayment.findOneAndUpdate(
          { $or: [{ logisticsPaymentId: refId }, { referenceNumber: refId }] },
          { status: terminalMap(newStatus), currentStep: nextStepIndex + 1 }
        );
      } catch (e) {
        console.error('[Approvals] Sync LogisticsPayment failed:', e.message);
      }
    } else if (['Custom Duty', 'Customs Duty'].includes(approval.type)) {
      try {
        const { CustomDutyPayment } = await import('../../models/CustomDutyPayment.js');
        const refId = approval.referenceId || approval.id;
        await CustomDutyPayment.findOneAndUpdate(
          { $or: [{ dutyId: refId }, { _id: refId.match(/^[0-9a-fA-F]{24}$/) ? refId : null }] },
          { status: terminalMap(newStatus) }
        );
      } catch (e) {
        console.error('[Approvals] Sync CustomDutyPayment failed:', e.message);
      }
    } else if (['RFQ Vendor Award', 'Freight RFQ', 'RFQ'].includes(approval.type)) {
      try {
        const { RfqHeader, RfqQuote } = await import('../../models/RfqLogistics.js');
        // Look up via transactionSnapshot.rfqId (most reliable), referenceNumber, or awardApprovalId
        const rfqId = approval.transactionSnapshot?.rfqId || approval.referenceNumber || approval.id;
        const rfq = await RfqHeader.findOne({
          $or: [
            { rfqId },
            { rfqNumber: rfqId },
            { awardApprovalId: approval.id },
            { awardApprovalId: rfqId }
          ]
        });
        if (rfq) {
          if (newStatus === 'Approved & Dispatched') {
            // Newly approved allocations for this specific approval cycle
            const newlyApproved = (approval.allocations || []).map(a => ({
              ...a,
              approved: true,
              cycleApprovalId: approval.id
            }));
            const totalQty = Number(rfq.totalQuantity) || Number(rfq.cargoDetails?.containerCount) || 1;

            // Preserve all previously approved allocations from prior cycles
            const existingAllocations = Array.isArray(rfq.awardAllocations) ? rfq.awardAllocations : [];
            const isReassignment = Boolean(approval.transactionSnapshot?.isReassignment);
            const alreadyApproved = isReassignment ? [] : existingAllocations.filter(a => a.approved === true);
            const otherPending = existingAllocations.filter(a => a.approved !== true && a.cycleApprovalId !== approval.id);

            const mergedAllocations = [...alreadyApproved, ...newlyApproved, ...otherPending];

            const totalAllocated = mergedAllocations.filter(a => a.approved === true).reduce((sum, a) => sum + (Number(a.containers) || 0), 0);
            const remainingQty = Math.max(0, totalQty - totalAllocated);

            rfq.allocatedQuantity = totalAllocated;
            rfq.pendingAllocation = remainingQty;
            rfq.status = remainingQty === 0 ? 'awarded' : totalAllocated > 0 ? 'partially_awarded' : 'published';
            rfq.set('awardAllocations', mergedAllocations);
            rfq.awardedVendorId = mergedAllocations.filter(a => a.approved).map(a => a.vendorId).join(',');
            rfq.awardedVendorName = mergedAllocations.filter(a => a.approved).map(a => a.vendorName).join(', ');
            rfq.awardedQuoteId = mergedAllocations.filter(a => a.approved).map(a => a.quoteId).join(',');

            await Promise.all(newlyApproved.map(item => RfqQuote.updateOne({ quoteId: item.quoteId }, { status: 'awarded' })));
            newlyApproved.forEach(item => broadcastEvent('RFQ_AWARDED', { rfqId: rfq.rfqId, rfqNumber: rfq.rfqNumber, vendorId: item.vendorId, vendorName: item.vendorName, containers: item.containers, awardedAt: new Date(), isPartial: remainingQty > 0 }));
          } else if (newStatus === 'Rejected' || newStatus === 'Returned for changes') {
            // On reject/return: revert pending allocations, restore status to prior approved state
            const existingAllocations = Array.isArray(rfq.awardAllocations) ? rfq.awardAllocations : [];
            const approvedAllocations = existingAllocations.filter(a => a.approved === true);
            const currentApprovedQty = approvedAllocations.reduce((sum, a) => sum + (Number(a.containers) || 0), 0);
            const totalQty = Number(rfq.totalQuantity) || Number(rfq.cargoDetails?.containerCount) || 1;
            rfq.allocatedQuantity = currentApprovedQty;
            rfq.pendingAllocation = Math.max(0, totalQty - currentApprovedQty);
            rfq.status = currentApprovedQty >= totalQty ? 'awarded' : currentApprovedQty > 0 ? 'partially_awarded' : 'published';
            // Remove pending (non-approved) allocations on reject/return
            rfq.set('awardAllocations', approvedAllocations);
          }
          await rfq.save();
        }
      } catch (e) {
        console.error('[Approvals] Sync RFQ Vendor Award failed:', e.message);
      }
    } else if (approval.type === 'BL Freight Invoice' || approval.entityType === 'LogisticsPayment') {
      try {
        const { LogisticsPayment } = await import('../../models/LogisticsPayment.js');
        const nextStatus = newStatus === 'Approved & Dispatched' ? 'Approved' : newStatus === 'Rejected' ? 'Rejected' : newStatus === 'Returned for changes' ? 'Returned' : newStatus;
        await LogisticsPayment.findOneAndUpdate(
          { $or: [{ logisticsPaymentId: approval.id }, { referenceNumber: approval.referenceNumber || approval.id }] },
          { status: nextStatus, currentStep: newStep }
        );
      } catch (e) {
        console.error('[Approvals] Sync LogisticsPayment failed:', e.message);
      }
    } else if (approval.type === 'Custom Duty') {
      try {
        const { CustomDutyPayment } = await import('../../models/CustomDutyPayment.js');
        await CustomDutyPayment.findOneAndUpdate(
          { $or: [{ dutyId: approval.id }, { blNumber: approval.poReference }, { approvalInstanceId: approval._id }] },
          { status: terminalMap(newStatus) }
        );
      } catch (e) {
        console.error('[Approvals] Sync CustomDutyPayment failed:', e.message);
      }
    }

    const isFullyApproved = newStatus === 'Approved & Dispatched';
    if (isFullyApproved) {
      await postSettlementLedgerEntry({ approval, actingUser });
    }

    const label =
      rawAction === 'approve' ? (isFullyApproved ? 'fully approved' : 'advanced to next step') :
      rawAction === 'return'  ? 'returned for changes' :
      'rejected';

    return res.json({
      success: true,
      message: `Request ${label}.`,
      data: {
        id:          approval.id,
        status:      approval.status,
        currentStep: approval.currentStep,
        actionHistory: approval.actionHistory
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET /api/approvals/:id ───────────────────────────────────────────────────
export const getApprovalById = async (req, res) => {
  try {
    const { id } = req.params;
    const matcher = new RegExp(escapeRegex(id), 'i');

    let approval = await Approval.findOne({
      $or: [
        { id }, 
        { id: matcher }, 
        { referenceNumber: id }, 
        { referenceNumber: matcher },
        { 'transactionSnapshot.rfqId': id },
        { 'transactionSnapshot.rfqId': matcher }
      ]
    }).sort({ createdAt: -1 }).lean();

    if (!approval) {
      const { InvoicePayment } = await import('../../models/InvoicePayment.js');
      const { AdvancePayment } = await import('../../models/AdvancePayment.js');
      const { RfqHeader } = await import('../../models/RfqLogistics.js');
      const { PurchaseOrder } = await import('../../models/PurchaseOrder.js');
      const { Vendor } = await import('../../models/Vendor.js');

      const [inv, adv, rfq, po, vendor] = await Promise.all([
        InvoicePayment.findOne({ $or: [{ invoicePaymentId: id }, { invoiceNumber: id }] }).lean().catch(() => null),
        AdvancePayment.findOne({ $or: [{ advanceId: id }] }).lean().catch(() => null),
        RfqHeader.findOne({ $or: [{ rfqId: id }, { rfqNumber: id }] }).lean().catch(() => null),
        PurchaseOrder.findOne({ $or: [{ poNumber: id }, { sapPoNumber: id }] }).lean().catch(() => null),
        Vendor.findOne({ $or: [{ id }, { sapVendorCode: id }] }).lean().catch(() => null)
      ]);

      if (rfq && rfq.awardApprovalId) {
        approval = await Approval.findOne({ id: rfq.awardApprovalId }).lean();
        if (approval) {
          return res.json({ success: true, approval });
        }
      }

      const rawStatus = (inv?.status || adv?.status || rfq?.status || po?.status || '').toLowerCase();

      // If no approval document exists and the underlying record is in published, draft, open, or created status, return null
      if (!inv && !adv && !rfq && !po && !vendor) {
        return res.json({ success: true, approval: null });
      }

      if (['published', 'draft', 'open', 'created'].includes(rawStatus)) {
        return res.json({ success: true, approval: null });
      }

      const recordType = inv ? 'Invoice Payment' : adv ? 'Advance Payment' : rfq ? 'Freight RFQ' : po ? 'Purchase Order' : vendor ? 'Vendor Account' : 'Approval Workflow';
      const vendorName = inv?.vendorName || adv?.vendorName || rfq?.title || po?.vendorName || vendor?.companyName || 'Vendor';
      const poRef = inv?.sapPoNumber || inv?.poId || adv?.sapPoNumber || adv?.poId || rfq?.linkedPoId || po?.poNumber || '';
      const amountVal = inv?.netPayable || adv?.amount || po?.poValue || 0;
      const amountFormatted = amountVal ? `₹${Number(amountVal).toLocaleString('en-IN')}` : '₹0.00';

      const defaultSteps = [
        { step: 1, title: 'Purchase Manager Approval', roleKey: 'purchase_manager', roleName: 'Purchase Manager', statusKey: 'Pending Purchase Manager Approval' }
      ];

      const currentStatus = rawStatus === 'approved' || rawStatus === 'paid' ? 'Approved & Dispatched' : rawStatus === 'rejected' ? 'Rejected' : rawStatus === 'returned' ? 'Returned for changes' : 'Pending Purchase Manager Approval';

      approval = {
        id,
        type: recordType,
        vendorName,
        amountOriginal: amountFormatted,
        amountINR: amountFormatted,
        poReference: poRef,
        currentSlab: `${recordType} Slab`,
        currentStep: currentStatus === 'Approved & Dispatched' ? 2 : 1,
        totalSteps: 2,
        workflowSteps: JSON.stringify(defaultSteps),
        status: currentStatus,
        submittedAt: inv?.createdAt || adv?.createdAt || new Date(),
        actionHistory: []
      };
    }

    return res.json({ success: true, approval });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET /api/approvals/:id/history ───────────────────────────────────────────
export const getApprovalHistory = async (req, res) => {
  try {
    const approval = await Approval.findOne({ id: req.params.id }).lean();
    if (!approval) {
      return res.status(404).json({ success: false, error: 'Approval not found' });
    }
    const audit = await WorkflowAudit.find({ entityId: approval.id }).sort({ occurredAt: 1 }).lean();
    return res.json({
      success: true,
      approvalId: approval.id,
      status: approval.status,
      currentStep: approval.currentStep,
      history: approval.actionHistory || [],
      audit
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
