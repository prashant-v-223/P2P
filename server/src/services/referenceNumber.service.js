import { ReferenceSequence } from '../models/ReferenceSequence.js';

const PREFIXES = Object.freeze({
  invoice: 'INV',
  advance: 'ADV'
});

export function getReferenceDatePart(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return value.year;
}

export async function getNextReferenceNumber(type, date = new Date(), options = {}) {
  const prefix = PREFIXES[type];
  if (!prefix) throw new Error(`Unsupported reference type: ${type}`);

  const datePart = getReferenceDatePart(date);
  const key = `${prefix}-${datePart}`;
  const sequence = await ReferenceSequence.findOneAndUpdate(
    { key },
    { $inc: { value: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true, session: options.session }
  );

  return `${key}-${String(sequence.value).padStart(3, '0')}`;
}

export async function setReferenceSequenceFloor(type, date, value, options = {}) {
  const prefix = PREFIXES[type];
  if (!prefix) throw new Error(`Unsupported reference type: ${type}`);
  const key = `${prefix}-${getReferenceDatePart(date)}`;
  return ReferenceSequence.findOneAndUpdate(
    { key },
    { $max: { value: Number(value) || 0 } },
    { upsert: true, new: true, setDefaultsOnInsert: true, session: options.session }
  );
}
