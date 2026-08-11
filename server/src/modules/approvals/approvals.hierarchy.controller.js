import { Approval } from '../../models/Approval.js';
import { User } from '../../models/User.js';

const activeApprovalFilter = {
  status: { $nin: ['Approved & Dispatched', 'Rejected', 'Cancelled'] }
};

const canActOnCurrentStep = (approval, user) => {
  if (approval.requestedById === user.id) return false;
  if (approval.assignedApprover) return approval.assignedApprover === user.id;
  const steps = JSON.parse(approval.workflowSteps || '[]');
  const step = steps.find((item) => item.step === approval.currentStep);
  const requiredRole = String(step?.roleKey || '').replace(/[-\s]/g, '_').toLowerCase();
  return requiredRole && requiredRole === String(user.role || '').replace(/[-\s]/g, '_').toLowerCase();
};

const getCurrentStepRole = (approval) => {
  try {
    const steps = JSON.parse(approval.workflowSteps || '[]');
    const step = steps.find((item) => item.step === approval.currentStep);
    return step?.roleName || step?.roleKey || approval.assignedApproverRole || null;
  } catch {
    return approval.assignedApproverRole || null;
  }
};

const getVisibilityFilter = async (user) => {
  if (user.canSeeAllRequests || ['admin', 'superadmin', 'system_admin', 'systemadmin', 'md'].includes(String(user.role).toLowerCase())) return {};
  const users = await User.find({ status: 'Active' }, { id: 1, managerId: 1 }).lean();
  const visibleIds = new Set([user.id]);
  const queue = [user.id];
  while (queue.length) {
    const managerId = queue.shift();
    for (const subordinate of users.filter((candidate) => candidate.managerId === managerId)) {
      if (visibleIds.has(subordinate.id)) continue;
      visibleIds.add(subordinate.id);
      queue.push(subordinate.id);
    }
  }
  return { requestedById: { $in: [...visibleIds] } };
};

export const getHierarchyPendingApprovals = async (req, res) => {
  const user = await User.findOne({ id: req.user.id, status: 'Active' }).lean();
  if (!user) return res.status(403).json({ success: false, error: 'Your active user record could not be found.' });

  const visibility = await getVisibilityFilter(user);
  const requests = await Approval.find({ ...activeApprovalFilter, ...visibility })
    .sort({ submittedAt: -1 })
    .lean();

  return res.json({
    success: true,
    count: requests.length,
    userInfo: {
      id: user.id,
      name: user.name,
      role: user.role,
      team: user.team,
      hierarchyLevel: user.hierarchyLevel,
      managerId: user.managerId,
      managerName: user.managerName,
      canSeeAllRequests: user.canSeeAllRequests
    },
    requests: requests.map((request) => ({
      ...request,
      currentStepRole: getCurrentStepRole(request),
      canApprove: canActOnCurrentStep(request, user)
    }))
  });
};

export const getHierarchyTeamStats = async (req, res) => {
  const user = await User.findOne({ id: req.user.id, status: 'Active' }).lean();
  if (!user) return res.status(403).json({ success: false, error: 'Your active user record could not be found.' });

  const visibility = await getVisibilityFilter(user);
  const [pending, total, teamSize] = await Promise.all([
    Approval.countDocuments({ ...activeApprovalFilter, ...visibility }),
    Approval.countDocuments(visibility),
    user.canSeeAllRequests ? User.countDocuments({ status: 'Active' }) : User.countDocuments({ status: 'Active', team: user.team })
  ]);
  return res.json({ success: true, stats: { pending, total, teamSize } });
};

export const getReportingChain = async (req, res) => {
  const targetUserId = req.query.userId || req.user.id;
  const user = await User.findOne({ id: targetUserId }).lean();
  if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

  const chain = [user];
  const seen = new Set([user.id]);
  let managerId = user.managerId;
  while (managerId && !seen.has(managerId)) {
    const manager = await User.findOne({ id: managerId }).lean();
    if (!manager) break;
    chain.push(manager);
    seen.add(manager.id);
    managerId = manager.managerId;
  }
  return res.json({ success: true, chain });
};
