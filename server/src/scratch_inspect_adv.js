import mongoose from '../../node_modules/mongoose/index.js';
import dns from 'node:dns';

dns.setServers(['1.1.1.1', '8.8.8.8']);

const MONGODB_URI = 'mongodb+srv://prashantvadhvana_db_user:iBCZW1m1LWi7bXR6@cluster0.xxkca2v.mongodb.net/rayzon_p2p';

async function checkAdv391513() {
  await mongoose.connect(MONGODB_URI);
  const { Approval } = await import('./models/Approval.js');
  const app = await Approval.findOne({ $or: [{ id: 'ADV-391513' }, { referenceId: 'ADV-391513' }] }).lean();
  console.log('ADV-391513 Approval:', app ? {
    id: app.id,
    referenceId: app.referenceId,
    vendorName: app.vendorName,
    currentStep: app.currentStep,
    assignedApproverName: app.assignedApproverName,
    assignedApproverRole: app.assignedApproverRole,
    assignedApprover: app.assignedApprover,
    workflowSteps: app.workflowSteps
  } : 'Not found');
  await mongoose.disconnect();
  process.exit(0);
}

checkAdv391513().catch(console.error);
