'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';

interface ChartData {
  name: string;
  incoming: number;
  outgoing: number;
}

interface TransactionChartProps {
  data: ChartData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-dark-800 border border-white/[0.04] rounded-lg p-3">
        <p className="text-xs text-gray-500 mb-2">{label}</p>
        <div className="space-y-1">
          <p className="text-xs">
            <span className="text-green-500">Entradas: </span>
            <span className="font-mono text-white">{formatCurrency(payload[0]?.value || 0)}</span>
          </p>
          <p className="text-xs">
            <span className="text-gray-500">Salidas: </span>
            <span className="font-mono text-white">{formatCurrency(payload[1]?.value || 0)}</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export function TransactionChart({ data }: TransactionChartProps) {
  return (
    <div className="rounded-xl bg-dark-800 border border-white/[0.04] p-5">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500">Flujo de transacciones</p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-gray-500">Entradas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-gray-600" />
            <span className="text-xs text-gray-500">Salidas</span>
          </div>
        </div>
      </div>

      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorIncoming" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="name"
              stroke="#374151"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#374151"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="incoming"
              stroke="#22c55e"
              strokeWidth={1.5}
              fillOpacity={1}
              fill="url(#colorIncoming)"
            />
            <Area
              type="monotone"
              dataKey="outgoing"
              stroke="#4b5563"
              strokeWidth={1.5}
              fillOpacity={0}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
