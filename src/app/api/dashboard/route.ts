import { NextRequest, NextResponse } from 'next/server';
import { getDashboardStats, getRecentTransactions, getUserById, getClabeAccountById } from '@/lib/db';
import { getBankName } from '@/lib/banks';

// Helper to get current user from request headers
async function getCurrentUser(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return null;
  return await getUserById(userId);
}

// GET /api/dashboard - Get dashboard stats and recent transactions
export async function GET(request: NextRequest) {
  try {
    // Get current user for authorization
    const currentUser = await getCurrentUser(request);

    // Note: Users don't have company_id in this system
    // All authenticated users see all dashboard data (authorization via CLABE access)
    const companyId: string | undefined = undefined;

    // Get dashboard stats
    const stats = await getDashboardStats(companyId);

    // Get recent transactions
    const recentTransactionsRaw = await getRecentTransactions(10, companyId);

    // Transform transactions to frontend format
    const recentTransactions = await Promise.all(
      recentTransactionsRaw.map(async (tx) => {
        // Get CLABE account info if available
        let clabeInfo = null;
        if (tx.clabe_account_id) {
          clabeInfo = await getClabeAccountById(tx.clabe_account_id);
        }

        return {
          id: tx.id,
          type: tx.type,
          amount: parseFloat(tx.amount?.toString() || '0'),
          status: tx.status,
          beneficiaryName: tx.beneficiary_name || (clabeInfo ? 'Cuenta ' + clabeInfo.alias : 'N/A'),
          payerName: tx.payer_name || 'N/A',
          concept: tx.concept || 'Sin concepto',
          trackingKey: tx.tracking_key,
          date: new Date(tx.created_at),
          bank: tx.type === 'incoming'
            ? getBankName(tx.payer_bank || '')
            : getBankName(tx.beneficiary_bank || ''),
        };
      })
    );

    return NextResponse.json({
      stats: {
        totalIncoming: stats.totalIncoming,
        totalOutgoing: stats.totalOutgoing,
        pendingCount: stats.pendingCount,
        clientsCount: stats.clientsCount,
        totalBalance: stats.totalBalance,
        incomingChange: stats.incomingChange,
        outgoingChange: stats.outgoingChange,
      },
      chartData: stats.weeklyData,
      recentTransactions,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Error al obtener estadísticas del dashboard' },
      { status: 500 }
    );
  }
}
