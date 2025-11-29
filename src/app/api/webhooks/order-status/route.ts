import { NextRequest, NextResponse } from 'next/server';
import { WebhookOrderStatusData } from '@/types';
import { buildOrderStatusOriginalString } from '@/lib/opm-api';
import { verifySignature } from '@/lib/crypto';

/**
 * POST /api/webhooks/order-status
 *
 * Webhook endpoint for order status changes (outgoing SPEI transfers)
 *
 * This endpoint receives notifications when an order status changes:
 * - pending: Order is queued, waiting for balance
 * - sent: Order sent to SPEI, waiting for response
 * - scattered: Successfully settled/liquidated
 * - canceled: Order was canceled
 * - returned: Order was rejected by recipient bank
 */
export async function POST(request: NextRequest) {
  try {
    const body: WebhookOrderStatusData = await request.json();

    // Validate webhook type
    if (body.type !== 'orderStatus') {
      return NextResponse.json(
        { error: 'Invalid webhook type' },
        { status: 400 }
      );
    }

    const { data, sign } = body;

    // Build original string for signature verification
    const originalString = buildOrderStatusOriginalString(data);

    // Verify signature (in production, use actual public key from environment)
    const publicKey = process.env.OPM_PUBLIC_KEY;
    if (publicKey && sign) {
      const isValidSignature = await verifySignature(originalString, sign, publicKey);
      if (!isValidSignature) {
        console.error('Invalid webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    // Log the status change
    console.log('Order status update:', {
      orderId: data.id,
      status: data.status,
      detail: data.detail,
      timestamp: new Date().toISOString(),
    });

    // Handle different status changes
    switch (data.status) {
      case 'pending':
        // Order is waiting for balance or in queue
        console.log(`Order ${data.id} is pending`);
        // Update internal records
        break;

      case 'sent':
        // Order has been sent to SPEI
        console.log(`Order ${data.id} has been sent to SPEI`);
        // Update internal records, maybe notify user
        break;

      case 'scattered':
        // Order successfully settled
        console.log(`Order ${data.id} successfully settled`);
        // Update internal records, send confirmation to user
        // Mark transaction as complete
        break;

      case 'canceled':
        // Order was canceled
        console.log(`Order ${data.id} was canceled: ${data.detail}`);
        // Return funds to available balance
        // Notify user
        break;

      case 'returned':
        // Order was rejected by recipient bank
        console.log(`Order ${data.id} was returned: ${data.detail}`);
        // Return funds to available balance
        // Log rejection reason
        // Notify user
        break;

      default:
        console.warn(`Unknown order status: ${data.status}`);
    }

    // Acknowledge receipt
    return NextResponse.json({
      received: true,
      orderId: data.id,
      status: data.status,
      processedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Internal processing error' },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'order-status-webhook',
    timestamp: new Date().toISOString(),
  });
}
