import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/webhooks/cash
 *
 * Webhook endpoint for cash collection notifications from OPM
 * (Cobro de dinero en efectivo)
 *
 * This endpoint receives notifications when a cash collection has been made.
 * Currently logs all requests for future implementation.
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  let body: any = null;

  try {
    body = await request.json();

    // Log complete request for debugging
    console.log('=== CASH COLLECTION WEBHOOK RECEIVED ===');
    console.log('Timestamp:', timestamp);
    console.log('Headers:', Object.fromEntries(request.headers.entries()));
    console.log('Body:', JSON.stringify(body, null, 2));
    console.log('========================================');

    // Optional: Validate webhook secret if configured
    const webhookSecret = process.env.WEBHOOK_SECRET;
    const receivedSecret = request.headers.get('x-webhook-secret');

    if (webhookSecret && receivedSecret && webhookSecret !== receivedSecret) {
      console.warn('Webhook secret mismatch - logging but continuing');
    }

    // Extract cash collection data
    const cashData = extractCashData(body);

    if (cashData) {
      console.log('Extracted cash collection data:', cashData);

      // TODO: Implement cash collection processing logic
      // For now, just log and acknowledge

      return NextResponse.json({
        received: true,
        timestamp,
        processed: true,
        returnCode: 0,
        message: 'Cash collection notification received',
        data: {
          amount: cashData.amount,
          reference: cashData.reference,
        },
      });
    }

    return NextResponse.json({
      received: true,
      timestamp,
      processed: false,
      message: 'Payload logged but not processed - unexpected structure',
    });

  } catch (error) {
    console.error('=== CASH WEBHOOK ERROR ===');
    console.error('Timestamp:', timestamp);
    console.error('Error:', error);
    console.error('Body received:', body);
    console.error('==========================');

    return NextResponse.json({
      received: true,
      timestamp,
      processed: false,
      error: 'Internal error occurred - logged for review',
    });
  }
}

interface CashData {
  reference: string;
  amount: number;
  collectionPoint?: string;
  collectionDate?: string;
  clientName?: string;
  clientId?: string;
}

/**
 * Extract cash collection data from various possible payload structures
 */
function extractCashData(body: any): CashData | null {
  try {
    // Structure 1: OPM format with type and nested data
    if (body?.type === 'cashCollection' && body?.data) {
      const d = body.data;
      return {
        reference: d.reference || d.referencia,
        amount: d.amount || d.monto,
        collectionPoint: d.collectionPoint || d.puntoCobranza,
        collectionDate: d.collectionDate || d.fechaCobro,
        clientName: d.clientName || d.nombreCliente,
        clientId: d.clientId || d.idCliente,
      };
    }

    // Structure 2: Flat structure
    if (body?.reference && body?.amount) {
      return {
        reference: body.reference,
        amount: body.amount,
        collectionPoint: body.collectionPoint,
        collectionDate: body.collectionDate,
        clientName: body.clientName,
        clientId: body.clientId,
      };
    }

    // Structure 3: Spanish field names
    if (body?.referencia && body?.monto) {
      return {
        reference: body.referencia,
        amount: body.monto,
        collectionPoint: body.puntoCobranza,
        collectionDate: body.fechaCobro,
        clientName: body.nombreCliente,
        clientId: body.idCliente,
      };
    }

    return null;
  } catch (error) {
    console.error('Error extracting cash data:', error);
    return null;
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'cash-collection-webhook',
    timestamp: new Date().toISOString(),
    message: 'Webhook is ready to receive cash collection notifications',
  });
}
