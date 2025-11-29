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
      <div className="bg-black/90 border border-white/10 rounded-md px-3 py-2">
        <p className="text-[10px] text-white/40 mb-1">{label}</p>
        <p className="text-xs font-mono text-white/80">{formatCurrency(payload[0]?.value || 0)}</p>
      </div>
    );
  }
  return null;
};

export function TransactionChart({ data }: TransactionChartProps) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-4">
      <p className="text-xs text-white/30 mb-4">Ultimos 7 dias</p>

      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity={0.08} />
                <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="name"
              stroke="rgba(255,255,255,0.15)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="rgba(255,255,255,0.15)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="incoming"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={1}
              fill="url(#chartGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
