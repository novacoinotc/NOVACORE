'use client';

import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

export function Badge({
  className,
  variant = 'default',
  size = 'md',
  pulse = false,
  children,
  ...props
}: BadgeProps) {
  const variants = {
    default: 'bg-dark-600 text-gray-300 border-white/10',
    success: 'bg-green-500/10 text-green-400 border-green-500/30',
    warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    danger: 'bg-red-500/10 text-red-400 border-red-500/30',
    info: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    gold: 'bg-gold-500/10 text-gold-400 border-gold-500/30',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              variant === 'success' && 'bg-green-400',
              variant === 'warning' && 'bg-yellow-400',
              variant === 'danger' && 'bg-red-400',
              variant === 'info' && 'bg-purple-400',
              variant === 'gold' && 'bg-gold-400',
              variant === 'default' && 'bg-gray-400'
            )}
          />
          <span
            className={cn(
              'relative inline-flex h-2 w-2 rounded-full',
              variant === 'success' && 'bg-green-400',
              variant === 'warning' && 'bg-yellow-400',
              variant === 'danger' && 'bg-red-400',
              variant === 'info' && 'bg-purple-400',
              variant === 'gold' && 'bg-gold-400',
              variant === 'default' && 'bg-gray-400'
            )}
          />
        </span>
      )}
      {children}
    </span>
  );
}
