'use client';

import { forwardRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  variant?: 'default' | 'glass';
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      label,
      error,
      success,
      hint,
      leftIcon,
      variant = 'default',
      disabled,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;

    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs text-white/40 mb-1.5">{label}</label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            type={inputType}
            disabled={disabled}
            className={cn(
              'w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/30 transition-colors',
              'focus:border-white/20 focus:bg-white/[0.06]',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              leftIcon && 'pl-9',
              isPassword && 'pr-9',
              error && 'border-red-500/50',
              success && 'border-green-500/50',
              className
            )}
            {...props}
          />

          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/50"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>

        {error && <p className="mt-1 text-xs text-red-400/80">{error}</p>}
        {success && !error && <p className="mt-1 text-xs text-green-400/80">{success}</p>}
        {hint && !error && !success && <p className="mt-1 text-xs text-white/30">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
