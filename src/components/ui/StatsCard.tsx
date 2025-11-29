'use client';

import { cn, formatCurrency, formatCompactNumber } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number;
  change?: number;
  format?: 'currency' | 'number' | 'compact';
}

export function StatsCard({
  title,
  value,
  change,
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

  return (
    <div className="rounded-xl bg-dark-800 border border-white/[0.04] p-5">
      <p className="text-sm text-gray-500 mb-2">{title}</p>
      <p className="text-2xl font-semibold font-mono text-white">
        {formattedValue()}
      </p>
      {change !== undefined && (
        <div className="flex items-center gap-1 mt-2">
          {change >= 0 ? (
            <TrendingUp className="w-3 h-3 text-green-500" />
          ) : (
            <TrendingDown className="w-3 h-3 text-red-500" />
          )}
          <span
            className={cn(
              'text-xs',
              change >= 0 ? 'text-green-500' : 'text-red-500'
            )}
          >
            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}
