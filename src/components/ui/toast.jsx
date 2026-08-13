import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);
const styles = {
  success: { icon: CheckCircle2, className: 'border-emerald-200', iconClassName: 'bg-emerald-50 text-emerald-700' },
  error: { icon: AlertCircle, className: 'border-rose-200', iconClassName: 'bg-rose-50 text-rose-700' },
  info: { icon: Info, className: 'border-sky-200', iconClassName: 'bg-sky-50 text-sky-700' }
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => setToasts((items) => items.filter((item) => item.id !== id)), []);
  const showToast = useCallback(({ title, description = '', type = 'success', duration = 3500 }) => {
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setToasts((items) => [...items.slice(-3), { id, title, description, type }]);
    window.setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);
  const value = useMemo(() => ({ showToast, dismiss }), [showToast, dismiss]);
  const toastViewport = createPortal(
    <div className="pointer-events-none fixed right-3 top-3 z-[200] flex w-[min(380px,calc(100vw-1.5rem))] flex-col gap-2.5 sm:right-4 sm:top-4" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const config = styles[toast.type] || styles.info;
        const Icon = config.icon;
        return (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-3.5 shadow-[0_18px_45px_-16px_rgba(15,23,42,0.45)] ring-1 ring-slate-900/5 ${config.className}`}
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.iconClassName}`}>
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-5 text-slate-900">{toast.title}</p>
              {toast.description && <p className="mt-0.5 text-xs leading-5 text-slate-600">{toast.description}</p>}
            </div>
            <button type="button" onClick={() => dismiss(toast.id)} className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Dismiss notification">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toastViewport}
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
};
