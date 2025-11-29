'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  variant?: 'default' | 'glass';
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      options,
      placeholder = 'Seleccionar...',
      variant = 'default',
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs text-white/40 mb-1.5">{label}</label>
        )}

        <div className="relative">
          <select
            ref={ref}
            disabled={disabled}
            className={cn(
              'w-full appearance-none rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 pr-8 text-sm text-white transition-colors',
              'focus:border-white/20 focus:bg-white/[0.06]',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              error && 'border-red-500/50',
              className
            )}
            {...props}
          >
            <option value="" disabled className="bg-neutral-900 text-white/40">
              {placeholder}
            </option>
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="bg-neutral-900 text-white"
              >
                {option.label}
              </option>
            ))}
          </select>

          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <ChevronDown className="w-4 h-4 text-white/30" />
          </div>
        </div>

        {error && <p className="mt-1 text-xs text-red-400/80">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export { Select };
