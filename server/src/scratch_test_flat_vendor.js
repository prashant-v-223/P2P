import mongoose from '../../node_modules/mongoose/index.js';
import dns from 'node:dns';

dns.setServers(['1.1.1.1', '8.8.8.8']);

const MONGODB_URI = 'mongodb+srv://prashantvadhvana_db_user:iBCZW1m1LWi7bXR6@cluster0.xxkca2v.mongodb.net/rayzon_p2p';

async function testFlatVendor() {
  await mongoose.connect(MONGODB_URI);
  const { Vendor } = await import('./models/Vendor.js');
  const { User } = await import('./models/User.js');

  const rawQuery = 'FLAT HONG KONG CO LIMITED';
  // Normalize string by removing punctuation and corporate noise words
  const normalize = (str) => String(str || '')
    .toLowerCase()
    .replace(/[(),.\-_/\\]/g, ' ')
    .replace(/\b(co|ltd|limited|sdn|bhd|inc|corp|corporation|pv|products|regular|one-time|import|domestic)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const cleanQuery = normalize(rawQuery);
  console.log('Clean Query:', cleanQuery);

  const allVendors = await Vendor.find({}).lean();
  const matchedVendor = allVendors.find(v => {
    const norm = normalize(v.companyName);
    return norm.includes('flat hong') || cleanQuery.includes(norm) || norm.includes(cleanQuery);
  });

  console.log('Matched Vendor:', matchedVendor ? {
    id: matchedVendor.id,
    companyName: matchedVendor.companyName,
    linkedUser: matchedVendor.linkedUser,
    contactEmail: matchedVendor.contactEmail,
    assignedPurchaseManager: matchedVendor.assignedPurchaseManager
  } : 'None');

  if (matchedVendor) {
    const ownerName = matchedVendor.linkedUser || matchedVendor.assignedPurchaseManager;
    const ownerUser = await User.findOne({
      $or: [
        { name: ownerName },
        { name: { $regex: new RegExp(ownerName, 'i') } }
      ]
    }).lean();

    console.log('Owner User:', ownerUser ? { id: ownerUser.id, name: ownerUser.name, role: ownerUser.role, managerId: ownerUser.managerId, managerName: ownerUser.managerName } : 'None');

    if (ownerUser?.managerId || ownerUser?.managerName) {
      const managerUser = await User.findOne({
        $or: [
          { id: ownerUser.managerId },
          { userId: ownerUser.managerId },
          { name: ownerUser.managerName }
        ]
      }).lean();
      console.log('Reporting Manager:', managerUser ? { id: managerUser.id, name: managerUser.name, role: managerUser.role } : 'None');
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

testFlatVendor().catch(console.error);
