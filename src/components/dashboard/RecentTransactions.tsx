'use client';

import { formatCurrency, formatRelativeTime, cn } from '@/lib/utils';
import { Transaction } from '@/types';
import Link from 'next/link';

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <p className="text-xs text-white/30">Recientes</p>
        <Link href="/history" className="text-xs text-white/30 hover:text-white/50">
          Ver mas
        </Link>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {transactions.map((tx) => (
          <div key={tx.id} className="px-4 py-3 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/70 truncate">
                  {tx.type === 'incoming' ? tx.payerName : tx.beneficiaryName}
                </p>
                <p className="text-xs text-white/30">{formatRelativeTime(tx.date.getTime())}</p>
              </div>
              <p
                className={cn(
                  'font-mono text-sm',
                  tx.type === 'incoming' ? 'text-green-400/80' : 'text-white/50'
                )}
              >
                {tx.type === 'incoming' ? '+' : '-'}{formatCurrency(tx.amount)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {transactions.length === 0 && (
        <div className="p-6 text-center">
          <p className="text-xs text-white/30">Sin transacciones</p>
        </div>
      )}
    </div>
  );
}
