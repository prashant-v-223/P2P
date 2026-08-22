import mongoose from 'mongoose';
import { InvoicePayment } from '../server/src/models/InvoicePayment.js';

async function check() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/p2p';
    await mongoose.connect(mongoUri);

    const invoices = await InvoicePayment.find({ asnNumber: { $ne: '' } }).select('invoiceNumber asnNumber vendorId createdAt').lean();
    console.log('--- EXISTING INVOICES WITH ASN NUMBERS ---');
    console.log(JSON.stringify(invoices, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
check();
