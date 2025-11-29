'use client';

import { Eye, EyeOff } from 'lucide-react';
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
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-white/30">Balance total</p>
        <button
          onClick={() => setShowBalance(!showBalance)}
          className="text-white/20 hover:text-white/40 transition-colors"
        >
          {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      </div>

      <p className="font-mono text-2xl text-white/90 mb-6">
        {showBalance ? (
          <>
            <span className="text-white/40">$</span>
            {totalBalance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </>
        ) : (
          <span className="text-white/20">••••••••</span>
        )}
      </p>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/[0.06]">
        <div>
          <p className="text-xs text-white/30 mb-1">Disponible</p>
          <p className="font-mono text-sm text-white/70">
            {showBalance ? formatCurrency(availableBalance) : '••••••'}
          </p>
        </div>
        <div>
          <p className="text-xs text-white/30 mb-1">En transito</p>
          <p className="font-mono text-sm text-white/70">
            {showBalance ? formatCurrency(transitBalance) : '••••••'}
          </p>
        </div>
      </div>
    </div>
  );
}
