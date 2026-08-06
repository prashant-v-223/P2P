import React from 'react';
import { SearchableSelect } from './searchable-select';

export function CustomSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  label,
  required = false,
  error,
  helperText,
  disabled = false,
  className = '',
  size = 'md',
  searchable = true,
  name
}) {
  return (
    <div className={`space-y-1.5 font-sans ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <SearchableSelect
        options={options}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        error={error}
        disabled={disabled}
        size={size}
        searchable={searchable}
        name={name}
      />

      {helperText && !error && (
        <p className="text-[11px] font-medium text-slate-400 mt-1">{helperText}</p>
      )}
    </div>
  );
}

