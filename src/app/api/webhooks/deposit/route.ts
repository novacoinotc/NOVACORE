import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getClabeAccountByClabe,
  createTransaction,
  getTransactionByTrackingKey,
  getCompanyById,
  getProcessedWebhook,
  recordProcessedWebhook,
  hashWebhookPayload,
  isWebhookProcessingDisabled,
} from '@/lib/db';
import { processCommission, canReceiveSpei } from '@/lib/commissions';
import { verifySignature } from '@/lib/crypto';
import { buildSupplyOriginalString } from '@/lib/opm-api';
import {
  validateWebhookSource,
  validateWebhookPayload,
  sanitizeWebhookDataForLog,
  logWebhookEvent,
} from '@/lib/webhook-security';

/**
 * POST /api/webhooks/deposit
 *
 * Webhook endpoint for incoming SPEI deposits (supply notifications from OPM)
 *
 * This endpoint is designed to be resilient and flexible:
 * - Accepts any valid JSON payload
 * - Logs all requests for debugging
 * - Always returns 200 OK to prevent retries
 * - Validates webhook secret via x-webhook-secret header (optional)
 * - Attempts to process deposits if payload has expected structure
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  let body: any = null;

  try {
    // Security check: Validate webhook source (IP whitelist + rate limiting)
    const securityCheck = await validateWebhookSource(request);
    if (!securityCheck.allowed) {
      return NextResponse.json({
        received: true,
        timestamp,
        processed: false,
        message: securityCheck.reason || 'Request blocked',
      }, { status: 403 });
    }

    // Get body
    body = await request.json();

    // SECURITY: Kill switch for webhook processing
    // When enabled, webhooks are logged but NOT processed (ingest-only mode)
    if (isWebhookProcessingDisabled()) {
      console.warn('=== WEBHOOK PROCESSING DISABLED (KILL SWITCH) ===');
      console.warn('Webhook received but NOT processed. Payload logged for later replay.');
      console.warn('Payload (sanitized):', JSON.stringify(sanitizeWebhookDataForLog(body)));
      console.warn('================================================');
      return NextResponse.json({
        received: true,
        timestamp,
        processed: false,
        message: 'Webhook processing temporarily disabled',
      });
    }

    // Validate payload structure
    const payloadCheck = validateWebhookPayload(body, 'deposit');
    if (!payloadCheck.valid) {
      console.warn('Invalid deposit webhook payload:', payloadCheck.error);
      return NextResponse.json({
        received: true,
        timestamp,
        processed: false,
        message: payloadCheck.error,
      });
    }

    // Log safely (without sensitive data)
    console.log('=== DEPOSIT WEBHOOK RECEIVED ===');
    console.log('Timestamp:', timestamp);
    console.log('Client IP:', securityCheck.clientIp);
    console.log('Payload (sanitized):', JSON.stringify(sanitizeWebhookDataForLog(body)));
    console.log('================================');

    // SECURITY FIX: Validate webhook secret if configured - MUST block on mismatch
    const webhookSecret = process.env.WEBHOOK_SECRET;
    const receivedSecret = request.headers.get('x-webhook-secret');

    if (webhookSecret) {
      // If webhook secret is configured, validation is MANDATORY
      if (!receivedSecret) {
        console.error('=== WEBHOOK REJECTED: Missing secret header ===');
        return NextResponse.json({
          received: true,
          timestamp,
          processed: false,
          returnCode: 99,
          errorDescription: 'Missing webhook secret',
        }, { status: 401 });
      }

      try {
        const secretBuffer = Buffer.from(webhookSecret);
        const receivedBuffer = Buffer.from(receivedSecret);
        if (secretBuffer.length !== receivedBuffer.length ||
            !crypto.timingSafeEqual(secretBuffer, receivedBuffer)) {
          console.error('=== WEBHOOK REJECTED: Secret mismatch ===');
          return NextResponse.json({
            received: true,
            timestamp,
            processed: false,
            returnCode: 99,
            errorDescription: 'Invalid webhook secret',
          }, { status: 401 });
        }
        console.log('Webhook secret validated successfully');
      } catch (e) {
        console.error('=== WEBHOOK REJECTED: Secret comparison failed ===', e);
        return NextResponse.json({
          received: true,
          timestamp,
          processed: false,
          returnCode: 99,
          errorDescription: 'Secret validation error',
        }, { status: 401 });
      }
    }

    // RSA signature validation from OPM
    // PERMANENTLY DISABLED: OPM does not provide their public key for webhook validation
    // Security relies on: (1) IP whitelist (hardcoded OPM IPs), (2) Webhook secret header
    // If OPM ever provides their public key, set SKIP_WEBHOOK_SIGNATURE_VALIDATION=false
    const skipSignatureValidation = process.env.SKIP_WEBHOOK_SIGNATURE_VALIDATION === 'true';

    if (!skipSignatureValidation) {
      const signatureValid = await validateOpmSignature(body);
      if (!signatureValid) {
        // SECURITY FIX: Don't log full body - use sanitized version
        console.error('=== DEPOSIT WEBHOOK SIGNATURE VALIDATION FAILED ===');
        console.error('Timestamp:', timestamp);
        console.error('Payload (sanitized):', JSON.stringify(sanitizeWebhookDataForLog(body)));
        console.error('Sign field present:', !!(body?.sign || body?.data?.sign));
        console.error('================================================');

        return NextResponse.json({
          received: true,
          timestamp,
          processed: false,
          returnCode: 99,
          errorDescription: 'Invalid signature',
          message: 'RSA signature validation failed',
        });
      }
      console.log('RSA signature validated successfully');
    } else {
      // SECURITY NOTE: RSA validation is skipped because OPM doesn't provide their public key
      // This is acceptable because we enforce strict IP whitelist (OPM IPs only)
      // and validate webhook secret header as additional defense layers
      if (process.env.NODE_ENV === 'production') {
        console.log('RSA signature validation disabled (OPM limitation) - relying on IP whitelist');
      }
    }

    // Try to extract deposit data from various possible payload structures
    const depositData = extractDepositData(body);

    if (depositData) {
      console.log('Extracted deposit data:', depositData);

      // SECURITY: Idempotency check to prevent duplicate processing
      const payloadHash = hashWebhookPayload(body);
      const existingWebhook = await getProcessedWebhook('deposit', depositData.trackingKey);

      if (existingWebhook) {
        console.log(`[SECURITY] Duplicate webhook detected: ${depositData.trackingKey}`);
        // Record the duplicate attempt
        await recordProcessedWebhook({
          id: `wh_${crypto.randomUUID()}`,
          webhookType: 'deposit',
          trackingKey: depositData.trackingKey,
          sourceIp: securityCheck.clientIp,
          payloadHash,
          result: 'duplicate',
        });

        return NextResponse.json({
          received: true,
          timestamp,
          processed: false,
          returnCode: 12,
          message: 'Webhook already processed (idempotency check)',
        });
      }

      // Attempt to process the deposit
      const result = await processDeposit(depositData);

      // Record the webhook processing result
      await recordProcessedWebhook({
        id: `wh_${crypto.randomUUID()}`,
        webhookType: 'deposit',
        trackingKey: depositData.trackingKey,
        sourceIp: securityCheck.clientIp,
        payloadHash,
        result: result.success ? 'success' : 'failed',
      });

      return NextResponse.json({
        received: true,
        timestamp,
        processed: result.success,
        returnCode: result.returnCode,
        message: result.message,
        internalTxId: result.transactionId,
      });
    }

    // If we couldn't extract deposit data, just acknowledge receipt
    return NextResponse.json({
      received: true,
      timestamp,
      processed: false,
      message: 'Payload logged but not processed - unexpected structure',
    });

  } catch (error) {
    // SECURITY FIX: Log error but don't expose sensitive body data
    console.error('=== DEPOSIT WEBHOOK ERROR ===');
    console.error('Timestamp:', timestamp);
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Body structure:', body ? Object.keys(body) : 'null');
    console.error('=============================');

    return NextResponse.json({
      received: true,
      timestamp,
      processed: false,
      error: 'Internal error occurred - logged for review',
    });
  }
}

/**
 * Extract deposit data from various possible payload structures
 */
function extractDepositData(body: any): DepositData | null {
  try {
    // Structure 1: OPM format with type: 'supply' and nested data
    if (body?.type === 'supply' && body?.data) {
      const d = body.data;
      return {
        trackingKey: d.trackingKey,
        amount: d.amount,
        beneficiaryAccount: d.beneficiaryAccount,
        beneficiaryBank: d.beneficiaryBank,
        beneficiaryName: d.beneficiaryName,
        beneficiaryUid: d.beneficiaryUid,
        payerAccount: d.payerAccount,
        payerBank: d.payerBank,
        payerName: d.payerName,
        payerUid: d.payerUid,
        concept: d.concept,
        numericalReference: d.numericalReference,
        receivedTimestamp: d.receivedTimestamp,
      };
    }

    // Structure 2: Flat structure with direct fields
    if (body?.trackingKey && body?.amount && body?.beneficiaryAccount) {
      return {
        trackingKey: body.trackingKey,
        amount: body.amount,
        beneficiaryAccount: body.beneficiaryAccount,
        beneficiaryBank: body.beneficiaryBank,
        beneficiaryName: body.beneficiaryName,
        beneficiaryUid: body.beneficiaryUid,
        payerAccount: body.payerAccount,
        payerBank: body.payerBank,
        payerName: body.payerName,
        payerUid: body.payerUid,
        concept: body.concept,
        numericalReference: body.numericalReference,
        receivedTimestamp: body.receivedTimestamp || body.timestamp,
      };
    }

    // Structure 3: With different field names (camelCase variations)
    if (body?.tracking_key || body?.claveRastreo) {
      return {
        trackingKey: body.tracking_key || body.claveRastreo,
        amount: body.amount || body.monto,
        beneficiaryAccount: body.beneficiary_account || body.cuentaBeneficiario || body.beneficiaryAccount,
        beneficiaryBank: body.beneficiary_bank || body.bancoBeneficiario || body.beneficiaryBank,
        beneficiaryName: body.beneficiary_name || body.nombreBeneficiario || body.beneficiaryName,
        beneficiaryUid: body.beneficiary_uid || body.rfcBeneficiario || body.beneficiaryUid,
        payerAccount: body.payer_account || body.cuentaOrdenante || body.payerAccount,
        payerBank: body.payer_bank || body.bancoOrdenante || body.payerBank,
        payerName: body.payer_name || body.nombreOrdenante || body.payerName,
        payerUid: body.payer_uid || body.rfcOrdenante || body.payerUid,
        concept: body.concept || body.concepto,
        numericalReference: body.numerical_reference || body.referenciaNumérica || body.numericalReference,
        receivedTimestamp: body.received_timestamp || body.fechaRecepcion || body.timestamp,
      };
    }

    return null;
  } catch (error) {
    console.error('Error extracting deposit data:', error);
    return null;
  }
}

/**
 * Validate OPM RSA signature on incoming deposit webhook
 *
 * OPM signs all webhooks with their private key. We verify using their public key.
 * The original string format for supply webhooks is:
 * ||beneficiaryName|beneficiaryUid|beneficiaryAccount|beneficiaryBank|beneficiaryAccountType|
 * payerName|payerUid|payerAccount|payerBank|payerAccountType|amount|concept|trackingKey|numericalReference||
 */
async function validateOpmSignature(body: any): Promise<boolean> {
  try {
    const publicKey = process.env.OPM_PUBLIC_KEY;

    if (!publicKey) {
      console.error('OPM_PUBLIC_KEY not configured - cannot validate signature');
      return false;
    }

    // Extract signature from payload (can be at root level or in data)
    const signature = body?.sign || body?.data?.sign;

    if (!signature) {
      console.error('No signature (sign field) found in webhook payload');
      return false;
    }

    // Extract data for building original string
    // Handle both nested (type: 'supply', data: {...}) and flat structures
    const data = body?.type === 'supply' && body?.data ? body.data : body;

    // Validate required fields for signature verification
    if (!data?.beneficiaryAccount || !data?.trackingKey) {
      console.error('Missing required fields for signature verification');
      return false;
    }

    // Build the original string that OPM signed
    const originalString = buildSupplyOriginalString({
      beneficiaryName: data.beneficiaryName || '',
      beneficiaryUid: data.beneficiaryUid || '',
      beneficiaryAccount: data.beneficiaryAccount,
      beneficiaryBank: data.beneficiaryBank || '',
      beneficiaryAccountType: data.beneficiaryAccountType || 40,
      payerName: data.payerName || '',
      payerUid: data.payerUid || '',
      payerAccount: data.payerAccount || '',
      payerBank: data.payerBank || '',
      payerAccountType: data.payerAccountType || 40,
      amount: data.amount || 0,
      concept: data.concept || '',
      trackingKey: data.trackingKey,
      numericalReference: data.numericalReference || 0,
    });

    console.log('Original string for signature verification:', originalString);

    // Verify the signature using OPM's public key
    const isValid = await verifySignature(originalString, signature, publicKey);

    if (!isValid) {
      console.error('RSA signature verification failed');
      console.error('Expected signature for original string:', originalString);
      console.error('Received signature:', signature);
    }

    return isValid;
  } catch (error) {
    console.error('Error during signature validation:', error);
    return false;
  }
}

interface DepositData {
  trackingKey: string;
  amount: number;
  beneficiaryAccount: string;
  beneficiaryBank?: string;
  beneficiaryName?: string;
  beneficiaryUid?: string;
  payerAccount?: string;
  payerBank?: string;
  payerName?: string;
  payerUid?: string;
  concept?: string;
  numericalReference?: string | number;
  receivedTimestamp?: number | string;
}

interface ProcessResult {
  success: boolean;
  returnCode: number;
  message: string;
  transactionId?: string;
}

/**
 * Process the deposit and save to database
 */
async function processDeposit(data: DepositData): Promise<ProcessResult> {
  try {
    // Validate minimum required fields
    if (!data.beneficiaryAccount || !data.amount || !data.trackingKey) {
      return {
        success: false,
        returnCode: 7,
        message: 'Missing required fields: beneficiaryAccount, amount, or trackingKey',
      };
    }

    // SECURITY FIX: Comprehensive amount validation (matching orders endpoint)
    const amountStr = String(data.amount);

    // Reject scientific notation (e.g., "1e10")
    if (/[eE]/.test(amountStr)) {
      return {
        success: false,
        returnCode: 7,
        message: 'Invalid amount format - scientific notation not allowed',
      };
    }

    // Validate decimal format (max 2 decimal places)
    if (!/^\d+(\.\d{1,2})?$/.test(amountStr)) {
      return {
        success: false,
        returnCode: 7,
        message: 'Invalid amount format - max 2 decimal places allowed',
      };
    }

    const parsedAmount = parseFloat(amountStr);

    // Check for NaN, Infinity, negative, and zero
    if (isNaN(parsedAmount) || !isFinite(parsedAmount) || parsedAmount <= 0) {
      return {
        success: false,
        returnCode: 7,
        message: 'Invalid amount - must be a positive number',
      };
    }

    // Maximum transaction limit (same as orders endpoint)
    const MAX_TRANSACTION_AMOUNT = 999999999.99;
    if (parsedAmount > MAX_TRANSACTION_AMOUNT) {
      return {
        success: false,
        returnCode: 7,
        message: 'Amount exceeds maximum allowed',
      };
    }

    // Check if beneficiary account exists
    const clabeAccount = await getClabeAccountByClabe(data.beneficiaryAccount);
    if (!clabeAccount) {
      console.warn(`CLABE account not found: ${data.beneficiaryAccount}`);
      return {
        success: false,
        returnCode: 6,
        message: 'Beneficiary account not found',
      };
    }

    // Check if CLABE account is active
    if (!clabeAccount.is_active) {
      return {
        success: false,
        returnCode: 6,
        message: 'Beneficiary account is inactive',
      };
    }

    // Check if company can receive SPEI
    const speiCheck = await canReceiveSpei(clabeAccount.company_id);
    if (!speiCheck.allowed) {
      console.warn(`SPEI IN blocked for company ${clabeAccount.company_id}: ${speiCheck.reason}`);
      return {
        success: false,
        returnCode: 13,
        message: speiCheck.reason || 'Company cannot receive SPEI transfers',
      };
    }

    // Check for duplicate tracking key
    const existingTransaction = await getTransactionByTrackingKey(data.trackingKey);
    if (existingTransaction) {
      console.warn(`Duplicate tracking key: ${data.trackingKey}`);
      return {
        success: false,
        returnCode: 12,
        message: 'Duplicate tracking key',
      };
    }

    // Create transaction
    const transactionId = `tx_${crypto.randomUUID()}`;

    try {
      // Convert numericalReference to number if it's a string
      const numRef = data.numericalReference
        ? parseInt(String(data.numericalReference), 10)
        : undefined;

      const savedTransaction = await createTransaction({
        id: transactionId,
        clabeAccountId: clabeAccount.id,
        type: 'incoming',
        status: 'scattered',
        amount: parsedAmount,  // Use validated/parsed amount
        concept: data.concept,
        trackingKey: data.trackingKey,
        numericalReference: isNaN(numRef as number) ? undefined : numRef,
        beneficiaryAccount: data.beneficiaryAccount,
        beneficiaryBank: data.beneficiaryBank,
        beneficiaryName: data.beneficiaryName,
        beneficiaryUid: data.beneficiaryUid,
        payerAccount: data.payerAccount,
        payerBank: data.payerBank,
        payerName: data.payerName,
        payerUid: data.payerUid,
      });

      console.log(`Transaction saved: ${transactionId} for CLABE ${clabeAccount.id}`);

      // Process commission if configured
      const company = await getCompanyById(clabeAccount.company_id);
      if (company && savedTransaction) {
        const commissionResult = await processCommission(savedTransaction, company);
        if (commissionResult.success && commissionResult.commissionAmount > 0) {
          console.log(`Pending commission created: ${commissionResult.commissionAmount} MXN`);
        }
      }

      return {
        success: true,
        returnCode: 0,
        message: 'Transaction accepted',
        transactionId,
      };

    } catch (dbError) {
      console.error('Failed to save transaction:', dbError);
      return {
        success: false,
        returnCode: 99,
        message: 'Database error - transaction logged but not saved',
      };
    }

  } catch (error) {
    console.error('Error processing deposit:', error);
    return {
      success: false,
      returnCode: 99,
      message: 'Internal processing error',
    };
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'deposit-webhook',
    timestamp: new Date().toISOString(),
    message: 'Webhook is ready to receive deposits',
  });
}
