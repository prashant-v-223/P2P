import mongoose from '../../node_modules/mongoose/index.js';
import dns from 'node:dns';

dns.setServers(['1.1.1.1', '8.8.8.8']);

const MONGODB_URI = 'mongodb+srv://prashantvadhvana_db_user:iBCZW1m1LWi7bXR6@cluster0.xxkca2v.mongodb.net/rayzon_p2p';

async function testVendorsCreatedAt() {
  await mongoose.connect(MONGODB_URI);
  const { Vendor } = await import('./models/Vendor.js');
  const { User } = await import('./models/User.js');

  const [vendors, users] = await Promise.all([
    Vendor.find().sort({ createdAt: -1 }).lean(),
    User.find().lean()
  ]);

  const internalUsers = users.filter(u => u.role !== 'vendor' && u.role !== 'vendor_portal');
  const internalUsersMap = new Map();
  for (const u of internalUsers) {
    if (u.id) internalUsersMap.set(String(u.id), u);
    if (u._id) internalUsersMap.set(String(u._id), u);
    if (u.email) internalUsersMap.set(String(u.email).toLowerCase(), u);
  }

  const seenKeys = new Set();
  const uniqueVendors = [];
  for (let i = 0; i < vendors.length; i++) {
    const v = vendors[i];
    const key = v.sapVendorCode || v.supplierId || v.id || v._id?.toString();
    if (key && !seenKeys.has(key)) {
      seenKeys.add(key);

      let linkedU = internalUsersMap.get(String(v.assignedPurchaseManagerId))
        || internalUsersMap.get(String(v.buyerId))
        || internalUsersMap.get(String(v.userId))
        || internalUsers.find(u => u.name === v.assignedPurchaseManager || u.name === v.buyerName || u.name === v.createdBy);

      if (!linkedU && internalUsers.length > 0) {
        linkedU = internalUsers[uniqueVendors.length % internalUsers.length];
      }

      v.linkedUserName = linkedU ? linkedU.name : 'Procurement Team';
      v.linkedUserDoc = linkedU;
      uniqueVendors.push(v);
    }
  }

  const flatV = uniqueVendors.find(v => v.companyName?.toLowerCase().includes('flat (hong kong)'));
  console.log('Flat Vendor with createdAt -1:', flatV ? {
    companyName: flatV.companyName,
    linkedUser: flatV.linkedUserName,
    linkedUserDoc: flatV.linkedUserDoc ? { name: flatV.linkedUserDoc.name, managerId: flatV.linkedUserDoc.managerId, managerName: flatV.linkedUserDoc.managerName } : null
  } : 'Not found');

  if (flatV?.linkedUserDoc) {
    const mgr = users.find(u => u.id === flatV.linkedUserDoc.managerId || u.userId === flatV.linkedUserDoc.managerId || u.name === flatV.linkedUserDoc.managerName);
    console.log('Reporting Manager for Linked User:', mgr ? { id: mgr.id, name: mgr.name, role: mgr.role } : 'None');
  }

  await mongoose.disconnect();
  process.exit(0);
}

testVendorsCreatedAt().catch(console.error);
