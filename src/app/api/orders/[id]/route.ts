import { NextRequest, NextResponse } from 'next/server';
import { getOrder, cancelOrder, getOrderCep, notifyOrder } from '@/lib/opm-api';

/**
 * GET /api/orders/[id]
 *
 * Get a single order by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const apiKey = process.env.OPM_API_KEY;
    const response = await getOrder(params.id, apiKey);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get order error:', error);
    return NextResponse.json(
      { error: 'Failed to get order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orders/[id]
 *
 * Cancel an order by ID
 *
 * Note: Orders can only be canceled if they haven't been sent yet (status: pending)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const apiKey = process.env.OPM_API_KEY;
    const response = await cancelOrder(params.id, apiKey);

    return NextResponse.json({
      success: true,
      message: 'Order canceled successfully',
      orderId: params.id,
      ...response,
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
