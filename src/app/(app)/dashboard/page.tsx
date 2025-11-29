'use client';

import { StatsCard } from '@/components/ui';
import { BalanceCard } from '@/components/dashboard/BalanceCard';
import { TransactionChart } from '@/components/dashboard/TransactionChart';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { Transaction } from '@/types';

const chartData = [
  { name: 'L', incoming: 45000, outgoing: 32000 },
  { name: 'M', incoming: 52000, outgoing: 28000 },
  { name: 'X', incoming: 38000, outgoing: 41000 },
  { name: 'J', incoming: 61000, outgoing: 35000 },
  { name: 'V', incoming: 48000, outgoing: 52000 },
  { name: 'S', incoming: 33000, outgoing: 22000 },
  { name: 'D', incoming: 28000, outgoing: 18000 },
];

const recentTransactions: Transaction[] = [
  {
    id: '1',
    type: 'incoming',
    amount: 15000,
    status: 'scattered',
    beneficiaryName: 'NOVACORE SA DE CV',
    payerName: 'Juan Perez',
    concept: 'PAGO DE SERVICIOS',
    trackingKey: 'NC2024112900001',
    date: new Date(Date.now() - 1000 * 60 * 5),
    bank: 'BBVA',
  },
  {
    id: '2',
    type: 'outgoing',
    amount: 8500,
    status: 'sent',
    beneficiaryName: 'Maria Garcia',
    payerName: 'NOVACORE SA DE CV',
    concept: 'DISPERSION NOMINA',
    trackingKey: 'NC2024112900002',
    date: new Date(Date.now() - 1000 * 60 * 15),
    bank: 'SANTANDER',
  },
  {
    id: '3',
    type: 'incoming',
    amount: 50000,
    status: 'scattered',
    beneficiaryName: 'NOVACORE SA DE CV',
    payerName: 'Crypto Exchange',
    concept: 'DEPOSITO FONDOS',
    trackingKey: 'NC2024112900003',
    date: new Date(Date.now() - 1000 * 60 * 45),
    bank: 'BANORTE',
  },
  {
    id: '4',
    type: 'outgoing',
    amount: 25000,
    status: 'pending',
    beneficiaryName: 'Proveedor Tech',
    payerName: 'NOVACORE SA DE CV',
    concept: 'PAGO FACTURA',
    trackingKey: 'NC2024112900004',
    date: new Date(Date.now() - 1000 * 60 * 120),
    bank: 'HSBC',
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-px bg-white/[0.04] rounded-lg overflow-hidden">
        <StatsCard title="Entradas" value={125000} format="currency" change={12.5} />
        <StatsCard title="Salidas" value={85000} format="currency" change={-5.2} />
        <StatsCard title="Pendientes" value={12} format="number" />
        <StatsCard title="Clientes" value={1248} format="number" />
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BalanceCard
          totalBalance={1250000}
          availableBalance={980000}
          transitBalance={270000}
        />
        <TransactionChart data={chartData} />
      </div>

      {/* Recent */}
      <RecentTransactions transactions={recentTransactions} />
    </div>
  );
}
