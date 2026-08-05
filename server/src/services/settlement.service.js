import { PaymentLedger } from '../models/PaymentLedger.js';
import crypto from 'node:crypto';

/**
 * Automatically creates a PaymentLedger record when a payment is fully approved.
 * @param {Object} params
 * @param {Object} params.approval - The Approval model instance
 * @param {string} params.actingUser - The user who performed the final approval
 */
export async function postSettlementLedgerEntry({ approval, actingUser }) {
  try {
    if (!approval || !approval.id) return;

    // Map approval type to payableType enum
    let payableType = 'AdvancePayment';
    if (approval.type === 'Invoice Payment') payableType = 'InvoicePayment';
    else if (approval.type === 'BL Freight Invoice') payableType = 'RfqBlInvoice';
    else if (approval.type === 'Custom Duty') payableType = 'CustomDutyPayment';
    else if (approval.type === 'Logistics Payment') payableType = 'LogisticsPayment';

    // Prevent duplicate entries
    const existing = await PaymentLedger.findOne({ payableId: approval.id });
    if (existing) return existing;

    const grossAmount = Number.parseFloat(approval.amountINR || approval.amountOriginal) || 0;
    const tdsAmount = Math.round(grossAmount * 0.02 * 100) / 100; // 2% TDS default estimate
    const netAmount = grossAmount - tdsAmount;

    // Generate unique UTR
    const utrPrefix = payableType === 'AdvancePayment' ? 'ADV' : payableType === 'InvoicePayment' ? 'INV' : 'PAY';
    const utrNumber = `${utrPrefix}-${Date.now().toString().slice(-8)}${Math.floor(1000 + Math.random() * 9000)}`;

    const ledgerRecord = await PaymentLedger.create({
      paymentId: `ledg-${crypto.randomUUID()}`,
      payableType,
      payableId: approval.id,
      referenceNumber: approval.poReference || approval.id,
      vendorId: approval.vendorId || `v-${approval.vendorName?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'unknown'}`,
      vendorName: approval.vendorName || 'Vendor',
      grossAmount,
      tdsAmount,
      netAmount,
      paymentMode: 'RTGS',
      bankName: 'HDFC Bank - Main Corporate',
      bankAccountNumber: '50200049281745',
      utrNumber,
      status: 'processed',
      paidAt: new Date(),
      processedBy: actingUser || 'System Approval Engine'
    });

    console.log(`[SETTLEMENT LEDGER] Posted settlement record ${ledgerRecord.paymentId} for approval ${approval.id}`);
    return ledgerRecord;
  } catch (err) {
    console.error('[SETTLEMENT LEDGER ERROR]: Failed to post ledger entry:', err.message);
  }
}
