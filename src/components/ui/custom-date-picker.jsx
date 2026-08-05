import React from 'react';
import { Calendar, AlertCircle } from 'lucide-react';

export function CustomDatePicker({
  value,
  onChange,
  max,
  min,
  label,
  required = false,
  error,
  helperText,
  disabled = false,
  className = ''
}) {
  return (
    <div className="space-y-1.5 font-sans">
      {label && (
        <label className="block text-xs font-bold text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <Calendar className="w-4 h-4 text-[#0d7676] absolute left-3.5 pointer-events-none" />
        <input
          type="date"
          value={value || ''}
          max={max}
          min={min}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border rounded-xl text-slate-900 text-sm font-semibold outline-none transition-all focus:ring-2 focus:ring-teal-100 ${
            error
              ? 'border-rose-400 focus:border-rose-500 bg-rose-50/20'
              : 'border-slate-200 focus:border-[#0d7676] focus:bg-white hover:border-slate-300'
          } ${disabled ? 'opacity-60 bg-slate-100 cursor-not-allowed' : ''} ${className}`}
        />
      </div>

      {error ? (
        <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1 mt-1">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </p>
      ) : helperText ? (
        <p className="text-[11px] font-medium text-slate-400 mt-1">{helperText}</p>
      ) : null}
    </div>
  );
}
