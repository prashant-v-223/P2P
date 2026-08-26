import mongoose from '../../node_modules/mongoose/index.js';
import dns from 'node:dns';

dns.setServers(['1.1.1.1', '8.8.8.8']);

const MONGODB_URI = 'mongodb+srv://prashantvadhvana_db_user:iBCZW1m1LWi7bXR6@cluster0.xxkca2v.mongodb.net/rayzon_p2p';

async function linkFlatVendor() {
  await mongoose.connect(MONGODB_URI);
  const { Vendor } = await import('./models/Vendor.js');
  const { User } = await import('./models/User.js');

  const drashti = await User.findOne({ name: /drashti/i }).lean();
  console.log('Drashti User:', drashti ? { id: drashti.id, name: drashti.name, managerId: drashti.managerId } : 'Not found');

  if (drashti) {
    const res = await Vendor.updateMany(
      { $or: [{ sapVendorCode: '20000026' }, { supplierId: '20000026' }, { companyName: /flat \(hong kong\)/i }] },
      {
        $set: {
          assignedPurchaseManagerId: drashti.id,
          assignedPurchaseManager: drashti.name,
          buyerId: drashti.id,
          buyerName: drashti.name,
          linkedUser: drashti.name
        }
      }
    );
    console.log('Updated Vendors:', res);
  }

  await mongoose.disconnect();
  process.exit(0);
}

linkFlatVendor().catch(console.error);
