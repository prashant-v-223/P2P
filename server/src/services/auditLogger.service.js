import { WorkflowAudit } from '../models/WorkflowAudit.js';
import crypto from 'crypto';

const makeAuditKey = ({ requestId, actorId, entityType, entityId, eventType, action, step }) => {
  if (!requestId) return null;
  return crypto.createHash('sha256').update([
    requestId, actorId, entityType, entityId, eventType, action, Number(step || 1)
  ].map((value) => String(value || '').trim().toLowerCase()).join('|')).digest('hex');
};

/**
 * Universal Action Logger
 * Records immutable audit logs for every system action across all modules
 */
export async function logAction(req, {
  eventType,
  entityType,
  entityId,
  action,
  step = 1,
  previousState = null,
  newState = null,
  reason = '',
  workflowId = null,
  workflowVersion = 1
}) {
  try {
    const actorId = req?.user?.id || req?.user?.userId || 'system';
    const actorName = req?.user?.name || req?.user?.email || 'System';
    const actorRole = req?.user?.role || 'system';

    const resolvedEventType = eventType || `ACTION_${String(action || 'EXECUTE').toUpperCase()}`;
    const resolvedAction = action || 'EXECUTE';
    const requestId = req?.headers?.['x-request-id'] || req?.auditRequestId || null;
    const auditKey = makeAuditKey({ requestId, actorId, entityType, entityId, eventType: resolvedEventType, action: resolvedAction, step });
    const payload = {
      eventId: `wa-${crypto.randomUUID()}`,
      eventType: resolvedEventType,
      actorId,
      actorName,
      actorRole,
      entityType: entityType || 'System',
      entityId: String(entityId || 'N/A'),
      workflowId: workflowId || null,
      workflowVersion: workflowVersion || 1,
      step: Number(step || 1),
      action: resolvedAction,
      previousState: previousState || null,
      newState: newState || null,
      reason: reason || req?.body?.remarks || req?.body?.reason || 'User Action Executed',
      requestId: requestId || `req-${crypto.randomUUID()}`,
      auditKey: auditKey || undefined,
      source: req?.headers?.['x-client-source'] || 'web',
      occurredAt: new Date()
    };
    const auditEntry = auditKey
      ? await WorkflowAudit.findOneAndUpdate(
          { auditKey }, { $setOnInsert: payload }, { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      : await WorkflowAudit.create(payload);

    console.log(`[Audit Log] ${eventType || action} on ${entityType}:${entityId} by ${actorName} (${actorRole})`);
    return auditEntry;
  } catch (err) {
    console.warn('[Audit Log Error]:', err.message);
    return null;
  }
}

const MUTATION_ACTIONS = { POST: 'CREATE', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' };
const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim());

/** Catch-all audit coverage for successful API mutations that did not write a richer audit entry. */
export function auditMutationMiddleware(req, res, next) {
  const action = MUTATION_ACTIONS[req.method];
  if (!action || !req.path.startsWith('/api/')) return next();

  req.auditRequestId = req.headers['x-request-id'] || `req-${crypto.randomUUID()}`;
  req.headers['x-request-id'] = req.auditRequestId;
  let responseBody;
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    responseBody = body;
    return originalJson(body);
  };

  res.once('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    const data = responseBody?.data || responseBody?.invoice || responseBody?.approval || responseBody?.vendor || {};
    const entityId = firstValue(
      data.invoicePaymentId, data.advanceId, data.rfqId, data.rfqNumber, data.poNumber,
      data.sapPoNumber, data.vendorId, data.agentId, data.id, data._id,
      req.params?.id, req.params?.entityId, req.body?.id, req.body?.invoiceNumber,
      req.body?.advanceId, req.body?.rfqId, req.body?.vendorId
    ) || `${req.baseUrl || ''}${req.path}`;
    const pathParts = req.originalUrl.split('?')[0].split('/').filter(Boolean);
    const entityType = String(pathParts[1] === 'p2p' ? pathParts[2] : pathParts[1] || 'System');

    setImmediate(async () => {
      try {
        const richerAuditExists = await WorkflowAudit.exists({ requestId: req.auditRequestId, entityId: String(entityId) });
        if (richerAuditExists) return;
        await logAction(req, {
          eventType: `${entityType.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_${action}`,
          entityType,
          entityId,
          action,
          reason: `${req.method} ${req.originalUrl} completed successfully`,
          newState: { statusCode: res.statusCode }
        });
      } catch (error) {
        console.warn('[Automatic Audit Error]:', error.message);
      }
    });
  });
  next();
}
