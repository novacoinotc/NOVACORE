import { NextRequest, NextResponse } from 'next/server';
import { createOrder, listOrders, buildOrderOriginalString } from '@/lib/opm-api';
import { signWithPrivateKey, generateNumericalReference, generateTrackingKey } from '@/lib/crypto';
import { CreateOrderRequest } from '@/types';
import { validateOrderFields, prepareTextForSpei, sanitizeForSpei } from '@/lib/utils';

/**
 * POST /api/orders
 *
 * Create a new SPEI transfer order
 *
 * Field specifications according to OPM API (Especificacion api.pdf):
 * - concept: string<40> - max 40 characters
 * - beneficiaryAccount: string<18> - CLABE 18 digits
 * - beneficiaryBank: string<5> - 5 digit bank code
 * - beneficiaryName: string<40> - max 40 characters
 * - beneficiaryUid: string<18> - RFC/CURP max 18 chars
 * - payerAccount: string<18> - CLABE 18 digits
 * - payerBank: string<5> - 5 digit bank code
 * - payerName: string<40> - max 40 characters
 * - payerUid: string<18> - RFC/CURP max 18 chars (optional)
 * - amount: double<18,2> - max 2 decimal places
 * - numericalReference: integer<7> - 7 digits
 * - paymentDay: integer<32> - epoch milliseconds
 * - paymentType: integer<32> - payment type code
 * - trackingKey: string<30> - max 30 characters (optional)
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
      payerAccountType,
      amount,
      concept,
      numericalReference,
      trackingKey,
      paymentType,
      // Optional CEP override fields
      cepPayerName,
      cepPayerUid,
      cepPayerAccount,
    } = body;

    // Validate required fields
    if (!beneficiaryAccount || !beneficiaryBank || !beneficiaryName || !amount || !concept) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          requiredFields: ['beneficiaryAccount', 'beneficiaryBank', 'beneficiaryName', 'amount', 'concept']
        },
        { status: 400 }
      );
    }

    // Parse amount to ensure it's a number
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) {
      return NextResponse.json(
        { error: 'Amount must be a valid number' },
        { status: 400 }
      );
    }

    // Sanitize text fields for SPEI (remove accents and special characters)
    const sanitizedBeneficiaryName = prepareTextForSpei(beneficiaryName, 40);
    const sanitizedConcept = prepareTextForSpei(concept, 40);
    const sanitizedPayerName = prepareTextForSpei(
      payerName || process.env.DEFAULT_PAYER_NAME || '',
      40
    );

    // Generate tracking key if not provided (max 30 chars)
    const finalTrackingKey = trackingKey
      ? trackingKey.substring(0, 30)
      : generateTrackingKey('NC');

    // Generate numerical reference if not provided (7 digits)
    const finalNumericalReference = numericalReference || generateNumericalReference();

    // Resolve payer account and bank from defaults if not provided
    const resolvedPayerAccount = payerAccount || process.env.DEFAULT_PAYER_ACCOUNT || '';
    const resolvedPayerBank = payerBank || process.env.DEFAULT_PAYER_BANK || '90684';
    const resolvedPayerAccountType = payerAccountType ?? 40;

    // Validate all fields according to OPM API specification
    const validationErrors = validateOrderFields({
      concept: sanitizedConcept,
      beneficiaryAccount,
      beneficiaryBank,
      beneficiaryName: sanitizedBeneficiaryName,
      beneficiaryUid,
      payerAccount: resolvedPayerAccount,
      payerBank: resolvedPayerBank,
      payerName: sanitizedPayerName,
      payerUid,
      numericalReference: finalNumericalReference,
      trackingKey: finalTrackingKey,
      amount: parsedAmount,
    });

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          validationErrors,
        },
        { status: 400 }
      );
    }

    // Payment day (current timestamp in milliseconds)
    const paymentDay = Date.now();

    // Build order data
    const orderData = {
      beneficiaryName: sanitizedBeneficiaryName,
      beneficiaryUid: beneficiaryUid || '',
      beneficiaryBank,
      beneficiaryAccount,
      beneficiaryAccountType,
      payerAccount: resolvedPayerAccount,
      payerBank: resolvedPayerBank,
      payerName: sanitizedPayerName,
      payerUid: payerUid || '',
      payerAccountType: resolvedPayerAccountType,
      numericalReference: finalNumericalReference,
      paymentDay,
      paymentType: paymentType ?? 1, // Default: Third party to third party
      concept: sanitizedConcept,
      amount: parsedAmount,
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
      // Include CEP override fields if provided
      ...(cepPayerName && { cepPayerName: sanitizeForSpei(cepPayerName).substring(0, 40) }),
      ...(cepPayerUid && { cepPayerUid: cepPayerUid.substring(0, 18) }),
      ...(cepPayerAccount && { cepPayerAccount }),
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
 *
 * Query parameters (from Especificacion api.pdf):
 * - type: 0=outgoing (speiOut), 1=incoming (speiIn)
 * - page: Page number (default 1)
 * - itemsPerPage: Items per page (default 50)
 * - from: Start date (epoch milliseconds)
 * - to: End date (epoch milliseconds)
 * - hasSubProduct: Filter by subproduct presence
 * - productId: Filter by product ID
 * - isSent: Filter by sent status
 * - isScattered: Filter by scattered/settled status
 * - isReturned: Filter by returned status
 * - isCanceled: Filter by canceled status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const type = parseInt(searchParams.get('type') || '0') as 0 | 1;
    const page = parseInt(searchParams.get('page') || '1');
    const itemsPerPage = parseInt(searchParams.get('itemsPerPage') || '50');
    const from = searchParams.get('from') ? parseInt(searchParams.get('from')!) : undefined;
    const to = searchParams.get('to') ? parseInt(searchParams.get('to')!) : undefined;
    const hasSubProduct = searchParams.get('hasSubProduct') === 'true' ? true : undefined;
    const productId = searchParams.get('productId') || undefined;
    const isSent = searchParams.get('isSent') === 'true' ? true : undefined;
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
        hasSubProduct,
        productId,
        isSent,
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
