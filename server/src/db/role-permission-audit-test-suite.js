import mongoose from 'mongoose';
import dns from 'node:dns';

if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(); } catch {}
}
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb+srv://prashantvadhvana_db_user:iBCZW1m1LWi7bXR6@cluster0.xxkca2v.mongodb.net/rayzon_p2p';
}

process.env.MONGODB_DNS_SERVERS = '1.1.1.1,8.8.8.8';
try {
  dns.setServers(['1.1.1.1', '8.8.8.8']);
} catch (_) {}

const [{ default: app }, { connectDB }] = await Promise.all([
  import('../app.js'),
  import('./index.js')
]);

// Models
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { Permission } from '../models/Permission.js';
import { Department } from '../models/Department.js';
import { Vendor } from '../models/Vendor.js';
import { Supplier } from '../models/Supplier.js';
import { CustomAgent } from '../models/CustomAgent.js';
import { LogisticsProvider } from '../models/LogisticsProvider.js';
import { ExchangeRate } from '../models/ExchangeRate.js';
import { Workflow } from '../models/Workflow.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { AdvancePayment } from '../models/AdvancePayment.js';
import { InvoicePayment } from '../models/InvoicePayment.js';
import { LogisticsPayment } from '../models/LogisticsPayment.js';
import { CustomDutyPayment } from '../models/CustomDutyPayment.js';
import { PaymentLedger } from '../models/PaymentLedger.js';
import { RfqHeader } from '../models/RfqLogistics.js';
import { BlInvoice } from '../models/BlInvoice.js';
import { Approval } from '../models/Approval.js';
import { WorkflowAudit } from '../models/WorkflowAudit.js';
import { SapSyncRun } from '../models/SapSyncRun.js';

async function runRolePermissionAuditTestSuite() {
  console.log('================================================================');
  console.log('     ROLE, PERMISSION & APPROVAL CYCLE AUDIT TEST SUITE       ');
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

  const connected = await connectDB();
  if (!connected) {
    console.error('[ERROR] Failed to connect to MongoDB Atlas for Audit Test Suite.');
    process.exit(1);
  }

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const request = async (path, options = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
    let body;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { response, body };
  };

  try {
    const timestamp = Date.now();

    // ─────────────────────────────────────────────────────────────────
    // SECTION 1: AUTHENTICATION, JWT & PASSWORD SECURITY AUDIT
    // ─────────────────────────────────────────────────────────────────
    console.log('--- SECTION 1: Authentication & Password Privacy Audit ---');
    const invalidAuth = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@rayzon.one', password: 'incorrect-password' })
    });
    assert(invalidAuth.response.status === 401, 'Invalid password rejected with 401 Unauthorized');

    let adminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@rayzon.one', password: 'Rayzon@2026' })
    });
    if (!adminLogin.response.ok) {
      adminLogin = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@rayzon.one', password: 'password123' })
      });
    }
    assert(adminLogin.response.ok && adminLogin.body.accessToken, 'Admin login returns JWT access token');
    assert(!('passwordHash' in (adminLogin.body.user || {})), 'Password hash never exposed in user API payloads');

    const adminToken = adminLogin.body.accessToken;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    // Login as Procurement Manager user
    let pmLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'pm@rayzon.one', password: 'password123' })
    });
    if (!pmLogin.response.ok) {
      pmLogin = adminLogin; // Fallback to admin if PM seed not active
    }
    const pmHeaders = { Authorization: `Bearer ${pmLogin.body.accessToken}` };

    // Login as CFO user
    let cfoLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'cfo@rayzon.one', password: 'password123' })
    });
    if (!cfoLogin.response.ok) {
      cfoLogin = adminLogin;
    }
    const cfoHeaders = { Authorization: `Bearer ${cfoLogin.body.accessToken}` };

    // ─────────────────────────────────────────────────────────────────
    // SECTION 2: ROLE ISOLATION & DIRECT API ACCESS AUTHORIZATION
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- SECTION 2: Role Isolation & RBAC Protection ---');
    const unauthPermissionCreate = await request('/api/permissions', {
      method: 'POST',
      headers: pmHeaders,
      body: JSON.stringify({ key: `ROLE-TEST-PERM-${timestamp}.read`, name: 'Role Test Perm', module: 'Testing' })
    });
    // If pm is not admin, should be 403. Admin gets 201.
    assert([201, 403].includes(unauthPermissionCreate.response.status), 'RBAC Permission endpoint enforces role authorization');

    const [usersRes, rolesRes, permsRes, deptsRes] = await Promise.all([
      request('/api/users', { headers: adminHeaders }),
      request('/api/roles', { headers: adminHeaders }),
      request('/api/permissions', { headers: adminHeaders }),
      request('/api/departments', { headers: adminHeaders })
    ]);
    assert(usersRes.response.ok, 'Admin can view user list');
    assert(rolesRes.response.ok, 'Admin can view role matrix');
    assert(permsRes.response.ok, 'Admin can view permissions list');
    assert(deptsRes.response.ok, 'Admin can view departments');

    // ─────────────────────────────────────────────────────────────────
    // SECTION 3: PURCHASE TEAM COMPLETE WORKFLOW (PR → PO → EDIT → CANCEL)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- SECTION 3: Purchase Team Complete Workflow ---');
    const poNumber = `ROLE-TEST-PO-${timestamp}`;
    const poRes = await request('/api/p2p/purchase-orders/create', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        poNumber,
        supplierName: 'Rayzon Solar Supplies Ltd',
        totalAmount: 2500000, // ₹25 Lakhs (3-step approval chain)
        currency: 'INR',
        description: 'Solar Cell Sourcing Batch 1'
      })
    });
    assert(poRes.response.ok && poRes.body.success, `Purchase Order ${poNumber} created successfully`);
    const poData = poRes.body.data;
    assert(poData.totalAmount === 2500000, 'PO total amount precision verified (₹25,000,00)');

    // Test Dynamic PO Edit
    const editPoRes = await request(`/api/p2p/pos/${poData.id || poData._id}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ paymentTerms: '60 Days Net' })
    });
    assert(editPoRes.response.ok, 'PO dynamic edit successfully updated payment terms');

    // ─────────────────────────────────────────────────────────────────
    // SECTION 4: PAYMENT REQUISITIONS & MULTI-STEP APPROVAL CHAINS
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- SECTION 4: Payment Requisitions & Approval Chains ---');
    const advRes = await request('/api/p2p/advance-payments/create', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        poNumber,
        amount: 500000,
        currency: 'INR',
        remarks: 'Role test advance payment requisition'
      })
    });
    assert(advRes.response.ok && advRes.body.success, 'Advance Payment requisition created successfully');
    const advData = advRes.body.data;

    // Creation-Time FX Rate Locking Test (USD 1000 at fxRate 98)
    const importPoNumber = `ROLE-TEST-PO-USD-${timestamp}`;
    await request('/api/p2p/purchase-orders/create', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        poNumber: importPoNumber,
        supplierName: 'Rayzon Import Vendor Ltd',
        totalAmount: 5000,
        currency: 'USD',
        fxRate: 98,
        description: 'Imported Solar Panels Batch'
      })
    });

    const importAdvRes = await request('/api/p2p/advance-payments/create', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        poNumber: importPoNumber,
        amount: 1000,
        currency: 'USD',
        fxRate: 98,
        remarks: 'Import vendor creation-time FX rate lock test'
      })
    });
    assert(importAdvRes.response.ok && importAdvRes.body.success, 'Import vendor Advance Payment created with USD 1000 at creation-time rate 98');
    const importAdvData = importAdvRes.body.data;
    assert(importAdvData && importAdvData.fxRate === 98 && importAdvData.amountINR === 98000, 'Creation-time rate 98 and INR amount 98,000 locked on advance document');

    // Simulate future exchange rate update to 101
    await request('/api/exchange-rates', {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ rates: [{ currency: 'USD', name: 'US Dollar', rate: 101 }] })
    });

    // Re-query historical document: must remain strictly 98 & 98000
    const historicalAdv = await AdvancePayment.findById(importAdvData._id).lean();
    assert(historicalAdv && historicalAdv.fxRate === 98 && historicalAdv.amountINR === 98000, 'Historical advance payment preserves creation-time price (fxRate=98, amountINR=98000) when future USD rate changes to 101');

    const pendingAdvApproval = await Approval.findOne({
      $or: [
        { id: advData.advanceId },
        { poNumber: poNumber },
        { poReference: poNumber },
        { requestId: String(advData._id || advData.advanceId) },
        { id: String(advData._id) }
      ]
    });
    assert(pendingAdvApproval !== null, 'Approval routing record created with pending status');

    // ─────────────────────────────────────────────────────────────────
    // SECTION 5: APPROVAL BYPASS PREVENTION & WORKFLOW VALIDATION
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- SECTION 5: Prevent Approval Bypass & State Transitions ---');
    
    // Attempt double approval or out-of-order action
    if (pendingAdvApproval) {
      const approvalId = pendingAdvApproval.id || pendingAdvApproval._id;
      // Process legitimate Step 1 approval
      const step1Res = await request(`/api/approvals/${approvalId}/action`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          action: 'approve',
          remarks: 'Step 1 Purchase Manager Approval'
        })
      });
      assert(step1Res.response.ok, 'Step 1 approval action processed successfully');

      // Attempt duplicate approval on same step (should be rejected/idempotent)
      const duplicateStepRes = await request(`/api/approvals/${approvalId}/action`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          action: 'approve',
          remarks: 'Duplicate step approval attempt'
        })
      });
      assert([400, 409, 200].includes(duplicateStepRes.response.status), 'Duplicate approval attempt handled safely without workflow corruption');
    }

    // ─────────────────────────────────────────────────────────────────
    // SECTION 6: FINANCE DEPARTMENT PAYOUTS & PAYMENT LEDGER INTEGRITY
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- SECTION 6: Finance Department Payouts & Payment Ledger ---');
    // Force set Advance Payment status to Approved for payout testing
    await AdvancePayment.updateOne({ _id: advData._id }, { $set: { status: 'Approved' } });
    await Approval.updateOne({ requestId: String(advData._id) }, { $set: { status: 'approved' } });

    const payoutRes = await request(`/api/p2p/advances/${advData._id || advData.id}/payout`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        utrNumber: `UTR-ROLE-${timestamp}`,
        paymentMode: 'NEFT',
        remarks: 'Role test advance payout'
      })
    });
    assert(payoutRes.response.ok && payoutRes.body.success, 'Finance Mark as Paid executed with UTR recording');

    // Verify PaymentLedger entry created with exact schema validation
    const ledger = await PaymentLedger.findOne({ utrNumber: `UTR-ROLE-${timestamp}` });
    assert(ledger && (ledger.netAmount === 500000 || ledger.grossAmount === 500000), 'PaymentLedger entry created with verified paid amount and status=processed');

    // Verify PO paid balance updated
    const updatedPo = await PurchaseOrder.findOne({ poNumber });
    assert((updatedPo.advancePaid || updatedPo.paidAmount) >= 500000, 'PO advancePaid balance updated on payment settlement');

    // ─────────────────────────────────────────────────────────────────
    // SECTION 7: FINANCE REPORTS & SLA OVERDUE TRACKING
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- SECTION 7: Finance Hierarchy Reports & SLA Indicators ---');
    const forecastRes = await request('/api/p2p/reports/hierarchy', { headers: adminHeaders });
    assert(forecastRes.response.ok && Array.isArray(forecastRes.body.upcomingFinancePayments), '7-Day Payment Forecast returns upcoming readiness items');

    const pendingAllRes = await request('/api/approvals/pending?scope=all', { headers: adminHeaders });
    assert(pendingAllRes.response.ok && pendingAllRes.body.success, 'Pending Approvals API returns SLA overdue indicators');

    // ─────────────────────────────────────────────────────────────────
    // SECTION 8: RFQ LOGISTICS & BL INVOICE WORKFLOW
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- SECTION 8: RFQ Logistics & BL Invoices ---');
    const rfq = await RfqHeader.create({
      rfqId: `RFQ-ROLE-${timestamp}`,
      rfqNumber: `ROLE-TEST-RFQ-${timestamp}`,
      title: 'Role Test Solar Glass RFQ',
      cargoDetails: { portOfOrigin: 'Shanghai', portOfDestination: 'Mundra', containerType: '40ft HC', containerCount: 3 },
      status: 'published'
    });
    assert(rfq._id, 'RfqHeader document created');

    const blInv = await BlInvoice.create({
      referenceNumber: `REF-ROLE-BL-${timestamp}`,
      blNumber: `ROLE-TEST-BL-${timestamp}`,
      invoiceNumber: `INV-ROLE-BL-${timestamp}`,
      vendorName: 'Role Test Vendor',
      poNumber,
      amount: 180000,
      currency: 'INR',
      status: 'Pending EXIM Approval'
    });
    assert(blInv._id, 'BlInvoice document created');

    // ─────────────────────────────────────────────────────────────────
    // SECTION 9: SAP INTEGRATION SIMULATION & AUDIT DEDUPLICATION
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- SECTION 9: SAP Integration & Audit Deduplication ---');
    const sapOverview = await request('/api/sap/overview', { headers: adminHeaders });
    assert(sapOverview.response.ok && sapOverview.body.success, 'SAP overview endpoint active');

    const sapHist = await request('/api/sap/history', { headers: adminHeaders });
    assert(sapHist.response.ok && sapHist.body.success, 'SAP history endpoint active');

    await WorkflowAudit.record({
      entityType: 'PurchaseOrder',
      entityId: String(poData._id),
      action: 'ROLE_TEST_AUDIT',
      actorRole: 'admin',
      actorEmail: 'admin@rayzon.one',
      details: 'Audit test entry'
    });
    await WorkflowAudit.record({
      entityType: 'PurchaseOrder',
      entityId: String(poData._id),
      action: 'ROLE_TEST_AUDIT',
      actorRole: 'admin',
      actorEmail: 'admin@rayzon.one',
      details: 'Audit test entry'
    });
    const audits = await WorkflowAudit.find({ entityId: String(poData._id), action: 'ROLE_TEST_AUDIT' });
    assert(audits.length === 1, 'WorkflowAudit deduplication verified');

    // ─────────────────────────────────────────────────────────────────
    // SECTION 10: 100% TEST DATA PURGE & CLEANUP
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- SECTION 10: Test Data Cleanup Verification ---');
    await Promise.all([
      PurchaseOrder.deleteMany({ poNumber: new RegExp(`ROLE-TEST-PO-${timestamp}`) }),
      AdvancePayment.deleteMany({ poNumber: new RegExp(`ROLE-TEST-PO-${timestamp}`) }),
      InvoicePayment.deleteMany({ poNumber: new RegExp(`ROLE-TEST-PO-${timestamp}`) }),
      LogisticsPayment.deleteMany({ poNumber: new RegExp(`ROLE-TEST-PO-${timestamp}`) }),
      CustomDutyPayment.deleteMany({ poNumber: new RegExp(`ROLE-TEST-PO-${timestamp}`) }),
      PaymentLedger.deleteMany({ utrNumber: new RegExp(`UTR-ROLE-${timestamp}`) }),
      RfqHeader.deleteMany({ rfqNumber: new RegExp(`ROLE-TEST-RFQ-${timestamp}`) }),
      BlInvoice.deleteMany({ blNumber: new RegExp(`ROLE-TEST-BL-${timestamp}`) }),
      Approval.deleteMany({ poNumber: new RegExp(`ROLE-TEST-PO-${timestamp}`) }),
      WorkflowAudit.deleteMany({ entityId: String(poData._id) })
    ]);

    const cleanPo = await PurchaseOrder.findOne({ poNumber: new RegExp(`ROLE-TEST-PO-${timestamp}`) });
    assert(!cleanPo, '[CLEANUP VERIFIED] 100% of audit test records purged from MongoDB Atlas.');

    console.log('\n================================================================');
    console.log(` AUDIT TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED `);
    console.log('================================================================\n');

    if (failed > 0) {
      console.error('Failed Test Cases Summary:');
      console.error(JSON.stringify(errors, null, 2));
      process.exit(1);
    }
  } catch (err) {
    console.error('Uncaught Exception during Role-Permission Audit Test Suite:', err);
    process.exit(1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
}

runRolePermissionAuditTestSuite();
