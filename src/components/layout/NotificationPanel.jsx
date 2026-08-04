import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  BellOff,
  CheckCircle2,
  XCircle,
  RotateCcw,
  PartyPopper,
  Info,
  CheckCheck,
  Trash2,
  ChevronRight,
  ShieldCheck,
  Wifi,
  WifiOff
} from 'lucide-react';
import {
  selectNotifications,
  selectUnreadCount,
  markRead,
  markAllRead,
  clearAll
} from '../../features/notifications/notificationsSlice';
import { useBrowserNotification } from '../../hooks/useBrowserNotification';
import { cn } from '../../lib/utils';

// ─── Time-ago formatter ────────────────────────────────────────────────────
function timeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (diff < 5)   return 'Just now';
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(isoString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// ─── Config per actionType ─────────────────────────────────────────────────
const TYPE_CONFIG = {
  approved: {
    Icon: CheckCircle2,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    dot: 'bg-emerald-500',
    border: 'border-l-emerald-400',
    label: 'Approved'
  },
  fully_approved: {
    Icon: PartyPopper,
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600',
    dot: 'bg-teal-500',
    border: 'border-l-teal-400',
    label: 'Fully Approved'
  },
  rejected: {
    Icon: XCircle,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    dot: 'bg-rose-500',
    border: 'border-l-rose-400',
    label: 'Rejected'
  },
  returned: {
    Icon: RotateCcw,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    dot: 'bg-amber-500',
    border: 'border-l-amber-400',
    label: 'Returned'
  },
  all_clear: {
    Icon: PartyPopper,
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600',
    dot: 'bg-teal-500',
    border: 'border-l-teal-400',
    label: 'All Clear'
  },
  default: {
    Icon: Info,
    iconBg: 'bg-slate-50',
    iconColor: 'text-slate-400',
    dot: 'bg-slate-300',
    border: 'border-l-slate-200',
    label: 'Info'
  }
};

function getCfg(actionType) {
  return TYPE_CONFIG[actionType] || TYPE_CONFIG.default;
}

// ─── Notification row component ────────────────────────────────────────────
function NotifRow({ notif, onClick }) {
  const cfg = getCfg(notif.actionType);
  const { Icon } = cfg;

  return (
    <div
      onClick={() => onClick(notif)}
      className={cn(
        'w-full cursor-pointer flex items-start gap-3 px-4 py-3 border-l-[3px] transition-all duration-150 group',
        cfg.border,
        notif.read
          ? 'bg-white hover:bg-slate-50'
          : 'bg-teal-50/20 hover:bg-teal-50/50'
      )}
    >
      {/* Icon bubble */}
      <span className={cn(
        'flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5 transition-transform group-hover:scale-105',
        cfg.iconBg
      )}>
        <Icon className={cn('w-3.5 h-3.5', cfg.iconColor)} />
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={cn(
            'text-[12px] font-semibold truncate',
            notif.read ? 'text-slate-700' : 'text-slate-900 font-bold'
          )}>
            {notif.title}
          </p>
          <span className="text-[10px] text-slate-400 font-medium shrink-0">{timeAgo(notif.timestamp)}</span>
        </div>

        {notif.message && (
          <p className="text-[11px] text-slate-500 mt-0.5 leading-4 line-clamp-1">
            {notif.message}
          </p>
        )}
      </div>

      {!notif.read && (
        <span className={cn('flex-shrink-0 w-2 h-2 rounded-full mt-2 animate-pulse', cfg.dot)} />
      )}
    </div>
  );
}

// ─── SSE connection indicator ──────────────────────────────────────────────
function ConnectionDot({ isConnected }) {
  return (
    <span className="flex items-center gap-1">
      {isConnected
        ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /><span className="text-[9px] text-emerald-600 font-semibold">LIVE</span></>
        : <><span className="w-1.5 h-1.5 rounded-full bg-slate-300" /><span className="text-[9px] text-slate-400 font-semibold">OFFLINE</span></>
      }
    </span>
  );
}

// ─── Main NotificationPanel ────────────────────────────────────────────────
export default function NotificationPanel() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const notifications = useSelector(selectNotifications);
  const unreadCount = useSelector(selectUnreadCount);
  const { permission } = useBrowserNotification();

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const [sseConnected, setSseConnected] = useState(false);
  const panelRef = useRef(null);
  const prevUnreadRef = useRef(unreadCount);

  // Map approval types to detail view routes
  const getDetailRoute = (approvalType, approvalId) => {
    if (!approvalId) return '/approvals';
    
    const type = approvalType?.toLowerCase() || '';
    
    // Advance Payment
    if (type.includes('advance')) {
      return `/p2p/advance-payments/${approvalId}`;
    }
    
    // Invoice Payment
    if (type.includes('invoice')) {
      return `/p2p/invoice-payments/${approvalId}`;
    }
    
    // RFQ Logistics
    if (type.includes('rfq') || type.includes('logistics')) {
      return `/admin/rfqs/${approvalId}`;
    }
    
    // Custom Duty Payment
    if (type.includes('custom') || type.includes('duty')) {
      return `/p2p/custom-duty?id=${approvalId}`;
    }
    
    // Logistics Payment
    if (type.includes('logistics payment')) {
      return `/p2p/logistics-payments?id=${approvalId}`;
    }
    
    // Default fallback to approvals page with search
    return `/approvals?q=${encodeURIComponent(approvalId)}`;
  };

  const handleNotifClick = (notif) => {
    dispatch(markRead(notif.id));
    setOpen(false);
    
    const route = getDetailRoute(notif.approvalType, notif.approvalId);
    navigate(route);
  };

  // Detect SSE by watching for new notifications arriving while tab is active
  useEffect(() => {
    // Check if EventSource is supported
    setSseConnected('EventSource' in window);
  }, []);

  // Track connection status via heartbeat in console logs — simple heuristic
  useEffect(() => {
    if (prevUnreadRef.current !== unreadCount && unreadCount > prevUnreadRef.current) {
      setSseConnected(true);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  // Auto mark as read when panel is open
  useEffect(() => {
    if (open && unreadCount > 0) {
      const timer = setTimeout(() => dispatch(markAllRead()), 3000);
      return () => clearTimeout(timer);
    }
  }, [open, unreadCount, dispatch]);

  // Outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const displayed = filter === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications;

  return (
    <div className="relative" ref={panelRef}>

      {/* ── Bell button ──────────────────────────────────────── */}
      <button
        id="notification-bell-btn"
        onClick={() => setOpen(p => !p)}
        className={cn(
          'relative rounded-xl border p-2.5 transition-all duration-150',
          open
            ? 'border-teal-300 bg-teal-50 text-teal-700 shadow-sm'
            : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm'
        )}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-[18px] w-[18px]" />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            key={unreadCount}
            className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-white"
            style={{ animation: 'badge-pop 0.25s ease-out' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}

        {/* SSE live dot on bell */}
        {sseConnected && (
          <span className="absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
        )}
      </button>

      {/* ── Dropdown panel ───────────────────────────────────── */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 z-50 w-[min(400px,calc(100vw-1rem))] rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/12 overflow-hidden"
          style={{ animation: 'panel-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) both' }}
        >

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center">
                <Bell className="w-3.5 h-3.5 text-teal-700" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-slate-900">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <ConnectionDot isConnected={sseConnected} />
              </div>
            </div>

            {/* Header actions */}
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={() => dispatch(markAllRead())}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-teal-700 hover:bg-teal-50 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3 h-3" /> All read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={() => { dispatch(clearAll()); setOpen(false); }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                  title="Clear all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>


          {/* Filter tabs */}
          {notifications.length > 0 && (
            <div className="flex border-b border-slate-100 bg-slate-50/60">
              {['all', 'unread'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'flex-1 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors',
                    filter === f
                      ? 'text-teal-700 border-b-2 border-teal-500 bg-white'
                      : 'text-slate-400 hover:text-slate-600'
                  )}
                >
                  {f === 'unread' ? `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` : 'All'}
                </button>
              ))}
            </div>
          )}

          {/* Notification list */}
          <div className="max-h-[380px] overflow-y-auto overscroll-contain">
            {displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-50 to-slate-100 flex items-center justify-center mb-3 shadow-inner">
                  {filter === 'unread'
                    ? <CheckCheck className="w-6 h-6 text-emerald-500" />
                    : <Bell className="w-6 h-6 text-slate-300" />
                  }
                </div>
                <p className="text-sm font-bold text-slate-700">
                  {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                  {filter === 'unread'
                    ? 'No unread notifications at this time.'
                    : 'Approval actions will appear here in real-time.'
                  }
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100/80">
                {displayed.map(notif => (
                  <NotifRow
                    key={notif.id}
                    notif={notif}
                    onClick={handleNotifClick}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-4 py-2.5 bg-gradient-to-t from-slate-50/80 to-white">
            <div className="flex items-center justify-between">
              <Link
                to="/approvals"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1.5 text-[12px] font-bold text-teal-700 hover:text-teal-800 transition-colors"
              >
                View Pending Approvals
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
              {permission === 'granted' && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
                  <ShieldCheck className="w-3 h-3" /> Browser alerts ON
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Keyframe animations */}
      <style>{`
        @keyframes panel-in {
          from { opacity: 0; transform: translateY(-8px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes badge-pop {
          0%   { transform: scale(0.6); }
          60%  { transform: scale(1.2); }
          100% { transform: scale(1);   }
        }
      `}</style>
    </div>
  );
}
