import express from 'express';
import mongoose from 'mongoose';
import { PurchaseOrder } from '../../models/PurchaseOrder.js';
import { InvoicePayment } from '../../models/InvoicePayment.js';
import { AdvancePayment } from '../../models/AdvancePayment.js';
import { PaymentLedger } from '../../models/PaymentLedger.js';
import { Approval } from '../../models/Approval.js';
import { Workflow } from '../../models/Workflow.js';
import { RfqHeader, RfqQuote, RfqBlEntry, CustomDutyPayment, LogisticsPayment } from '../../models/RfqLogistics.js';
import { Vendor } from '../../models/Vendor.js';
import { broadcastEvent } from '../../services/sse.service.js';
import { sendApprovalCreatedEmails } from '../../services/notification.service.js';

const router = express.Router();

// Helper to escape regex search inputs
function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// Helper to build safe MongoDB filter matching ObjectId, custom string ID, or reference
function buildInvoiceFilter(idParam) {
  const filterOr = [
    { invoicePaymentId: idParam },
    { invoiceNumber: idParam }
  ];
  if (mongoose.Types.ObjectId.isValid(idParam)) {
    filterOr.push({ _id: idParam });
  }
  return { $or: filterOr };
}

function buildAdvanceFilter(idParam) {
  const filterOr = [
    { advanceId: idParam },
    { poId: idParam },
    { sapPoNumber: idParam }
  ];
  if (mongoose.Types.ObjectId.isValid(idParam)) {
    filterOr.push({ _id: idParam });
  }
  return { $or: filterOr };
}

// ─── GET /api/p2p/workflows/preview ──────────────────────────────────────────
router.get('/workflows/preview', async (req, res) => {
  try {
    const moduleType = req.query.module || 'Advance Payment';
    const amount = Number(req.query.amount) || 0;
    const wf = await resolveWorkflowFromDB(moduleType, amount);
    return res.json({ success: true, workflow: wf });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
async function resolveWorkflowFromDB(moduleType, amount) {
  try {
    const workflows = await Workflow.find({
      status: { $in: ['active', 'Active'] }
    }).lean();

    const numAmount = Number(amount) || 0;

    // Filter workflows matching the module (e.g. 'Advance Payment')
    const categoryWfs = workflows.filter(w => {
      const name = (w.name || '').toLowerCase();
      const cat  = (w.category || '').toLowerCase();
      const mod  = (moduleType || '').toLowerCase();
      return name.includes(mod) || cat.includes(mod) || mod.includes(name) || mod.includes(cat) ||
        (mod.includes('advance') && (name.includes('advance') || cat.includes('advance'))) ||
        (mod.includes('invoice') && (name.includes('invoice') || cat.includes('invoice')));
    });

    // Find the exact workflow where minAmount <= numAmount <= maxAmount
    const matchedWf = categoryWfs.find(w => {
      const min = Number(w.minAmount) || 0;
      const max = (w.maxAmount == null || w.maxAmount === 0) ? Infinity : Number(w.maxAmount);
      return numAmount >= min && numAmount <= max;
    });

    if (matchedWf && Array.isArray(matchedWf.steps) && matchedWf.steps.length > 0) {
      return buildWorkflowResult(matchedWf, matchedWf.steps);
    }

    return getDefaultWorkflow(moduleType, numAmount);
  } catch (err) {
    console.error('[Workflow Resolution Error]', err.message);
    return getDefaultWorkflow(moduleType, amount);
  }
}

function buildWorkflowResult(wf, rawSteps) {
  const steps = rawSteps.map((s, idx) => {
    const title = s.title || s.roleName || `Step ${idx + 1}`;
    const statusKey = `Pending ${title}`;
    return {
      step:      s.step || idx + 1,
      title,
      roleName:  s.roleName || s.roleKey || title,
      roleKey:   s.roleKey  || s.roleName || title,
      statusKey  // Used as approval.status at this step
    };
  });

  return {
    workflowId:  wf._id?.toString() || wf.id,
    slab:        wf.name || 'Standard',
    totalSteps:  steps.length,
    steps
  };
}

function getDefaultWorkflow(moduleType, amount) {
  const numAmount = Number(amount) || 0;

  if (numAmount >= 10000000) { // >= 1 Crore
    return buildWorkflowResult({ id: 'WF-DEFAULT-HIGH', name: 'Advance Payment (Above ₹1 Cr)' }, [
      { step: 1, title: 'Procurement Head Approval', roleName: 'Procurement Head', roleKey: 'procurement_head' },
      { step: 2, title: 'MD Approval',               roleName: 'MD Approval',       roleKey: 'md' },
      { step: 3, title: 'Finance Approval',          roleName: 'Finance Approval',  roleKey: 'finance_lead' }
    ]);
  }

  return buildWorkflowResult({ id: 'WF-DEFAULT-STD', name: 'Advance Payment (Up to ₹1 Cr)' }, [
    { step: 1, title: 'Procurement Head Approval', roleName: 'Procurement Head', roleKey: 'procurement_head' },
    { step: 2, title: 'Finance Lead Approval',     roleName: 'Finance Lead',     roleKey: 'finance_lead' }
  ]);
}

// Create Approval record from workflow result
async function createApprovalRecord({ referenceId, type, vendorName, amountFormatted, poRef, requestedBy, wf }) {
  const firstStep = wf.steps[0];
  const initialStatus = firstStep?.statusKey || 'Pending Procurement Head Approval';

  const newApproval = await Approval.create({
    id:             referenceId,
    type,
    vendorName,
    amountOriginal: amountFormatted,
    amountINR:      amountFormatted,
    currency:       'INR',
    requestedBy:    requestedBy || 'Finance Team',
    currentSlab:    wf.slab,
    workflowId:     wf.workflowId,
    poReference:    poRef || '',
    currentStep:    1,
    totalSteps:     wf.totalSteps,
    workflowSteps:  JSON.stringify(wf.steps),
    status:         initialStatus,
    submittedAt:    new Date(),
    actionHistory:  []
  });

  // ── Real-time SSE: notify all connected clients of the new request ─────────
  broadcastEvent('APPROVAL_CREATED', {
    approvalId:    referenceId,
    approvalType:  type,
    amount:        amountFormatted,
    vendorName:    vendorName || '',
    requestedBy:   requestedBy || 'Finance Team',
    firstStepRole: firstStep?.roleKey  || firstStep?.roleName || '',
    firstStepTitle: firstStep?.title   || firstStep?.roleName || 'Step 1',
    totalSteps:    wf.totalSteps,
    workflowSteps: wf.steps,
  });

  // ── Email: notify first-step approvers ────────────────────────────────
  sendApprovalCreatedEmails({ approval: newApproval.toObject() });

  return newApproval;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED MASTER DATA
// ─────────────────────────────────────────────────────────────────────────────
async function seedMasterData() {
  const poCount = await PurchaseOrder.countDocuments();
  if (poCount === 0) {
    await PurchaseOrder.insertMany([
      {
        poNumber: 'PO-4300001510', sapPoNumber: '4300001510',
        supplierId: 'VEND-10029', supplierName: 'Jinko Solar (Vietnam) Industries Co., Ltd',
        companyCode: '1000', currency: 'INR', totalAmount: 18500000,
        advancePaid: 3700000, advanceCommitted: 3700000, amountLocked: true, status: 'open'
      },
      {
        poNumber: 'PO-4300001511', sapPoNumber: '4300001511',
        supplierId: 'VEND-10045', supplierName: 'Trina Solar Co. Ltd',
        companyCode: '1000', currency: 'INR', totalAmount: 12400000,
        advancePaid: 0, advanceCommitted: 0, amountLocked: false, status: 'open'
      },
      {
        poNumber: 'PO-4100004110', sapPoNumber: '4100004110',
        supplierId: 'VEND-10001', supplierName: 'Acute Systems & Solutions',
        companyCode: '1000', currency: 'INR', totalAmount: 43164.40,
        advancePaid: 12949.32, advanceCommitted: 12949.32, amountLocked: false, status: 'open'
      },
      {
        poNumber: 'PO-4100005459', sapPoNumber: '4100005459',
        supplierId: 'VEND-10002', supplierName: 'SWASTIK OIL AGENCIES',
        companyCode: '1000', currency: 'INR', totalAmount: 92500.00,
        advancePaid: 18500.00, advanceCommitted: 18500.00, amountLocked: false, status: 'open'
      },
      {
        poNumber: 'PO-6000001201', sapPoNumber: '6000001201',
        supplierId: 'VEND-10088', supplierName: 'LONGi Solar Technology Co. Ltd',
        companyCode: '1000', currency: 'INR', totalAmount: 24500000,
        advancePaid: 4900000, advanceCommitted: 4900000, amountLocked: true, status: 'open'
      },
      {
        poNumber: 'PO-4200001889', sapPoNumber: '4200001889',
        supplierId: '30000111', supplierName: 'CUBIK LOGISTICS COMPANY LIMITED',
        companyCode: '1000', currency: 'INR', totalAmount: 6500000,
        advancePaid: 0, advanceCommitted: 0, amountLocked: false, status: 'open'
      },
      {
        poNumber: 'PO-4200001990', sapPoNumber: '4200001990',
        supplierId: '30000111', supplierName: 'CUBIK LOGISTICS COMPANY LIMITED',
        companyCode: '1000', currency: 'INR', totalAmount: 8900000,
        advancePaid: 1780000, advanceCommitted: 1780000, amountLocked: false, status: 'open'
      }
    ]);
  }

  const advCount = await AdvancePayment.countDocuments();
  if (advCount === 0) {
    await AdvancePayment.insertMany([
      {
        advanceId: 'ADV-046153', poId: 'PO-4100004110', sapPoNumber: '4100004110',
        vendorId: 'VEND-10001', vendorName: 'Acute Systems & Solutions',
        amount: 12949.32, percentageOfPo: 30,
        gstBreakup: { cgst: 1165.44, sgst: 1165.44, igst: 0, totalGst: 2330.88 },
        paymentMode: 'RTGS', bankName: 'HDFC Bank', status: 'approved', createdBy: 'Finance Team'
      },
      {
        advanceId: 'ADV-520512', poId: 'PO-4100005459', sapPoNumber: '4100005459',
        vendorId: 'VEND-10002', vendorName: 'SWASTIK OIL AGENCIES',
        amount: 18500, percentageOfPo: 20,
        gstBreakup: { cgst: 1665, sgst: 1665, igst: 0, totalGst: 3330 },
        paymentMode: 'NEFT', bankName: 'ICICI Bank', status: 'pending', createdBy: 'Finance Team'
      },
      {
        advanceId: 'ADV-902144', poId: 'PO-4300001510', sapPoNumber: '4300001510',
        vendorId: 'VEND-10029', vendorName: 'Jinko Solar (Vietnam) Industries Co., Ltd',
        amount: 3700000, percentageOfPo: 20,
        gstBreakup: { cgst: 0, sgst: 0, igst: 666000, totalGst: 666000 },
        paymentMode: 'SWIFT', bankName: 'SBI International', status: 'paid', createdBy: 'Finance Team'
      },
      {
        advanceId: 'ADV-772109', poId: 'PO-6000001201', sapPoNumber: '6000001201',
        vendorId: 'VEND-10088', vendorName: 'LONGi Solar Technology Co. Ltd',
        amount: 4900000, percentageOfPo: 20,
        gstBreakup: { cgst: 0, sgst: 0, igst: 882000, totalGst: 882000 },
        paymentMode: 'RTGS', bankName: 'HDFC Bank', status: 'draft', createdBy: 'Finance Team'
      }
    ]);
  }
}

router.post('/seed', async (req, res) => {
  try {
    await seedMasterData();
    res.json({ success: true, message: 'P2P Master Data seeded' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PURCHASE ORDERS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/purchase-orders', async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const size = Math.min(100, Math.max(1, Number.parseInt(req.query.size || req.query.pageSize, 10) || 10));
    const search = String(req.query.q || req.query.search || '').trim();
    const statusFilter = String(req.query.status || '').trim();
    const typeFilter = String(req.query.type || '').trim();

    let poCount = await PurchaseOrder.countDocuments();
    if (poCount === 0) await seedMasterData();

    const filter = {};
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [
        { poNumber: regex }, { sapPoNumber: regex },
        { supplierName: regex }, { supplierId: regex }
      ];
    }
    if (statusFilter && statusFilter !== 'All Status' && statusFilter !== 'All') {
      filter.status = statusFilter.toLowerCase();
    }
    if (typeFilter && typeFilter !== 'All Types' && typeFilter !== 'All') {
      if (typeFilter === 'Import') {
        filter.$or = [
          { poNumber: /^PO-43/i }, { poNumber: /^60/ },
          { sapPoNumber: /^43/ }, { sapPoNumber: /^60/ }
        ];
      } else if (typeFilter === 'Domestic') {
        filter.$or = [
          { poNumber: /^PO-41/i }, { poNumber: /^42/ },
          { sapPoNumber: /^41/ }, { sapPoNumber: /^42/ }
        ];
      }
    }

    const total = await PurchaseOrder.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / size));
    const safePage = Math.min(page, totalPages);
    const pos = await PurchaseOrder.find(filter)
      .sort({ createdAt: -1 }).skip((safePage - 1) * size).limit(size).lean();

    return res.json({ success: true, data: pos, total, page: safePage, pageSize: size, totalPages,
      hasPrevious: safePage > 1, hasNext: safePage < totalPages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/purchase-orders/:id', async (req, res) => {
  try {
    const filterOr = [{ poNumber: req.params.id }, { sapPoNumber: req.params.id }];
    if (mongoose.Types.ObjectId.isValid(req.params.id)) filterOr.push({ _id: req.params.id });
    const po = await PurchaseOrder.findOne({ $or: filterOr }).lean();
    if (!po) return res.status(404).json({ success: false, error: 'Purchase order not found' });
    res.json({ success: true, data: po });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADVANCE PAYMENTS
// ─────────────────────────────────────────────────────────────────────────────
const getAdvancesHandler = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const size = Math.min(100, Math.max(1, Number.parseInt(req.query.size || req.query.pageSize, 10) || 10));
    const search = String(req.query.q || req.query.search || '').trim();
    const statusFilter = String(req.query.status || '').trim();

    let advCount = await AdvancePayment.countDocuments();
    if (advCount === 0) await seedMasterData();

    const filter = {};
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [
        { advanceId: regex }, { poId: regex }, { sapPoNumber: regex },
        { vendorName: regex }, { vendorId: regex }, { bankName: regex }, { createdBy: regex }
      ];
    }
    if (statusFilter && statusFilter !== 'All Status' && statusFilter !== 'All') {
      filter.status = statusFilter.toLowerCase();
    }

    const total = await AdvancePayment.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / size));
    const safePage = Math.min(page, totalPages);
    const advances = await AdvancePayment.find(filter)
      .sort({ createdAt: -1 }).skip((safePage - 1) * size).limit(size).lean();

    return res.json({ success: true, data: advances, total, page: safePage, pageSize: size, totalPages,
      hasPrevious: safePage > 1, hasNext: safePage < totalPages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

router.get('/advances', getAdvancesHandler);
router.get('/advance-payments', getAdvancesHandler);

const getSingleAdvanceHandler = async (req, res) => {
  try {
    const adv = await AdvancePayment.findOne(buildAdvanceFilter(req.params.id)).lean();
    if (!adv) return res.status(404).json({ success: false, error: 'Advance payment not found' });
    const approval = await Approval.findOne({ $or: [{ id: adv.advanceId }, { id: req.params.id }] }).lean();
    return res.json({ success: true, data: { ...adv, approval: approval || null } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

router.get('/advances/:id', getSingleAdvanceHandler);
router.get('/advance-payments/:id', getSingleAdvanceHandler);

// ─── POST Create Advance Payment ─────────────────────────────────────────────
const createAdvanceHandler = async (req, res) => {
  try {
    const {
      poNumber, vendorName, vendorCode, amount, percentageOfPo,
      cgst, sgst, igst, totalGst, grandTotal,
      paymentMode, bankName, bankAccountNumber, remarks, requestedBy
    } = req.body;

    if (!poNumber) {
      return res.status(400).json({ success: false, error: 'PO Number is required.' });
    }
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Amount must be greater than zero.' });
    }

    // Lookup PO
    const po = await PurchaseOrder.findOne({ $or: [{ poNumber }, { sapPoNumber: poNumber }] }).lean();

    const vendorNameFinal = vendorName || po?.supplierName || 'Vendor';
    const vendorIdFinal   = vendorCode  || po?.supplierId   || 'VEND-00000';
    const poRef           = po?.sapPoNumber || poNumber;
    const numAmount       = Number(amount);

    const advanceId = 'ADV-' + Date.now().toString().slice(-6);

    const newAdv = await AdvancePayment.create({
      advanceId,
      poId:       po?.poNumber || poNumber,
      sapPoNumber: poRef,
      vendorId:   vendorIdFinal,
      vendorName: vendorNameFinal,
      amount:     numAmount,
      percentageOfPo: Number(percentageOfPo) || 0,
      gstBreakup: {
        cgst:     Number(cgst)     || 0,
        sgst:     Number(sgst)     || 0,
        igst:     Number(igst)     || 0,
        totalGst: Number(totalGst) || 0
      },
      paymentMode:       paymentMode       || 'NEFT',
      bankName:          bankName          || 'HDFC Bank',
      bankAccountNumber: bankAccountNumber || '',
      remarks:           remarks           || '',
      status:            'pending',
      createdBy:         requestedBy       || 'Finance Team'
    });

    // Resolve and create approval workflow
    const wf = await resolveWorkflowFromDB('Advance Payment', numAmount);
    const amountFormatted = `₹${numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    await createApprovalRecord({
      referenceId: advanceId,
      type:        'Advance Payment',
      vendorName:  vendorNameFinal,
      amountFormatted,
      poRef,
      requestedBy: requestedBy || 'Finance Team',
      wf
    });

    return res.json({
      success: true,
      message: 'Advance payment created and sent for approval.',
      data:    newAdv,
      workflow: wf
    });
  } catch (err) {
    console.error('[Create Advance]', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

router.post('/advances/create', createAdvanceHandler);
router.post('/advance-payments/create', createAdvanceHandler);

// ─── DELETE Advance Payment ───────────────────────────────────────────────────
const deleteAdvanceHandler = async (req, res) => {
  try {
    const adv = await AdvancePayment.findOne(buildAdvanceFilter(req.params.id));
    if (adv) {
      await AdvancePayment.deleteOne({ _id: adv._id });
      await Approval.deleteOne({ id: adv.advanceId }).catch(() => {});
    }
    res.json({ success: true, message: 'Advance payment deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

router.delete('/advances/:id', deleteAdvanceHandler);
router.delete('/advance-payments/:id', deleteAdvanceHandler);

// ─── PUT Update Advance Payment Status (from approval flow) ──────────────────
router.put('/advances/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['draft', 'pending', 'approved', 'rejected', 'returned', 'paid', 'adjusted'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value.' });
    }
    const adv = await AdvancePayment.findOne(buildAdvanceFilter(req.params.id));
    if (!adv) return res.status(404).json({ success: false, error: 'Advance not found' });
    adv.status = status;
    await adv.save();

    // Sync approval record
    const approval = await Approval.findOne({ id: adv.advanceId });
    if (approval) {
      if (status === 'approved') approval.status = 'Approved & Dispatched';
      else if (status === 'rejected') approval.status = 'Rejected';
      else if (status === 'returned') approval.status = 'Returned for changes';
      await approval.save();
    }
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// INVOICE PAYMENTS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/invoices', async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const size = Math.min(100, Math.max(1, Number.parseInt(req.query.size || req.query.pageSize, 10) || 10));
    const search = String(req.query.q || req.query.search || '').trim();
    const statusFilter = String(req.query.status || '').trim();
    const matchFilter = String(req.query.threeWayMatch || req.query.match || '').trim();

    // Remove old static seed invoices
    await InvoicePayment.deleteMany({ invoicePaymentId: { $in: ['INV-PAY-901', 'INV-PAY-902', 'INV-PAY-903'] } }).catch(() => {});

    const filter = {};
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [
        { invoiceNumber: regex }, { invoicePaymentId: regex },
        { poId: regex }, { sapPoNumber: regex },
        { vendorName: regex }, { vendorId: regex }
      ];
    }
    if (statusFilter && statusFilter !== 'All Status' && statusFilter !== 'All') {
      filter.status = statusFilter.toLowerCase();
    }
    if (matchFilter && matchFilter !== 'All Match' && matchFilter !== 'All') {
      filter['threeWayMatch.status'] = matchFilter.toLowerCase();
    }

    const total = await InvoicePayment.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / size));
    const safePage = Math.min(page, totalPages);
    const invoices = await InvoicePayment.find(filter)
      .sort({ createdAt: -1 }).skip((safePage - 1) * size).limit(size).lean();

    return res.json({ success: true, data: invoices, total, page: safePage, pageSize: size, totalPages,
      hasPrevious: safePage > 1, hasNext: safePage < totalPages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/invoices/:id', async (req, res) => {
  try {
    const inv = await InvoicePayment.findOne(buildInvoiceFilter(req.params.id)).lean();
    if (!inv) return res.status(404).json({ success: false, error: 'Invoice payment not found' });
    const approval = await Approval.findOne({ $or: [{ id: inv.invoicePaymentId }, { id: req.params.id }] }).lean();
    return res.json({ success: true, data: { ...inv, approval: approval || null } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST Create Invoice Payment ─────────────────────────────────────────────
router.post('/invoices/create', async (req, res) => {
  try {
    const {
      poNumber, invoiceNumber, grossAmount, gstAmount, tdsAmount, tdsPercentage,
      advanceAdjusted, advanceIdAdjusted, poQuantity, grnQuantity, invoiceQuantity,
      grnNumber, remarks, approvalTo, requestedBy, vendorId, vendorName
    } = req.body;

    const po = await PurchaseOrder.findOne({ $or: [{ poNumber }, { sapPoNumber: poNumber }] }).lean();

    const vendorNameFinal = vendorName || requestedBy || po?.supplierName || 'Jinko Solar (Vietnam) Industries Co., Ltd';
    const vendorIdFinal   = vendorId || po?.supplierId || 'VEND-10029';
    const poRef           = po?.sapPoNumber  || poNumber || '4300001510';

    const numGross   = Number(grossAmount)   || 0;
    const numGst     = Number(gstAmount)     || 0;
    const numTds     = Number(tdsAmount)     || 0;
    const numAdv     = Number(advanceAdjusted) || 0;
    const netPayable = Math.max(0, numGross + numGst - numTds - numAdv);

    // Unique invoice number handling
    let finalInvoiceNumber = String(invoiceNumber || '').trim();
    if (!finalInvoiceNumber) {
      finalInvoiceNumber = 'INV-' + new Date().getFullYear() + '-' + Math.floor(100000 + Math.random() * 900000);
    }
    const existingInv = await InvoicePayment.findOne({ invoiceNumber: finalInvoiceNumber });
    if (existingInv) {
      finalInvoiceNumber = `${finalInvoiceNumber}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const invPaymentId = 'INV-PAY-' + Date.now().toString().slice(-6);

    const poQty  = Number(poQuantity)      || 100;
    const grnQty = Number(grnQuantity)     || 100;
    const invQty = Number(invoiceQuantity) || 100;
    const isMatched = (poQty === grnQty) && (grnQty === invQty);

    const newInvoice = await InvoicePayment.create({
      invoicePaymentId: invPaymentId,
      poId:             po?.poNumber || poNumber || 'PO-4300001510',
      sapPoNumber:      poRef,
      vendorId:         vendorIdFinal,
      vendorName:       vendorNameFinal,
      invoiceNumber:    finalInvoiceNumber,
      invoiceDate:      new Date(),
      grossAmount:      numGross,
      gstAmount:        numGst,
      tdsAmount:        numTds,
      tdsPercentage:    Number(tdsPercentage) || 0,
      advanceAdjusted:  numAdv,
      advanceIdAdjusted: advanceIdAdjusted || '',
      grnNumber:        grnNumber  || '',
      remarks:          remarks    || '',
      approvalTo:       approvalTo || '',
      netPayable,
      threeWayMatch: {
        status:          isMatched ? 'matched' : 'mismatch',
        poQuantity:      poQty,
        grnQuantity:     grnQty,
        invoiceQuantity: invQty,
        varianceAmount:  isMatched ? 0 : Math.abs(invQty - grnQty) * 100,
        matchedAt:       new Date()
      },
      status:    'pending',
      createdBy: requestedBy || 'Finance Team'
    });

    // Workflow & Approval queue creation
    const wf = await resolveWorkflowFromDB('Invoice Payment', netPayable);
    const amountFormatted = `₹${netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    await createApprovalRecord({
      referenceId:    invPaymentId,
      type:           'Invoice Payment',
      vendorName:     vendorNameFinal,
      amountFormatted,
      poRef,
      requestedBy:    requestedBy || 'Finance Team',
      wf
    });

    return res.json({ success: true, data: newInvoice, workflow: wf });
  } catch (err) {
    console.error('[Create Invoice]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT Update Invoice ───────────────────────────────────────────────────────
router.put('/invoices/:id', async (req, res) => {
  try {
    const invoice = await InvoicePayment.findOne(buildInvoiceFilter(req.params.id));
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice payment not found' });

    const { poNumber, invoiceNumber, grossAmount, gstAmount, tdsAmount,
            tdsPercentage, advanceAdjusted, grnNumber, remarks, approvalTo } = req.body;

    if (invoiceNumber)      invoice.invoiceNumber    = invoiceNumber.trim();
    if (grossAmount !== undefined) invoice.grossAmount = Number(grossAmount);
    if (gstAmount !== undefined)   invoice.gstAmount   = Number(gstAmount);
    if (tdsAmount !== undefined)   invoice.tdsAmount   = Number(tdsAmount);
    if (tdsPercentage !== undefined) invoice.tdsPercentage = Number(tdsPercentage);
    if (advanceAdjusted !== undefined) invoice.advanceAdjusted = Number(advanceAdjusted);
    if (grnNumber !== undefined) invoice.grnNumber = grnNumber.trim();
    if (remarks !== undefined)   invoice.remarks   = remarks.trim();
    if (approvalTo !== undefined) invoice.approvalTo = approvalTo;

    invoice.netPayable = Math.max(0,
      (invoice.grossAmount || 0) + (invoice.gstAmount || 0)
      - (invoice.tdsAmount || 0) - (invoice.advanceAdjusted || 0)
    );

    await invoice.save();
    return res.json({ success: true, data: invoice });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT Update Invoice Status ────────────────────────────────────────────────
router.put('/invoices/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['draft', 'pending', 'approved', 'rejected', 'returned', 'paid'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value.' });
    }

    const invoice = await InvoicePayment.findOne(buildInvoiceFilter(req.params.id));
    if (invoice) {
      invoice.status = status;
      await invoice.save();

      const approval = await Approval.findOne({
        $or: [{ id: invoice.invoicePaymentId }, { id: req.params.id }]
      });
      if (approval) {
        if (status === 'approved')  approval.status = 'Approved & Dispatched';
        else if (status === 'rejected') approval.status = 'Rejected';
        else if (status === 'returned') approval.status = 'Returned for changes';
        else if (status === 'pending') {
          // Move to next step
          let wfSteps = [];
          try { wfSteps = JSON.parse(approval.workflowSteps || '[]'); } catch (_) {}
          const nextStepObj = wfSteps.find(s => s.step === 2);
          approval.status = nextStepObj?.statusKey || 'Pending Finance Lead Approval';
          approval.currentStep = 2;
        }
        await approval.save();
      }
    }

    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST Record Invoice Payout ───────────────────────────────────────────────
router.post('/invoices/:id/payout', async (req, res) => {
  try {
    const { utrNumber, paymentMode } = req.body;
    if (!utrNumber?.trim()) {
      return res.status(400).json({ success: false, error: 'UTR number is required.' });
    }

    const invoice = await InvoicePayment.findOne(buildInvoiceFilter(req.params.id));
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice payment not found' });

    invoice.utrNumber = utrNumber.trim();
    invoice.status    = 'paid';
    invoice.paidAt    = new Date();
    await invoice.save();

    const approval = await Approval.findOne({
      $or: [{ id: invoice.invoicePaymentId }, { id: req.params.id }]
    });
    if (approval) {
      approval.status = 'Approved & Dispatched';
      await approval.save();
    }

    await PaymentLedger.create({
      ledgerId:    'LEDGER-' + Date.now().toString().slice(-6),
      moduleType:  'InvoicePayment',
      referenceId: invoice.invoicePaymentId,
      poReference: invoice.sapPoNumber || invoice.poId,
      vendorName:  invoice.vendorName,
      amount:      invoice.netPayable,
      currency:    'INR',
      paymentMode: paymentMode || 'NEFT',
      utrNumber:   utrNumber.trim(),
      status:      'completed',
      processedAt: new Date()
    }).catch(e => console.error('[Ledger error]', e.message));

    return res.json({ success: true, message: 'Payout recorded successfully', data: invoice });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE Invoice Payment ───────────────────────────────────────────────────
router.delete('/invoices/:id', async (req, res) => {
  try {
    const inv = await InvoicePayment.findOne(buildInvoiceFilter(req.params.id));
    if (inv) {
      await InvoicePayment.deleteOne({ _id: inv._id });
      await Approval.deleteOne({ id: inv.invoicePaymentId }).catch(() => {});
    }
    res.json({ success: true, message: 'Invoice payment deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── RFQ & CUSTOMS SEED & MANAGEMENT ──────────────────────────────────────────
export async function seedRfqMasterData() {
  try {
    const count = await RfqHeader.countDocuments();
    if (count > 0) return;

    await RfqHeader.insertMany([
      {
        rfqId: 'RFQ-2026-0086', rfqNumber: 'RFQ-2026-0086',
        title: 'DUMMY ENTRY FROM IT TEAM', poId: '4700000251', sapPoNumber: '4700000251',
        cargoDetails: { containerType: '40 FT', containerCount: 1, portOfOrigin: 'SHANGHAI', portOfDestination: 'NHAVA SHEVA', cargoType: 'SOLAR CELL' },
        closingDate: new Date('2026-08-08T11:24:00Z'), status: 'published'
      },
      {
        rfqId: 'RFQ-2026-0085', rfqNumber: 'RFQ-2026-0085',
        title: 'IMPORT SEA FREIGHT - 1 X 40 FT - SILICONE SEALANT', poId: '4300001510', sapPoNumber: '4300001510',
        cargoDetails: { containerType: '40 FT', containerCount: 1, portOfOrigin: 'SHANGHAI', portOfDestination: 'NHAVA SHEVA', cargoType: 'SILICONE SEALANT' },
        closingDate: new Date('2026-07-31T23:59:00Z'), status: 'published'
      },
      {
        rfqId: 'RFQ-2026-0084', rfqNumber: 'RFQ-2026-0084',
        title: 'IMPORT SEA FREIGHT - 100 X 40 FT - SOLAR CELLS', poId: '4300001411', sapPoNumber: '4300001411',
        cargoDetails: { containerType: '40 FT', containerCount: 100, portOfOrigin: 'NINGBO', portOfDestination: 'MUNDRA', cargoType: 'SOLAR CELL' },
        closingDate: new Date('2026-07-31T23:59:00Z'), status: 'published'
      },
      {
        rfqId: 'RFQ-2026-0083', rfqNumber: 'RFQ-2026-0083',
        title: 'IMPORT SEA FREIGHT - 2 X 40 FT - SILICONE SEALANT', poId: '4300001512', sapPoNumber: '4300001512',
        cargoDetails: { containerType: '40 FT', containerCount: 2, portOfOrigin: 'SHANGHAI', portOfDestination: 'MUNDRA', cargoType: 'SILICONE SEALANT' },
        closingDate: new Date('2026-07-31T23:59:00Z'), status: 'published'
      },
      {
        rfqId: 'RFQ-2026-0077', rfqNumber: 'RFQ-2026-0077',
        title: 'IMPORT SEA FREIGHT - 20 X 40 FT - SOLAR CELLS', poId: '4300001515', sapPoNumber: '4300001515',
        cargoDetails: { containerType: '40 FT', containerCount: 20, portOfOrigin: 'SHANGHAI', portOfDestination: 'NHAVA SHEVA', cargoType: 'SOLAR CELL' },
        closingDate: new Date('2026-07-31T23:59:00Z'), status: 'pending_approval'
      },
      {
        rfqId: 'RFQ-2026-0075', rfqNumber: 'RFQ-2026-0075',
        title: 'IMPORT SEA FREIGHT - 300 X 40 FT - SOLAR GLASS', poId: '4300001599', sapPoNumber: '4300001599',
        cargoDetails: { containerType: '40 FT', containerCount: 300, portOfOrigin: 'NINGBO', portOfDestination: 'MUNDRA', cargoType: 'SOLAR GLASS' },
        closingDate: new Date('2026-07-28T23:59:00Z'), status: 'awarded', awardedVendorId: 'VEND-10029', awardedVendorName: 'Dummy FF'
      }
    ]);

    await RfqQuote.insertMany([
      {
        quoteId: 'Q-001', rfqId: 'RFQ-2026-0086', vendorId: 'VEND-10029', vendorName: 'Dummy FF',
        freightAmount: 15000, destinationCharges: 25000, transitDays: 14, rank: 'L1', status: 'awarded'
      }
    ]);

    await RfqBlEntry.insertMany([
      {
        blId: 'BL-9021', rfqId: 'RFQ-2026-0086', blNumber: 'MSK-908124501', vesselName: 'EVER GIVEN V-104E',
        shippingLine: 'MSC', containerCount: 1, customAgentId: 'CA-101', customAgentName: 'Magnesh - Fast Forward Logistics India',
        status: 'assigned_to_agent'
      },
      {
        blId: 'BL-9022', rfqId: 'RFQ-2026-0075', blNumber: 'MAEU-8812904', vesselName: 'MAERSK SEALAND V-201',
        shippingLine: 'Maersk Line', containerCount: 4, customAgentId: 'CA-101', customAgentName: 'Magnesh - Fast Forward Logistics India',
        status: 'custom_cleared'
      }
    ]);
  } catch (err) {
    console.warn('[RFQ SEED WARN]', err.message);
  }
}

// ─── GET /api/p2p/rfqs ────────────────────────────────────────────────────────
router.get('/rfqs', async (req, res) => {
  try {
    await seedRfqMasterData();
    const search = String(req.query.q || req.query.search || '').trim();
    const statusFilter = String(req.query.status || '').trim();

    const filter = {};
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ rfqNumber: rx }, { title: rx }, { poId: rx }, { sapPoNumber: rx }];
    }
    if (statusFilter && statusFilter !== 'All Status' && statusFilter !== 'All') {
      filter.status = statusFilter.toLowerCase().replace(' ', '_');
    }

    const rfqs = await RfqHeader.find(filter).sort({ createdAt: -1 }).lean();

    const enriched = await Promise.all(
      rfqs.map(async (r) => {
        const quoteCount = await RfqQuote.countDocuments({ rfqId: r.rfqId });
        return {
          ...r,
          closingDateFormatted: r.closingDate ? new Date(r.closingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Expired',
          invitedVendorsCount: 12,
          quotesCount: quoteCount || (r.rfqId === 'RFQ-2026-0086' ? 1 : r.rfqId === 'RFQ-2026-0085' ? 8 : r.rfqId === 'RFQ-2026-0084' ? 3 : r.rfqId === 'RFQ-2026-0083' ? 6 : r.rfqId === 'RFQ-2026-0082' ? 10 : 8)
        };
      })
    );

    return res.json({ success: true, data: enriched });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET Freight Forwarders / Shipping Lines Vendor List ──────────────────────
router.get('/rfqs/logistics-vendors', async (req, res) => {
  try {
    const defaultLogistics = [
      { id: 'v-ff-1', sapVendorCode: '20000215', companyName: 'Aquair International Freight Forwarders' },
      { id: 'v-ff-2', sapVendorCode: '10002355', companyName: 'Babaji Shivram Clearing & Carriers' },
      { id: 'v-ff-3', sapVendorCode: '0000235', companyName: 'Dummy FF' },
      { id: 'v-ff-4', sapVendorCode: '11001450', companyName: 'Fairwinds Shipping Private Limited' },
      { id: 'v-ff-5', sapVendorCode: '11001810', companyName: 'Fast Forward Logistics India' },
      { id: 'v-ff-6', sapVendorCode: '11001148', companyName: 'Gef Global Logistics Pvt Ltd' },
      { id: 'v-ff-7', sapVendorCode: '50000131', companyName: 'Globiiz Synergy Private Limited' },
      { id: 'v-ff-8', sapVendorCode: '11001810', companyName: 'Isgfl India Pvt. Ltd.' },
      { id: 'v-ff-9', sapVendorCode: '11001776', companyName: 'Kgl Network Pvt. Ltd.' }
    ];
    return res.json({ success: true, data: defaultLogistics });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST Create RFQ ─────────────────────────────────────────────────────────
router.post('/rfqs', async (req, res) => {
  try {
    const {
      title, linkedPoId, closingDate, description,
      shippingTerms, cargoType, portOfLoading, portOfDischarge,
      containerType, containerCount, weightPerContainer, estimatedReadinessDate,
      invitedVendors
    } = req.body;

    if (!title || !cargoType || !portOfLoading || !portOfDischarge) {
      return res.status(400).json({
        success: false,
        error: 'Title, Cargo Type, Port of Loading, and Port of Discharge are required fields.'
      });
    }

    const nextIdNum = Math.floor(10 + Math.random() * 90);
    const rfqNumber = `RFQ-2026-00${nextIdNum}`;

    const newRfq = await RfqHeader.create({
      rfqId: rfqNumber,
      rfqNumber,
      title: title.trim(),
      poId: linkedPoId || '4700000251',
      sapPoNumber: linkedPoId || '4700000251',
      cargoDetails: {
        containerType: containerType || '40 FT',
        containerCount: Number(containerCount) || 1,
        portOfOrigin: portOfLoading,
        portOfDestination: portOfDischarge,
        cargoType: cargoType,
        shippingTerms: shippingTerms || 'FOB',
        weightPerContainer: Number(weightPerContainer) || 0,
        estimatedReadinessDate: estimatedReadinessDate || new Date()
      },
      closingDate: closingDate ? new Date(closingDate) : new Date(Date.now() + 7*24*60*60*1000),
      status: 'published'
    });

    const wf = await Workflow.findOne({ module: 'RfqHeader', isActive: true }).lean().catch(() => null);
    if (wf) {
      await Approval.create({
        id: rfqNumber,
        module: 'RfqHeader',
        requestedBy: 'System Admin',
        roleRequired: 'Procurement Head',
        status: 'Pending Procurement Head Approval',
        details: `${title} (${cargoType} from ${portOfLoading} to ${portOfDischarge})`,
        amount: 0,
        currency: 'INR',
        requestedAt: new Date()
      }).catch(() => {});
    }

    return res.status(201).json({ success: true, data: newRfq });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET Single RFQ Details ──────────────────────────────────────────────────
router.get('/rfqs/:id', async (req, res) => {
  try {
    await seedRfqMasterData();
    const { id } = req.params;
    const rfq = await RfqHeader.findOne({ $or: [{ rfqId: id }, { rfqNumber: id }] }).lean();
    if (!rfq) {
      return res.status(404).json({ success: false, error: 'RFQ not found' });
    }

    const quotes = await RfqQuote.find({ rfqId: rfq.rfqId }).sort({ totalInr: 1 }).lean();
    const blEntries = await RfqBlEntry.find({ rfqId: rfq.rfqId }).lean();

    return res.json({
      success: true,
      data: {
        ...rfq,
        quotes,
        blEntries
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT Update RFQ ──────────────────────────────────────────────────────────
router.put('/rfqs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, linkedPoId, closingDate, description,
      shippingTerms, cargoType, portOfLoading, portOfDischarge,
      containerType, containerCount, weightPerContainer, estimatedReadinessDate,
      invitedVendors, status
    } = req.body;

    const rfq = await RfqHeader.findOne({ $or: [{ rfqId: id }, { rfqNumber: id }] });
    if (!rfq) return res.status(404).json({ success: false, error: 'RFQ not found' });

    if (title) rfq.title = title.trim();
    if (linkedPoId) {
      rfq.poId = linkedPoId;
      rfq.sapPoNumber = linkedPoId;
    }
    if (description !== undefined) rfq.description = description;
    if (closingDate) rfq.closingDate = new Date(closingDate);
    if (status) rfq.status = status;

    if (!rfq.cargoDetails) rfq.cargoDetails = {};
    if (shippingTerms) rfq.cargoDetails.shippingTerms = shippingTerms;
    if (cargoType) rfq.cargoDetails.cargoType = cargoType;
    if (portOfLoading) rfq.cargoDetails.portOfOrigin = portOfLoading;
    if (portOfDischarge) rfq.cargoDetails.portOfDestination = portOfDischarge;
    if (containerType) rfq.cargoDetails.containerType = containerType;
    if (containerCount !== undefined) rfq.cargoDetails.containerCount = Number(containerCount);
    if (weightPerContainer !== undefined) rfq.cargoDetails.weightPerContainer = weightPerContainer;
    if (estimatedReadinessDate) rfq.cargoDetails.estimatedReadinessDate = new Date(estimatedReadinessDate);

    if (invitedVendors && Array.isArray(invitedVendors)) {
      rfq.invitedVendors = invitedVendors;
    }

    await rfq.save();
    return res.json({ success: true, message: 'RFQ updated successfully in MongoDB.', data: rfq });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE RFQ ──────────────────────────────────────────────────────────────
router.delete('/rfqs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rfq = await RfqHeader.findOne({ $or: [{ rfqId: id }, { rfqNumber: id }] });
    if (rfq) {
      await RfqHeader.deleteOne({ _id: rfq._id });
      await RfqQuote.deleteMany({ rfqId: rfq.rfqId }).catch(() => {});
    }
    return res.json({ success: true, message: 'RFQ deleted from MongoDB.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST Copy/Duplicate RFQ ──────────────────────────────────────────────────
router.post('/rfqs/:id/copy', async (req, res) => {
  try {
    const { id } = req.params;
    const sourceRfq = await RfqHeader.findOne({ $or: [{ rfqId: id }, { rfqNumber: id }] }).lean();
    if (!sourceRfq) return res.status(404).json({ success: false, error: 'Source RFQ not found' });

    const nextIdNum = Math.floor(10 + Math.random() * 90);
    const newRfqNumber = `RFQ-2026-00${nextIdNum}`;

    const newRfq = await RfqHeader.create({
      ...sourceRfq,
      _id: undefined,
      rfqId: newRfqNumber,
      rfqNumber: newRfqNumber,
      title: `COPY - ${sourceRfq.title}`,
      status: 'published',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return res.status(201).json({ success: true, message: 'RFQ copied successfully.', data: newRfq });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST Submit Vendor Quote with Auto L1..L5 Ranking ────────────────────────
router.post('/rfqs/:id/quote', async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorId, vendorName, shippingLine, oceanFreightUsd, stChargesInr, otherChargesInr, transitDays } = req.body;

    const rfq = await RfqHeader.findOne({ $or: [{ rfqId: id }, { rfqNumber: id }] });
    if (!rfq) return res.status(404).json({ success: false, error: 'RFQ not found' });

    const oceanUsd = Number(oceanFreightUsd) || 15000;
    const stInr = Number(stChargesInr) || 25000;
    const othInr = Number(otherChargesInr) || 0;
    const usdRate = 92.5; // Exchange rate calculation
    const totalInr = Math.round(oceanUsd * usdRate + stInr + othInr);

    const quoteId = `Q-${Date.now().toString().slice(-6)}`;
    await RfqQuote.create({
      quoteId,
      rfqId: rfq.rfqId,
      vendorId: vendorId || 'VEND-10029',
      vendorName: vendorName || 'Dummy FF',
      shippingLine: shippingLine || 'MSC',
      oceanFreightUsd: oceanUsd,
      stChargesInr: stInr,
      otherChargesInr: othInr,
      totalInr,
      freightAmount: oceanUsd,
      destinationCharges: stInr,
      transitDays: Number(transitDays) || 14,
      status: 'submitted'
    });

    // Re-rank all quotes for this RFQ by totalInr ascending
    const allQuotes = await RfqQuote.find({ rfqId: rfq.rfqId }).sort({ totalInr: 1 });
    for (let i = 0; i < allQuotes.length; i++) {
      const rankLabel = `L${i + 1}`;
      allQuotes[i].rank = rankLabel;
      await allQuotes[i].save();
    }

    return res.json({ success: true, message: 'Vendor quote submitted and ranked in MongoDB.', quoteId });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST Award RFQ Quote ─────────────────────────────────────────────────────
router.post('/rfqs/:id/award', async (req, res) => {
  try {
    const { id } = req.params;
    const { quoteId, vendorId, vendorName } = req.body;

    const rfq = await RfqHeader.findOne({ $or: [{ rfqId: id }, { rfqNumber: id }] });
    if (!rfq) return res.status(404).json({ success: false, error: 'RFQ not found' });

    rfq.status = 'awarded';
    rfq.awardedVendorId = vendorId;
    rfq.awardedVendorName = vendorName;
    rfq.awardedQuoteId = quoteId;
    rfq.allocatedQuantity = rfq.cargoDetails?.containerCount || 1;
    rfq.pendingAllocation = 0;
    await rfq.save();

    if (quoteId) {
      await RfqQuote.updateOne({ quoteId }, { status: 'awarded' });
    }

    broadcastEvent('rfq_awarded', { rfqId: rfq.rfqId, vendorName, awardedAt: new Date() });

    return res.json({ success: true, message: 'RFQ awarded successfully in MongoDB.', data: rfq });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── CUSTOMS BROKER & BL ASSIGNMENT ROUTES ──────────────────────────────────
router.get('/customs-agent/assigned', async (req, res) => {
  try {
    await seedRfqMasterData();
    const bls = await RfqBlEntry.find().sort({ createdAt: -1 }).lean();
    return res.json({
      success: true,
      agentName: 'Magnesh',
      agentCompany: 'Fast Forward Logistics India',
      totalAssigned: bls.length,
      pendingClearance: bls.filter(b => b.status !== 'custom_cleared').length,
      customCleared: bls.filter(b => b.status === 'custom_cleared').length,
      assignments: bls
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/customs-agent/upload-boe', async (req, res) => {
  try {
    const { blId, boeNumber, dutyAmount, fileName } = req.body;
    const bl = await RfqBlEntry.findOne({ $or: [{ blId }, { blNumber: blId }] });
    if (!bl) return res.status(404).json({ success: false, error: 'BL entry not found.' });

    bl.documents.push({
      docType: 'Customs Bill of Entry',
      fileUrl: fileName || 'BOE-Doc.pdf',
      uploadedBy: 'Magnesh (Customs Agent)',
      uploadedAt: new Date()
    });
    await bl.save();

    return res.json({ success: true, message: 'Bill of Entry uploaded successfully.', bl });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/customs-agent/clear', async (req, res) => {
  try {
    const { blId } = req.body;
    const bl = await RfqBlEntry.findOne({ $or: [{ blId }, { blNumber: blId }] });
    if (!bl) return res.status(404).json({ success: false, error: 'BL entry not found.' });

    bl.status = 'custom_cleared';
    await bl.save();

    broadcastEvent('customs_cleared', { blId: bl.blId, blNumber: bl.blNumber, clearedAt: new Date() });

    return res.json({ success: true, message: 'Marked as Customs Cleared! Invoicing options enabled.', bl });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
