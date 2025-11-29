'use client';

import { ArrowUpRight, ArrowDownLeft, ExternalLink, Clock } from 'lucide-react';
import { formatCurrency, formatRelativeTime, getStatusText, cn } from '@/lib/utils';
import { Badge } from '@/components/ui';
import { Transaction } from '@/types';

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  return (
    <div className="rounded-2xl bg-dark-800 border border-white/5 overflow-hidden">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Transacciones Recientes</h3>
            <p className="text-sm text-gray-400">Ultimas 10 operaciones</p>
          </div>
          <button className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors">
            Ver todas
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="divide-y divide-white/5">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="p-4 hover:bg-white/[0.02] transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div
                className={cn(
                  'p-3 rounded-xl transition-all duration-200',
                  tx.type === 'incoming'
                    ? 'bg-green-500/10 text-green-400 group-hover:bg-green-500/20'
                    : 'bg-red-500/10 text-red-400 group-hover:bg-red-500/20'
                )}
              >
                {tx.type === 'incoming' ? (
                  <ArrowDownLeft className="w-5 h-5" />
                ) : (
                  <ArrowUpRight className="w-5 h-5" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-white truncate">
                    {tx.type === 'incoming' ? tx.payerName : tx.beneficiaryName}
                  </p>
                  <Badge
                    variant={
                      tx.status === 'scattered'
                        ? 'success'
                        : tx.status === 'pending' || tx.status === 'sent'
                        ? 'warning'
                        : tx.status === 'returned'
                        ? 'danger'
                        : 'default'
                    }
                    size="sm"
                  >
                    {getStatusText(tx.status)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500 font-mono">{tx.trackingKey}</span>
                  <span className="text-xs text-gray-600">|</span>
                  <span className="text-xs text-gray-500">{tx.concept}</span>
                </div>
              </div>

              {/* Amount & Time */}
              <div className="text-right">
                <p
                  className={cn(
                    'font-mono font-semibold',
                    tx.type === 'incoming' ? 'text-green-400' : 'text-white'
                  )}
                >
                  {tx.type === 'incoming' ? '+' : '-'} {formatCurrency(tx.amount)}
                </p>
                <div className="flex items-center gap-1 justify-end mt-1">
                  <Clock className="w-3 h-3 text-gray-500" />
                  <span className="text-xs text-gray-500">
                    {formatRelativeTime(tx.date.getTime())}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {transactions.length === 0 && (
        <div className="p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-dark-600 flex items-center justify-center">
            <Clock className="w-8 h-8 text-gray-500" />
          </div>
          <p className="text-gray-400">No hay transacciones recientes</p>
        </div>
      )}
    </div>
  );
}
