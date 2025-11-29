'use client';

import { cn, formatCurrency, formatCompactNumber } from '@/lib/utils';

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
    <div className="p-4">
      <p className="text-xs text-white/30 mb-1">{title}</p>
      <p className="text-xl font-medium font-mono text-white/90">
        {formattedValue()}
      </p>
      {change !== undefined && (
        <p
          className={cn(
            'text-xs mt-1',
            change >= 0 ? 'text-green-400/60' : 'text-red-400/60'
          )}
        >
          {change >= 0 ? '+' : ''}{change.toFixed(1)}%
        </p>
      )}
    </div>
  );
}
