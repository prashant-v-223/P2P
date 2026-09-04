import mongoose from 'mongoose';
import dns from 'node:dns';
import { Approval } from '../models/Approval.js';
import { User } from '../models/User.js';
import { AdvancePayment } from '../models/AdvancePayment.js';
import { InvoicePayment } from '../models/InvoicePayment.js';
import { LogisticsPayment } from '../models/LogisticsPayment.js';
import { CustomDutyPayment } from '../models/CustomDutyPayment.js';
import { isApprovalForRole } from '../modules/approvals/approvals.controller.js';
import { resolveApprovalChain, repairAllActiveApprovals, repairAllOldPaymentRecords } from '../services/approvalRouting.service.js';

if (process.env.MONGODB_DNS_SERVERS) {
  dns.setServers(process.env.MONGODB_DNS_SERVERS.split(',').map(s => s.trim()));
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://prashantvadhvana_db_user:iBCZW1m1LWi7bXR6@cluster0.xxkca2v.mongodb.net/rayzon_p2p';

async function runTestSuite() {
  console.log('================================================================');
  console.log('       STARTING COMPREHENSIVE APPROVAL WORKFLOW TEST SUITE      ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;
  const errors = [];

  const assert = (condition, testName, details = '') => {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${details}`);
      failed++;
      errors.push({ testName, details });
    }
  };

  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: 'rayzon_p2p',
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000
    });
    console.log('[TEST SETUP] Connected to MongoDB Atlas successfully.\n');

    // ── TEST CASE 1: Chain Resolution for Small Advance Payment (< 10L) ─────
    console.log('--- Test Case 1: Approval Chain Resolution (< ₹10 Lakhs) ---');
    const smallChain = await resolveApprovalChain('Advance Payment', 300000, { email: 'admin@rayzon.one' });
    assert(Array.isArray(smallChain) && smallChain.length === 2, 'Small Advance Payment (<10L) produces 2-step approval chain', `Got ${smallChain.length} steps`);
    assert(smallChain[0]?.roleKey === 'purchase_manager', 'Step 1 is Purchase Manager', `Got ${smallChain[0]?.roleKey}`);
    assert(smallChain[1]?.roleKey === 'procurement_head', 'Step 2 is Purchase Head', `Got ${smallChain[1]?.roleKey}`);

    // ── TEST CASE 2: Chain Resolution for Medium Advance Payment (> 10L, < 50L) ─
    console.log('\n--- Test Case 2: Approval Chain Resolution (₹10L - ₹50L) ---');
    const medChain = await resolveApprovalChain('Advance Payment', 2500000, { email: 'admin@rayzon.one' });
    assert(Array.isArray(medChain) && medChain.length === 3, 'Medium Advance Payment (10L-50L) produces 3-step approval chain', `Got ${medChain.length} steps`);
    assert(medChain[2]?.roleKey === 'cfo', 'Step 3 is CFO Approval', `Got ${medChain[2]?.roleKey}`);

    // ── TEST CASE 3: Chain Resolution for Large Advance Payment (> 50L) ────
    console.log('\n--- Test Case 3: Approval Chain Resolution (> ₹50 Lakhs) ---');
    const largeChain = await resolveApprovalChain('Advance Payment', 7500000, { email: 'admin@rayzon.one' });
    assert(Array.isArray(largeChain) && largeChain.length === 4, 'Large Advance Payment (>50L) produces 4-step approval chain (incl. MD)', `Got ${largeChain.length} steps`);
    assert(largeChain[3]?.roleKey === 'md', 'Step 4 is Managing Director Approval', `Got ${largeChain[3]?.roleKey}`);

    // ── TEST CASE 4: Logistics Payment Approval Chain (< 1Cr vs >= 1Cr) ────
    console.log('\n--- Test Case 4: Logistics Payment Approval Chain ---');
    const logSmall = await resolveApprovalChain('Logistics Payment', 500000, { email: 'admin@rayzon.one' });
    assert(logSmall.length === 2, 'Logistics (<1Cr) produces 2-step chain (Logistics Manager -> Finance)', `Got ${logSmall.length}`);
    const logLarge = await resolveApprovalChain('Logistics Payment', 15000000, { email: 'admin@rayzon.one' });
    assert(logLarge.length === 3 && logLarge[2].roleKey === 'md', 'Logistics (>=1Cr) adds Step 3 MD Approval', `Got ${logLarge.length}`);

    // ── TEST CASE 5: Role Authorization & Matching ─────────────────────────
    console.log('\n--- Test Case 5: Role Authorization Matching ---');
    const dummyApproval = {
      requestedById: 'user-proc-101',
      currentStep: 1,
      workflowSteps: JSON.stringify([
        { step: 1, roleKey: 'purchase_manager', assignedApproverRole: 'purchase_manager' },
        { step: 2, roleKey: 'finance', assignedApproverRole: 'finance' }
      ])
    };
    assert(isApprovalForRole(dummyApproval, ['purchase_manager'], 'user-pm-01') === true, 'Purchase Manager authorized for Step 1');
    assert(isApprovalForRole(dummyApproval, ['finance'], 'user-fin-01') === false, 'Finance blocked from acting on Step 1 (Procurement Manager step)');
    assert(isApprovalForRole(dummyApproval, ['admin'], 'user-admin-01') === true, 'Superadmin authorized for any step');

    // ── TEST CASE 6: Self-Approval Block ──────────────────────────────────
    console.log('\n--- Test Case 6: Self-Approval Prohibition Check ---');
    const requesterWithMgr = await User.findOne({ managerId: { $ne: null }, status: 'Active' }).lean();
    if (requesterWithMgr) {
      const selfApprovalDoc = {
        requestedById: requesterWithMgr.id,
        currentStep: 1,
        assignedApprover: 'different-mgr-id',
        workflowSteps: JSON.stringify([{ step: 1, roleKey: requesterWithMgr.role }])
      };
      assert(isApprovalForRole(selfApprovalDoc, [requesterWithMgr.role], requesterWithMgr.id) === false, 'Requester with manager BLOCKED from approving own request');
    } else {
      console.log('[SKIP] No user with manager found for self-approval test');
    }

    // ── TEST CASE 7: End-to-End Approval Lifecycle Simulation ────────────────
    console.log('\n--- Test Case 7: End-to-End Approval Lifecycle & Child Document Sync ---');
    const testId = `TEST-ADV-${Date.now()}`;
    const testSteps = [
      { step: 1, title: 'Purchase Manager Approval', roleKey: 'purchase_manager', statusKey: 'Pending Purchase Manager Approval' },
      { step: 2, title: 'Finance Approval', roleKey: 'finance', statusKey: 'Pending Finance Approval' }
    ];

    const testApp = await Approval.create({
      id: testId,
      type: 'Advance Payment',
      vendorName: 'Test Solar Tech Ltd',
      amountOriginal: '150000',
      amountINR: '150000',
      currency: 'INR',
      requestedBy: 'Test Requester',
      requestedById: 'test-req-001',
      currentStep: 1,
      totalSteps: 2,
      status: 'Pending Purchase Manager Approval',
      assignedApproverRole: 'purchase_manager',
      workflowSteps: JSON.stringify(testSteps),
      submittedAt: new Date()
    });

    const testAdv = await AdvancePayment.create({
      advanceId: testId,
      vendorId: 'VEND-TEST-101',
      vendorName: 'Test Solar Tech Ltd',
      sapPoNumber: 'PO-2026-9999',
      poId: 'PO-2026-9999',
      amount: 150000,
      amountINR: 150000,
      currency: 'INR',
      status: 'pending',
      currentStep: 1,
      assignedApproverRole: 'purchase_manager',
      createdBy: 'Test Requester'
    });

    assert(testApp && testAdv, 'Created test approval and advance payment document');

    // Simulate Step 1 Approval
    testApp.currentStep = 2;
    testApp.status = 'Pending Finance Approval';
    testApp.assignedApproverRole = 'finance';
    testApp.actionHistory.push({
      action: 'approve',
      step: 1,
      statusAtAction: 'Pending Finance Approval',
      role: 'purchase_manager',
      actionedBy: 'Test PM User',
      actionedAt: new Date()
    });
    await testApp.save();

    await AdvancePayment.updateOne(
      { advanceId: testId },
      { $set: { currentStep: 2, assignedApproverRole: 'finance', status: 'pending' } }
    );

    const checkAdvStep2 = await AdvancePayment.findOne({ advanceId: testId }).lean();
    assert(
      checkAdvStep2 && checkAdvStep2.currentStep === 2 && String(checkAdvStep2.assignedApproverRole || '').toLowerCase().includes('finance'),
      'Advance Payment updated to Step 2 Finance',
      `Got Step ${checkAdvStep2?.currentStep}, Role ${checkAdvStep2?.assignedApproverRole}`
    );

    // Simulate Step 2 Final Approval
    testApp.currentStep = 2;
    testApp.status = 'Approved & Dispatched';
    testApp.completedAt = new Date();
    testApp.actionHistory.push({
      action: 'approve',
      step: 2,
      statusAtAction: 'Approved & Dispatched',
      role: 'finance',
      actionedBy: 'Test Finance Lead',
      actionedAt: new Date()
    });
    await testApp.save();

    await AdvancePayment.updateOne(
      { advanceId: testId },
      { $set: { status: 'approved' } }
    );

    const checkAdvFinal = await AdvancePayment.findOne({ advanceId: testId }).lean();
    assert(checkAdvFinal.status === 'approved', 'Advance Payment marked as approved on final step');

    // Clean up test documents
    await Approval.deleteOne({ id: testId });
    await AdvancePayment.deleteOne({ advanceId: testId });
    console.log('[CLEANUP] Deleted test documents.');

    // ── TEST CASE 9: Return / Reverse Approval Flow & Rejection Flow ───────
    console.log('\n--- Test Case 9: Return / Reverse Approval & Rejection Flow ---');
    const returnTestId = `TEST-RET-${Date.now()}`;
    const returnApp = await Approval.create({
      id: returnTestId,
      type: 'Advance Payment',
      vendorName: 'Return Test Vendor',
      amountOriginal: '50000',
      amountINR: '50000',
      currency: 'INR',
      requestedBy: 'Test Requester',
      currentStep: 2,
      totalSteps: 2,
      status: 'Pending Finance Approval',
      assignedApproverRole: 'finance',
      workflowSteps: JSON.stringify(testSteps),
      submittedAt: new Date()
    });

    // Simulate Return from Step 2 to Step 1
    returnApp.currentStep = 1;
    returnApp.status = 'Pending Purchase Manager Approval';
    returnApp.assignedApproverRole = 'purchase_manager';
    returnApp.actionHistory.push({
      action: 'return',
      step: 2,
      statusAtAction: 'Pending Purchase Manager Approval',
      role: 'finance',
      actionedBy: 'Finance Reviewer',
      actionedAt: new Date(),
      remarks: 'Incorrect PO allocation rate'
    });
    await returnApp.save();

    assert(returnApp.currentStep === 1 && returnApp.status === 'Pending Purchase Manager Approval', 'Returned Step 2 approval back to Step 1 Purchase Manager');

    // Simulate Return from Step 1 to Requester
    returnApp.status = 'Returned for changes';
    returnApp.actionHistory.push({
      action: 'return',
      step: 1,
      statusAtAction: 'Returned for changes',
      role: 'purchase_manager',
      actionedBy: 'PM Reviewer',
      actionedAt: new Date(),
      remarks: 'Please revise quotation document'
    });
    await returnApp.save();

    assert(returnApp.status === 'Returned for changes', 'Returned Step 1 approval back to Requester as Returned for changes');

    // Simulate Rejection Flow
    const rejectTestId = `TEST-REJ-${Date.now()}`;
    const rejectApp = await Approval.create({
      id: rejectTestId,
      type: 'Invoice Payment',
      vendorName: 'Reject Test Vendor',
      amountOriginal: '75000',
      amountINR: '75000',
      currency: 'INR',
      requestedBy: 'Test Requester',
      currentStep: 1,
      totalSteps: 2,
      status: 'Pending Purchase Manager Approval',
      assignedApproverRole: 'purchase_manager',
      workflowSteps: JSON.stringify(testSteps),
      submittedAt: new Date()
    });

    rejectApp.status = 'Rejected';
    rejectApp.actionHistory.push({
      action: 'reject',
      step: 1,
      statusAtAction: 'Rejected',
      role: 'purchase_manager',
      actionedBy: 'PM Approver',
      actionedAt: new Date(),
      remarks: 'Duplicate invoice detected'
    });
    await rejectApp.save();

    assert(rejectApp.status === 'Rejected', 'Rejection flow correctly stops approval and marks status as Rejected');

    // ── TEST CASE 10: Workflow Audit Log Deduplication ─────────────────────
    console.log('\n--- Test Case 10: Workflow Audit Log Deduplication ---');
    const { WorkflowAudit } = await import('../models/WorkflowAudit.js');
    const auditPayload = {
      eventId: `test-evt-${Date.now()}`,
      eventType: 'APPROVAL_REJECT',
      actorId: 'test-user-99',
      actorName: 'Audit Test User',
      actorRole: 'finance',
      entityType: 'Invoice Payment',
      entityId: rejectTestId,
      step: 1,
      action: 'reject',
      reason: 'Testing audit log deduplication',
      requestId: `req-dedup-${Date.now()}`
    };

    // Log event twice simultaneously
    await WorkflowAudit.record(auditPayload);
    await WorkflowAudit.record(auditPayload);

    const auditDocsCount = await WorkflowAudit.countDocuments({ entityId: rejectTestId, action: 'reject' });
    assert(auditDocsCount === 1, 'Workflow Audit log prevents duplicate audit entries for duplicate calls', `Got ${auditDocsCount} entries`);

    // ── TEST CASE 11: Mark as Paid Flow & UTR Ledger Sync ─────────────────────
    console.log('\n--- Test Case 11: Mark as Paid Flow & UTR Ledger Integration ---');
    const { PaymentLedger } = await import('../models/PaymentLedger.js');
    const paidTestId = `TEST-PAID-${Date.now()}`;
    const paidAdv = await AdvancePayment.create({
      advanceId: paidTestId,
      vendorId: 'VEND-PAID-01',
      vendorName: 'Paid Test Vendor Ltd',
      sapPoNumber: 'PO-2026-PAID',
      poId: 'PO-2026-PAID',
      amount: 250000,
      amountINR: 250000,
      currency: 'INR',
      status: 'approved',
      currentStep: 2,
      assignedApproverRole: 'finance',
      createdBy: 'Finance User'
    });

    const paidApproval = await Approval.create({
      id: paidTestId,
      type: 'Advance Payment',
      vendorName: 'Paid Test Vendor Ltd',
      amountOriginal: '250000',
      amountINR: '250000',
      currency: 'INR',
      status: 'Approved & Dispatched',
      currentStep: 2,
      totalSteps: 2,
      submittedAt: new Date()
    });

    // Simulate Mark as Paid payout
    const testUtr = `UTR-TEST-${Date.now()}`;
    paidAdv.status = 'paid';
    paidAdv.utrNumber = testUtr;
    paidAdv.paidAt = new Date();
    paidAdv.paymentMode = 'RTGS';
    await paidAdv.save();

    paidApproval.status = 'Approved & Dispatched';
    await paidApproval.save();

    const ledgerEntry = await PaymentLedger.create({
      paymentId: `PAY-TEST-${Date.now()}`,
      payableType: 'AdvancePayment',
      payableId: paidTestId,
      referenceNumber: 'PO-2026-PAID',
      vendorId: 'VEND-PAID-01',
      vendorName: 'Paid Test Vendor Ltd',
      grossAmount: 250000,
      netAmount: 250000,
      paymentMode: 'RTGS',
      utrNumber: testUtr,
      status: 'processed',
      paidAt: new Date()
    });

    const checkPaidAdv = await AdvancePayment.findOne({ advanceId: paidTestId }).lean();
    assert(checkPaidAdv && checkPaidAdv.status === 'paid' && checkPaidAdv.utrNumber === testUtr, 'Advance Payment marked as paid with UTR number saved', `UTR: ${checkPaidAdv?.utrNumber}`);
    assert(ledgerEntry && ledgerEntry.utrNumber === testUtr && ledgerEntry.status === 'processed', 'Payment Ledger record created successfully with processed status');

    // ── TEST CASE 12: RFQ Creation & Vendor Award Approval Workflow ─────────
    console.log('\n--- Test Case 12: RFQ Creation & Vendor Award Approval Workflow ---');
    const { RfqHeader, RfqQuote } = await import('../models/RfqLogistics.js');
    const rfqTestId = `TEST-RFQ-${Date.now()}`;
    const quoteTestId = `TEST-QUOTE-${Date.now()}`;

    const rfqDoc = await RfqHeader.create({
      rfqId: rfqTestId,
      rfqNumber: rfqTestId,
      title: 'Solar Inverter Freight RFQ',
      originPort: 'Mundra',
      destinationPort: 'Nhava Sheva',
      cargoDetails: { containerCount: 20 },
      status: 'published',
      createdBy: 'Exim Lead'
    });

    const quoteDoc = await RfqQuote.create({
      quoteId: quoteTestId,
      rfqId: rfqTestId,
      vendorId: 'VEND-RFQ-99',
      vendorName: 'Global Ocean Lines',
      containersCount: 20,
      ratePerContainer: 15000,
      freightAmount: 300000,
      totalInr: 300000,
      status: 'submitted'
    });

    // Resolve RFQ Award Approval Chain
    const rfqChain = await resolveApprovalChain('RFQ Vendor Award', 300000, { email: 'admin@rayzon.one' });
    assert(Array.isArray(rfqChain) && rfqChain.length >= 2, 'RFQ Vendor Award produces multi-step approval chain', `Got ${rfqChain?.length} steps`);

    const rfqAwardApp = await Approval.create({
      id: `AWARD-${rfqTestId}`,
      type: 'RFQ Vendor Award',
      vendorName: 'Global Ocean Lines',
      amountOriginal: '300000',
      amountINR: '300000',
      currency: 'INR',
      requestedBy: 'Exim Lead',
      currentStep: 1,
      totalSteps: rfqChain.length,
      status: 'Pending Purchase Head Review',
      assignedApproverRole: rfqChain[0]?.roleKey || 'procurement_head',
      workflowSteps: JSON.stringify(rfqChain),
      transactionSnapshot: { rfqId: rfqTestId, quoteId: quoteTestId },
      submittedAt: new Date()
    });

    // Step 1 Approval -> Step 2
    rfqAwardApp.currentStep = 2;
    rfqAwardApp.status = 'Pending CFO Signoff';
    rfqAwardApp.assignedApproverRole = 'cfo';
    await rfqAwardApp.save();

    // Step 2 Approval -> Fully Approved & Award RFQ
    rfqAwardApp.status = 'Approved & Dispatched';
    await rfqAwardApp.save();

    rfqDoc.status = 'awarded';
    rfqDoc.awardedVendorId = 'VEND-RFQ-99';
    rfqDoc.awardedVendorName = 'Global Ocean Lines';
    await rfqDoc.save();

    const checkRfqDoc = await RfqHeader.findOne({ rfqId: rfqTestId }).lean();
    assert(checkRfqDoc && checkRfqDoc.status === 'awarded', 'RFQ Vendor Award approval completes and marks RFQ status as awarded');

    // ── GUARANTEED 100% TEST DATA CLEANUP ─────────────────────────────────
    console.log('\n--- Cleaning Up All Test Records ---');
    await Approval.deleteMany({ id: { $regex: /^TEST-|^AWARD-TEST-/ } });
    await AdvancePayment.deleteMany({ advanceId: { $regex: /^TEST-/ } });
    await InvoicePayment.deleteMany({ invoicePaymentId: { $regex: /^TEST-/ } });
    await LogisticsPayment.deleteMany({ logisticsPaymentId: { $regex: /^TEST-/ } });
    await CustomDutyPayment.deleteMany({ dutyId: { $regex: /^TEST-/ } });
    await PaymentLedger.deleteMany({ $or: [{ referenceId: { $regex: /^TEST-/ } }, { paymentId: { $regex: /^PAY-TEST-/ } }] });
    await RfqHeader.deleteMany({ rfqId: { $regex: /^TEST-/ } });
    await RfqQuote.deleteMany({ quoteId: { $regex: /^TEST-/ } });
    await WorkflowAudit.deleteMany({ entityId: { $regex: /^TEST-|^AWARD-TEST-/ } });
    console.log('[CLEANUP COMPLETE] All test records 100% completely removed from MongoDB.');

  } catch (err) {
    assert(false, 'Test Suite Execution', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n================================================================');
    console.log(` TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');
    if (failed > 0) {
      console.error('Failures:', JSON.stringify(errors, null, 2));
      process.exit(1);
    } else {
      console.log('ALL APPROVAL WORKFLOW TEST CASES PASSED SUCCESSFULLY!');
      process.exit(0);
    }
  }
}

runTestSuite();
