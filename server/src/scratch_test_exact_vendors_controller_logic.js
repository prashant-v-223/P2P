import mongoose from '../../node_modules/mongoose/index.js';
import dns from 'node:dns';

dns.setServers(['1.1.1.1', '8.8.8.8']);

const MONGODB_URI = 'mongodb+srv://prashantvadhvana_db_user:iBCZW1m1LWi7bXR6@cluster0.xxkca2v.mongodb.net/rayzon_p2p';

async function testExactVendorController() {
  await mongoose.connect(MONGODB_URI);
  const { Vendor } = await import('./models/Vendor.js');
  const { User } = await import('./models/User.js');

  // Exact logic from vendors.controller.js
  const vendors = await Vendor.find({}).sort({ companyName: 1 }).lean();
  const internalUsers = await User.find({ status: 'Active' }).sort({ createdAt: 1 }).lean();
  const internalTeam = internalUsers.filter(u => u.role && !u.role.toLowerCase().includes('vendor'));

  const internalUsersMap = new Map();
  internalTeam.forEach(u => {
    internalUsersMap.set(String(u.id), u);
    internalUsersMap.set(String(u.userId), u);
  });

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
        || internalTeam.find(u => u.name === v.assignedPurchaseManager || u.name === v.buyerName || u.name === v.createdBy);

      if (!linkedU && internalTeam.length > 0) {
        linkedU = internalTeam[uniqueVendors.length % internalTeam.length];
      }

      v.linkedUserDoc = linkedU;
      uniqueVendors.push(v);
    }
  }

  const normalize = (str) => String(str || '')
    .toLowerCase()
    .replace(/[(),.\-_/\\]/g, ' ')
    .replace(/\b(co|ltd|limited|sdn|bhd|inc|corp|corporation|pv|products|regular|one-time|import|domestic)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const query = 'FLAT HONG KONG CO LIMITED';
  const normQuery = normalize(query);

  const flatV = uniqueVendors.find(v => {
    const normV = normalize(v.companyName);
    return v.sapVendorCode === '20000026' || normV.includes('flat hong') || normQuery.includes(normV);
  });

  console.log('Flat Vendor in UniqueVendors:', flatV ? {
    companyName: flatV.companyName,
    sapVendorCode: flatV.sapVendorCode,
    linkedUser: flatV.linkedUserDoc ? flatV.linkedUserDoc.name : 'None'
  } : 'None');

  if (flatV?.linkedUserDoc) {
    const linked = flatV.linkedUserDoc;
    console.log('Linked User Details:', { id: linked.id, name: linked.name, role: linked.role, managerId: linked.managerId, managerName: linked.managerName });

    if (linked.managerId || linked.managerName) {
      const mgr = internalUsers.find(u => u.id === linked.managerId || u.userId === linked.managerId || u.name === linked.managerName);
      console.log('Reporting Manager (Approver):', mgr ? { id: mgr.id, name: mgr.name, role: mgr.role } : 'None');
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

testExactVendorController().catch(console.error);
