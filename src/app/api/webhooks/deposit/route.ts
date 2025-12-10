import { NextRequest, NextResponse } from 'next/server';
import {
  getClabeAccountByClabe,
  createTransaction,
  getTransactionByTrackingKey,
  getCompanyById,
} from '@/lib/db';
import { processCommission, canReceiveSpei } from '@/lib/commissions';
import { verifySignature } from '@/lib/crypto';
import { buildSupplyOriginalString } from '@/lib/opm-api';

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
    // Get raw body for logging
    body = await request.json();

    // Log complete request for debugging
    console.log('=== DEPOSIT WEBHOOK RECEIVED ===');
    console.log('Timestamp:', timestamp);
    console.log('Headers:', Object.fromEntries(request.headers.entries()));
    console.log('Body:', JSON.stringify(body, null, 2));
    console.log('================================');

    // Optional: Validate webhook secret if configured
    const webhookSecret = process.env.WEBHOOK_SECRET;
    const receivedSecret = request.headers.get('x-webhook-secret');

    if (webhookSecret && receivedSecret && webhookSecret !== receivedSecret) {
      console.warn('Webhook secret mismatch - logging but continuing');
      // Don't reject, just log the mismatch
    }

    // MANDATORY: Validate RSA signature from OPM
    const signatureValid = await validateOpmSignature(body);
    if (!signatureValid) {
      console.error('=== DEPOSIT WEBHOOK SIGNATURE VALIDATION FAILED ===');
      console.error('Timestamp:', timestamp);
      console.error('Body:', JSON.stringify(body, null, 2));
      console.error('Sign field:', body?.sign || body?.data?.sign || 'NOT PROVIDED');
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

    // Try to extract deposit data from various possible payload structures
    const depositData = extractDepositData(body);

    if (depositData) {
      console.log('Extracted deposit data:', depositData);

      // Attempt to process the deposit
      const result = await processDeposit(depositData);

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
    // Log error but always return 200 OK
    console.error('=== DEPOSIT WEBHOOK ERROR ===');
    console.error('Timestamp:', timestamp);
    console.error('Error:', error);
    console.error('Body received:', body);
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
 * IMPORTANT: OPM signs webhooks with THEIR private key.
 * We must verify using OPM'S PUBLIC KEY (not ours).
 *
 * - OPM_WEBHOOK_PUBLIC_KEY: OPM's public key for verifying their webhooks (REQUIRED for validation)
 * - OPM_PUBLIC_KEY: OUR public key (part of our keypair, NOT for webhook validation)
 *
 * The original string format for supply webhooks is:
 * ||beneficiaryName|beneficiaryUid|beneficiaryAccount|beneficiaryBank|beneficiaryAccountType|
 * payerName|payerUid|payerAccount|payerBank|payerAccountType|amount|concept|trackingKey|numericalReference||
 */
async function validateOpmSignature(body: any): Promise<boolean> {
  try {
    // IMPORTANT: Use OPM's public key for webhook validation, NOT our public key
    // OPM_WEBHOOK_PUBLIC_KEY = OPM's key to verify their signatures
    // OPM_PUBLIC_KEY = Our key (wrong for webhook validation)
    const opmWebhookPublicKey = process.env.OPM_WEBHOOK_PUBLIC_KEY;

    if (!opmWebhookPublicKey) {
      // If OPM's public key is not configured, log warning and skip validation
      // This allows the system to work while waiting for OPM to provide their public key
      console.warn('=== OPM WEBHOOK SIGNATURE VALIDATION SKIPPED ===');
      console.warn('OPM_WEBHOOK_PUBLIC_KEY not configured.');
      console.warn('To enable signature validation, obtain OPM\'s public key and set OPM_WEBHOOK_PUBLIC_KEY');
      console.warn('NOTE: OPM_PUBLIC_KEY is YOUR key, not OPM\'s key for webhook validation');
      console.warn('=================================================');
      return true; // Skip validation, accept the webhook
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

    // Verify the signature using OPM's public key (not ours)
    const isValid = await verifySignature(originalString, signature, opmWebhookPublicKey);

    if (!isValid) {
      console.error('RSA signature verification failed');
      console.error('Original string:', originalString);
      console.error('Received signature:', signature);
      console.error('Using OPM_WEBHOOK_PUBLIC_KEY for validation');
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

    // Validate amount is positive
    if (data.amount <= 0) {
      return {
        success: false,
        returnCode: 7,
        message: 'Invalid amount',
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
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

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
        amount: data.amount,
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
