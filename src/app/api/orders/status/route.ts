import { NextRequest, NextResponse } from 'next/server';
import { getOrderByTrackingKey } from '@/lib/opm-api';
import { authenticateRequest } from '@/lib/auth-middleware';

/**
 * GET /api/orders/status
 *
 * Get order status by tracking key
 *
 * SECURITY: Requires authentication. Only authenticated users can query order status.
 *
 * Query parameters:
 * - trackingKey: The tracking key of the order (required)
 * - paymentDay: Payment day in epoch milliseconds (required)
 * - type: 0=outgoing (speiOut), 1=incoming (speiIn) (required)
 *
 * This endpoint is useful when you only have the tracking key
 * and need to look up the order status.
 */
export async function GET(request: NextRequest) {
  try {
    // ============================================
    // SECURITY FIX: Require authentication
    // ============================================
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    const trackingKey = searchParams.get('trackingKey');
    const paymentDay = searchParams.get('paymentDay');
    const type = searchParams.get('type');

    // Validate required parameters
    if (!trackingKey) {
      return NextResponse.json(
        { error: 'trackingKey parameter is required' },
        { status: 400 }
      );
    }

    if (!paymentDay) {
      return NextResponse.json(
        { error: 'paymentDay parameter is required (epoch milliseconds)' },
        { status: 400 }
      );
    }

    if (type === null || (type !== '0' && type !== '1')) {
      return NextResponse.json(
        { error: 'type parameter is required (0=outgoing, 1=incoming)' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPM_API_KEY;
    const response = await getOrderByTrackingKey(
      trackingKey,
      parseInt(paymentDay),
      parseInt(type) as 0 | 1,
      apiKey
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get order status error:', error);
    return NextResponse.json(
      { error: 'Failed to get order status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
