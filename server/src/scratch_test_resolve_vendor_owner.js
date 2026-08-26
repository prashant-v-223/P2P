import mongoose from '../../node_modules/mongoose/index.js';
import dns from 'node:dns';

dns.setServers(['1.1.1.1', '8.8.8.8']);

const MONGODB_URI = 'mongodb+srv://prashantvadhvana_db_user:iBCZW1m1LWi7bXR6@cluster0.xxkca2v.mongodb.net/rayzon_p2p';

async function testResolveVendorOwner() {
  await mongoose.connect(MONGODB_URI);
  const { Vendor } = await import('./models/Vendor.js');
  const { User } = await import('./models/User.js');

  // Load all vendors & internal users exactly like vendors.controller.js
  const allUsers = await User.find({ status: 'Active' }).sort({ createdAt: 1 }).lean();
  const internalUsers = allUsers.filter(u => u.role && !u.role.toLowerCase().includes('vendor'));

  const internalUsersMap = new Map();
  internalUsers.forEach(u => {
    internalUsersMap.set(String(u.id), u);
    internalUsersMap.set(String(u.userId), u);
  });

  const rawVendors = await Vendor.find({}).sort({ createdAt: 1 }).lean();
  const seenKeys = new Set();
  const uniqueVendors = [];

  for (const v of rawVendors) {
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

      v.resolvedLinkedUser = linkedU;
      uniqueVendors.push(v);
    }
  }

  const normalize = (str) => String(str || '')
    .toLowerCase()
    .replace(/[(),.\-_/\\]/g, ' ')
    .replace(/\b(co|ltd|limited|sdn|bhd|inc|corp|corporation|pv|products|regular|one-time|import|domestic)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const targetName = 'FLAT HONG KONG CO LIMITED';
  const normTarget = normalize(targetName);

  const matched = uniqueVendors.find(v => {
    const normV = normalize(v.companyName);
    return normV.includes('flat hong') || normTarget.includes(normV) || normV.includes(normTarget);
  });

  console.log('Matched Vendor:', matched ? {
    companyName: matched.companyName,
    linkedUser: matched.resolvedLinkedUser ? matched.resolvedLinkedUser.name : 'None'
  } : 'None');

  if (matched?.resolvedLinkedUser) {
    const linkedUserDoc = matched.resolvedLinkedUser;
    console.log('Linked User:', { name: linkedUserDoc.name, managerId: linkedUserDoc.managerId, managerName: linkedUserDoc.managerName });

    if (linkedUserDoc.managerId || linkedUserDoc.managerName) {
      const mgr = allUsers.find(u => u.id === linkedUserDoc.managerId || u.userId === linkedUserDoc.managerId || u.name === linkedUserDoc.managerName);
      console.log('Reporting Manager for Linked User:', mgr ? { id: mgr.id, name: mgr.name, role: mgr.role } : 'None');
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

testResolveVendorOwner().catch(console.error);
