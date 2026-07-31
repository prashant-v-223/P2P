import { createSlice } from '@reduxjs/toolkit';

const STORAGE_KEY = 'rayzon_p2p_notifications';
const MAX_NOTIFICATIONS = 50;

// ─── Load persisted notifications from localStorage ──────────────────────
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(notifications) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch { /* quota exceeded or private mode */ }
}

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: {
    items: loadFromStorage()
  },
  reducers: {
    addNotification: (state, action) => {
      const payload = action.payload || {};

      // Ignore noise/spam notification types
      if (payload.actionType === 'all_clear') return;

      // Deduplicate: ignore if identical approvalId & actionType was added in last 10 seconds
      const now = Date.now();
      const isDuplicate = state.items.some(item => {
        if (item.approvalId && payload.approvalId && item.approvalId === payload.approvalId && item.actionType === payload.actionType) {
          const time = new Date(item.timestamp).getTime();
          return (now - time) < 10000;
        }
        return false;
      });

      if (isDuplicate) return;

      const notification = {
        id: `notif-${now}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        read: false,
        ...payload
      };
      state.items = [notification, ...state.items].slice(0, MAX_NOTIFICATIONS);
      saveToStorage(state.items);
    },

    markRead: (state, action) => {
      const item = state.items.find(n => n.id === action.payload);
      if (item) {
        item.read = true;
        saveToStorage(state.items);
      }
    },

    markAllRead: (state) => {
      state.items.forEach(n => { n.read = true; });
      saveToStorage(state.items);
    },

    clearAll: (state) => {
      state.items = [];
      saveToStorage(state.items);
    }
  }
});

export default notificationsSlice.reducer;
export const { addNotification, markRead, markAllRead, clearAll } = notificationsSlice.actions;

// ─── Selectors ─────────────────────────────────────────────────────────────
export const selectNotifications = (state) => state.notifications.items;
export const selectUnreadCount = (state) => state.notifications.items.filter(n => !n.read).length;
