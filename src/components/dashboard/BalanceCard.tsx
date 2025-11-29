'use client';

import { motion } from 'framer-motion';
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-dark-700 via-dark-800 to-dark-900 border border-white/10 p-6"
    >
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/10 via-transparent to-neon-purple/10 opacity-50" />

      {/* Glowing orbs */}
      <motion.div
        className="absolute -top-20 -right-20 w-40 h-40 bg-neon-cyan/20 rounded-full blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      <motion.div
        className="absolute -bottom-10 -left-10 w-32 h-32 bg-neon-purple/20 rounded-full blur-3xl"
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.4, 0.2, 0.4],
        }}
        transition={{ duration: 5, repeat: Infinity }}
      />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-accent-primary to-accent-secondary shadow-glow">
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
          <motion.div
            className="font-mono text-4xl md:text-5xl font-bold text-white"
            key={showBalance ? 'visible' : 'hidden'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {showBalance ? (
              <>
                <span className="text-2xl text-gray-400">$</span>
                <span className="text-neon-cyan text-glow-cyan">
                  {totalBalance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-lg text-gray-500 ml-2">MXN</span>
              </>
            ) : (
              <span className="text-gray-500">••••••••</span>
            )}
          </motion.div>
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
              <div className="p-1.5 rounded-lg bg-yellow-500/20">
                <ArrowUpRight className="w-4 h-4 text-yellow-400" />
              </div>
              <span className="text-sm text-gray-400">En Transito</span>
            </div>
            <p className="font-mono text-xl font-semibold text-white">
              {showBalance ? formatCurrency(transitBalance) : '••••••'}
            </p>
          </div>
        </div>
      </div>

      {/* Decorative lines */}
      <div className="absolute top-0 right-0 w-1/2 h-full opacity-10">
        <svg className="w-full h-full" viewBox="0 0 200 200">
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00f5ff" />
              <stop offset="100%" stopColor="#bf00ff" />
            </linearGradient>
          </defs>
          {[...Array(5)].map((_, i) => (
            <line
              key={i}
              x1={40 * i}
              y1="0"
              x2={40 * i + 100}
              y2="200"
              stroke="url(#lineGrad)"
              strokeWidth="1"
            />
          ))}
        </svg>
      </div>
    </motion.div>
  );
}
