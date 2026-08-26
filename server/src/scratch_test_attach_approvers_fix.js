import mongoose from '../../node_modules/mongoose/index.js';
import dns from 'node:dns';

dns.setServers(['1.1.1.1', '8.8.8.8']);

const MONGODB_URI = 'mongodb+srv://prashantvadhvana_db_user:iBCZW1m1LWi7bXR6@cluster0.xxkca2v.mongodb.net/rayzon_p2p';

async function testAttachApproversFix() {
  await mongoose.connect(MONGODB_URI);
  const { User } = await import('./models/User.js');
  const { Vendor } = await import('./models/Vendor.js');
  const { isRoleMatchingStep, findParentManager } = await import('./services/approvalRouting.service.js');

  async function resolveVendorOwnerUser(rawVendorQuery) {
    if (!rawVendorQuery) return null;
    try {
      const [vendors, users] = await Promise.all([
        Vendor.find().sort({ createdAt: -1 }).lean().catch(() => []),
        User.find().lean().catch(() => [])
      ]);

      const internalUsers = users.filter(u => u.role !== 'vendor' && u.role !== 'vendor_portal');
      const internalUsersMap = new Map();
      for (const u of internalUsers) {
        if (u.id) internalUsersMap.set(String(u.id), u);
        if (u._id) internalUsersMap.set(String(u._id), u);
        if (u.email) internalUsersMap.set(String(u.email).toLowerCase(), u);
      }

      const normalize = (str) => String(str || '')
        .toLowerCase()
        .replace(/[(),.\-_/\\]/g, ' ')
        .replace(/\b(co|ltd|limited|sdn|bhd|inc|corp|corporation|pv|products|regular|one-time|import|domestic)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      const normQuery = normalize(rawVendorQuery);

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

          v.linkedUserDoc = linkedU;
          uniqueVendors.push(v);
        }
      }

      const matchedVendor = uniqueVendors.find(v => {
        const normV = normalize(v.companyName);
        return v.sapVendorCode === rawVendorQuery || v.supplierId === rawVendorQuery || v.id === rawVendorQuery ||
          normV === normQuery || (normQuery && normV.includes(normQuery)) || (normV && normQuery.includes(normV));
      });

      return matchedVendor?.linkedUserDoc || null;
    } catch (err) {
      console.error('[resolveVendorOwnerUser Error]:', err.message);
      return null;
    }
  }

  const rawVendorQuery = 'FLAT HONG KONG CO LIMITED';
  const vendorOwnerUser = await resolveVendorOwnerUser(rawVendorQuery);
  console.log('Vendor Owner User:', vendorOwnerUser ? { id: vendorOwnerUser.id, name: vendorOwnerUser.name, managerId: vendorOwnerUser.managerId } : 'None');

  if (vendorOwnerUser?.managerId) {
    const parentManager = await findParentManager(vendorOwnerUser, 'procurement');
    console.log('Step 1 Approver for FLAT HONG KONG CO LIMITED:', parentManager);
  }

  await mongoose.disconnect();
  process.exit(0);
}

testAttachApproversFix().catch(console.error);
