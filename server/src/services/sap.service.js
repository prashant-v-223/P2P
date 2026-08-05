// Resilient SAP Outbound Sync Queue & Retry Manager with Exponential Backoff
const sapQueue = [];
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 5000; // 5 seconds

export function enqueueSapSync(taskType, payload) {
  const task = {
    id: `sap-task-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    taskType, // 'POST_INVOICE' | 'POST_ADVANCE' | 'POST_GRN' | 'SYNC_PO'
    payload,
    status: 'QUEUED',
    attempts: 0,
    nextRunAt: Date.now(),
    createdAt: new Date(),
    error: null
  };

  sapQueue.push(task);
  console.log(`[SAP Sync Queue] Enqueued task "${task.id}" (${taskType}). Queue length: ${sapQueue.length}`);
  
  // Schedule execution asynchronously
  setImmediate(() => processSapQueue());
  return task;
}

export async function processSapQueue() {
  const now = Date.now();
  const pendingTasks = sapQueue.filter((t) => (t.status === 'QUEUED' || t.status === 'RETRYING') && now >= t.nextRunAt);

  for (const task of pendingTasks) {
    task.attempts += 1;
    task.status = 'PROCESSING';

    try {
      console.log(`[SAP Sync Queue] Processing task "${task.id}" (Attempt ${task.attempts}/${MAX_RETRIES})...`);
      
      // Simulate SAP Outbound API Post
      await new Promise((resolve) => setTimeout(resolve, 300));
      
      task.status = 'COMPLETED';
      task.completedAt = new Date();
      console.log(`[SAP Sync Queue] Task "${task.id}" completed successfully.`);
    } catch (err) {
      if (task.attempts < MAX_RETRIES) {
        task.status = 'RETRYING';
        const backoffMs = BASE_DELAY_MS * Math.pow(2, task.attempts - 1);
        task.nextRunAt = Date.now() + backoffMs;
        task.error = err.message;
        console.warn(`[SAP Sync Queue] Task "${task.id}" failed: ${err.message}. Retrying in ${backoffMs / 1000}s...`);
      } else {
        task.status = 'FAILED';
        task.failedAt = new Date();
        task.error = err.message;
        console.error(`[SAP Sync Queue] Task "${task.id}" permanently failed after ${MAX_RETRIES} attempts.`);
      }
    }
  }
}

export function getSapQueueStatus() {
  return {
    totalTasks: sapQueue.length,
    queued: sapQueue.filter((t) => t.status === 'QUEUED').length,
    processing: sapQueue.filter((t) => t.status === 'PROCESSING').length,
    retrying: sapQueue.filter((t) => t.status === 'RETRYING').length,
    completed: sapQueue.filter((t) => t.status === 'COMPLETED').length,
    failed: sapQueue.filter((t) => t.status === 'FAILED').length,
    recentTasks: sapQueue.slice(-10)
  };
}
