const mongoose = require('mongoose');
require('dotenv').config({ path: './server/.env' });

async function test() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/p2p';
    await mongoose.connect(mongoUri);
    const { RfqHeader, Approval, RfqQuote } = require('./server/src/models/p2pModels');

    // Simulate getRfqAwardApproval logic
    async function getRfqAwardApproval(rfq) {
      if (!rfq) return { required: false, approval: null, approved: false };
      const plainRfq = typeof rfq.toObject === 'function' ? rfq.toObject() : rfq;

      let approval = null;
      const queryOrs = [];
      if (plainRfq.awardApprovalId) queryOrs.push({ id: plainRfq.awardApprovalId });
      if (plainRfq.rfqNumber) queryOrs.push({ id: plainRfq.rfqNumber }, { referenceId: plainRfq.rfqNumber });
      if (plainRfq.rfqId) queryOrs.push({ id: plainRfq.rfqId }, { referenceId: plainRfq.rfqId }, { 'transactionSnapshot.rfqId': plainRfq.rfqId });

      if (queryOrs.length > 0) {
        approval = await Approval.findOne({ $or: queryOrs }).sort({ createdAt: -1 }).lean();
      }

      const required = Boolean(approval || plainRfq.awardApprovalId || String(plainRfq.status).toLowerCase() === 'pending_approval');
      const approved = Boolean(approval && approval.status === 'Approved & Dispatched');

      return { required, approval, approved };
    }

    const rfq5 = await RfqHeader.findOne({ rfqNumber: 'RFQ-2026-0105' }).lean();
    console.log('--- RFQ-2026-0105 DB Status:', rfq5?.status);

    const awardApproval = await getRfqAwardApproval(rfq5);
    console.log('--- Award Approval Result:', awardApproval);

    const approvalIsPending = awardApproval.required && awardApproval.approval && !['Approved & Dispatched', 'Rejected'].includes(awardApproval.approval.status);
    const effectiveStatus = awardApproval.approved
      ? (['published', 'pending_approval'].includes(rfq5.status) ? 'awarded' : rfq5.status)
      : (approvalIsPending ? 'pending_approval' : rfq5.status);

    console.log('--- Computed Effective Status:', effectiveStatus);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
test();
