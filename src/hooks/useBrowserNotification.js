/**
 * useBrowserNotification.js
 *
 * Manages the Web Notifications API:
 *  - Tracks permission state
 *  - Requests permission from user
 *  - Shows native OS notifications with brand icon
 */

import { useState, useCallback, useEffect } from 'react';

// App icon for notifications (base64 teal P2P badge-like icon)
const NOTIF_ICON = '/favicon.ico';
const APP_TAG_PREFIX = 'rayzon-p2p-';

export function useBrowserNotification() {
  const [permission, setPermission] = useState(
    () => ('Notification' in window ? Notification.permission : 'unsupported')
  );

  // Keep state in sync when permission changes externally
  useEffect(() => {
    if (!('Notification' in window)) return;
    const check = () => setPermission(Notification.permission);
    // Poll every 2s — there's no native "permission changed" event
    const id = setInterval(check, 2000);
    return () => clearInterval(id);
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch {
      return 'denied';
    }
  }, []);

  const showBrowserNotification = useCallback((title, options = {}) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return null;
    try {
      const notif = new Notification(title, {
        icon: NOTIF_ICON,
        badge: NOTIF_ICON,
        tag: `${APP_TAG_PREFIX}${Date.now()}`,
        requireInteraction: false,
        silent: false,
        ...options
      });

      // Auto close after 6 seconds
      setTimeout(() => { try { notif.close(); } catch {} }, 6000);

      // Click → focus the P2P tab
      notif.onclick = () => {
        window.focus();
        notif.close();
        if (options.onClick) options.onClick();
      };

      return notif;
    } catch (err) {
      console.warn('[BrowserNotification] Failed to show:', err.message);
      return null;
    }
  }, []);

  return { permission, requestPermission, showBrowserNotification };
}
