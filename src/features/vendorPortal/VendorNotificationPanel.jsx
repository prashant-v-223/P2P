import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  XCircle,
  Info,
  CheckCheck,
  Trash2,
  ChevronRight,
  ClipboardList,
  FileText,
  Wallet,
  Award,
  Clock,
  Sun,
  X
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/ui/toast';

// Relative time-ago formatter
function timeAgo(isoString) {
  if (!isoString) return 'Just now';
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 10) return 'Just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(isoString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// Notification Category Configurations
const TYPE_CONFIG = {
  rfq_invited: {
    Icon: ClipboardList,
    iconBg: 'bg-teal-50',
    iconColor: 'text-[#0d7676]',
    border: 'border-l-[#0d7676]',
    label: 'New RFQ'
  },
  rfq_awarded: {
    Icon: Award,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    border: 'border-l-amber-500',
    label: 'Awarded'
  },
  rfq_deadline: {
    Icon: Clock,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    border: 'border-l-rose-400',
    label: 'Closing Soon'
  },
  invoice_status: {
    Icon: FileText,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    border: 'border-l-blue-500',
    label: 'Invoice Update'
  },
  advance_status: {
    Icon: Wallet,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    border: 'border-l-emerald-500',
    label: 'Advance Payment'
  },
  general: {
    Icon: Info,
    iconBg: 'bg-slate-50',
    iconColor: 'text-slate-600',
    border: 'border-l-slate-400',
    label: 'Notice'
  }
};

export default function VendorNotificationPanel({ vendorProfile, vendorUser, isFreightForwarder }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const panelRef = useRef(null);

  const storageKey = `rayzon_vendor_notifications_${vendorProfile?.sapVendorCode || vendorUser?.id || 'guest'}`;

  const [notifications, setNotifications] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Save to localStorage when notifications change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(notifications));
    } catch {
      // Ignore storage write errors
    }
  }, [notifications, storageKey]);

  // Click outside listener to close popover
  useEffect(() => {
    function handleClickOutside(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Fetch RFQ data & generate initial vendor notifications if empty or refreshed
  const syncVendorNotifications = useCallback(async () => {
    const token = localStorage.getItem('rayzon_vendor_token');
    if (!token) return;

    try {
      const newItems = [];

      if (isFreightForwarder) {
        const res = await apiFetch('/api/p2p/vendor-rfqs');
        const json = await res.json();
        if (res.ok && json.success && Array.isArray(json.data)) {
          const now = new Date();
          json.data.forEach((rfq) => {
            const isPublished = String(rfq.status).toLowerCase() === 'published';
            const isAwardedToMe = rfq.awardedVendorName === vendorProfile?.companyName || rfq.myQuote?.status === 'awarded';

            if (isAwardedToMe) {
              newItems.push({
                id: `rfq-award-${rfq.rfqId}`,
                type: 'rfq_awarded',
                title: 'RFQ Awarded to Your Company 🎉',
                message: `${rfq.rfqNumber || rfq.rfqId}: ${rfq.title || 'Freight Sourcing'} has been awarded to you.`,
                createdAt: rfq.awardedAt || rfq.updatedAt || new Date().toISOString(),
                link: `/vendor/rfqs/${rfq.rfqNumber || rfq.rfqId}`,
                read: false
              });
            } else if (isPublished && !rfq.myQuote) {
              newItems.push({
                id: `rfq-invite-${rfq.rfqId}`,
                type: 'rfq_invited',
                title: 'New RFQ Invitation Awaiting Quote',
                message: `${rfq.rfqNumber || rfq.rfqId}: ${rfq.title || 'Freight RFQ'}. Closing Date: ${rfq.closingDate ? new Date(rfq.closingDate).toLocaleDateString('en-IN') : 'Open'}`,
                createdAt: rfq.createdAt || new Date().toISOString(),
                link: `/vendor/rfqs/${rfq.rfqNumber || rfq.rfqId}`,
                read: false
              });
            }
          });
        }
      } else {
        // Regular Vendor Notifications (Invoices & Advances)
        const invoicesRes = await apiFetch('/api/vendors/my-invoices');
        if (invoicesRes.ok) {
          const invJson = await invoicesRes.json();
          if (invJson.success && Array.isArray(invJson.invoices)) {
            invJson.invoices.slice(0, 5).forEach((inv) => {
              newItems.push({
                id: `inv-${inv.invoiceNumber || inv.id}`,
                type: 'invoice_status',
                title: `Invoice ${inv.invoiceNumber} Status`,
                message: `Invoice ${inv.invoiceNumber} status is currently ${inv.status || 'Under Review'}.`,
                createdAt: inv.createdAt || new Date().toISOString(),
                link: '/vendor/invoices',
                read: false
              });
            });
          }
        }
      }

      if (newItems.length > 0) {
        setNotifications((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const toAdd = newItems.filter((item) => !existingIds.has(item.id));
          if (toAdd.length === 0) return prev;
          return [...toAdd, ...prev];
        });
      }
    } catch {
      // Background sync errors fail silently
    }
  }, [isFreightForwarder, vendorProfile?.companyName]);

  useEffect(() => {
    syncVendorNotifications();
  }, [syncVendorNotifications]);

  // Real-time SSE Live Listener
  useEffect(() => {
    const token = localStorage.getItem('rayzon_vendor_token');
    if (!token) return undefined;

    const stream = new EventSource(`/api/events/stream?token=${encodeURIComponent(token)}`);
    const identifiers = [vendorProfile?.sapVendorCode, vendorProfile?.id, vendorUser?.id].filter(Boolean).map(String);

    const handleRfqInvited = (event) => {
      let data; try { data = JSON.parse(event.data); } catch { return; }
      if (!(data.vendorIds || []).some((id) => identifiers.includes(String(id)))) return;

      const newNotif = {
        id: `sse-invite-${data.rfqId}-${Date.now()}`,
        type: 'rfq_invited',
        title: '⚡ New RFQ Invitation Published',
        message: `${data.rfqNumber || data.rfqId}: ${data.title}`,
        createdAt: new Date().toISOString(),
        link: `/vendor/rfqs/${data.rfqNumber || data.rfqId}`,
        read: false
      };

      setNotifications((prev) => [newNotif, ...prev]);
      showToast({ type: 'info', title: 'New RFQ Invitation', description: `${data.rfqNumber}: ${data.title}` });
    };

    const handleRfqAwarded = (event) => {
      let data; try { data = JSON.parse(event.data); } catch { return; }
      if (!identifiers.includes(String(data.vendorId)) && data.vendorName !== vendorProfile?.companyName) return;

      const newNotif = {
        id: `sse-award-${data.rfqId}-${Date.now()}`,
        type: 'rfq_awarded',
        title: '🏆 RFQ Awarded to Your Company!',
        message: `${data.rfqNumber || data.rfqId} has been successfully awarded to your company.`,
        createdAt: new Date().toISOString(),
        link: `/vendor/rfqs/${data.rfqNumber || data.rfqId}`,
        read: false
      };

      setNotifications((prev) => [newNotif, ...prev]);
      showToast({ type: 'success', title: 'RFQ Awarded!', description: `${data.rfqNumber || data.rfqId} awarded to your company.` });
    };

    stream.addEventListener('RFQ_INVITED', handleRfqInvited);
    stream.addEventListener('RFQ_AWARDED', handleRfqAwarded);

    return () => stream.close();
  }, [vendorProfile, vendorUser, showToast]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'unread') return !n.read;
    if (activeTab === 'rfqs') return n.type.startsWith('rfq_');
    if (activeTab === 'invoices') return n.type === 'invoice_status' || n.type === 'advance_status';
    return true;
  });

  const handleMarkAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    showToast({ type: 'success', title: 'Marked all as read', description: 'All vendor notifications are now marked as read.' });
  };

  const handleClearAll = () => {
    setNotifications([]);
    showToast({ type: 'info', title: 'Notifications cleared', description: 'Your notification panel has been cleared.' });
  };

  const handleItemClick = (notif) => {
    handleMarkAsRead(notif.id);
    setIsOpen(false);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* ── Bell Trigger Button ──────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative rounded-xl border p-2 transition-all cursor-pointer ${
          isOpen
            ? 'border-[#0d7676] bg-teal-50 text-[#0d7676] ring-2 ring-teal-500/20'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-teal-50 hover:text-[#0d7676] hover:border-teal-200'
        }`}
        title="Vendor Notifications"
        aria-expanded={isOpen}
      >
        <Bell className="h-4 w-4" />

        {/* Unread Badge Count */}
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-extrabold text-white shadow-xs animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Floating Notification Popover Dropdown Panel ────────────── */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2.5 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-2xl z-50 overflow-hidden font-sans text-xs animate-in fade-in slide-in-from-top-2 duration-150">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-[#0d7676] font-bold border border-teal-200">
                <Bell className="h-3.5 w-3.5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-xs tracking-tight flex items-center gap-1.5">
                  Notifications
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[9px] font-extrabold text-[#0d7676]">
                      {unreadCount} new
                    </span>
                  )}
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">Vendor Portal Alerts</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="p-1 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-md transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                  title="Clear all notifications"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors ml-1"
                title="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-slate-100 bg-white px-2 pt-2 gap-1 text-[11px] font-bold text-slate-500">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-t-lg transition-colors ${
                activeTab === 'all'
                  ? 'border-b-2 border-[#0d7676] text-[#0d7676] bg-teal-50/50 font-bold'
                  : 'hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unread')}
              className={`px-3 py-1.5 rounded-t-lg transition-colors ${
                activeTab === 'unread'
                  ? 'border-b-2 border-[#0d7676] text-[#0d7676] bg-teal-50/50 font-bold'
                  : 'hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Unread ({unreadCount})
            </button>
            {isFreightForwarder && (
              <button
                type="button"
                onClick={() => setActiveTab('rfqs')}
                className={`px-3 py-1.5 rounded-t-lg transition-colors ${
                  activeTab === 'rfqs'
                    ? 'border-b-2 border-[#0d7676] text-[#0d7676] bg-teal-50/50 font-bold'
                    : 'hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                RFQs
              </button>
            )}
            {!isFreightForwarder && (
              <button
                type="button"
                onClick={() => setActiveTab('invoices')}
                className={`px-3 py-1.5 rounded-t-lg transition-colors ${
                  activeTab === 'invoices'
                    ? 'border-b-2 border-[#0d7676] text-[#0d7676] bg-teal-50/50 font-bold'
                    : 'hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Invoices
              </button>
            )}
          </div>

          {/* Notification List Container */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 bg-white">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 mx-auto flex items-center justify-center text-slate-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="font-semibold text-slate-700 text-xs">You're all caught up!</p>
                <p className="text-[10px] text-slate-400">No new notifications in this view.</p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.general;
                const IconComponent = config.Icon;

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleItemClick(notif)}
                    className={`group relative p-3.5 flex items-start gap-3 border-l-4 transition-all cursor-pointer ${
                      config.border
                    } ${
                      notif.read ? 'bg-white hover:bg-slate-50/80 opacity-80' : 'bg-teal-50/20 hover:bg-teal-50/40 font-semibold'
                    }`}
                  >
                    {/* Category Icon */}
                    <div className={`p-2 rounded-xl shrink-0 ${config.iconBg} ${config.iconColor} border border-slate-100`}>
                      <IconComponent className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                          {config.label}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">
                          {timeAgo(notif.createdAt)}
                        </span>
                      </div>
                      <h4 className={`text-xs ${notif.read ? 'font-bold text-slate-800' : 'font-extrabold text-slate-900'} truncate`}>
                        {notif.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mt-0.5 font-medium">
                        {notif.message}
                      </p>
                    </div>

                    {/* Unread indicator dot */}
                    {!notif.read && (
                      <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-[#0d7676] ring-4 ring-teal-100" />
                    )}

                    {/* Hover chevron */}
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#0d7676] group-hover:translate-x-0.5 transition-all self-center shrink-0 opacity-0 group-hover:opacity-100" />
                  </div>
                );
              })
            )}
          </div>

          {/* Panel Footer */}
          <div className="border-t border-slate-100 bg-slate-50/70 p-2 text-center">
            {isFreightForwarder ? (
              <button
                type="button"
                onClick={() => { setIsOpen(false); navigate('/vendor/rfqs'); }}
                className="w-full text-[11px] font-bold text-[#0d7676] hover:underline py-1"
              >
                View All RFQs & Quotations →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setIsOpen(false); navigate('/vendor/invoices'); }}
                className="w-full text-[11px] font-bold text-[#0d7676] hover:underline py-1"
              >
                View All Vendor Invoices →
              </button>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
