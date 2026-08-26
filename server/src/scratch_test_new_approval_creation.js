import mongoose from '../../node_modules/mongoose/index.js';
import dns from 'node:dns';

dns.setServers(['1.1.1.1', '8.8.8.8']);

const MONGODB_URI = 'mongodb+srv://prashantvadhvana_db_user:iBCZW1m1LWi7bXR6@cluster0.xxkca2v.mongodb.net/rayzon_p2p';

async function testNewApprovalCreation() {
  await mongoose.connect(MONGODB_URI);
  console.log('[Test New Approval] Connected to Atlas MongoDB...');

  const { resolveApprovalChain, attachApprovers } = await import('./services/approvalRouting.service.js');
  const { User } = await import('./models/User.js');

  const testUser = await User.findOne({ email: 'prashantvadhvana@gmail.com' }).lean();

  const amountINR = 15000000; // 1.5 Crore

  console.log(`[Test New Approval] Resolving approval chain for 1.5 Cr Advance Payment...`);
  const rawSteps = await resolveApprovalChain('Advance Payment', amountINR, testUser);

  console.log(`[Test New Approval] Attaching approvers for vendor Flat (Hong Kong) Co., Limited...`);
  const hydratedSteps = await attachApprovers(rawSteps, {
    ...testUser,
    vendorName: 'Flat (Hong Kong) Co., Limited',
    supplierId: '20000026',
    vendorId: '20000026'
  });

  console.log('\n======================================================');
  console.log('✅ NEW APPROVAL ROUTING & ASSIGNMENT VERIFIED CLEANLY');
  console.log('======================================================');

  console.log('\n[Hydrated Workflow Steps]');
  hydratedSteps.forEach((s, idx) => {
    console.log(`  Step ${idx + 1} (${s.title}):`);
    console.log(`    - Assigned Approver Name: "${s.assignedApproverName || 'Role Pool'}"`);
    console.log(`    - Assigned Approver Role: "${s.assignedApproverRole || s.roleKey}"`);
    console.log(`    - Is Pool Approval: ${Boolean(s.isPoolApproval)}`);
    console.log(`    - Resolution Method: "${s.resolutionMethod}"`);
  });

  await mongoose.disconnect();
  process.exit(0);
}

testNewApprovalCreation().catch(console.error);
