import mongoose from '../../node_modules/mongoose/index.js';
import dns from 'node:dns';

dns.setServers(['1.1.1.1', '8.8.8.8']);

const MONGODB_URI = 'mongodb+srv://prashantvadhvana_db_user:iBCZW1m1LWi7bXR6@cluster0.xxkca2v.mongodb.net/rayzon_p2p';

async function checkAkash() {
  await mongoose.connect(MONGODB_URI);
  const { User } = await import('./models/User.js');
  const akash = await User.findOne({ name: /akash/i }).lean();
  console.log('Akash:', akash ? { id: akash.id, name: akash.name, role: akash.role, isManager: akash.isManager } : 'Not found');
  const pooja = await User.findOne({ name: /pooja/i }).lean();
  console.log('Pooja:', pooja ? { id: pooja.id, name: pooja.name, role: pooja.role, isManager: pooja.isManager } : 'Not found');
  await mongoose.disconnect();
  process.exit(0);
}

checkAkash().catch(console.error);
