import { NextRequest, NextResponse } from 'next/server';
import { createOrder, listOrders, buildOrderOriginalString } from '@/lib/opm-api';
import { signWithPrivateKey, generateNumericalReference, generateTrackingKey } from '@/lib/crypto';
import { CreateOrderRequest } from '@/types';
import { validateOrderFields, prepareTextForSpei, sanitizeForSpei } from '@/lib/utils';
import { verifyTOTP, getClientIP, getUserAgent } from '@/lib/security';
import { getUserTotpSecret, isUserTotpEnabled, createAuditLogEntry, getUserById, createTransaction, getClabeAccountByClabe } from '@/lib/db';

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
  const clientIP = getClientIP(request);
  const userAgent = getUserAgent(request);

  console.log('=== ORDER CREATION REQUEST ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Client IP:', clientIP);

  try {
    const body = await request.json();
    console.log('Request body:', JSON.stringify(body, null, 2));

    const {
      // Authentication fields
      userId,
      totpCode,
      // Transfer fields
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

    // ============================================
    // 2FA Verification for SPEI Transfers
    // ============================================
    if (!userId) {
      console.error('ORDER ERROR: Missing userId in request');
      return NextResponse.json(
        { error: 'Se requiere autenticación para realizar transferencias', details: 'userId not provided in request body' },
        { status: 401 }
      );
    }

    console.log('User ID:', userId);

    // Check if user has 2FA enabled
    const totpEnabled = await isUserTotpEnabled(userId);
    console.log('2FA enabled for user:', totpEnabled);

    if (totpEnabled) {
      // 2FA is enabled - require TOTP code
      if (!totpCode) {
        console.log('2FA required but no code provided');
        return NextResponse.json(
          {
            error: 'Se requiere código de autenticación 2FA para realizar transferencias',
            requires2FA: true
          },
          { status: 401 }
        );
      }

      // Verify the TOTP code
      const secret = await getUserTotpSecret(userId);
      if (!secret || !verifyTOTP(secret, totpCode)) {
        // Log failed 2FA attempt
        const user = await getUserById(userId);
        await createAuditLogEntry({
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          action: '2FA_FAILED',
          userId,
          userEmail: user?.email,
          ipAddress: clientIP,
          userAgent,
          details: { reason: 'Invalid TOTP code for SPEI transfer', amount },
          severity: 'warning',
        });

        console.error('ORDER ERROR: Invalid 2FA code');
        return NextResponse.json(
          {
            error: 'Código de autenticación inválido',
            requires2FA: true
          },
          { status: 401 }
        );
      }

      console.log('2FA verification successful');

      // Log successful 2FA verification for transfer
      const user = await getUserById(userId);
      await createAuditLogEntry({
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        action: 'TRANSFER_INITIATED',
        userId,
        userEmail: user?.email,
        ipAddress: clientIP,
        userAgent,
        details: {
          beneficiaryAccount,
          beneficiaryName,
          amount,
          verified2FA: true
        },
        severity: 'info',
      });
    }

    // Validate required fields
    const missingFields: string[] = [];
    if (!beneficiaryAccount) missingFields.push('beneficiaryAccount');
    if (!beneficiaryBank) missingFields.push('beneficiaryBank');
    if (!beneficiaryName) missingFields.push('beneficiaryName');
    if (!amount) missingFields.push('amount');
    if (!concept) missingFields.push('concept');
    if (!payerAccount) missingFields.push('payerAccount (cuenta de origen)');

    if (missingFields.length > 0) {
      console.error('ORDER ERROR: Missing required fields:', missingFields);
      return NextResponse.json(
        {
          error: `Campos requeridos faltantes: ${missingFields.join(', ')}`,
          missingFields,
        },
        { status: 400 }
      );
    }

    // Parse amount to ensure it's a number
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) {
      console.error('ORDER ERROR: Invalid amount:', amount);
      return NextResponse.json(
        { error: 'El monto debe ser un número válido', providedAmount: amount },
        { status: 400 }
      );
    }

    // Sanitize text fields for SPEI (remove accents and special characters)
    const sanitizedBeneficiaryName = prepareTextForSpei(beneficiaryName, 40);
    const sanitizedConcept = prepareTextForSpei(concept, 40);
    const sanitizedPayerName = prepareTextForSpei(
      payerName || process.env.DEFAULT_PAYER_NAME || 'NOVACORE',
      40
    );

    // Generate tracking key if not provided (max 30 chars)
    const finalTrackingKey = trackingKey
      ? trackingKey.substring(0, 30)
      : generateTrackingKey('NC');

    // Generate numerical reference if not provided OR if provided value is invalid (not 7 digits)
    let finalNumericalReference: number;
    if (numericalReference) {
      const numRef = parseInt(String(numericalReference), 10);
      // If the provided reference is not 7 digits, generate a new one
      if (numRef >= 1000000 && numRef <= 9999999) {
        finalNumericalReference = numRef;
      } else {
        console.log(`Provided numericalReference (${numericalReference}) is invalid, generating new one`);
        finalNumericalReference = generateNumericalReference();
      }
    } else {
      finalNumericalReference = generateNumericalReference();
    }

    // Resolve payer account and bank from defaults if not provided
    const resolvedPayerAccount = payerAccount || process.env.DEFAULT_PAYER_ACCOUNT || '';
    const resolvedPayerBank = payerBank || process.env.DEFAULT_PAYER_BANK || '90684';
    const resolvedPayerAccountType = payerAccountType ?? 40;

    console.log('Resolved order data:', {
      beneficiaryAccount,
      beneficiaryBank,
      beneficiaryName: sanitizedBeneficiaryName,
      payerAccount: resolvedPayerAccount,
      payerBank: resolvedPayerBank,
      amount: parsedAmount,
      numericalReference: finalNumericalReference,
      trackingKey: finalTrackingKey,
    });

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
      console.error('ORDER ERROR: Validation failed:', JSON.stringify(validationErrors, null, 2));
      return NextResponse.json(
        {
          error: 'Error de validación: ' + validationErrors.map(e => e.message).join(', '),
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

    console.log('Sending order to OPM API...');
    console.log('Order request (without sign):', { ...orderRequest, sign: '[REDACTED]' });

    // Send to OPM API
    const apiKey = process.env.OPM_API_KEY;
    if (!apiKey) {
      console.error('ORDER ERROR: OPM_API_KEY not configured');
      return NextResponse.json(
        { error: 'API key no configurada' },
        { status: 500 }
      );
    }

    const response = await createOrder(orderRequest, apiKey);

    console.log('OPM API response:', JSON.stringify(response, null, 2));

    // Save the outgoing transaction to local database
    if (response.success && response.data) {
      try {
        const opmOrder = response.data;

        // Get the CLABE account ID from payer account
        const clabeAccount = await getClabeAccountByClabe(resolvedPayerAccount);

        // Determine initial status based on OPM response
        let status = 'pending';
        if (opmOrder.sent) status = 'sent';
        if (opmOrder.scattered) status = 'scattered';
        if (opmOrder.returned) status = 'returned';
        if (opmOrder.canceled) status = 'canceled';

        const savedTransaction = await createTransaction({
          id: `tx_out_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          clabeAccountId: clabeAccount?.id,
          type: 'outgoing',
          status,
          amount: parsedAmount,
          concept: sanitizedConcept,
          trackingKey: opmOrder.trackingKey || finalTrackingKey,
          numericalReference: finalNumericalReference,
          beneficiaryAccount,
          beneficiaryBank,
          beneficiaryName: sanitizedBeneficiaryName,
          beneficiaryUid: beneficiaryUid || undefined,
          payerAccount: resolvedPayerAccount,
          payerBank: resolvedPayerBank,
          payerName: sanitizedPayerName,
          payerUid: payerUid || undefined,
          opmOrderId: opmOrder.id,
        });

        console.log('Outgoing transaction saved to database:', savedTransaction.id);
        console.log('OPM Order ID:', opmOrder.id);
        console.log('Tracking Key:', opmOrder.trackingKey || finalTrackingKey);
      } catch (dbError) {
        // Log the error but don't fail the request - the order was created successfully in OPM
        console.error('Failed to save outgoing transaction to database:', dbError);
      }
    }

    console.log('=== ORDER CREATION COMPLETE ===');

    return NextResponse.json(response);
  } catch (error) {
    console.error('=== ORDER CREATION ERROR ===');
    console.error('Error:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      {
        error: 'Error al crear la orden',
        details: error instanceof Error ? error.message : 'Error desconocido',
        hint: 'Revisa los logs del servidor para más detalles'
      },
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
