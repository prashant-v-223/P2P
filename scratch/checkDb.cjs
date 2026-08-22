const mongoose = require('mongoose');
require('dotenv').config({ path: './server/.env' });

async function check() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/p2p';
    await mongoose.connect(mongoUri);
    const { RfqHeader, Approval } = require('./server/src/models/p2pModels');
    const rfq5 = await RfqHeader.findOne({ rfqNumber: 'RFQ-2026-0105' }).lean();
    console.log('--- RFQ-2026-0105 DOCUMENT ---');
    console.log(JSON.stringify(rfq5, null, 2));

    if (rfq5) {
      const ors = [
        rfq5.awardApprovalId ? { id: rfq5.awardApprovalId } : null,
        rfq5.rfqNumber ? { id: rfq5.rfqNumber } : null,
        rfq5.rfqNumber ? { referenceId: rfq5.rfqNumber } : null,
        rfq5.rfqId ? { 'transactionSnapshot.rfqId': rfq5.rfqId } : null
      ].filter(Boolean);
      
      const app = ors.length ? await Approval.find({ $or: ors }).lean() : [];
      console.log('--- APPROVALS FOUND FOR RFQ 105 ---');
      console.log(JSON.stringify(app, null, 2));
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
check();
