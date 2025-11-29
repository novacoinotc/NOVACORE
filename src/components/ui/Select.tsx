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
  variant?: 'default' | 'glass' | 'neon';
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
    const variants = {
      default: 'bg-dark-700 border-white/10 focus:border-accent-primary',
      glass: 'glass border-white/10 focus:border-white/30',
      neon: 'bg-dark-800 border-neon-cyan/30 focus:border-neon-cyan',
    };

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            {label}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            disabled={disabled}
            className={cn(
              'w-full appearance-none rounded-lg border px-4 py-2.5 pr-10 text-white transition-all duration-300',
              'focus:outline-none focus:ring-2 focus:ring-accent-primary/30',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              variants[variant],
              error && 'border-red-500 focus:border-red-500',
              className
            )}
            {...props}
          >
            <option value="" disabled className="bg-dark-800 text-gray-400">
              {placeholder}
            </option>
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="bg-dark-800 text-white"
              >
                {option.label}
              </option>
            ))}
          </select>

          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </div>
        </div>

        {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export { Select };
