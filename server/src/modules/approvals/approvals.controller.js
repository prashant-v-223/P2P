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

// ── Hierarchical Approvals Chain Map ──────────────────────────────────────
const ROLE_HIERARCHY = {
  'superadmin': ['admin', 'system admin', 'md', 'director', 'cfo', 'finance head', 'finance lead', 'finance', 'procurement head', 'procurement', 'exim manager', 'exim', 'logistics lead', 'logistics', 'accounts lead', 'accounts', 'manager', 'assistant manager', 'executive'],
  'admin': ['system admin', 'md', 'director', 'cfo', 'finance head', 'finance lead', 'finance', 'procurement head', 'procurement', 'exim manager', 'exim', 'logistics lead', 'logistics', 'accounts lead', 'accounts', 'manager', 'assistant manager', 'executive'],
  'system admin': ['md', 'director', 'cfo', 'finance head', 'finance lead', 'finance', 'procurement head', 'procurement', 'exim manager', 'exim', 'logistics lead', 'logistics', 'accounts lead', 'accounts', 'manager', 'assistant manager', 'executive'],
  'md': ['director', 'cfo', 'finance head', 'finance lead', 'finance', 'procurement head', 'procurement', 'exim manager', 'exim', 'logistics lead', 'logistics', 'accounts lead', 'accounts', 'general manager', 'senior manager', 'manager', 'assistant manager', 'executive'],
  'director': ['cfo', 'finance head', 'finance lead', 'finance', 'procurement head', 'procurement', 'exim manager', 'exim', 'logistics lead', 'logistics', 'accounts lead', 'accounts', 'general manager', 'senior manager', 'manager', 'assistant manager', 'executive'],
  'cfo': ['finance head', 'finance lead', 'finance', 'accounts lead', 'accounts'],
  'finance head': ['finance lead', 'finance', 'accounts lead', 'accounts'],
  'finance lead': ['finance', 'accounts'],
  'procurement head': ['procurement manager', 'procurement lead', 'procurement', 'buyer', 'assistant manager', 'executive'],
  'exim manager': ['exim lead', 'exim officer', 'exim assistant', 'exim', 'assistant manager', 'executive'],
  'general manager': ['senior manager', 'manager', 'assistant manager', 'executive'],
  'senior manager': ['manager', 'assistant manager', 'executive'],
  'manager': ['assistant manager', 'executive', 'officer'],
  'assistant manager': ['executive', 'officer']
};

// ── Map a role string to the keywords we look for in status strings ──────────
function getRoleKeywords(role = '') {
  const r = role.toLowerCase().replace(/[\s_-]+/g, ' ').trim();
  if (r.includes('procurement')) return ['procurement'];
  if (r.includes('finance head') || r.includes('finance_head')) return ['finance head', 'finance lead', 'finance'];
  if (r.includes('finance lead') || r.includes('finance_lead')) return ['finance lead', 'finance'];
  if (r.includes('finance')) return ['finance'];
  if (r.includes('md') || r.includes('director') || r.includes('managing director')) return ['md', 'director'];
  if (r.includes('exim')) return ['exim'];
  if (r.includes('logistics')) return ['logistics'];
  if (r.includes('account')) return ['account'];
  return [r];
}

// ── Check if an approval's ACTIVE STEP is meant for this role / roles (with Hierarchy support) ───────
function isApprovalForRole(approval, roleFilter) {
  const roles = Array.isArray(roleFilter) ? roleFilter : [roleFilter];
  
  for (const role of roles) {
    const rNorm = (role || '').toLowerCase().replace(/[\s_-]+/g, ' ').trim();
    if (rNorm === 'admin' || rNorm === 'system admin' || rNorm === 'systemadmin' || rNorm === 'superadmin') return true;

    const keywords = getRoleKeywords(role);
    const subordinates = ROLE_HIERARCHY[rNorm] || [];
    const allAllowedKeywords = Array.from(new Set([
      ...keywords,
      ...subordinates.flatMap(s => getRoleKeywords(s))
    ]));

    const statusLower = (approval.status || '').toLowerCase();

    // Primary: status check
    for (const kw of allAllowedKeywords) {
      if (statusLower.includes(kw)) return true;
    }

    // Secondary: workflowSteps check
    if (approval.workflowSteps) {
      try {
        const steps = JSON.parse(approval.workflowSteps);
        const activeStepObj = steps.find(s => s.step === (approval.currentStep || 1));
        if (activeStepObj) {
          const roleName = (activeStepObj.roleName || '').toLowerCase();
          const roleKey  = (activeStepObj.roleKey  || '').toLowerCase();
          const title    = (activeStepObj.title    || '').toLowerCase();
          for (const kw of allAllowedKeywords) {
            if (roleName.includes(kw) || roleKey.includes(kw) || title.includes(kw)) return true;
          }
        }
      } catch (_) {}
    }
  }

  return false;
}

// ── Advance to next step using stored workflowSteps JSON ─────────────────────
function getNextStepStatus(approval) {
  if (approval.workflowSteps) {
    try {
      const steps = JSON.parse(approval.workflowSteps);
      const sorted = steps.sort((a, b) => (a.step || 0) - (b.step || 0));
      const currentIdx = sorted.findIndex(s =>
        approval.status === s.statusKey ||
        approval.status === `Pending ${s.title}`
      );
      if (currentIdx >= 0 && currentIdx < sorted.length - 1) {
        const nextStep = sorted[currentIdx + 1];
        return nextStep.statusKey || `Pending ${nextStep.title}`;
      }
      return 'Approved & Dispatched';
    } catch (e) {
      console.error('[getNextStepStatus] parse error:', e.message);
    }
  }

  const NEXT_STEP = {
    'Pending Procurement Head Approval': 'Pending Finance Approval',
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
      const steps = JSON.parse(approval.workflowSteps);
      const activeStepObj = steps.find(s => s.step === (approval.currentStep || 1));
      if (activeStepObj) {
        return (activeStepObj.roleName || activeStepObj.roleKey || '').toLowerCase();
      }
    } catch (_) {}
  }

  // Fallback: infer from status string
  if (statusLower.includes('procurement')) return 'procurement head';
  if (statusLower.includes('finance')) return 'finance';
  if (statusLower.includes('md') || statusLower.includes('director')) return 'md';
  if (statusLower.includes('exim')) return 'exim';
  if (statusLower.includes('logistics')) return 'logistics';
  return '';
}

async function getStepAssignment(approval, stepNumber) {
  let step = null;
  try {
    step = JSON.parse(approval.workflowSteps || '[]').find((item) => item.step === stepNumber);
  } catch (_) {}
  const role = String(step?.roleKey || step?.roleName || '').replace(/[\s-]+/g, '_').toLowerCase();
  if (!role || role.includes('finance') || role === 'md' || role.includes('director')) {
    return { assignedApprover: null, assignedApproverName: null, assignedApproverRole: role || null };
  }
  const manager = await User.findOne({ status: 'Active', team: approval.requestedByTeam, role: { $in: ['procurement_head', 'exim-manager'] } }, { id: 1, name: 1, role: 1 }).lean();
  return {
    assignedApprover: manager?.id || null,
    assignedApproverName: manager?.name || null,
    assignedApproverRole: manager?.role || role
  };
}

// ── Check if user role(s) can act on current step (with Hierarchy support) ────────────────────────────
function canActOnStep(userRole, approval) {
  const roles = Array.isArray(userRole) ? userRole : [userRole];
  
  for (const role of roles) {
    const ur = (role || '').toLowerCase().replace(/[\s_-]+/g, ' ').trim();
    if (ur === 'admin' || ur.replace(/\s+/g, '') === 'systemadmin' || ur === 'superadmin') return true;

    const requiredRole = getCurrentStepRole(approval);
    if (!requiredRole) return true;

    // Direct role keyword match
    const keywords = getRoleKeywords(role);
    for (const kw of keywords) {
      if (requiredRole.includes(kw)) return true;
    }

    // Hierarchical role match (Higher-level approvers can act on subordinate steps)
    const subordinates = ROLE_HIERARCHY[ur] || [];
    for (const subRole of subordinates) {
      const subKeywords = getRoleKeywords(subRole);
      for (const kw of subKeywords) {
        if (requiredRole.includes(kw) || kw.includes(requiredRole)) return true;
      }
    }
  }

  return false;
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

    // Actionable items specifically assigned to user's role step
    const actionableApprovals = allApprovals.filter(a => isApprovalForRole(a, effectiveRoles));
    const actionableCount = actionableApprovals.length;
    const allCount = allApprovals.length;

    const scope = String(req.query.scope || (isSuperUser ? 'all' : 'actionable')).toLowerCase().trim();
    let approvals = (scope === 'actionable' || req.query.actionableOnly === 'true') ? actionableApprovals : allApprovals;

    if (!isSuperUser && scope !== 'all') {
      approvals = approvals.filter(a => isApprovalForRole(a, effectiveRoles));
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
        try { parsedSteps = JSON.parse(a.workflowSteps); } catch (_) {}
      }
      const stepRole = getCurrentStepRole(a);
      // Check if this approval was matched via delegation
      let matchedDelegator = null;
      if (delegatorMap[stepRole] && !isApprovalForRole(a, primaryRole)) {
        matchedDelegator = delegatorMap[stepRole][0];
      }

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
    const requester = String(approval.requestedById || approval.requestedBy || '').trim().toLowerCase();
    if (requester && [actingUserId, req.user?.email, req.user?.name].filter(Boolean).some((value) => requester === String(value).trim().toLowerCase())) return res.status(403).json({ success: false, error: 'You cannot approve, return, or reject your own request.' });
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
    if (!isAssignedApprover && !canActOnStep(effectiveRoles, approval)) {
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
    } else if (approval.type === 'RFQ Vendor Award') {
      try {
        const { RfqHeader, RfqQuote } = await import('../../models/RfqLogistics.js');
        // Look up via transactionSnapshot.rfqId (most reliable) or awardApprovalId
        const rfqId = approval.transactionSnapshot?.rfqId;
        const rfq = await RfqHeader.findOne(
          rfqId
            ? { $or: [{ rfqId }, { awardApprovalId: approval.id }] }
            : { awardApprovalId: approval.id }
        );
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
            const alreadyApproved = existingAllocations.filter(a => a.approved === true);
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
        { step: 1, title: 'Procurement Head Approval', roleKey: 'procurement_head', roleName: 'Procurement Head', statusKey: 'Pending Procurement Head Approval' },
        { step: 2, title: 'Finance Approval', roleKey: 'finance_lead', roleName: 'Finance Lead', statusKey: 'Pending Finance Approval' }
      ];

      const currentStatus = rawStatus === 'approved' || rawStatus === 'paid' ? 'Approved & Dispatched' : rawStatus === 'rejected' ? 'Rejected' : rawStatus === 'returned' ? 'Returned for changes' : 'Pending Procurement Head Approval';

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
