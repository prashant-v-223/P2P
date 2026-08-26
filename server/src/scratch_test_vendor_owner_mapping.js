import mongoose from '../../node_modules/mongoose/index.js';
import dns from 'node:dns';

dns.setServers(['1.1.1.1', '8.8.8.8']);

const MONGODB_URI = 'mongodb+srv://prashantvadhvana_db_user:iBCZW1m1LWi7bXR6@cluster0.xxkca2v.mongodb.net/rayzon_p2p';

async function testVendorOwnerMapping() {
  await mongoose.connect(MONGODB_URI);
  const { Vendor } = await import('./models/Vendor.js');
  const { User } = await import('./models/User.js');

  const normalize = (str) => String(str || '')
    .toLowerCase()
    .replace(/[(),.\-_/\\]/g, ' ')
    .replace(/\b(co|ltd|limited|sdn|bhd|inc|corp|corporation|pv|products|regular|one-time|import|domestic)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Get active internal procurement users (executives/members)
  const procurementUsers = await User.find({
    status: 'Active',
    role: { $in: ['procurement', 'Procurement', 'procurement_executive', 'inner_team'] }
  }).sort({ createdAt: 1, name: 1 }).lean();

  console.log('Procurement Executive Users:', procurementUsers.map(u => ({ id: u.id, name: u.name, managerId: u.managerId, managerName: u.managerName })));

  const allVendors = await Vendor.find({}).sort({ createdAt: 1, _id: 1 }).lean();
  const flatVendor = allVendors.find(v => normalize(v.companyName).includes('flat hong'));

  if (flatVendor && procurementUsers.length > 0) {
    const vIdx = allVendors.findIndex(v => v.id === flatVendor.id);
    const ownerUser = procurementUsers[vIdx % procurementUsers.length];
    console.log(`Flat Vendor Index: ${vIdx}, Owner User:`, ownerUser ? { id: ownerUser.id, name: ownerUser.name, managerId: ownerUser.managerId } : 'None');

    if (ownerUser?.managerId) {
      const manager = await User.findOne({
        $or: [{ id: ownerUser.managerId }, { userId: ownerUser.managerId }]
      }).lean();
      console.log('Reporting Manager:', manager ? { id: manager.id, name: manager.name, role: manager.role } : 'None');
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

testVendorOwnerMapping().catch(console.error);
