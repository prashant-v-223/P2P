import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

function formatLabel(str) {
  if (!str || typeof str !== 'string') return String(str ?? '');
  if (str.includes(' ') && !str.includes('_')) return str;
  const knownCaps = { cfo: 'CFO', md: 'MD', rfq: 'RFQ', bl: 'BL', exim: 'EXIM', po: 'PO', inr: 'INR', sap: 'SAP' };
  return str
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .map((word) => {
      const lower = word.toLowerCase();
      return knownCaps[lower] || (word.charAt(0).toUpperCase() + word.slice(1));
    })
    .join(' ');
}

export function SearchableSelect({
  options = [],
  value,
  onChange,
  onSearchChange,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search options...',
  error,
  disabled = false,
  className = '',
  size = 'md', // 'sm' | 'md'
  searchable = true,
  name
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState({});

  const normalized = useMemo(() => {
    return (options || []).map((option) => {
      if (option === null || option === undefined) return { label: '', value: '' };
      if (typeof option === 'string' || typeof option === 'number' || typeof option === 'boolean') {
        return { label: formatLabel(String(option)), value: option };
      }
      const val = option.value !== undefined ? option.value : (option.roleName !== undefined ? option.roleName : (option.id !== undefined ? option.id : (option.code !== undefined ? option.code : option.key)));
      const rawLbl = option.label !== undefined
        ? option.label
        : (option.name !== undefined
        ? option.name
        : (option.roleName !== undefined
        ? option.roleName
        : (option.title !== undefined
        ? option.title
        : (option.description && !String(option.description).startsWith('Imported legacy')
        ? option.description
        : String(val ?? '')))));
      return { label: formatLabel(String(rawLbl)), value: val };
    });
  }, [options]);

  const selected = normalized.find((option) => {
    if (value === undefined || value === null) return false;
    return String(option.value) === String(value);
  });

  const displayLabel = selected
    ? selected.label
    : (value !== undefined && value !== null && value !== '' ? formatLabel(String(value)) : placeholder);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return normalized;
    return normalized.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));
  }, [normalized, query, searchable]);

  const choose = (option) => {
    if (!option || disabled) return;
    if (onChange) {
      // Pass value directly or synthetic event if needed
      onChange(option.value);
    }
    setOpen(false);
    setQuery('');
    setHighlighted(0);
  };

  const handleKeys = (event) => {
    if (disabled) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) setOpen(true);
      else setHighlighted((index) => Math.min(index + 1, Math.max(0, filtered.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (!open) setOpen(true);
      else if (filtered[highlighted]) choose(filtered[highlighted]);
    }
  };

  useEffect(() => {
    const close = (event) => {
      if (!rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
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
      const openAbove = availableBelow < 260 && rect.top > availableBelow;
      setMenuStyle({
        left: rect.left,
        width: Math.max(rect.width, 160),
        minWidth: rect.width,
        ...(openAbove ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 })
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

  const isSmall = size === 'sm';

  return (
    <div ref={rootRef} className={`relative inline-block w-full ${className}`}>
      {name && <input type="hidden" name={name} value={value ?? ''} />}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        onKeyDown={handleKeys}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border bg-white text-left font-medium shadow-xs transition focus:outline-none focus:ring-2 focus:ring-[#0d7676]/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60 ${
          isSmall ? 'h-9 px-2.5 text-xs' : 'h-10 px-3 text-sm'
        } ${
          error
            ? 'border-rose-400 text-rose-900 focus:border-rose-500'
            : 'border-slate-200 text-slate-800 hover:border-slate-300 focus:border-[#0d7676]'
        }`}
      >
        <span className={`truncate ${(selected || (value !== undefined && value !== null && value !== '')) ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>
          {displayLabel}
        </span>
        <ChevronDown className={`shrink-0 transition-transform ${isSmall ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-slate-400 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className="fixed z-[999] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10"
          >
            {searchable && normalized.length > 5 && (
              <div className="border-b border-slate-100 p-1.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => {
                      const newQuery = e.target.value;
                      setQuery(newQuery);
                      setHighlighted(0);
                      if (onSearchChange) onSearchChange(newQuery);
                    }}
                    onKeyDown={handleKeys}
                    placeholder={searchPlaceholder}
                    className="h-8 w-full rounded-lg bg-slate-50 pl-8 pr-2.5 text-xs outline-none focus:bg-white focus:ring-1 focus:ring-[#0d7676]"
                  />
                </div>
              </div>
            )}
            <div className="max-h-60 overflow-y-auto p-1" role="listbox">
              {filtered.length ? (
                filtered.map((option, index) => {
                  const isSelected = String(option.value) === String(value);
                  return (
                    <button
                      key={`${option.value}-${index}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setHighlighted(index)}
                      onClick={() => choose(option)}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition ${
                        index === highlighted
                          ? 'bg-teal-50 text-[#0d7676] font-semibold'
                          : isSelected
                          ? 'bg-slate-50 text-[#0d7676] font-bold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{option.label}</span>
                      {isSelected && <Check className="ml-2 h-3.5 w-3.5 shrink-0 text-[#0d7676]" />}
                    </button>
                  );
                })
              ) : (
                <p className="px-3 py-4 text-center text-xs text-slate-400">No matching options</p>
              )}
            </div>
          </div>,
          document.body
        )}
      {error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}

