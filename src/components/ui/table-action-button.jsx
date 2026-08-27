import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const VARIANT_STYLES = {
  view: 'border-teal-200 bg-teal-50/90 text-[#0d7676] hover:bg-[#0d7676] hover:text-white hover:border-[#0d7676] shadow-2xs',
  teal: 'border-teal-200 bg-teal-50/90 text-[#0d7676] hover:bg-[#0d7676] hover:text-white hover:border-[#0d7676] shadow-2xs',
  edit: 'border-blue-200 bg-blue-50/90 text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 shadow-2xs',
  copy: 'border-emerald-200 bg-emerald-50/90 text-emerald-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 shadow-2xs',
  delete: 'border-rose-200 bg-rose-50/90 text-rose-600 hover:bg-rose-600 hover:text-white hover:border-rose-600 shadow-2xs',
  close: 'border-amber-200 bg-amber-50/90 text-amber-700 hover:bg-amber-600 hover:text-white hover:border-amber-600 shadow-2xs',
  reopen: 'border-sky-200 bg-sky-50/90 text-sky-700 hover:bg-sky-600 hover:text-white hover:border-sky-600 shadow-2xs',
  success: 'border-emerald-200 bg-emerald-50/90 text-emerald-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 shadow-2xs',
  slate: 'border-slate-200 bg-slate-100/90 text-slate-700 hover:bg-slate-800 hover:text-white hover:border-slate-800 shadow-2xs'
};

export function TableActionButton({
  onClick,
  icon: Icon,
  title,
  label,
  variant = 'view',
  disabled = false,
  className = ''
}) {
  const [hovered, setHovered] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const tooltip = title || label;
  const style = VARIANT_STYLES[variant] || VARIANT_STYLES.view;

  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top - 6,
        left: rect.left + rect.width / 2
      });
    }
  };

  const handleMouseEnter = () => {
    updateCoords();
    setHovered(true);
  };

  const handleMouseLeave = () => {
    setHovered(false);
  };

  useEffect(() => {
    if (!hovered) return;
    const handleScroll = () => updateCoords();
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [hovered]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        disabled={disabled}
        aria-label={tooltip}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${style} ${className}`}
      >
        <Icon className="h-4 w-4 shrink-0 stroke-[2.2]" />
      </button>

      {hovered && tooltip && createPortal(
        <div
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            transform: 'translate(-50%, -100%)',
            zIndex: 99999
          }}
          className="px-2.5 py-1 bg-slate-900/95 backdrop-blur-xs text-white text-[10.5px] font-bold rounded-lg shadow-xl whitespace-nowrap pointer-events-none transition-opacity duration-150 animate-in fade-in zoom-in-95"
        >
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/95" />
        </div>,
        document.body
      )}
    </>
  );
}

export default TableActionButton;
