import { NextRequest, NextResponse } from 'next/server';
import { getUserById, getClabeAccountById, getClabeAccountsByCompanyId, getUserClabeAccess, sql } from '@/lib/db';
import { getBankName } from '@/lib/banks';
import { authenticateRequest } from '@/lib/auth-middleware';

// Get dashboard stats filtered by CLABE IDs
async function getDashboardStatsForClabes(clabeIds: string[]) {
  if (clabeIds.length === 0) {
    return {
      totalIncoming: 0,
      totalOutgoing: 0,
      pendingCount: 0,
      clientsCount: 0,
      totalBalance: 0,
      inTransit: 0,
      incomingChange: 0,
      outgoingChange: 0,
      weeklyData: [] as { name: string; incoming: number; outgoing: number }[],
    };
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  // SECURITY FIX: Use parameterized query with ANY() instead of sql.unsafe()
  // Current period stats
  const currentStatsResult = await sql`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'incoming' AND status = 'scattered' THEN amount ELSE 0 END), 0) as incoming,
      COALESCE(SUM(CASE WHEN type = 'outgoing' AND status IN ('sent', 'scattered') THEN amount ELSE 0 END), 0) as outgoing,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
    FROM transactions
    WHERE created_at >= ${thirtyDaysAgo.toISOString()}
    AND clabe_account_id = ANY(${clabeIds}::text[])
  `;

  // Previous period stats (for comparison)
  const prevStatsResult = await sql`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'incoming' AND status = 'scattered' THEN amount ELSE 0 END), 0) as incoming,
      COALESCE(SUM(CASE WHEN type = 'outgoing' AND status IN ('sent', 'scattered') THEN amount ELSE 0 END), 0) as outgoing
    FROM transactions
    WHERE created_at >= ${sixtyDaysAgo.toISOString()} AND created_at < ${thirtyDaysAgo.toISOString()}
    AND clabe_account_id = ANY(${clabeIds}::text[])
  `;

  // Get unique clients count
  const clientsResult = await sql`
    SELECT COUNT(DISTINCT payer_name) as count
    FROM transactions
    WHERE type = 'incoming' AND payer_name IS NOT NULL
    AND clabe_account_id = ANY(${clabeIds}::text[])
  `;

  // Get "in transit" amount
  const inTransitResult = await sql`
    SELECT COALESCE(SUM(amount), 0) as in_transit
    FROM transactions
    WHERE type = 'outgoing'
    AND status IN ('pending_confirmation', 'pending', 'sent', 'queued')
    AND clabe_account_id = ANY(${clabeIds}::text[])
  `;

  // Get weekly data for chart
  const weeklyResult = await sql`
    SELECT
      TO_CHAR(DATE_TRUNC('day', created_at), 'Dy') as day_name,
      EXTRACT(DOW FROM created_at) as day_num,
      COALESCE(SUM(CASE WHEN type = 'incoming' AND status = 'scattered' THEN amount ELSE 0 END), 0) as incoming,
      COALESCE(SUM(CASE WHEN type = 'outgoing' AND status IN ('sent', 'scattered') THEN amount ELSE 0 END), 0) as outgoing
    FROM transactions
    WHERE created_at >= ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}
    AND clabe_account_id = ANY(${clabeIds}::text[])
    GROUP BY DATE_TRUNC('day', created_at), EXTRACT(DOW FROM created_at)
    ORDER BY DATE_TRUNC('day', created_at)
  `;

  const dayNames = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const weeklyData = dayNames.map((name, idx) => {
    const dayData = (weeklyResult as any[]).find((d: any) => parseInt(d.day_num) === idx);
    return {
      name,
      incoming: parseFloat(dayData?.incoming || '0'),
      outgoing: parseFloat(dayData?.outgoing || '0'),
    };
  });

  const currentIncoming = parseFloat(currentStatsResult[0]?.incoming || '0');
  const currentOutgoing = parseFloat(currentStatsResult[0]?.outgoing || '0');
  const prevIncoming = parseFloat(prevStatsResult[0]?.incoming || '0');
  const prevOutgoing = parseFloat(prevStatsResult[0]?.outgoing || '0');

  const incomingChange = prevIncoming > 0 ? ((currentIncoming - prevIncoming) / prevIncoming) * 100 : 0;
  const outgoingChange = prevOutgoing > 0 ? ((currentOutgoing - prevOutgoing) / prevOutgoing) * 100 : 0;

  const inTransit = parseFloat(inTransitResult[0]?.in_transit || '0');

  return {
    totalIncoming: currentIncoming,
    totalOutgoing: currentOutgoing,
    pendingCount: parseInt(currentStatsResult[0]?.pending_count || '0'),
    clientsCount: parseInt(clientsResult[0]?.count || '0'),
    totalBalance: currentIncoming - currentOutgoing,
    inTransit,
    incomingChange: Math.round(incomingChange * 10) / 10,
    outgoingChange: Math.round(outgoingChange * 10) / 10,
    weeklyData,
  };
}

// Get recent transactions filtered by CLABE IDs
async function getRecentTransactionsForClabes(clabeIds: string[], limit: number = 10) {
  if (clabeIds.length === 0) {
    return [];
  }

  // SECURITY FIX: Use parameterized query with ANY() instead of sql.unsafe()
  const result = await sql`
    SELECT * FROM transactions
    WHERE clabe_account_id = ANY(${clabeIds}::text[])
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return result;
}

// GET /api/dashboard - Get dashboard stats and recent transactions (filtered by user access)
export async function GET(request: NextRequest) {
  try {
    // SECURITY FIX: Use proper authentication instead of trusting x-user-id header
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }
    const currentUser = authResult.user;

    // Get allowed CLABE account IDs for this user
    let allowedClabeIds: string[] = [];
    let useGlobalStats = false;

    if (currentUser.role === 'super_admin') {
      // Super admin can see all
      useGlobalStats = true;
    } else if (currentUser.role === 'company_admin' && currentUser.company_id) {
      // Company admin sees all CLABEs from their company
      const companyClabes = await getClabeAccountsByCompanyId(currentUser.company_id);
      allowedClabeIds = companyClabes.map(c => c.id);
    } else {
      // Regular user sees only assigned CLABEs
      allowedClabeIds = await getUserClabeAccess(currentUser.id);
    }

    // If user has no CLABEs assigned and is not super_admin, return empty stats
    if (!useGlobalStats && allowedClabeIds.length === 0) {
      return NextResponse.json({
        stats: {
          totalIncoming: 0,
          totalOutgoing: 0,
          pendingCount: 0,
          clientsCount: 0,
          totalBalance: 0,
          inTransit: 0,
          incomingChange: 0,
          outgoingChange: 0,
        },
        chartData: [],
        recentTransactions: [],
      });
    }

    // Get dashboard stats (filtered by CLABEs or global for super_admin)
    let stats;
    let recentTransactionsRaw;

    if (useGlobalStats) {
      // Super admin: import and use global functions
      const { getDashboardStats, getRecentTransactions } = await import('@/lib/db');
      stats = await getDashboardStats();
      recentTransactionsRaw = await getRecentTransactions(10);
    } else {
      stats = await getDashboardStatsForClabes(allowedClabeIds);
      recentTransactionsRaw = await getRecentTransactionsForClabes(allowedClabeIds, 10);
    }

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
        inTransit: stats.inTransit,
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
