import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { listOrders } from '@/lib/opm-api';
import { generateNumericalReference, generateTrackingKey } from '@/lib/crypto';
import { validateOrderFields, prepareTextForSpei, sanitizeForSpei } from '@/lib/utils';
import { verifyTOTP, getClientIP, getUserAgent } from '@/lib/security';
import { getUserTotpSecret, isUserTotpEnabled, createAuditLogEntry, getUserById, createOutgoingTransactionAtomic, getClabeAccountByClabe, getClabeAccountsByCompanyId } from '@/lib/db';
import { authenticateRequest, validateClabeAccess } from '@/lib/auth-middleware';

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
    // ============================================
    // SECURE AUTHENTICATION - Validate session token
    // ============================================
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      console.error('ORDER ERROR: Authentication failed');
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }

    // Get authenticated user ID from session (NOT from request body)
    const authenticatedUser = authResult.user;
    const userId = authenticatedUser.id;

    console.log('Authenticated User ID:', userId);

    const body = await request.json();
    // Remove sensitive data from logs
    console.log('Request received for transfer from:', body.payerAccount?.slice(0, 6) + '***');

    const {
      // 2FA code (still from body for the TOTP verification)
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
    // Validate user has access to the source CLABE
    // ============================================
    const sourceClabeAccount = await getClabeAccountByClabe(payerAccount);
    if (!sourceClabeAccount) {
      return NextResponse.json(
        { error: 'Cuenta origen no encontrada' },
        { status: 404 }
      );
    }

    const hasAccess = await validateClabeAccess(userId, sourceClabeAccount.id, authenticatedUser.role, authenticatedUser.companyId);
    if (!hasAccess) {
      console.error('ORDER ERROR: User does not have access to source CLABE');
      await createAuditLogEntry({
        id: `audit_${Date.now()}`,
        action: 'SUSPICIOUS_ACTIVITY',
        userId,
        userEmail: authenticatedUser.email,
        ipAddress: clientIP,
        userAgent,
        details: { reason: 'Attempted transfer from unauthorized CLABE', payerAccount: payerAccount?.slice(0, 6) + '***' },
        severity: 'critical',
      });
      return NextResponse.json(
        { error: 'No tienes permiso para operar esta cuenta' },
        { status: 403 }
      );
    }

    // ============================================
    // 2FA Verification for SPEI Transfers
    // ============================================

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
          id: `audit_${crypto.randomUUID()}`,
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
        id: `audit_${crypto.randomUUID()}`,
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

    // Parse amount to ensure it's a valid, finite number
    const amountStr = String(amount);

    // SECURITY FIX: Reject scientific notation (e.g., "1e10") to prevent limit bypass
    if (/[eE]/.test(amountStr)) {
      console.error('ORDER ERROR: Scientific notation not allowed:', amount);
      return NextResponse.json(
        { error: 'El monto no puede usar notación científica', providedAmount: amount },
        { status: 400 }
      );
    }

    // SECURITY FIX: Only allow valid decimal format (digits, optional decimal point, max 2 decimals)
    if (!/^\d+(\.\d{1,2})?$/.test(amountStr)) {
      console.error('ORDER ERROR: Invalid amount format:', amount);
      return NextResponse.json(
        { error: 'El monto debe ser un número válido con máximo 2 decimales', providedAmount: amount },
        { status: 400 }
      );
    }

    const parsedAmount = parseFloat(amountStr);
    // SECURITY: Check for NaN, Infinity, negative, and zero amounts
    if (isNaN(parsedAmount) || !isFinite(parsedAmount)) {
      console.error('ORDER ERROR: Invalid amount (NaN or Infinity):', amount);
      return NextResponse.json(
        { error: 'El monto debe ser un número válido', providedAmount: amount },
        { status: 400 }
      );
    }

    if (parsedAmount <= 0) {
      console.error('ORDER ERROR: Amount must be positive:', amount);
      return NextResponse.json(
        { error: 'El monto debe ser mayor a cero', providedAmount: amount },
        { status: 400 }
      );
    }

    // SECURITY: Maximum transaction limit (prevent overflow attacks)
    const MAX_TRANSACTION_AMOUNT = 999999999.99; // ~1 billion MXN limit
    if (parsedAmount > MAX_TRANSACTION_AMOUNT) {
      console.error('ORDER ERROR: Amount exceeds maximum:', amount);
      return NextResponse.json(
        { error: 'El monto excede el límite máximo permitido', providedAmount: amount },
        { status: 400 }
      );
    }

    // NOTE: Balance validation is now done atomically in createOutgoingTransactionAtomic
    // to prevent race conditions and double spending

    // Sanitize text fields for SPEI (remove accents and special characters)
    const sanitizedBeneficiaryName = prepareTextForSpei(beneficiaryName, 40);
    const sanitizedConcept = prepareTextForSpei(concept, 40);
    const sanitizedPayerName = prepareTextForSpei(
      payerName || process.env.DEFAULT_PAYER_NAME || 'NOVACORE',
      40
    );

    // Generate tracking key if not provided (max 30 chars)
    let finalTrackingKey: string;
    if (trackingKey) {
      // SECURITY FIX: Validate user-provided tracking key format
      const sanitizedTrackingKey = String(trackingKey).substring(0, 30).toUpperCase();
      if (!/^[A-Z0-9]+$/.test(sanitizedTrackingKey)) {
        console.error('ORDER ERROR: Invalid tracking key format:', trackingKey);
        return NextResponse.json(
          { error: 'La clave de rastreo solo puede contener letras mayúsculas y números' },
          { status: 400 }
        );
      }
      if (sanitizedTrackingKey.length < 5) {
        console.error('ORDER ERROR: Tracking key too short:', trackingKey);
        return NextResponse.json(
          { error: 'La clave de rastreo debe tener al menos 5 caracteres' },
          { status: 400 }
        );
      }
      finalTrackingKey = sanitizedTrackingKey;
    } else {
      finalTrackingKey = generateTrackingKey('NC');
    }

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

    // SECURITY FIX: Removed logging of sensitive account/amount data
    console.log('Order data prepared, trackingKey:', finalTrackingKey);

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

    // Grace period configuration: seconds before order is sent to OPM
    // This gives users time to cancel a transfer before it's irreversible
    // SECURITY: Can be configured via environment variable (default 8 seconds)
    const GRACE_PERIOD_SECONDS = parseInt(process.env.GRACE_PERIOD_SECONDS || '8', 10);

    // Build order data to be sent to OPM AFTER grace period
    // Note: paymentDay will be set when actually sending to OPM
    const pendingOrderData = {
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
      paymentType: paymentType ?? 1, // Default: Third party to third party
      concept: sanitizedConcept,
      amount: parsedAmount,
      trackingKey: finalTrackingKey,
      // Include CEP override fields if provided
      ...(cepPayerName && { cepPayerName: sanitizeForSpei(cepPayerName).substring(0, 40) }),
      ...(cepPayerUid && { cepPayerUid: cepPayerUid.substring(0, 18) }),
      ...(cepPayerAccount && { cepPayerAccount }),
    };

    // SECURITY FIX: Removed logging of sensitive order data
    console.log('=== CREATING TRANSACTION WITH ATOMIC BALANCE CHECK ===');

    // Calculate confirmation deadline
    const confirmationDeadline = new Date(Date.now() + GRACE_PERIOD_SECONDS * 1000);
    const transactionId = `tx_out_${crypto.randomUUID()}`;

    // ============================================
    // CRITICAL: Use atomic transaction with row locking to prevent double spending
    // This ensures balance check and transaction creation happen atomically
    // ============================================
    const atomicResult = await createOutgoingTransactionAtomic({
      id: transactionId,
      clabeAccountId: sourceClabeAccount.id,
      type: 'outgoing',
      status: 'pending_confirmation',
      amount: parsedAmount,
      concept: sanitizedConcept,
      trackingKey: finalTrackingKey,
      numericalReference: finalNumericalReference,
      beneficiaryAccount,
      beneficiaryBank,
      beneficiaryName: sanitizedBeneficiaryName,
      beneficiaryUid: beneficiaryUid || undefined,
      payerAccount: resolvedPayerAccount,
      payerBank: resolvedPayerBank,
      payerName: sanitizedPayerName,
      payerUid: payerUid || undefined,
      confirmationDeadline,
      pendingOrderData,
    });

    if (!atomicResult.success) {
      console.error('ORDER ERROR: Atomic transaction failed:', atomicResult.error);

      // Log the failed attempt for insufficient balance
      if (atomicResult.availableBalance !== undefined) {
        const user = await getUserById(userId);
        await createAuditLogEntry({
          id: `audit_${crypto.randomUUID()}`,
          action: 'TRANSFER_INSUFFICIENT_BALANCE',
          userId,
          userEmail: user?.email,
          ipAddress: clientIP,
          userAgent,
          details: {
            payerAccount,
            requestedAmount: parsedAmount,
            availableBalance: atomicResult.availableBalance,
          },
          severity: 'warning',
        });
      }

      return NextResponse.json(
        {
          error: atomicResult.error,
          ...(atomicResult.availableBalance !== undefined && {
            details: {
              requestedAmount: parsedAmount,
              availableBalance: atomicResult.availableBalance,
            },
          }),
        },
        { status: 400 }
      );
    }

    const savedTransaction = atomicResult.transaction;

    console.log('=== TRANSACTION SAVED WITH ATOMIC BALANCE CHECK ===');
    console.log('Saved transaction ID:', savedTransaction.id);
    console.log('Tracking Key:', finalTrackingKey);
    console.log('Confirmation Deadline:', confirmationDeadline.toISOString());
    console.log('Grace Period:', GRACE_PERIOD_SECONDS, 'seconds');
    console.log('NOTE: Order will be sent to OPM after grace period expires');

    // Return response with grace period info
    // Note: No OPM order ID yet since we haven't sent to OPM
    return NextResponse.json({
      code: 200,
      data: {
        id: transactionId,
        trackingKey: finalTrackingKey,
        amount: parsedAmount,
        beneficiaryName: sanitizedBeneficiaryName,
        beneficiaryAccount,
        status: 'pending_confirmation',
      },
      gracePeriod: {
        transactionId: savedTransaction.id,
        confirmationDeadline: confirmationDeadline.toISOString(),
        secondsRemaining: GRACE_PERIOD_SECONDS,
        canCancel: true,
        message: `La transferencia se enviará automáticamente en ${GRACE_PERIOD_SECONDS} segundos. Puedes cancelar antes de que expire el tiempo.`,
      },
    });
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
 * SECURITY: Requires authentication. Only super_admin and company_admin can list orders.
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
    // ============================================
    // SECURITY: Authenticate user via session token
    // ============================================
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }

    const authenticatedUser = authResult.user;

    // Only super_admin and company_admin can list orders from OPM
    if (!['super_admin', 'company_admin'].includes(authenticatedUser.role)) {
      return NextResponse.json(
        { error: 'No tienes permiso para ver órdenes' },
        { status: 403 }
      );
    }

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

    // SECURITY FIX: Filter orders by company for company_admin
    // Super admin sees all orders, company_admin only sees orders for their CLABEs
    if (authenticatedUser.role === 'company_admin' && authenticatedUser.companyId) {
      const companyClabes = await getClabeAccountsByCompanyId(authenticatedUser.companyId);
      const companyClabeNumbers = new Set(companyClabes.map(c => c.clabe));

      // Filter orders to only include those involving company's CLABEs
      if (response.data && Array.isArray(response.data)) {
        response.data = response.data.filter((order: any) => {
          const payerAccount = order.payerAccount;
          const beneficiaryAccount = order.beneficiaryAccount;
          return (
            (payerAccount && companyClabeNumbers.has(payerAccount)) ||
            (beneficiaryAccount && companyClabeNumbers.has(beneficiaryAccount))
          );
        });
        // Update total count to reflect filtered results
        response.total = response.data.length;
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('List orders error:', error);
    return NextResponse.json(
      { error: 'Failed to list orders', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
