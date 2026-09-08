import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns';
import mongoose from 'mongoose';

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...parts] = trimmed.split('=');
    if (!process.env[key.trim()]) process.env[key.trim()] = parts.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

const apply = process.argv.includes('--apply');
const uri = process.env.MONGODB_URI?.trim();
if (!uri) throw new Error('MONGODB_URI is missing from .env');
if (uri.startsWith('mongodb+srv://')) {
  const configuredDns = process.env.MONGODB_DNS_SERVERS?.split(',').map((value) => value.trim()).filter(Boolean);
  dns.setServers(configuredDns?.length ? configuredDns : ['1.1.1.1', '8.8.8.8']);
}

await mongoose.connect(uri, { dbName: process.env.MONGODB_DB_NAME?.trim() || 'rayzon_p2p' });
const [{ InvoicePayment }, { ExchangeRate }] = await Promise.all([
  import('../models/InvoicePayment.js'),
  import('../models/ExchangeRate.js')
]);

const rates = new Map((await ExchangeRate.find({}).lean()).map((item) => [String(item.currency).toUpperCase(), Number(item.rate)]));
const invoices = await InvoicePayment.find({}).lean();
let changed = 0;

for (const invoice of invoices) {
  const currency = String(invoice.currency || 'INR').toUpperCase();
  const storedRate = Number(invoice.fxRate);
  const rate = currency === 'INR' ? 1 : (storedRate > 1 ? storedRate : rates.get(currency));
  if (!rate || rate <= 0) {
    console.warn(`Skipped ${invoice.invoicePaymentId}: no database exchange rate for ${currency}.`);
    continue;
  }

  const grossAmountINR = Math.round(Number(invoice.grossAmount || 0) * rate * 100) / 100;
  const amountINR = Math.round(Number(invoice.netPayable || 0) * rate * 100) / 100;
  const needsUpdate = storedRate !== rate || Number(invoice.grossAmountINR) !== grossAmountINR || Number(invoice.amountINR) !== amountINR;
  if (!needsUpdate) continue;

  console.log(`${invoice.invoicePaymentId}: rate=${rate}, grossINR=${grossAmountINR}, netINR=${amountINR}`);
  changed += 1;
  if (apply) {
    await InvoicePayment.updateOne(
      { _id: invoice._id },
      { $set: { fxRate: rate, grossAmountINR, amountINR } }
    );
  }
}

console.log(`${apply ? 'Updated' : 'Would update'} ${changed} invoice FX snapshot(s).${apply ? '' : ' Run with --apply after reviewing this output.'}`);
await mongoose.disconnect();
