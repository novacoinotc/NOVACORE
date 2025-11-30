import { NextRequest, NextResponse } from 'next/server';
import { notifyOrder } from '@/lib/opm-api';

/**
 * POST /api/orders/[id]/notify
 *
 * Resend webhook notification for an order
 *
 * Use this endpoint if a webhook notification was missed and you need
 * OPM to resend the status update.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const apiKey = process.env.OPM_API_KEY;
    const response = await notifyOrder(params.id, apiKey);

    return NextResponse.json({
      success: true,
      message: 'Webhook notification resent',
      orderId: params.id,
      ...response,
    });
  } catch (error) {
    console.error('Notify order error:', error);
    return NextResponse.json(
      { error: 'Failed to resend notification', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
