'use client';

import { useState, useEffect } from 'react';
import { StatsCard } from '@/components/ui';
import { BalanceCard } from '@/components/dashboard/BalanceCard';
import { TransactionChart } from '@/components/dashboard/TransactionChart';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { Transaction } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

interface DashboardData {
  stats: {
    totalIncoming: number;
    totalOutgoing: number;
    pendingCount: number;
    clientsCount: number;
    totalBalance: number;
    inTransit: number;
    incomingChange: number;
    outgoingChange: number;
  };
  chartData: { name: string; incoming: number; outgoing: number }[];
  recentTransactions: Transaction[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get session for user ID
        const sessionStr = localStorage.getItem('novacorp_session');
        let headers: HeadersInit = { 'Content-Type': 'application/json' };

        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          if (session.user?.id) {
            headers['x-user-id'] = session.user.id;
          }
        }

        const response = await fetch('/api/dashboard', { headers });

        if (!response.ok) {
          throw new Error('Error al cargar datos del dashboard');
        }

        const dashboardData = await response.json();

        // Transform dates in transactions
        const transformedTransactions = dashboardData.recentTransactions.map((tx: any) => ({
          ...tx,
          date: new Date(tx.date),
        }));

        setData({
          ...dashboardData,
          recentTransactions: transformedTransactions,
        });
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Default values if no data
  const stats = data?.stats || {
    totalIncoming: 0,
    totalOutgoing: 0,
    pendingCount: 0,
    clientsCount: 0,
    totalBalance: 0,
    inTransit: 0,
    incomingChange: 0,
    outgoingChange: 0,
  };

  const chartData = data?.chartData || [];
  const recentTransactions = data?.recentTransactions || [];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.04] rounded-lg overflow-hidden">
        <StatsCard
          title="Entradas"
          value={stats.totalIncoming}
          format="currency"
          change={stats.incomingChange}
        />
        <StatsCard
          title="Salidas"
          value={stats.totalOutgoing}
          format="currency"
          change={stats.outgoingChange}
        />
        <StatsCard title="Pendientes" value={stats.pendingCount} format="number" />
        <StatsCard title="Clientes" value={stats.clientsCount} format="number" />
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BalanceCard
          totalBalance={stats.totalBalance}
          availableBalance={stats.totalBalance - stats.inTransit}
          transitBalance={stats.inTransit}
        />
        <TransactionChart data={chartData} />
      </div>

      {/* Recent */}
      <RecentTransactions transactions={recentTransactions} />
    </div>
  );
}
