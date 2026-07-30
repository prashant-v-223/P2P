import { Approval } from '../../models/Approval.js';

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getPendingApprovals = async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const size = Math.min(100, Math.max(1, Number.parseInt(req.query.size, 10) || 10));
  const query = String(req.query.q || '').trim();
  const type = String(req.query.type || '').trim();
  const filter = { status: /^Pending/i };

  if (type && type !== 'All') filter.type = type;
  if (query) {
    const matcher = new RegExp(escapeRegex(query), 'i');
    filter.$or = [
      { id: matcher },
      { type: matcher },
      { vendorName: matcher },
      { requestedBy: matcher },
      { currentSlab: matcher },
      { amountINR: matcher }
    ];
  }

  const sort = req.query.sort === 'oldest' ? { submittedAt: 1, createdAt: 1 } : { submittedAt: -1, createdAt: -1 };
  const total = await Approval.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(page, totalPages);
  const approvals = await Approval.find(filter).sort(sort).skip((safePage - 1) * size).limit(size).lean();
  return res.json({
    success: true,
    count: approvals.length,
    total,
    page: safePage,
    size,
    totalPages,
    hasPrevious: safePage > 1,
    hasNext: safePage < totalPages,
    approvals
  });
};

export const processApprovalAction = async (req, res) => {
  const action = req.body.action?.toLowerCase();
  if (!['approve', 'return', 'reject'].includes(action)) {
    return res.status(400).json({ success: false, error: 'Action must be Approve, Return, or Reject.' });
  }
  const status = action === 'approve'
    ? 'Approved & Dispatched'
    : action === 'return'
      ? 'Returned for changes'
      : 'Rejected';
  const approval = await Approval.findOneAndUpdate(
    { id: req.params.id, status: /^Pending/i },
    { status, remarks: req.body.remarks || '', actionedBy: req.user.id, actionedAt: new Date() },
    { new: true, runValidators: true }
  );
  if (!approval) {
    return res.status(404).json({ success: false, error: 'Pending approval not found.' });
  }
  return res.json({ success: true, message: `Request ${status.toLowerCase()}.`, approval });
};
