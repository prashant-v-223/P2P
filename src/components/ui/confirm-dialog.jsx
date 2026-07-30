import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Button } from './button';

const ConfirmContext = createContext(null);

function ConfirmDialog({ options, onConfirm, onCancel }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const previousFocus = useRef(document.activeElement);

  useEffect(() => {
    cancelRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        onConfirm();
      }
      if (event.key === 'Tab') {
        const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled])')];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus.current?.focus?.();
    };
  }, [onCancel, onConfirm]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" className="modal-panel max-w-[440px]">
        <header className="flex items-start justify-between gap-4 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-100"><AlertTriangle className="h-5 w-5" /></span>
            <div><h2 id="confirm-title" className="text-base font-bold tracking-tight text-slate-950">{options.title}</h2><p id="confirm-description" className="mt-1 text-sm leading-5 text-slate-500">{options.description}</p></div>
          </div>
          <button onClick={onCancel} className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close confirmation"><X className="h-[18px] w-[18px]" /></button>
        </header>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3">
          <Button ref={cancelRef} variant="ghost" onClick={onCancel}>{options.cancelLabel}</Button>
          <Button variant="destructive" onClick={onConfirm} className="shadow-sm shadow-rose-600/20"><Trash2 className="h-4 w-4" />{options.confirmLabel}</Button>
        </div>
      </section>
    </div>
  );
}

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const confirm = useCallback((options = {}) => new Promise((resolve) => {
    setRequest({
      resolve,
      options: {
        title: options.title || 'Confirm action',
        description: options.description || 'This action cannot be undone.',
        confirmLabel: options.confirmLabel || 'Confirm',
        cancelLabel: options.cancelLabel || 'Cancel'
      }
    });
  }), []);
  const finish = useCallback((value) => {
    setRequest((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && <ConfirmDialog options={request.options} onConfirm={() => finish(true)} onCancel={() => finish(false)} />}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside ConfirmProvider');
  return confirm;
};
