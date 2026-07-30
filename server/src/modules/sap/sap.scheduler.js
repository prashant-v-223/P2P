import { SapSyncRun } from '../../models/SapSyncRun.js';
import { syncPurchaseOrders, syncSuppliers } from './sap.service.js';

let running = false;

const runScheduledSync = async () => {
  if (running) return;
  running = true;
  try {
    for (const [entity, task] of [['purchase-orders', syncPurchaseOrders], ['suppliers', syncSuppliers]]) {
      const started = Date.now();
      const run = await SapSyncRun.create({ entity, mode: 'full', requestedBy: 'system:scheduler', status: 'running' });
      try {
        const result = await task();
        Object.assign(run, result, { status: 'completed', completedAt: new Date(), durationMs: Date.now() - started });
      } catch (error) {
        Object.assign(run, { status: 'failed', error: error.message, completedAt: new Date(), durationMs: Date.now() - started });
      }
      await run.save();
    }
  } finally {
    running = false;
  }
};

export const startSapScheduler = () => {
  if (process.env.SAP_SYNC_ENABLED !== 'true' || !process.env.SAP_USERNAME || !process.env.SAP_PASSWORD) return;
  const intervalMinutes = Math.max(5, Number(process.env.SAP_SYNC_INTERVAL_MINUTES) || 60);
  const timer = setInterval(() => void runScheduledSync(), intervalMinutes * 60 * 1000);
  timer.unref();
  console.log(`[SAP] Automatic MongoDB sync scheduled every ${intervalMinutes} minutes.`);
};
