import mongoose from 'mongoose';
import { RfqHeader } from '../server/src/models/RfqLogistics.js';
import { Approval } from '../server/src/models/Approval.js';

async function test() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/p2p';
    await mongoose.connect(mongoUri);

    const rfq5 = await RfqHeader.findOne({ rfqNumber: 'RFQ-2026-0105' }).lean();
    console.log('--- RFQ-2026-0105 DB Status:', rfq5?.status);

    let approval = null;
    const queryOrs = [];
    if (rfq5?.awardApprovalId) queryOrs.push({ id: rfq5.awardApprovalId });
    if (rfq5?.rfqNumber) queryOrs.push({ id: rfq5.rfqNumber }, { referenceId: rfq5.rfqNumber });
    if (rfq5?.rfqId) queryOrs.push({ id: rfq5.rfqId }, { referenceId: rfq5.rfqId }, { 'transactionSnapshot.rfqId': rfq5.rfqId });

    if (queryOrs.length > 0) {
      approval = await Approval.findOne({ $or: queryOrs }).sort({ createdAt: -1 }).lean();
    }

    const required = Boolean(approval || rfq5?.awardApprovalId || String(rfq5?.status).toLowerCase() === 'pending_approval');
    const approved = Boolean(approval && approval.status === 'Approved & Dispatched');

    console.log('--- Award Approval Result:', { required, approval, approved });

    const approvalIsPending = required && approval && !['Approved & Dispatched', 'Rejected'].includes(approval.status);
    const effectiveStatus = approved
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
