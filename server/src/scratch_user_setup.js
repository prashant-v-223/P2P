import mongoose from '../../node_modules/mongoose/index.js';
import dns from 'node:dns';

dns.setServers(['1.1.1.1', '8.8.8.8']);

const MONGODB_URI = 'mongodb+srv://prashantvadhvana_db_user:iBCZW1m1LWi7bXR6@cluster0.xxkca2v.mongodb.net/rayzon_p2p';

async function checkAndFixUsersAndRoles() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to Atlas DB!');

  const { User } = await import('./models/User.js');
  const { Role } = await import('./models/Role.js');

  // 1. Ensure Procurement Manager role exists in Role collection
  let pmRole = await Role.findOne({ $or: [{ roleName: 'procurement_manager' }, { roleName: 'Procurement Manager' }, { roleKey: 'procurement_manager' }] });
  if (!pmRole) {
    pmRole = await Role.create({
      id: 'role-procurement-manager',
      roleName: 'Procurement Manager',
      roleKey: 'procurement_manager',
      department: 'Procurement',
      description: 'Level 2 Procurement Manager approval role',
      status: 'Active',
      permissions: ['advances.view', 'advances.approve', 'invoices.view', 'invoices.approve', 'pos.view']
    });
    console.log('SUCCESS: Created Procurement Manager in Role collection');
  } else {
    await Role.updateOne({ _id: pmRole._id }, { $set: { status: 'Active', roleName: 'Procurement Manager', roleKey: 'procurement_manager' } });
    console.log('SUCCESS: Updated Procurement Manager role in Role collection');
  }

  // 2. Ensure Pooja Bhat is procurement_manager and Princy reports to Pooja
  const users = await User.find({}).lean();
  const pooja = users.find(u => u.name?.toLowerCase().includes('pooja') || u.email?.toLowerCase().includes('pooja'));
  const princy = users.find(u => u.name?.toLowerCase().includes('princy') || u.email?.toLowerCase().includes('princy'));

  if (pooja) {
    await User.updateOne({ _id: pooja._id }, { $set: { role: 'procurement_manager', hierarchyLevel: 2, isManager: true } });
    console.log('SUCCESS: Updated Pooja Bhat role to procurement_manager, hierarchyLevel: 2');
  }

  if (princy && pooja) {
    await User.updateOne({ _id: princy._id }, { $set: { managerId: pooja.id, managerName: pooja.name, role: 'procurement', hierarchyLevel: 3 } });
    console.log(`SUCCESS: Linked Princy Chodvadiya to manager ${pooja.name} (${pooja.id})`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

checkAndFixUsersAndRoles().catch((err) => {
  console.error(err);
  process.exit(1);
});
