import mongoose from 'mongoose';
import { PurchaseOrder } from '../server/src/models/PurchaseOrder.js';
import { Vendor } from '../server/src/models/Vendor.js';
import { Supplier } from '../server/src/models/Supplier.js';

async function check() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/p2p';
    await mongoose.connect(mongoUri);

    const po = await PurchaseOrder.findOne({ $or: [{ poId: '4300001491' }, { sapPoNumber: '4300001491' }, { poNumber: '4300001491' }] }).lean();
    console.log('--- PO 4300001491 ---');
    console.log('po.paymentTerms:', po?.paymentTerms);
    console.log('po.creditDays:', po?.creditDays);
    console.log('po.vendorCode:', po?.vendorCode, 'po.vendorId:', po?.vendorId);

    const vendor = await Vendor.findOne({ $or: [{ sapVendorCode: po?.vendorCode || '20000137' }, { id: po?.vendorCode || '20000137' }] }).lean();
    console.log('--- VENDOR ---');
    console.log('vendor.paymentTerms:', vendor?.paymentTerms);
    console.log('vendor.creditDays:', vendor?.creditDays);

    const supplier = await Supplier.findOne({ $or: [{ sapVendorCode: po?.vendorCode || '20000137' }, { id: po?.vendorCode || '20000137' }] }).lean();
    console.log('--- SUPPLIER ---');
    console.log('supplier.paymentTerms:', supplier?.paymentTerms);
    console.log('supplier.creditDays:', supplier?.creditDays);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
check();
