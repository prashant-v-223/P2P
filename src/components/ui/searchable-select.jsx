import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

export function SearchableSelect({ options, value, onChange, placeholder = 'Select an option', searchPlaceholder = 'Search options...', error, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState({});
  const normalized = useMemo(() => options.map((option) => typeof option === 'string' ? { label: option, value: option } : option), [options]);
  const selected = normalized.find((option) => option.value === value);
  const filtered = normalized.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));
  const choose = (option) => {
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    setQuery('');
    setHighlighted(0);
  };
  const handleKeys = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) setOpen(true);
      else setHighlighted((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (!open) setOpen(true);
      else choose(filtered[highlighted]);
    }
  };

  useEffect(() => {
    const close = (event) => {
      if (!rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const positionMenu = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const availableBelow = window.innerHeight - rect.bottom;
      const openAbove = availableBelow < 300 && rect.top > availableBelow;
      setMenuStyle({
        left: rect.left,
        width: rect.width,
        ...(openAbove ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 })
      });
    };
    positionMenu();
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
    return () => {
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button ref={triggerRef} type="button" disabled={disabled} onClick={() => setOpen(!open)} onKeyDown={handleKeys} aria-haspopup="listbox" aria-expanded={open} className={`flex h-10 w-full items-center justify-between rounded-xl border bg-white px-3 text-left text-sm shadow-sm transition focus:outline-none focus:ring-4 focus:ring-teal-600/10 ${error ? 'border-rose-400' : 'border-slate-300 hover:border-slate-400 focus:border-teal-600'}`}>
        <span className={selected ? 'text-slate-900' : 'text-slate-400'}>{selected?.label || placeholder}</span><ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && createPortal(
        <div ref={menuRef} style={menuStyle} className="fixed z-[180] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
          <div className="border-b border-slate-100 p-2"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input autoFocus value={query} onChange={(e) => { setQuery(e.target.value); setHighlighted(0); }} onKeyDown={handleKeys} placeholder={searchPlaceholder} className="h-9 w-full rounded-lg bg-slate-50 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-teal-600/20" /></div></div>
          <div className="max-h-56 overflow-y-auto p-1.5" role="listbox">
            {filtered.length ? filtered.map((option, index) => (
              <button key={option.value} type="button" role="option" aria-selected={option.value === value} onMouseEnter={() => setHighlighted(index)} onClick={() => choose(option)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm ${index === highlighted ? 'bg-teal-50 text-teal-800' : 'text-slate-700 hover:bg-slate-50'}`}>
                {option.label}{option.value === value && <Check className="h-4 w-4 text-teal-700" />}
              </button>
            )) : <p className="px-3 py-6 text-center text-sm text-slate-400">No matching options</p>}
          </div>
        </div>,
        document.body
      )}
      {error && <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}
