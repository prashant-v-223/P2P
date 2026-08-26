import { WorkflowAudit } from '../models/WorkflowAudit.js';
import crypto from 'crypto';

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

    const auditEntry = await WorkflowAudit.create({
      eventId: `wa-${crypto.randomUUID()}`,
      eventType: eventType || `ACTION_${String(action || 'EXECUTE').toUpperCase()}`,
      actorId,
      actorName,
      actorRole,
      entityType: entityType || 'System',
      entityId: String(entityId || 'N/A'),
      workflowId: workflowId || null,
      workflowVersion: workflowVersion || 1,
      step: Number(step || 1),
      action: action || 'EXECUTE',
      previousState: previousState || null,
      newState: newState || null,
      reason: reason || req?.body?.remarks || req?.body?.reason || 'User Action Executed',
      requestId: req?.headers?.['x-request-id'] || `req-${Date.now()}`,
      source: req?.headers?.['x-client-source'] || 'web',
      occurredAt: new Date()
    });

    console.log(`[Audit Log] ${eventType || action} on ${entityType}:${entityId} by ${actorName} (${actorRole})`);
    return auditEntry;
  } catch (err) {
    console.warn('[Audit Log Error]:', err.message);
    return null;
  }
}
