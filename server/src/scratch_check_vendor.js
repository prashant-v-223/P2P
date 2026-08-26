import mongoose from '../../node_modules/mongoose/index.js';
import dns from 'node:dns';

dns.setServers(['1.1.1.1', '8.8.8.8']);

const MONGODB_URI = 'mongodb+srv://prashantvadhvana_db_user:iBCZW1m1LWi7bXR6@cluster0.xxkca2v.mongodb.net/rayzon_p2p';

async function checkVendor() {
  await mongoose.connect(MONGODB_URI);
  const { Vendor } = await import('./models/Vendor.js');
  const vendors = await Vendor.find({ companyName: /xinyi/i }).lean();
  console.log('Xinyi Vendors:', vendors);
  await mongoose.disconnect();
  process.exit(0);
}

checkVendor().catch(console.error);
