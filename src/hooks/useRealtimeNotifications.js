/**
 * useRealtimeNotifications.js
 *
 * Connects to the SSE stream at /api/events/stream and:
 *  1. Adds in-app notifications to Redux + localStorage
 *  2. Shows OS-level browser notifications
 *  3. Refreshes the pending approvals count in the sidebar
 *  4. Auto-reconnects on disconnect (exponential backoff)
 */

import { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addNotification } from '../features/notifications/notificationsSlice';
import { fetchPendingApprovals } from '../features/approvals/approvalsSlice';
import { useBrowserNotification } from './useBrowserNotification';

// Resolve the SSE URL — Vite dev proxy forwards /api/* to the backend automatically
function getSSEUrl(token) {
  // In dev: Vite proxies /api to localhost:5001
  // In prod: same origin serves /api
  const base = '';
  return `${base}/api/events/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

function getToken() {
  return localStorage.getItem('rayzon_access_token')
    || sessionStorage.getItem('rayzon_access_token')
    || localStorage.getItem('rayzon_token')
    || '';
}

// Build notification payload from SSE event data
function buildNotification(data) {
  const { approvalId, action, newStatus, actingUser, approvalType, amount, vendorName, isFullyApproved, isRejected, isReturned } = data;

  if (isFullyApproved) {
    return {
      actionType: 'fully_approved',
      title: `✅ Request ${approvalId} Fully Approved`,
      message: `${approvalType} (${amount || ''}) by ${actingUser}`,
      browserTitle: `✅ Request ${approvalId} Fully Approved`,
      browserBody: `${approvalType} completed all approval steps.`
    };
  }
  if (isRejected) {
    return {
      actionType: 'rejected',
      title: `❌ Request ${approvalId} Rejected`,
      message: `${approvalType} rejected by ${actingUser}`,
      browserTitle: `❌ Request ${approvalId} Rejected`,
      browserBody: `${approvalId} was rejected by ${actingUser}.`
    };
  }
  if (isReturned) {
    return {
      actionType: 'returned',
      title: `↩ Request ${approvalId} Returned`,
      message: `${approvalType} returned for changes by ${actingUser}`,
      browserTitle: `↩ Request ${approvalId} Returned`,
      browserBody: `${approvalId} returned for revision by ${actingUser}.`
    };
  }
  if (action === 'approve') {
    return {
      actionType: 'approved',
      title: `✔ Request ${approvalId} Advanced`,
      message: `Approved by ${actingUser} → Awaiting next step`,
      browserTitle: `✔ Request ${approvalId} Advanced`,
      browserBody: `${approvalId} advanced. Current status: ${newStatus}`
    };
  }
  return {
    actionType: 'default',
    title: `Request ${approvalId} Updated`,
    message: `${newStatus} by ${actingUser}`
  };
}

export function useRealtimeNotifications() {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector(s => s.auth);
  const { showBrowserNotification, permission } = useBrowserNotification();
  const esRef = useRef(null);
  const reconnectTimeout = useRef(null);
  const reconnectDelay = useRef(1000);

  const connect = useCallback(() => {
    if (!isAuthenticated) return;
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const token = getToken();
    const url = getSSEUrl(token);

    try {
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener('connected', () => {
        reconnectDelay.current = 1000;
      });

      // Handle new request creation broadcast
      es.addEventListener('APPROVAL_CREATED', (event) => {
        let data;
        try { data = JSON.parse(event.data); } catch { return; }

        dispatch(addNotification({
          actionType: 'created',
          title: `🆕 New Request ${data.approvalId}`,
          message: `${data.approvalType} (${data.amount}) submitted by ${data.requestedBy}`,
          approvalId: data.approvalId
        }));

        if (permission === 'granted') {
          showBrowserNotification(`🆕 Approval Needed: ${data.approvalId}`, {
            body: `${data.approvalType} submitted by ${data.requestedBy}. Awaiting ${data.firstStepTitle}.`,
            tag: `approval-created-${data.approvalId}`
          });
        }

        dispatch(fetchPendingApprovals(user?.role));
      });

      // Handle approval action broadcast
      es.addEventListener('APPROVAL_ACTION', (event) => {
        let data;
        try { data = JSON.parse(event.data); } catch { return; }

        const notif = buildNotification(data);

        dispatch(addNotification({
          actionType: notif.actionType,
          title: notif.title,
          message: notif.message,
          approvalId: data.approvalId
        }));

        if (permission === 'granted' && notif.browserTitle) {
          showBrowserNotification(notif.browserTitle, {
            body: notif.browserBody,
            tag: `approval-${data.approvalId}`
          });
        }

        dispatch(fetchPendingApprovals(user?.role));
      });

      es.addEventListener('RFQ_QUOTE_SUBMITTED', (event) => {
        let data;
        try { data = JSON.parse(event.data); } catch { return; }
        dispatch(addNotification({
          actionType: 'rfq_quote_submitted',
          title: `RFQ Quote Received: ${data.rfqNumber || data.rfqId}`,
          message: `${data.vendorName} submitted or updated a freight quote.`,
          approvalId: data.rfqId
        }));
      });

      es.onerror = () => {
        console.warn(`[SSE] Connection error. Reconnecting in ${reconnectDelay.current}ms...`);
        es.close();
        esRef.current = null;

        // Exponential backoff: 1s → 2s → 4s → 8s → 30s max
        reconnectTimeout.current = setTimeout(() => {
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30_000);
          connect();
        }, reconnectDelay.current);
      };
    } catch (err) {
      console.warn('[SSE] EventSource creation failed:', err.message);
    }
  }, [isAuthenticated, dispatch, user?.role, showBrowserNotification, permission]);

  // Connect when authenticated, disconnect when not
  useEffect(() => {
    if (isAuthenticated) {
      connect();
    } else {
      esRef.current?.close();
      esRef.current = null;
    }

    return () => {
      clearTimeout(reconnectTimeout.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [isAuthenticated, connect]);

  return null; // this hook only has side effects
}
