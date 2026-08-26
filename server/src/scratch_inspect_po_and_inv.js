import mongoose from '../../node_modules/mongoose/index.js';
import dns from 'node:dns';

dns.setServers(['1.1.1.1', '8.8.8.8']);

const MONGODB_URI = 'mongodb+srv://prashantvadhvana_db_user:iBCZW1m1LWi7bXR6@cluster0.xxkca2v.mongodb.net/rayzon_p2p';

async function inspectPoAndInv() {
  await mongoose.connect(MONGODB_URI);
  const { PurchaseOrder } = await import('./models/PurchaseOrder.js');
  const { InvoicePayment } = await import('./models/InvoicePayment.js');
  const { Approval } = await import('./models/Approval.js');
  const { Vendor } = await import('./models/Vendor.js');
  const { User } = await import('./models/User.js');

  const po = await PurchaseOrder.findOne({ $or: [{ poNumber: '4300001413' }, { sapPoNumber: '4300001413' }] }).lean();
  console.log('PO 4300001413:', po ? {
    poNumber: po.poNumber,
    sapPoNumber: po.sapPoNumber,
    vendorName: po.vendorName,
    vendorId: po.vendorId,
    supplierId: po.supplierId,
    createdBy: po.createdBy,
    createdById: po.createdById,
    buyerName: po.buyerName,
    purchaseManagerId: po.purchaseManagerId
  } : 'Not found');

  const inv = await InvoicePayment.findOne({ $or: [{ invoicePaymentId: 'INV-PAY-780318' }, { invoiceNumber: 'INV-2026-3524' }] }).lean();
  console.log('INV-PAY-780318 Doc:', inv ? {
    invoicePaymentId: inv.invoicePaymentId,
    poId: inv.poId,
    sapPoNumber: inv.sapPoNumber,
    vendorName: inv.vendorName,
    vendorId: inv.vendorId,
    supplierId: inv.supplierId
  } : 'Not found');

  const app = await Approval.findOne({ $or: [{ id: 'INV-PAY-780318' }, { referenceId: 'INV-PAY-780318' }] }).lean();
  console.log('INV-PAY-780318 Approval:', app ? {
    id: app.id,
    vendorName: app.vendorName,
    poReference: app.poReference,
    assignedApproverName: app.assignedApproverName,
    assignedApproverId: app.assignedApproverId,
    assignedApproverRole: app.assignedApproverRole,
    isPoolApproval: app.isPoolApproval
  } : 'Not found');

  await mongoose.disconnect();
  process.exit(0);
}

inspectPoAndInv().catch(console.error);
