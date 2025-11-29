'use client';

import { Wallet, TrendingUp, ArrowUpRight, ArrowDownLeft, Eye, EyeOff } from 'lucide-react';
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
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-dark-700 via-dark-800 to-dark-900 border border-white/10 p-6">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-transparent to-gold-500/10 opacity-50" />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-600 to-gold-500">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-sm text-gray-400">Balance Total</h3>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-xs text-green-400">+12.5% este mes</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowBalance(!showBalance)}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            {showBalance ? (
              <Eye className="w-5 h-5 text-gray-400" />
            ) : (
              <EyeOff className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>

        {/* Main Balance */}
        <div className="mb-8">
          <div className="font-mono text-4xl md:text-5xl font-bold text-white">
            {showBalance ? (
              <>
                <span className="text-2xl text-gray-400">$</span>
                <span className="text-gold-400">
                  {totalBalance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-lg text-gray-500 ml-2">MXN</span>
              </>
            ) : (
              <span className="text-gray-500">••••••••</span>
            )}
          </div>
        </div>

        {/* Sub balances */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-dark-800/50 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-green-500/20">
                <ArrowDownLeft className="w-4 h-4 text-green-400" />
              </div>
              <span className="text-sm text-gray-400">Disponible</span>
            </div>
            <p className="font-mono text-xl font-semibold text-white">
              {showBalance ? formatCurrency(availableBalance) : '••••••'}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-dark-800/50 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-gold-500/20">
                <ArrowUpRight className="w-4 h-4 text-gold-400" />
              </div>
              <span className="text-sm text-gray-400">En Transito</span>
            </div>
            <p className="font-mono text-xl font-semibold text-white">
              {showBalance ? formatCurrency(transitBalance) : '••••••'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
