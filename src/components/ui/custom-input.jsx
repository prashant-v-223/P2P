import React, { forwardRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export const CustomInput = forwardRef(({
  type = 'text',
  value,
  onChange,
  placeholder,
  label,
  required = false,
  error,
  helperText,
  disabled = false,
  readOnly = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  leftElement,
  rightElement,
  clearable = false,
  onClear,
  size = 'md',
  className = '',
  inputClassName = '',
  containerClassName = '',
  name,
  ...props
}, ref) => {
  const isSm = size === 'sm';

  const sizeClasses = isSm
    ? 'h-9 text-xs rounded-xl px-3'
    : 'h-10 text-xs sm:text-sm rounded-xl px-3.5';

  const paddingLeftClass = LeftIcon || leftElement ? (isSm ? 'pl-8' : 'pl-10') : '';
  const paddingRightClass = (RightIcon || rightElement || (clearable && value)) ? (isSm ? 'pr-8' : 'pr-10') : '';

  const handleClear = (e) => {
    e.stopPropagation();
    if (onClear) onClear();
    else if (onChange) onChange({ target: { value: '', name } });
  };

  return (
    <div className={cn('w-full font-sans space-y-1.5', containerClassName, className)}>
      {label && (
        <label className="block text-xs font-bold text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center w-full">
        {LeftIcon && (
          <div className="absolute left-3 flex items-center pointer-events-none text-slate-400">
            <LeftIcon className={cn('shrink-0', isSm ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
          </div>
        )}

        {leftElement && (
          <div className="absolute left-3 flex items-center shrink-0">
            {leftElement}
          </div>
        )}

        <input
          ref={ref}
          type={type}
          name={name}
          value={value ?? ''}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          className={cn(
            'w-full bg-white border border-slate-200 text-slate-900 font-medium placeholder:text-slate-400 shadow-2xs transition-all outline-none',
            'focus:border-[#0d7676] focus:ring-2 focus:ring-teal-500/20 focus:bg-white',
            'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none',
            'read-only:bg-slate-50/80 read-only:text-slate-600 read-only:cursor-not-allowed',
            error ? 'border-rose-300 bg-rose-50/20 text-rose-900 focus:border-rose-500 focus:ring-rose-500/20' : '',
            sizeClasses,
            paddingLeftClass,
            paddingRightClass,
            inputClassName
          )}
          {...props}
        />

        {clearable && value && !disabled && !readOnly && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Clear text"
          >
            <X className={cn('shrink-0', isSm ? 'w-3 h-3' : 'w-3.5 h-3.5')} />
          </button>
        )}

        {!clearable && RightIcon && (
          <div className="absolute right-3 flex items-center pointer-events-none text-slate-400">
            <RightIcon className={cn('shrink-0', isSm ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
          </div>
        )}

        {!clearable && rightElement && (
          <div className="absolute right-3 flex items-center shrink-0">
            {rightElement}
          </div>
        )}
      </div>

      {error && typeof error === 'string' && (
        <p className="text-[11px] font-bold text-rose-600 mt-1">{error}</p>
      )}

      {helperText && !error && (
        <p className="text-[11px] font-medium text-slate-400 mt-1">{helperText}</p>
      )}
    </div>
  );
});

CustomInput.displayName = 'CustomInput';

export default CustomInput;
