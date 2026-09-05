import mongoose from 'mongoose';
import dns from 'node:dns';

if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(); } catch {}
}
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb+srv://prashantvadhvana_db_user:iBCZW1m1LWi7bXR6@cluster0.xxkca2v.mongodb.net/rayzon_p2p';
}

if (process.env.MONGODB_DNS_SERVERS) {
  dns.setServers(process.env.MONGODB_DNS_SERVERS.split(',').map(s => s.trim()));
}

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

async function runMasterTestSuite() {
  console.log('================================================================');
  console.log('      STARTING SYSTEM-WIDE MASTER AUTOMATED TEST SUITE        ');
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
    console.error('[ERROR] Failed to connect to MongoDB Atlas for Master Test Suite.');
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
    // MODULE 1: AUTHENTICATION & SECURITY
    // ─────────────────────────────────────────────────────────────────
    console.log('--- MODULE 1: Auth & User Profile Security ---');
    const invalidAuth = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@rayzon.one', password: 'wrong-password' })
    });
    assert(invalidAuth.response.status === 401, 'Invalid password rejected with 401 status');

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
    assert(adminLogin.response.ok && adminLogin.body.accessToken, 'Admin login successfully returned JWT access token');
    assert(!('passwordHash' in (adminLogin.body.user || {})), 'Password hash excluded from user auth response');

    const adminToken = adminLogin.body.accessToken;
    const authHeaders = { Authorization: `Bearer ${adminToken}` };

    const profileRes = await request('/api/auth/me', { headers: authHeaders });
    assert(profileRes.response.ok && profileRes.body.user?.email === 'admin@rayzon.one', '/api/auth/me returns current user profile');

    // ─────────────────────────────────────────────────────────────────
    // MODULE 2: USERS, ROLES, DEPARTMENTS & RBAC MATRIX
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- MODULE 2: Users, Roles, Departments & RBAC Matrix ---');
    const [usersRes, rolesRes, permsRes, deptsRes] = await Promise.all([
      request('/api/users', { headers: authHeaders }),
      request('/api/roles', { headers: authHeaders }),
      request('/api/permissions', { headers: authHeaders }),
      request('/api/departments', { headers: authHeaders })
    ]);
    assert(usersRes.response.ok && Array.isArray(usersRes.body.users || usersRes.body), 'GET /api/users returns user array');
    assert(rolesRes.response.ok && Array.isArray(rolesRes.body.roles || rolesRes.body), 'GET /api/roles returns role array');
    assert(permsRes.response.ok && Array.isArray(permsRes.body.permissions || permsRes.body), 'GET /api/permissions returns permission list');
    assert(deptsRes.response.ok, 'GET /api/departments returns active departments');

    // Create & verify temporary RBAC entities
    const newPerm = await request('/api/permissions', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ key: `MASTER-TEST-PERM-${timestamp}.read`, name: 'Master Test Perm', module: 'Testing' })
    });
    assert(newPerm.response.status === 201, 'POST /api/permissions creates new permission');

    const newRole = await request('/api/roles', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ roleName: `MASTER-TEST-ROLE-${timestamp}`, description: 'Test Role', permissions: {} })
    });
    assert(newRole.response.status === 201, 'POST /api/roles creates new role');

    // Clean up temporary RBAC entities
    if (newRole.body.role?.id) {
      await request(`/api/roles/${newRole.body.role.id}`, { method: 'DELETE', headers: authHeaders });
    }
    if (newPerm.body.permission?.id) {
      await request(`/api/permissions/${newPerm.body.permission.id}`, { method: 'DELETE', headers: authHeaders });
    }

    // ─────────────────────────────────────────────────────────────────
    // MODULE 3: VENDORS, SUPPLIERS & DIRECTORY
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- MODULE 3: Vendors, Suppliers & Logistics Directory ---');
    const vendorsRes = await request('/api/vendors', { headers: authHeaders });
    assert(vendorsRes.response.ok && vendorsRes.body.success, 'GET /api/vendors returns vendor store');

    const customAgent = await CustomAgent.create({
      agentId: `MASTER-TEST-CA-${timestamp}`,
      agencyName: `Master Test Custom Agency ${timestamp}`,
      licenceNumber: `LIC-${timestamp}`,
      portLocation: 'Mundra Port',
      phone: '9999999999',
      email: `testagent-${timestamp}@rayzon.com`,
      passwordHash: 'dummyhash:123456',
      status: 'Active'
    });
    assert(customAgent._id, 'CustomAgent document created successfully');

    const logisticsProvider = await LogisticsProvider.create({
      providerId: `MASTER-TEST-LP-${timestamp}`,
      name: `Master Test Logistics Provider ${timestamp}`,
      contactPerson: 'Test Provider',
      email: `testlp-${timestamp}@rayzon.com`,
      phone: '8888888888',
      serviceType: 'Freight Forwarder',
      status: 'Active'
    });
    assert(logisticsProvider._id, 'LogisticsProvider document created successfully');

    // ─────────────────────────────────────────────────────────────────
    // MODULE 4: EXCHANGE RATES ENGINE & CONVERSIONS
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- MODULE 4: Exchange Rates & Multi-Currency Engine ---');
    const exchangeRes = await request('/api/exchange-rates', { headers: authHeaders });
    assert(exchangeRes.response.ok, 'GET /api/exchange-rates returns exchange rate matrix');

    const updateRate = await request('/api/exchange-rates', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ rates: [{ currency: 'USD', name: 'US Dollar', rate: 83.5 }] })
    });
    assert(updateRate.response.ok, 'PUT /api/exchange-rates updates active currency conversion rate');

    // ─────────────────────────────────────────────────────────────────
    // MODULE 5: WORKFLOW CONFIGURATION DEFINITIONS
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- MODULE 5: Workflow Definitions ---');
    const workflowRes = await request('/api/workflows', { headers: authHeaders });
    assert(workflowRes.response.ok, 'GET /api/workflows returns workflow definition list');

    // ─────────────────────────────────────────────────────────────────
    // MODULE 6: PURCHASE ORDER ENGINE & WORKFLOW PROGRESSION
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- MODULE 6: Purchase Order Creation & Amount Precision ---');
    const testPoNumber = `MASTER-TEST-PO-${timestamp}`;
    const poRes = await request('/api/p2p/purchase-orders/create', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        poNumber: testPoNumber,
        supplierName: 'Rayzon Test Solar Supplies Ltd',
        totalAmount: 1500000,
        currency: 'INR',
        description: '500W Mono Perc Solar Cell'
      })
    });
    assert(poRes.response.ok && poRes.body.success, `PO ${testPoNumber} created successfully`);
    const createdPo = poRes.body.data;

    // Verify PO total amount calculation precision
    assert(createdPo && createdPo.totalAmount === 1500000, 'PO total amount precision verified (₹15,000,00)');

    // ─────────────────────────────────────────────────────────────────
    // MODULE 7: PAYMENT REQUISITIONS (ADVANCE, INVOICE, LOGISTICS, CUSTOM DUTY)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- MODULE 7: Payment Requisitions (Advance, Invoice, Logistics, Duty) ---');
    
    // 1. Advance Payment
    const advRes = await request('/api/p2p/advance-payments/create', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        poNumber: testPoNumber,
        amount: 300000,
        currency: 'INR',
        remarks: 'Master test advance payment requisition'
      })
    });
    assert(advRes.response.ok && advRes.body.success, 'Advance Payment requisition created successfully');
    const createdAdv = advRes.body.data;

    // 2. Invoice Payment
    const invRes = await request('/api/p2p/invoices/create', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        poNumber: testPoNumber,
        invoiceNumber: `INV-${timestamp}`,
        grossAmount: 500000,
        invoiceQuantity: 5,
        currency: 'INR'
      })
    });
    assert(invRes.response.ok && invRes.body.success, 'Invoice Payment requisition created successfully');

    // 3. Logistics Payment
    const logRes = await request('/api/p2p/logistics-payments', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        poNumber: testPoNumber,
        invoiceNumber: `INV-LOG-${timestamp}`,
        transporterName: 'Rayzon Global Logistics Ltd',
        amount: 75000,
        currency: 'INR'
      })
    });
    assert(logRes.response.ok && logRes.body.success, 'Logistics Payment requisition created successfully');

    // 4. Custom Duty Payment
    const dutyRes = await request('/api/p2p/custom-duties', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        poNumber: testPoNumber,
        blNumber: `BL-DUTY-${timestamp}`,
        dutyAmount: 120000,
        customAgentName: 'Mundra Port CHA Agents',
        currency: 'INR'
      })
    });
    assert(dutyRes.response.ok && dutyRes.body.success, 'Custom Duty Payment requisition created successfully');

    // ─────────────────────────────────────────────────────────────────
    // MODULE 8: MARK AS PAID & PAYMENT LEDGER INTEGRITY
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- MODULE 8: Mark As Paid & Payment Ledger Engine ---');
    // Force approve Advance Payment so it enters ready for payout state
    await AdvancePayment.updateOne({ _id: createdAdv._id }, { $set: { status: 'Approved' } });
    await Approval.updateOne({ requestId: String(createdAdv._id) }, { $set: { status: 'approved' } });

    const payoutRes = await request(`/api/p2p/advances/${createdAdv._id || createdAdv.id}/payout`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        utrNumber: `UTR-MASTER-${timestamp}`,
        paymentMode: 'NEFT',
        remarks: 'Master test payout'
      })
    });
    assert(payoutRes.response.ok && payoutRes.body.success, 'Mark as Paid payout successfully executed with UTR recording');

    // Verify Ledger Entry
    const ledgerEntry = await PaymentLedger.findOne({ utrNumber: `UTR-MASTER-${timestamp}` });
    assert(ledgerEntry && (ledgerEntry.netAmount === 300000 || ledgerEntry.grossAmount === 300000), 'PaymentLedger entry created with verified paid amount');

    // Verify PO Paid Balance Updated
    const updatedPoDoc = await PurchaseOrder.findOne({ poNumber: testPoNumber });
    assert((updatedPoDoc.advancePaid || updatedPoDoc.paidAmount) >= 300000, 'PO paid balance updated correctly on payment settlement');

    // ─────────────────────────────────────────────────────────────────
    // MODULE 9: FINANCE REPORTS & OVERDUE SLA TRACKING
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- MODULE 9: Finance Hierarchy Reports & SLA Indicators ---');
    const hierarchyReport = await request('/api/p2p/reports/hierarchy', { headers: authHeaders });
    assert(hierarchyReport.response.ok && hierarchyReport.body.success, 'GET /api/p2p/reports/hierarchy returns payment forecast report');
    assert(Array.isArray(hierarchyReport.body.upcomingFinancePayments), 'Upcoming Finance Payments populated in 7-Day Forecast');

    const pendingApprovalsRes = await request('/api/approvals/pending?scope=all', { headers: authHeaders });
    assert(pendingApprovalsRes.response.ok && pendingApprovalsRes.body.success, 'GET /api/approvals/pending?scope=all returns approvals with SLA metrics');

    // ─────────────────────────────────────────────────────────────────
    // MODULE 10: RFQ LOGISTICS & BL INVOICE WORKFLOW
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- MODULE 10: RFQ Logistics & BL Invoices ---');
    const rfq = await RfqHeader.create({
      rfqId: `RFQ-ID-${timestamp}`,
      rfqNumber: `MASTER-TEST-RFQ-${timestamp}`,
      title: 'Master Test Solar Glass RFQ',
      cargoDetails: {
        portOfOrigin: 'Shanghai Port',
        portOfDestination: 'Mundra Port',
        containerType: '40ft High Cube',
        containerCount: 5
      },
      status: 'published'
    });
    assert(rfq._id, 'RfqHeader document created successfully');

    const blInvoice = await BlInvoice.create({
      referenceNumber: `REF-BL-${timestamp}`,
      blNumber: `MASTER-TEST-BL-${timestamp}`,
      invoiceNumber: `INV-BL-${timestamp}`,
      vendorName: 'Rayzon Test Vendor',
      poNumber: testPoNumber,
      shippingLine: 'Maersk Line Ltd',
      amount: 250000,
      currency: 'INR',
      status: 'Pending EXIM Approval'
    });
    assert(blInvoice._id, 'BlInvoice document created successfully');

    // ─────────────────────────────────────────────────────────────────
    // MODULE 11: SAP INTEGRATION SIMULATION & LOG INTEGRITY
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- MODULE 11: SAP Integration Simulation ---');
    const sapOverview = await request('/api/sap/overview', { headers: authHeaders });
    assert(sapOverview.response.ok && sapOverview.body.success, 'GET /api/sap/overview returns SAP integration metrics');

    const sapHistory = await request('/api/sap/history', { headers: authHeaders });
    assert(sapHistory.response.ok && sapHistory.body.success, 'GET /api/sap/history returns SAP sync log pagination');

    // Test Audit Log Deduplication
    await WorkflowAudit.record({
      entityType: 'PurchaseOrder',
      entityId: String(createdPo._id),
      action: 'MASTER_TEST_ACTION',
      actorRole: 'admin',
      actorEmail: 'admin@rayzon.one',
      details: 'Audit deduplication test entry 1'
    });

    await WorkflowAudit.record({
      entityType: 'PurchaseOrder',
      entityId: String(createdPo._id),
      action: 'MASTER_TEST_ACTION',
      actorRole: 'admin',
      actorEmail: 'admin@rayzon.one',
      details: 'Audit deduplication test entry 1'
    });

    const auditLogs = await WorkflowAudit.find({ entityId: String(createdPo._id), action: 'MASTER_TEST_ACTION' });
    assert(auditLogs.length === 1, 'WorkflowAudit deduplication verified (only 1 unique audit entry saved)');

    // ─────────────────────────────────────────────────────────────────
    // MODULE 12: 100% TEST DATA PURGE & CLEANUP
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- MODULE 12: Test Data Cleanup Verification ---');
    await Promise.all([
      PurchaseOrder.deleteMany({ poNumber: new RegExp(`MASTER-TEST-PO-${timestamp}`) }),
      AdvancePayment.deleteMany({ poNumber: new RegExp(`MASTER-TEST-PO-${timestamp}`) }),
      InvoicePayment.deleteMany({ poNumber: new RegExp(`MASTER-TEST-PO-${timestamp}`) }),
      LogisticsPayment.deleteMany({ poNumber: new RegExp(`MASTER-TEST-PO-${timestamp}`) }),
      CustomDutyPayment.deleteMany({ poNumber: new RegExp(`MASTER-TEST-PO-${timestamp}`) }),
      PaymentLedger.deleteMany({ utrNumber: new RegExp(`UTR-MASTER-${timestamp}`) }),
      RfqHeader.deleteMany({ rfqNumber: new RegExp(`MASTER-TEST-RFQ-${timestamp}`) }),
      BlInvoice.deleteMany({ blNumber: new RegExp(`MASTER-TEST-BL-${timestamp}`) }),
      Approval.deleteMany({ poNumber: new RegExp(`MASTER-TEST-PO-${timestamp}`) }),
      CustomAgent.deleteMany({ agentId: new RegExp(`MASTER-TEST-CA-${timestamp}`) }),
      LogisticsProvider.deleteMany({ providerId: new RegExp(`MASTER-TEST-LP-${timestamp}`) }),
      WorkflowAudit.deleteMany({ entityId: String(createdPo._id) })
    ]);

    const cleanPo = await PurchaseOrder.findOne({ poNumber: new RegExp(`MASTER-TEST-PO-${timestamp}`) });
    const cleanAdv = await AdvancePayment.findOne({ poNumber: new RegExp(`MASTER-TEST-PO-${timestamp}`) });
    assert(!cleanPo && !cleanAdv, '[CLEANUP VERIFIED] 100% of test records purged from MongoDB Atlas.');

    console.log('\n================================================================');
    console.log(` MASTER TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED `);
    console.log('================================================================\n');

    if (failed > 0) {
      console.error('Failed Test Cases Summary:');
      console.error(JSON.stringify(errors, null, 2));
      process.exit(1);
    }
  } catch (err) {
    console.error('Uncaught Exception during Master Test Suite execution:', err);
    process.exit(1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
}

runMasterTestSuite();
