'use client';

import { motion } from 'framer-motion';
import { cn, formatCurrency, formatCompactNumber } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'gradient' | 'neon';
  format?: 'currency' | 'number' | 'compact';
}

export function StatsCard({
  title,
  value,
  prefix,
  suffix,
  change,
  changeLabel,
  icon,
  variant = 'default',
  format = 'number',
}: StatsCardProps) {
  const formattedValue = () => {
    switch (format) {
      case 'currency':
        return formatCurrency(value);
      case 'compact':
        return formatCompactNumber(value);
      default:
        return value.toLocaleString('es-MX');
    }
  };

  const variants = {
    default: 'bg-dark-700 border-white/5',
    gradient: 'bg-gradient-to-br from-accent-primary/20 via-dark-700 to-accent-secondary/20 border-accent-primary/20',
    neon: 'bg-dark-800 border-neon-cyan/30',
  };

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      className={cn(
        'relative rounded-xl border p-6 overflow-hidden',
        variants[variant]
      )}
    >
      {/* Background glow */}
      {variant === 'gradient' && (
        <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/5 to-accent-secondary/5" />
      )}

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-gray-400">{title}</span>
          {icon && (
            <div className="p-2 rounded-lg bg-white/5">
              {icon}
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          {prefix && (
            <span className="text-lg text-gray-400">{prefix}</span>
          )}
          <motion.span
            className={cn(
              'text-3xl font-bold font-mono',
              variant === 'neon' ? 'text-neon-cyan text-glow-cyan' : 'text-white'
            )}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={value}
          >
            {formattedValue()}
          </motion.span>
          {suffix && (
            <span className="text-lg text-gray-400">{suffix}</span>
          )}
        </div>

        {change !== undefined && (
          <div className="flex items-center gap-1.5 mt-3">
            {change >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
            <span
              className={cn(
                'text-sm font-medium',
                change >= 0 ? 'text-green-400' : 'text-red-400'
              )}
            >
              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
            </span>
            {changeLabel && (
              <span className="text-sm text-gray-500">{changeLabel}</span>
            )}
          </div>
        )}
      </div>

      {/* Decorative elements */}
      {variant === 'neon' && (
        <>
          <div className="absolute top-0 right-0 w-20 h-20 bg-neon-cyan/10 rounded-full blur-2xl" />
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-neon-purple/10 rounded-full blur-2xl" />
        </>
      )}
    </motion.div>
  );
}
