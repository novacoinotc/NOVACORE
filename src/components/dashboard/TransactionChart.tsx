'use client';

import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
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
      <div className="bg-dark-800 border border-white/10 rounded-lg p-3 shadow-xl">
        <p className="text-gray-400 text-sm mb-2">{label}</p>
        <div className="space-y-1">
          <p className="text-sm">
            <span className="text-green-400">Entradas: </span>
            <span className="font-mono text-white">{formatCurrency(payload[0]?.value || 0)}</span>
          </p>
          <p className="text-sm">
            <span className="text-red-400">Salidas: </span>
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl bg-dark-700 border border-white/5 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Flujo de Transacciones</h3>
          <p className="text-sm text-gray-400">Ultimos 7 dias</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <span className="text-sm text-gray-400">Entradas</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <span className="text-sm text-gray-400">Salidas</span>
          </div>
        </div>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorIncoming" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00ff66" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#00ff66" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorOutgoing" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="name"
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="incoming"
              stroke="#00ff66"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorIncoming)"
            />
            <Area
              type="monotone"
              dataKey="outgoing"
              stroke="#ef4444"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorOutgoing)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
