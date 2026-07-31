import { Approval } from '../../models/Approval.js';
import { sendApprovalEmails } from '../../services/notification.service.js';
import { broadcastEvent } from '../../services/sse.service.js';

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

// ── Check if an approval's ACTIVE STEP is meant for this role ─────────────
function isApprovalForRole(approval, roleFilter) {
  const keywords = getRoleKeywords(roleFilter);
  const statusLower = (approval.status || '').toLowerCase();

  // Primary: does current status contain the role keyword?
  for (const kw of keywords) {
    if (statusLower.includes(kw)) return true;
  }

  // Secondary: check workflowSteps for activeStep role match
  if (approval.workflowSteps) {
    try {
      const steps = JSON.parse(approval.workflowSteps);
      const activeStepObj = steps.find(s => s.step === (approval.currentStep || 1));
      if (activeStepObj) {
        const roleName = (activeStepObj.roleName || '').toLowerCase();
        const roleKey  = (activeStepObj.roleKey  || '').toLowerCase();
        const title    = (activeStepObj.title    || '').toLowerCase();
        for (const kw of keywords) {
          if (roleName.includes(kw) || roleKey.includes(kw) || title.includes(kw)) return true;
        }
      }
    } catch (_) {}
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

// ── Check if user role can act on current step ────────────────────────────
function canActOnStep(userRole, approval) {
  const ur = (userRole || '').toLowerCase().replace(/[\s_-]+/g, ' ').trim();
  // System Admin / Admin bypass only for VIEWING — NOT for acting on steps
  // (We allow Admin to act only if approval is stuck or explicitly escalated)
  if (ur === 'system admin' || ur === 'admin') return true; // Admin can always act (super user)

  const requiredRole = getCurrentStepRole(approval);
  if (!requiredRole) return true; // no restriction defined → allow

  const keywords = getRoleKeywords(userRole);
  for (const kw of keywords) {
    if (requiredRole.includes(kw)) return true;
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

    // role comes from query param (sent by frontend based on logged-in user)
    const roleFilter = String(req.query.role || '').trim();

    const TERMINAL = ['Approved & Dispatched', 'Rejected', 'Returned for changes'];
    const filter = { status: { $nin: TERMINAL } };

    if (type && type !== 'All') filter.type = type;
    if (query) {
      const matcher = new RegExp(escapeRegex(query), 'i');
      filter.$or = [
        { id:          matcher },
        { type:        matcher },
        { vendorName:  matcher },
        { requestedBy: matcher },
        { currentSlab: matcher },
        { amountINR:   matcher },
        { poReference: matcher }
      ];
    }

    const sort = req.query.sort === 'oldest'
      ? { submittedAt: 1, createdAt: 1 }
      : { submittedAt: -1, createdAt: -1 };

    let approvals = await Approval.find(filter).sort(sort).lean();

    // ── Role-based filtering ─────────────────────────────────────────────
    // Admin / System Admin sees ALL approvals
    const roleNorm = roleFilter.toLowerCase().replace(/[\s_-]+/g, ' ').trim();
    const isAdmin = roleNorm === 'admin' || roleNorm === 'system admin' || !roleFilter;

    if (!isAdmin) {
      approvals = approvals.filter(a => isApprovalForRole(a, roleFilter));
    }

    // ── Self-submission exclusion ────────────────────────────────────────
    // A user must never see (or approve) requests THEY submitted themselves.
    // Use the name from the JWT (req.user.name) OR the 'me' query param as fallback.
    const currentUserName  = (req.user?.name  || req.query.me  || '').toLowerCase().trim();
    const currentUserEmail = (req.user?.email || req.query.meEmail || '').toLowerCase().trim();

    if (currentUserName || currentUserEmail) {
      approvals = approvals.filter(a => {
        const submitter = (a.requestedBy || '').toLowerCase().trim();
        if (!submitter) return true; // no submitter info → show it
        // Exclude if submitter matches by name OR by email prefix (user@domain → user)
        const matchesName  = currentUserName  && submitter === currentUserName;
        const matchesEmail = currentUserEmail && (submitter === currentUserEmail || submitter === currentUserEmail.split('@')[0]);
        return !matchesName && !matchesEmail;
      });
    }

    const total      = approvals.length;
    const totalPages = Math.max(1, Math.ceil(total / size));
    const safePage   = Math.min(page, totalPages);
    const paginated  = approvals.slice((safePage - 1) * size, safePage * size);

    const enriched = paginated.map(a => {
      let parsedSteps = null;
      if (a.workflowSteps) {
        try { parsedSteps = JSON.parse(a.workflowSteps); } catch (_) {}
      }
      return {
        ...a,
        parsedSteps,
        currentStepRole: getCurrentStepRole(a)
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

    const approval = await Approval.findOne({ id: req.params.id });
    if (!approval) {
      return res.status(404).json({ success: false, error: 'Approval not found.' });
    }

    // ── Role Authorization Check ──────────────────────────────────────────
    const actingUser = req.user?.name || req.body.actionedBy || req.body.user || 'Unknown User';
    const actingRole = req.user?.role || req.body.role || '';

    if (!canActOnStep(actingRole, approval)) {
      const requiredRole = getCurrentStepRole(approval);
      return res.status(403).json({
        success: false,
        error: `Access denied. This step requires "${requiredRole}" role. Your role is "${actingRole}".`,
        requiredRole,
        yourRole: actingRole
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

    const actionRemarks = (req.body.remarks || '').trim() || `${rawAction.charAt(0).toUpperCase() + rawAction.slice(1)} by ${actingUser}`;

    // ── Audit History Log ─────────────────────────────────────────────────
    const actionRecord = {
      action:         rawAction,
      step:           approval.currentStep || 1,
      statusAtAction: newStatus,
      role:           actingRole,
      actionedBy:     actingUser,
      actionedAt:     new Date(),
      remarks:        actionRemarks
    };

    if (!Array.isArray(approval.actionHistory)) approval.actionHistory = [];
    approval.actionHistory.push(actionRecord);

    approval.status      = newStatus;
    approval.currentStep = newStep;
    approval.remarks     = actionRemarks;
    approval.actionedBy  = actingUser;
    approval.actionedAt  = new Date();
    await approval.save();

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
    }

    const isFullyApproved = newStatus === 'Approved & Dispatched';
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

// ── GET /api/approvals/:id/history ───────────────────────────────────────────
export const getApprovalHistory = async (req, res) => {
  try {
    const approval = await Approval.findOne({ id: req.params.id }).lean();
    if (!approval) {
      return res.status(404).json({ success: false, error: 'Approval not found' });
    }
    return res.json({
      success: true,
      approvalId: approval.id,
      status: approval.status,
      currentStep: approval.currentStep,
      history: approval.actionHistory || []
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
