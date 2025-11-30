import { NextRequest, NextResponse } from 'next/server';
import { processDailyCommissionCutoff } from '@/lib/commissions';
import { getUserById } from '@/lib/db';

/**
 * POST /api/commissions/cutoff
 *
 * Execute daily commission cutoff
 * This endpoint should be called at 10 PM (22:00) by a cron job or scheduler
 *
 * Authorization: Requires super_admin role or valid cron secret
 *
 * Headers:
 * - x-user-id: User ID for authentication (super_admin required)
 * - x-cron-secret: Secret for cron job authentication (alternative to user auth)
 */
export async function POST(request: NextRequest) {
  try {
    // Check for cron secret (for automated scheduled jobs)
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    // Check for user authentication
    const userId = request.headers.get('x-user-id');

    // Verify authorization
    let isAuthorized = false;

    // Option 1: Cron secret authentication
    if (cronSecret && expectedSecret && cronSecret === expectedSecret) {
      isAuthorized = true;
      console.log('Commission cutoff triggered by cron job');
    }

    // Option 2: Super admin authentication
    if (!isAuthorized && userId) {
      const user = await getUserById(userId);
      if (user && user.role === 'super_admin') {
        isAuthorized = true;
        console.log(`Commission cutoff triggered by super_admin: ${user.email}`);
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'No autorizado para ejecutar el corte de comisiones' },
        { status: 403 }
      );
    }

    // Execute the daily cutoff
    const result = await processDailyCommissionCutoff();

    const timestamp = new Date().toISOString();

    if (result.success) {
      console.log(`Commission cutoff completed at ${timestamp}:`, {
        totalProcessed: result.totalProcessed,
        totalAmount: result.totalAmount,
        companiesProcessed: result.results.length,
      });

      return NextResponse.json({
        success: true,
        message: 'Corte de comisiones ejecutado exitosamente',
        timestamp,
        summary: {
          totalProcessed: result.totalProcessed,
          totalAmount: result.totalAmount,
          companiesProcessed: result.results.length,
        },
        results: result.results.map(r => ({
          companyId: r.companyId,
          success: r.success,
          amount: r.totalAmount,
          commissionCount: r.commissionCount,
          cutoffId: r.cutoffId,
          trackingKey: r.trackingKey,
          error: r.error,
        })),
      });
    } else {
      console.error(`Commission cutoff failed at ${timestamp}`);
      return NextResponse.json({
        success: false,
        message: 'Error al ejecutar el corte de comisiones',
        timestamp,
        results: result.results,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Commission cutoff error:', error);
    return NextResponse.json(
      {
        error: 'Error interno al ejecutar el corte de comisiones',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/commissions/cutoff
 *
 * Get cutoff status and pending commissions summary
 */
export async function GET(request: NextRequest) {
  try {
    // Check authorization
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const user = await getUserById(userId);
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Solo super_admin puede ver el estado de los cortes' },
        { status: 403 }
      );
    }

    // Import functions to get pending commissions
    const { getPendingCommissionsGroupedByCompany, getPendingCommissionCutoffs, getCompanyById } = await import('@/lib/db');

    // Get pending commissions grouped by company
    const pendingGroups = await getPendingCommissionsGroupedByCompany();

    // Get pending/processing cutoffs
    const pendingCutoffs = await getPendingCommissionCutoffs();

    // Enrich with company names
    const enrichedGroups = await Promise.all(
      pendingGroups.map(async (group) => {
        const company = await getCompanyById(group.companyId);
        return {
          ...group,
          companyName: company?.name || 'Unknown',
          parentClabe: company?.parent_clabe || null,
        };
      })
    );

    return NextResponse.json({
      pendingCommissions: {
        totalAmount: pendingGroups.reduce((sum, g) => sum + g.totalAmount, 0),
        totalCount: pendingGroups.reduce((sum, g) => sum + g.count, 0),
        companiesCount: pendingGroups.length,
        byCompany: enrichedGroups,
      },
      pendingCutoffs: pendingCutoffs.map(c => ({
        id: c.id,
        companyId: c.company_id,
        totalAmount: c.total_amount,
        commissionCount: c.commission_count,
        status: c.status,
        cutoffDate: c.cutoff_date,
        trackingKey: c.tracking_key,
      })),
      nextCutoffTime: '22:00 (10 PM)',
    });
  } catch (error) {
    console.error('Get cutoff status error:', error);
    return NextResponse.json(
      { error: 'Error al obtener estado de cortes' },
      { status: 500 }
    );
  }
}
