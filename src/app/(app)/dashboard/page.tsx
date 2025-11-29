'use client';

import { StatsCard } from '@/components/ui';
import { BalanceCard } from '@/components/dashboard/BalanceCard';
import { TransactionChart } from '@/components/dashboard/TransactionChart';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { Transaction } from '@/types';

// Demo data
const chartData = [
  { name: 'Lun', incoming: 45000, outgoing: 32000 },
  { name: 'Mar', incoming: 52000, outgoing: 28000 },
  { name: 'Mie', incoming: 38000, outgoing: 41000 },
  { name: 'Jue', incoming: 61000, outgoing: 35000 },
  { name: 'Vie', incoming: 48000, outgoing: 52000 },
  { name: 'Sab', incoming: 33000, outgoing: 22000 },
  { name: 'Dom', incoming: 28000, outgoing: 18000 },
];

const recentTransactions: Transaction[] = [
  {
    id: '1',
    type: 'incoming',
    amount: 15000,
    status: 'scattered',
    beneficiaryName: 'NOVACORE SA DE CV',
    payerName: 'JUAN PEREZ MARTINEZ',
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
    beneficiaryName: 'MARIA GARCIA LOPEZ',
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
    payerName: 'CRYPTO EXCHANGE MX',
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
    beneficiaryName: 'PROVEEDOR TECH SA',
    payerName: 'NOVACORE SA DE CV',
    concept: 'PAGO FACTURA 001234',
    trackingKey: 'NC2024112900004',
    date: new Date(Date.now() - 1000 * 60 * 120),
    bank: 'HSBC',
  },
  {
    id: '5',
    type: 'incoming',
    amount: 3500,
    status: 'returned',
    beneficiaryName: 'NOVACORE SA DE CV',
    payerName: 'CLIENTE DEMO',
    concept: 'DEVOLUCION',
    trackingKey: 'NC2024112900005',
    date: new Date(Date.now() - 1000 * 60 * 180),
    bank: 'BANAMEX',
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Resumen de actividad</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Entradas Hoy"
          value={125000}
          format="currency"
          change={12.5}
        />
        <StatsCard
          title="Salidas Hoy"
          value={85000}
          format="currency"
          change={-5.2}
        />
        <StatsCard
          title="Pendientes"
          value={12}
          format="number"
        />
        <StatsCard
          title="Clientes"
          value={1248}
          format="number"
          change={3.8}
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <BalanceCard
            totalBalance={1250000}
            availableBalance={980000}
            transitBalance={270000}
          />
          <TransactionChart data={chartData} />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <QuickActions />
          <RecentTransactions transactions={recentTransactions.slice(0, 4)} />
        </div>
      </div>
    </div>
  );
}
