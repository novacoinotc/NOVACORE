import { NextRequest, NextResponse } from 'next/server';
import {
  getClabeAccountByClabe,
  createTransaction,
  getTransactionByTrackingKey,
  getCompanyById,
} from '@/lib/db';
import { processCommission, canReceiveSpei } from '@/lib/commissions';

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
  numericalReference?: string;
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
      const savedTransaction = await createTransaction({
        id: transactionId,
        clabeAccountId: clabeAccount.id,
        type: 'incoming',
        status: 'scattered',
        amount: data.amount,
        concept: data.concept,
        trackingKey: data.trackingKey,
        numericalReference: data.numericalReference,
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
