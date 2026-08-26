import mongoose from '../../node_modules/mongoose/index.js';
import dns from 'node:dns';

dns.setServers(['1.1.1.1', '8.8.8.8']);

const MONGODB_URI = 'mongodb+srv://prashantvadhvana_db_user:iBCZW1m1LWi7bXR6@cluster0.xxkca2v.mongodb.net/rayzon_p2p';

async function checkVendor20000026() {
  await mongoose.connect(MONGODB_URI);
  const { Vendor } = await import('./models/Vendor.js');
  const { User } = await import('./models/User.js');

  const vendor = await Vendor.findOne({
    $or: [{ sapVendorCode: '20000026' }, { supplierId: '20000026' }, { id: '20000026' }]
  }).lean();

  console.log('Vendor 20000026:', vendor);

  if (vendor) {
    // Look up vendor in vendors.controller.js list
    const allUsers = await User.find({ status: 'Active' }).sort({ createdAt: 1 }).lean();
    const internalProcurementUsers = allUsers.filter(u => ['procurement', 'purchase'].some(r => (u.role || '').toLowerCase().includes(r)));

    console.log('Procurement Users:', internalProcurementUsers.map(u => ({ id: u.id, name: u.name, role: u.role, managerId: u.managerId, managerName: u.managerName })));

    const allVendors = await Vendor.find({}).sort({ createdAt: 1 }).lean();
    const vIdx = allVendors.findIndex(v => v.sapVendorCode === '20000026' || v.supplierId === '20000026');
    console.log('Vendor Index in Directory:', vIdx);

    if (vIdx >= 0 && internalProcurementUsers.length > 0) {
      const linkedExec = internalProcurementUsers[vIdx % internalProcurementUsers.length];
      console.log('Linked Executive for Vendor 20000026:', linkedExec ? { id: linkedExec.id, name: linkedExec.name, role: linkedExec.role, managerId: linkedExec.managerId, managerName: linkedExec.managerName } : 'None');

      if (linkedExec?.managerId) {
        const mgr = allUsers.find(u => u.id === linkedExec.managerId || u.userId === linkedExec.managerId || u.name === linkedExec.managerName);
        console.log('Reporting Manager:', mgr ? { id: mgr.id, name: mgr.name, role: mgr.role } : 'None');
      }
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

checkVendor20000026().catch(console.error);
