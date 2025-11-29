import { NextRequest, NextResponse } from 'next/server';
import { createOrder, listOrders, buildOrderOriginalString } from '@/lib/opm-api';
import { signWithPrivateKey, generateNumericalReference, generateTrackingKey } from '@/lib/crypto';
import { CreateOrderRequest } from '@/types';

/**
 * POST /api/orders
 *
 * Create a new SPEI transfer order
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      beneficiaryAccount,
      beneficiaryBank,
      beneficiaryName,
      beneficiaryUid = '',
      beneficiaryAccountType = 40,
      payerAccount,
      payerBank,
      payerName,
      payerUid,
      amount,
      concept,
      numericalReference,
      trackingKey,
    } = body;

    // Validate required fields
    if (!beneficiaryAccount || !beneficiaryBank || !beneficiaryName || !amount || !concept) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate tracking key if not provided
    const finalTrackingKey = trackingKey || generateTrackingKey('NC');

    // Generate numerical reference if not provided
    const finalNumericalReference = numericalReference || generateNumericalReference();

    // Payment day (current timestamp in milliseconds)
    const paymentDay = Date.now();

    // Build order data
    const orderData = {
      beneficiaryName,
      beneficiaryUid,
      beneficiaryBank,
      beneficiaryAccount,
      beneficiaryAccountType,
      payerAccount: payerAccount || process.env.DEFAULT_PAYER_ACCOUNT || '',
      payerBank: payerBank || process.env.DEFAULT_PAYER_BANK || '90684',
      payerName: payerName || process.env.DEFAULT_PAYER_NAME || '',
      payerUid,
      payerAccountType: 40,
      numericalReference: finalNumericalReference,
      paymentDay,
      paymentType: 1, // Third party to third party
      concept,
      amount: parseFloat(amount),
    };

    // Build original string for signing
    const originalString = buildOrderOriginalString(orderData);

    // Sign the order with private key
    const privateKey = process.env.OPM_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json(
        { error: 'Private key not configured' },
        { status: 500 }
      );
    }

    const sign = await signWithPrivateKey(originalString, privateKey);

    // Create the order request
    const orderRequest: CreateOrderRequest = {
      ...orderData,
      sign,
      trackingKey: finalTrackingKey,
    };

    // Send to OPM API
    const apiKey = process.env.OPM_API_KEY;
    const response = await createOrder(orderRequest, apiKey);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Order creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orders
 *
 * List orders with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const type = parseInt(searchParams.get('type') || '0') as 0 | 1;
    const page = parseInt(searchParams.get('page') || '1');
    const itemsPerPage = parseInt(searchParams.get('itemsPerPage') || '50');
    const from = searchParams.get('from') ? parseInt(searchParams.get('from')!) : undefined;
    const to = searchParams.get('to') ? parseInt(searchParams.get('to')!) : undefined;
    const isScattered = searchParams.get('isScattered') === 'true' ? true : undefined;
    const isReturned = searchParams.get('isReturned') === 'true' ? true : undefined;
    const isCanceled = searchParams.get('isCanceled') === 'true' ? true : undefined;

    const apiKey = process.env.OPM_API_KEY;
    const response = await listOrders(
      {
        type,
        page,
        itemsPerPage,
        from,
        to,
        isScattered,
        isReturned,
        isCanceled,
      },
      apiKey
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error('List orders error:', error);
    return NextResponse.json(
      { error: 'Failed to list orders', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
