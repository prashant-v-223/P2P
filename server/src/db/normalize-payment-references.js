import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import dns from 'node:dns';

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...parts] = trimmed.split('=');
    if (!process.env[key.trim()]) process.env[key.trim()] = parts.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

const [{ InvoicePayment }, { AdvancePayment }, { Approval }, { WorkflowAudit }, { ReferenceSequence }, referenceService] = await Promise.all([
  import('../models/InvoicePayment.js'),
  import('../models/AdvancePayment.js'),
  import('../models/Approval.js'),
  import('../models/WorkflowAudit.js'),
  import('../models/ReferenceSequence.js'),
  import('../services/referenceNumber.service.js')
]);

const apply = process.argv.includes('--apply');
const uri = process.env.MONGODB_URI?.trim();
if (!uri) throw new Error('MONGODB_URI is missing from .env');
if (uri.startsWith('mongodb+srv://')) {
  const configuredDns = process.env.MONGODB_DNS_SERVERS
    ?.split(',')
    .map((server) => server.trim())
    .filter(Boolean);
  dns.setServers(configuredDns?.length ? configuredDns : ['1.1.1.1', '8.8.8.8']);
}

await mongoose.connect(uri, { dbName: process.env.MONGODB_DB_NAME?.trim() || 'rayzon_p2p' });

const plans = [
  {
    type: 'invoice', prefix: 'INV', Model: InvoicePayment,
    idField: 'invoicePaymentId', legacyField: 'legacyInvoicePaymentId', legacyIdsField: 'legacyInvoicePaymentIds', entityType: 'InvoicePayment'
  },
  {
    type: 'advance', prefix: 'ADV', Model: AdvancePayment,
    idField: 'advanceId', legacyField: 'legacyAdvanceId', legacyIdsField: 'legacyAdvanceIds', entityType: 'AdvancePayment'
  }
];

let changed = 0;
for (const plan of plans) {
  const records = await plan.Model.find({}).lean();
  const datedReference = new RegExp(`^${plan.prefix}-(\\d{8})-(\\d+)$`);
  const chronology = (record) => {
    const match = String(record[plan.idField] || '').match(datedReference);
    if (match) return [Number(match[1]), Number(match[2])];
    const date = record.createdAt || record._id?.getTimestamp?.() || new Date(0);
    return [Number(referenceService.getReferenceDatePart(date)) * 10000 + 1231, new Date(date).getTime()];
  };
  records.sort((left, right) => {
    const leftOrder = chronology(left);
    const rightOrder = chronology(right);
    return leftOrder[0] - rightOrder[0] || leftOrder[1] - rightOrder[1] || String(left._id).localeCompare(String(right._id));
  });
  const canonical = new RegExp(`^${plan.prefix}-(\\d{4})-(\\d{3,})$`);
  const usedByDate = new Map();

  for (const record of records) {
    const match = String(record[plan.idField] || '').match(canonical);
    if (!match) continue;
    if (!usedByDate.has(match[1])) usedByDate.set(match[1], new Set());
    usedByDate.get(match[1]).add(Number(match[2]));
  }

  for (const record of records) {
    const oldReference = String(record[plan.idField] || '');
    if (canonical.test(oldReference)) continue;

    const date = record.createdAt || record._id?.getTimestamp?.() || new Date();
    const priorDatedMatch = oldReference.match(datedReference);
    const datePart = priorDatedMatch ? priorDatedMatch[1].slice(0, 4) : referenceService.getReferenceDatePart(date);
    if (!usedByDate.has(datePart)) usedByDate.set(datePart, new Set());
    const used = usedByDate.get(datePart);
    let sequence = 1;
    while (used.has(sequence)) sequence += 1;
    used.add(sequence);
    const newReference = `${plan.prefix}-${datePart}-${String(sequence).padStart(3, '0')}`;

    console.log(`${plan.entityType}: ${oldReference} -> ${newReference}`);
    changed += 1;
    if (!apply) continue;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const legacyIds = [oldReference, record[plan.legacyField], ...(record[plan.legacyIdsField] || [])].filter(Boolean);
        await plan.Model.updateOne(
          { _id: record._id },
          {
            $set: {
              [plan.idField]: newReference,
              [plan.legacyField]: record[plan.legacyField] || oldReference
            },
            $addToSet: { [plan.legacyIdsField]: { $each: legacyIds } }
          },
          { session }
        );
        await Approval.updateMany(
          { $or: [{ id: oldReference }, { 'transactionSnapshot.referenceId': oldReference }] },
          {
            $set: {
              ...(plan.entityType === 'InvoicePayment' ? { 'transactionSnapshot.invoicePaymentId': newReference } : { 'transactionSnapshot.advanceId': newReference }),
              'transactionSnapshot.referenceId': newReference
            }
          },
          { session }
        );
        await Approval.updateMany({ id: oldReference }, { $set: { id: newReference } }, { session });
        await WorkflowAudit.updateMany(
          { entityType: plan.entityType, entityId: oldReference },
          { $set: { entityId: newReference } },
          { session }
        );
        if (plan.entityType === 'InvoicePayment') {
          await AdvancePayment.updateMany({ adjustmentInvoiceId: oldReference }, { $set: { adjustmentInvoiceId: newReference } }, { session });
        } else {
          await InvoicePayment.updateMany({ advanceIdAdjusted: oldReference }, { $set: { advanceIdAdjusted: newReference } }, { session });
        }
        await ReferenceSequence.updateOne(
          { key: `${plan.prefix}-${datePart}` },
          { $max: { value: sequence } },
          { upsert: true, session }
        );
      });
    } finally {
      await session.endSession();
    }
  }

  if (apply) {
    for (const [datePart, used] of usedByDate.entries()) {
      const max = used.size ? Math.max(...used) : 0;
      await ReferenceSequence.updateOne(
        { key: `${plan.prefix}-${datePart}` },
        { $max: { value: max } },
        { upsert: true }
      );
    }
  }
}

console.log(`${apply ? 'Updated' : 'Would update'} ${changed} payment reference(s).${apply ? '' : ' Run with --apply after reviewing this output.'}`);
await mongoose.disconnect();
