'use client';

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
  variant?: 'default' | 'gradient' | 'gold';
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
    default: 'bg-dark-800 border-white/5',
    gradient: 'bg-gradient-to-br from-purple-600/20 via-dark-800 to-gold-500/10 border-purple-500/20',
    gold: 'bg-dark-800 border-gold-500/30',
  };

  return (
    <div
      className={cn(
        'relative rounded-xl border p-6 overflow-hidden transition-all duration-200 hover:border-purple-500/30',
        variants[variant]
      )}
    >
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
          <span
            className={cn(
              'text-3xl font-bold font-mono',
              variant === 'gold' ? 'text-gold-400' : 'text-white'
            )}
          >
            {formattedValue()}
          </span>
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
    </div>
  );
}
