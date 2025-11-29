'use client';

import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Users,
  Clock,
  Activity,
  Zap,
} from 'lucide-react';
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
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-display font-bold text-white">
            Dashboard
          </h1>
          <p className="text-gray-400 mt-1">
            Bienvenido de vuelta. Aqui esta el resumen de tu actividad.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-700 border border-white/5">
          <Activity className="w-5 h-5 text-neon-cyan animate-pulse" />
          <span className="text-sm text-gray-400">Sistema activo</span>
          <span className="text-sm font-mono text-neon-cyan">24/7</span>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Entradas Hoy"
          value={125000}
          format="currency"
          change={12.5}
          changeLabel="vs ayer"
          icon={<ArrowDownLeft className="w-5 h-5 text-green-400" />}
          variant="default"
        />
        <StatsCard
          title="Salidas Hoy"
          value={85000}
          format="currency"
          change={-5.2}
          changeLabel="vs ayer"
          icon={<ArrowUpRight className="w-5 h-5 text-red-400" />}
          variant="default"
        />
        <StatsCard
          title="Ordenes Pendientes"
          value={12}
          format="number"
          icon={<Clock className="w-5 h-5 text-yellow-400" />}
          variant="default"
        />
        <StatsCard
          title="Clientes Activos"
          value={1248}
          format="number"
          change={3.8}
          changeLabel="este mes"
          icon={<Users className="w-5 h-5 text-accent-primary" />}
          variant="gradient"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Balance & Chart */}
        <div className="lg:col-span-2 space-y-8">
          <BalanceCard
            totalBalance={1250000}
            availableBalance={980000}
            transitBalance={270000}
          />
          <TransactionChart data={chartData} />
        </div>

        {/* Right Column - Quick Actions & Stats */}
        <div className="space-y-8">
          <QuickActions />

          {/* Live Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-2xl bg-dark-700 border border-white/5 p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-neon-cyan/10">
                <Zap className="w-5 h-5 text-neon-cyan" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Actividad en Vivo</h3>
                <p className="text-xs text-gray-500">SPEI en tiempo real</p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { type: 'in', amount: '$2,500', time: 'Ahora' },
                { type: 'out', amount: '$1,200', time: '2s' },
                { type: 'in', amount: '$8,000', time: '5s' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.2 }}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-dark-600/50"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        item.type === 'in' ? 'bg-green-400' : 'bg-red-400'
                      } animate-pulse`}
                    />
                    <span
                      className={`text-sm font-mono ${
                        item.type === 'in' ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {item.type === 'in' ? '+' : '-'} {item.amount}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{item.time}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Recent Transactions */}
      <RecentTransactions transactions={recentTransactions} />
    </div>
  );
}
