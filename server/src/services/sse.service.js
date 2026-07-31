/**
 * sse.service.js
 * 
 * Server-Sent Events broadcast manager.
 * Maintains a registry of connected SSE clients and broadcasts
 * approval events to all of them in real-time.
 */

// Map of clientId -> { res, userId, userName, userRole }
const clients = new Map();
let clientIdCounter = 0;

/**
 * Register a new SSE client connection.
 * Returns the clientId for cleanup on disconnect.
 */
export function registerClient(res, userInfo = {}) {
  const clientId = ++clientIdCounter;
  clients.set(clientId, { res, ...userInfo });

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering
  res.flushHeaders?.();

  // Send initial connection confirmation
  sendToClient(res, 'connected', { clientId, message: 'SSE stream established' });

  // Heartbeat every 25s to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
      clients.delete(clientId);
    }
  }, 25_000);

  // Cleanup on client disconnect
  res.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(clientId);
    console.log(`[SSE] Client ${clientId} disconnected. Active: ${clients.size}`);
  });

  console.log(`[SSE] Client ${clientId} connected. Active: ${clients.size}`);
  return clientId;
}

/**
 * Send a single event to one response stream.
 */
function sendToClient(res, eventType, data) {
  try {
    res.write(`event: ${eventType}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch { /* client disconnected mid-write */ }
}

/**
 * Broadcast an event to ALL connected SSE clients.
 */
export function broadcastEvent(eventType, data) {
  const payload = { ...data, serverTime: new Date().toISOString() };
  let sent = 0;
  for (const [clientId, client] of clients) {
    try {
      sendToClient(client.res, eventType, payload);
      sent++;
    } catch {
      clients.delete(clientId);
    }
  }
  console.log(`[SSE] Broadcast "${eventType}" to ${sent}/${clients.size} clients`);
}

/**
 * Get current connected client count (for health checks).
 */
export function getClientCount() {
  return clients.size;
}
