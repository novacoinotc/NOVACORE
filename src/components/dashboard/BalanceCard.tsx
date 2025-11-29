'use client';

import { ArrowUpRight, ArrowDownLeft, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { formatCurrency } from '@/lib/utils';

interface BalanceCardProps {
  totalBalance: number;
  availableBalance: number;
  transitBalance: number;
}

export function BalanceCard({ totalBalance, availableBalance, transitBalance }: BalanceCardProps) {
  const [showBalance, setShowBalance] = useState(true);

  return (
    <div className="rounded-xl bg-dark-800 border border-white/[0.04] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-gray-500">Balance Total</p>
          <div className="font-mono text-3xl font-semibold text-white mt-1">
            {showBalance ? (
              <>
                <span className="text-gray-500">$</span>
                {totalBalance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                <span className="text-sm text-gray-500 ml-2">MXN</span>
              </>
            ) : (
              <span className="text-gray-500">••••••••</span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowBalance(!showBalance)}
          className="p-2 rounded-lg hover:bg-white/[0.03] transition-colors"
        >
          {showBalance ? (
            <Eye className="w-5 h-5 text-gray-500" />
          ) : (
            <EyeOff className="w-5 h-5 text-gray-500" />
          )}
        </button>
      </div>

      {/* Sub balances */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-dark-900/50">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownLeft className="w-4 h-4 text-green-500" />
            <span className="text-xs text-gray-500">Disponible</span>
          </div>
          <p className="font-mono text-lg font-medium text-white">
            {showBalance ? formatCurrency(availableBalance) : '••••••'}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-dark-900/50">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpRight className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-500">En Transito</span>
          </div>
          <p className="font-mono text-lg font-medium text-white">
            {showBalance ? formatCurrency(transitBalance) : '••••••'}
          </p>
        </div>
      </div>
    </div>
  );
}
