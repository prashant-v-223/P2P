import { PurchaseOrder } from '../../models/PurchaseOrder.js';
import { Supplier } from '../../models/Supplier.js';
import { SapSyncRun } from '../../models/SapSyncRun.js';
import { publicSapConfig } from './sap.config.js';
import { syncPurchaseOrders, syncSuppliers, testSapConnection } from './sap.service.js';

export const getSapOverview = async (_req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const config = publicSapConfig();
  const [purchaseOrders, suppliers, latestRun] = await Promise.all([
    PurchaseOrder.countDocuments(),
    Supplier.countDocuments(),
    SapSyncRun.findOne().sort({ startedAt: -1 }).lean()
  ]);
  let connected = false;
  let connectionMessage = config.configured ? 'Connection has not been tested.' : 'Add SAP_USERNAME and SAP_PASSWORD to .env.';
  if (config.configured) {
    try {
      connected = await testSapConnection();
      connectionMessage = 'API is reachable and responding correctly.';
    } catch (error) {
      connectionMessage = error.message;
    }
  }
  return res.json({ success: true, ...config, connected, connectionMessage, counts: { purchaseOrders, suppliers }, latestRun });
};

const executeSync = async ({ entity, mode, requestedBy, task }) => {
  const run = await SapSyncRun.create({ entity, mode, requestedBy, status: 'running', startedAt: new Date() });
  const started = Date.now();
  try {
    const result = await task();
    Object.assign(run, result, { status: 'completed', completedAt: new Date(), durationMs: Date.now() - started });
    await run.save();
    return run;
  } catch (error) {
    Object.assign(run, { status: 'failed', error: error.message, completedAt: new Date(), durationMs: Date.now() - started });
    await run.save();
    throw error;
  }
};

export const runSapSync = async (req, res) => {
  const entity = req.params.entity;
  if (!['purchase-orders', 'suppliers'].includes(entity)) {
    return res.status(400).json({ success: false, error: 'Unsupported SAP entity.' });
  }
  const poNumbers = Array.isArray(req.body.poNumbers) ? req.body.poNumbers : [];
  if (poNumbers.length > 100) return res.status(400).json({ success: false, error: 'A maximum of 100 PO numbers is allowed per request.' });
  const run = await executeSync({
    entity,
    mode: poNumbers.length ? 'manual' : 'full',
    requestedBy: req.user.id,
    task: entity === 'suppliers' ? syncSuppliers : () => syncPurchaseOrders(poNumbers)
  });
  return res.json({ success: true, message: `${entity} sync completed.`, run });
};

export const getSapSyncHistory = async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const page = Math.max(1, Number(req.query.page) || 1);
  const size = Math.min(100, Math.max(1, Number(req.query.size) || 10));
  const total = await SapSyncRun.countDocuments();
  const totalPages = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(page, totalPages);
  const runs = await SapSyncRun.find().sort({ startedAt: -1 }).skip((safePage - 1) * size).limit(size).lean();
  return res.json({ success: true, runs, total, page: safePage, size, totalPages });
};
