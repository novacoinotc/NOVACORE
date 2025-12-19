import { NextRequest, NextResponse } from 'next/server';
import { syncOpmTransactions } from '@/scripts/sync-opm-transactions';
import { authenticateRequest } from '@/lib/auth-middleware';

/**
 * POST /api/admin/sync-transactions
 *
 * Manually trigger OPM transaction synchronization.
 * This endpoint fetches all transactions from OPM and syncs them with the local database.
 *
 * Request body (optional):
 * - account: string - Specific CLABE account to check balance for
 *
 * Requires admin authentication (super_admin role).
 */
export async function POST(request: NextRequest) {
  console.log('=== ADMIN SYNC TRANSACTIONS REQUEST ===');
  console.log('Timestamp:', new Date().toISOString());

  try {
    // SECURITY FIX: Use proper authentication instead of trusting x-user-id header
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication required' },
        { status: authResult.statusCode || 401 }
      );
    }
    const user = authResult.user;

    // SECURITY FIX: Only super_admin can run sync
    if (user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Parse optional request body
    let account: string | undefined;
    try {
      const body = await request.json();
      account = body.account;
    } catch {
      // No body or invalid JSON - use defaults
    }

    console.log('Starting sync for user:', user.email);
    console.log('Account override:', account || 'none (using default)');

    // Run synchronization
    const result = await syncOpmTransactions(account);

    // Return detailed result
    return NextResponse.json({
      success: result.errors.length === 0,
      message: result.errors.length === 0
        ? 'Synchronization completed successfully'
        : 'Synchronization completed with errors',
      data: {
        totalFromOpm: result.totalFromOpm,
        inserted: result.inserted,
        updated: result.updated,
        unchanged: result.unchanged,
        errorCount: result.errors.length,
        errors: result.errors,
        opmBalance: result.opmBalance,
        localBalance: result.localBalance,
        balanceDiscrepancy: result.opmBalance !== null
          ? Math.round((result.opmBalance - result.localBalance.net) * 100) / 100
          : null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync transactions error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error during synchronization',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/sync-transactions
 *
 * Get sync status/info without running sync.
 * Returns information about what would be synced.
 */
export async function GET(request: NextRequest) {
  try {
    // SECURITY FIX: Use proper authentication instead of trusting x-user-id header
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication required' },
        { status: authResult.statusCode || 401 }
      );
    }

    // SECURITY FIX: Only super_admin can view sync info
    if (authResult.user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      endpoint: '/api/admin/sync-transactions',
      method: 'POST',
      description: 'Synchronize transactions between OPM and local database',
      parameters: {
        account: {
          type: 'string',
          required: false,
          description: 'CLABE account to check balance for (uses OPM_DEFAULT_ACCOUNT if not provided)',
        },
      },
      syncPeriod: '30 days',
      actions: [
        'Fetch balance from OPM API',
        'Fetch outgoing orders (speiOut) from OPM',
        'Fetch incoming orders (speiIn) from OPM',
        'Insert missing transactions into local DB',
        'Update transactions with changed status',
        'Calculate and compare balances',
      ],
    });
  } catch (error) {
    console.error('Get sync info error:', error);
    return NextResponse.json(
      { error: 'Error getting sync info' },
      { status: 500 }
    );
  }
}
