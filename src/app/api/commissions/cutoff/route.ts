import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { processDailyCommissionCutoff } from '@/lib/commissions';
import { authenticateRequest } from '@/lib/auth-middleware';

/**
 * POST /api/commissions/cutoff
 *
 * Execute daily commission cutoff
 * This endpoint should be called at 10 PM (22:00) by a cron job or scheduler
 *
 * Authorization: Requires super_admin role or valid cron secret
 *
 * Headers:
 * - Authorization: Bearer token (super_admin required)
 * - x-cron-secret: Secret for cron job authentication (alternative to user auth)
 */
export async function POST(request: NextRequest) {
  try {
    // Check for cron secret (for automated scheduled jobs)
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    // Verify authorization
    let isAuthorized = false;

    // Option 1: Cron secret authentication
    // SECURITY FIX: Use timing-safe comparison to prevent timing attacks
    if (cronSecret && expectedSecret) {
      try {
        const cronSecretBuffer = Buffer.from(cronSecret, 'utf8');
        const expectedSecretBuffer = Buffer.from(expectedSecret, 'utf8');

        // Only compare if same length to prevent timing leaks
        if (cronSecretBuffer.length === expectedSecretBuffer.length) {
          if (crypto.timingSafeEqual(cronSecretBuffer, expectedSecretBuffer)) {
            isAuthorized = true;
            console.log('Commission cutoff triggered by cron job');
          }
        }
      } catch {
        // Ignore comparison errors, isAuthorized remains false
      }
    }

    // Option 2: Super admin authentication via proper auth token
    if (!isAuthorized) {
      const authResult = await authenticateRequest(request);
      if (authResult.success && authResult.user && authResult.user.role === 'super_admin') {
        isAuthorized = true;
        console.log(`Commission cutoff triggered by super_admin: ${authResult.user.email}`);
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
    // SECURITY FIX: Use proper authentication instead of trusting x-user-id header
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }
    const user = authResult.user;

    if (user.role !== 'super_admin') {
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
