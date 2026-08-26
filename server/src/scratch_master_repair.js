import mongoose from '../../node_modules/mongoose/index.js';
import dns from 'node:dns';

dns.setServers(['1.1.1.1', '8.8.8.8']);

const MONGODB_URI = 'mongodb+srv://prashantvadhvana_db_user:iBCZW1m1LWi7bXR6@cluster0.xxkca2v.mongodb.net/rayzon_p2p';

async function runMasterRepair() {
  console.log('[Master Repair] Connecting to Atlas DB...');
  await mongoose.connect(MONGODB_URI);
  console.log('[Master Repair] Connected successfully!');

  const { repairAllActiveApprovals, repairAllOldPaymentRecords } = await import('./services/approvalRouting.service.js');

  console.log('[Master Repair] Repairing all active approval workflows...');
  await repairAllActiveApprovals();

  console.log('[Master Repair] Repairing all legacy payment records...');
  await repairAllOldPaymentRecords();

  console.log('[Master Repair] All old approval and payment records across MongoDB have been successfully repaired and synchronized!');
  await mongoose.disconnect();
  process.exit(0);
}

runMasterRepair().catch((err) => {
  console.error('[Master Repair Error]:', err);
  process.exit(1);
});
