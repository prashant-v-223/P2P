import mongoose from '../../node_modules/mongoose/index.js';
import dns from 'node:dns';

dns.setServers(['1.1.1.1', '8.8.8.8']);

const MONGODB_URI = 'mongodb+srv://prashantvadhvana_db_user:iBCZW1m1LWi7bXR6@cluster0.xxkca2v.mongodb.net/rayzon_p2p';

async function checkInv780318() {
  await mongoose.connect(MONGODB_URI);
  const { Approval } = await import('./models/Approval.js');
  const app = await Approval.findOne({ $or: [{ id: 'INV-PAY-780318' }, { referenceId: 'INV-PAY-780318' }] }).lean();
  console.log('INV-PAY-780318 Approval:', app ? {
    id: app.id,
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

checkInv780318().catch(console.error);
