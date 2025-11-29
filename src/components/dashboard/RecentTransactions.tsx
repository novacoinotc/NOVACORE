'use client';

import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { formatCurrency, formatRelativeTime, cn } from '@/lib/utils';
import { Transaction } from '@/types';
import Link from 'next/link';

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  return (
    <div className="rounded-xl bg-dark-800 border border-white/[0.04] overflow-hidden">
      <div className="p-4 border-b border-white/[0.04] flex items-center justify-between">
        <p className="text-sm text-gray-500">Transacciones recientes</p>
        <Link href="/history" className="text-xs text-purple-400 hover:text-purple-300">
          Ver todas
        </Link>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {transactions.map((tx) => (
          <div key={tx.id} className="p-4 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center',
                  tx.type === 'incoming' ? 'bg-green-500/10' : 'bg-dark-700'
                )}
              >
                {tx.type === 'incoming' ? (
                  <ArrowDownLeft className="w-4 h-4 text-green-500" />
                ) : (
                  <ArrowUpRight className="w-4 h-4 text-gray-500" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">
                  {tx.type === 'incoming' ? tx.payerName : tx.beneficiaryName}
                </p>
                <p className="text-xs text-gray-500">{formatRelativeTime(tx.date.getTime())}</p>
              </div>

              {/* Amount */}
              <p
                className={cn(
                  'font-mono text-sm',
                  tx.type === 'incoming' ? 'text-green-500' : 'text-white'
                )}
              >
                {tx.type === 'incoming' ? '+' : '-'}{formatCurrency(tx.amount)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {transactions.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-500">Sin transacciones</p>
        </div>
      )}
    </div>
  );
}
