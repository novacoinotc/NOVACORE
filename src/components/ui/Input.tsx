'use client';

import { forwardRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: 'default' | 'glass' | 'neon';
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
      rightIcon,
      variant = 'default',
      disabled,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;

    const variants = {
      default: 'bg-dark-700 border-white/10 focus:border-accent-primary',
      glass: 'glass border-white/10 focus:border-white/30',
      neon: 'bg-dark-800 border-neon-cyan/30 focus:border-neon-cyan focus:shadow-neon-cyan',
    };

    return (
      <div className="w-full">
        {/* Label */}
        {label && (
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            {label}
          </label>
        )}

        {/* Input Container */}
        <div className="relative">
          {/* Left Icon */}
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {leftIcon}
            </div>
          )}

          {/* Input */}
          <input
            ref={ref}
            type={inputType}
            disabled={disabled}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={cn(
              'w-full rounded-lg border px-4 py-2.5 text-white placeholder-gray-500 transition-all duration-300',
              'focus:outline-none focus:ring-2 focus:ring-accent-primary/30',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              variants[variant],
              leftIcon && 'pl-10',
              (rightIcon || isPassword) && 'pr-10',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500/30',
              success && 'border-green-500 focus:border-green-500 focus:ring-green-500/30',
              className
            )}
            {...props}
          />

          {/* Focus glow effect */}
          <AnimatePresence>
            {isFocused && variant === 'neon' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 rounded-lg bg-neon-cyan/5 pointer-events-none"
              />
            )}
          </AnimatePresence>

          {/* Right Icon / Password Toggle / Status Icon */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {error && <AlertCircle className="w-4 h-4 text-red-500" />}
            {success && !error && <CheckCircle className="w-4 h-4 text-green-500" />}
            {rightIcon && !isPassword && !error && !success && (
              <span className="text-gray-400">{rightIcon}</span>
            )}
            {isPassword && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Helper Text */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-1.5 text-sm text-red-400"
            >
              {error}
            </motion.p>
          )}
          {success && !error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-1.5 text-sm text-green-400"
            >
              {success}
            </motion.p>
          )}
          {hint && !error && !success && (
            <p className="mt-1.5 text-sm text-gray-500">{hint}</p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
