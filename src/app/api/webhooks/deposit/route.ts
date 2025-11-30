import { NextRequest, NextResponse } from 'next/server';
import { WebhookSupplyData } from '@/types';
import { buildSupplyOriginalString } from '@/lib/opm-api';
import { verifySignature } from '@/lib/crypto';
import {
  getClabeAccountByClabe,
  createTransaction,
  getTransactionByTrackingKey,
} from '@/lib/db';

/**
 * POST /api/webhooks/deposit
 *
 * Webhook endpoint for incoming SPEI deposits (supply notifications from OPM)
 * Based on MI-OPM-2.5.pdf integration manual
 *
 * This endpoint receives notifications when a SPEI transfer is received.
 * It must respond with a returnCode to accept or reject the transaction.
 *
 * Return Codes (from MI-OPM-2.5.pdf):
 * - 0: Transacción aceptada (Accept transaction)
 * - 4: Saldo de cuenta excede límite permitido (Account balance exceeds allowed limit)
 * - 6: Cuenta no existente (Account does not exist)
 * - 7: Error en datos de pago (Payment data error)
 * - 12: Operación duplicada (Duplicate operation - tracking key)
 * - 13: Beneficiario no reconoce pago (Beneficiary does not recognize payment)
 * - 99: Error interno del sistema (Internal system error)
 *
 * Optional response fields:
 * - cepBeneficiaryName: Override beneficiary name for CEP
 * - cepBeneficiaryUid: Override beneficiary RFC/CURP for CEP
 */
export async function POST(request: NextRequest) {
  try {
    const body: WebhookSupplyData = await request.json();

    // Validate webhook type
    if (body.type !== 'supply') {
      return NextResponse.json(
        { returnCode: 99, errorDescription: 'Invalid webhook type' },
        { status: 400 }
      );
    }

    const { data } = body;

    // Build original string for signature verification
    const originalString = buildSupplyOriginalString(data);

    // Verify signature (in production, use actual public key from environment)
    const publicKey = process.env.OPM_PUBLIC_KEY;
    if (publicKey && data.sign) {
      const isValidSignature = await verifySignature(originalString, data.sign, publicKey);
      if (!isValidSignature) {
        console.error('Invalid webhook signature');
        return NextResponse.json(
          { returnCode: 99, errorDescription: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    // Log the incoming deposit
    console.log('Incoming SPEI deposit:', {
      trackingKey: data.trackingKey,
      amount: data.amount,
      payerName: data.payerName,
      beneficiaryAccount: data.beneficiaryAccount,
      concept: data.concept,
      receivedAt: new Date(data.receivedTimestamp).toISOString(),
    });

    // Validate required payment data (return code 7 if invalid)
    if (!data.beneficiaryAccount || !data.amount || !data.trackingKey) {
      return NextResponse.json({
        returnCode: 7, // Error en datos de pago
        errorDescription: 'Datos de pago incompletos o inválidos',
      });
    }

    // Validate amount is positive
    if (data.amount <= 0) {
      return NextResponse.json({
        returnCode: 7, // Error en datos de pago
        errorDescription: 'Monto inválido',
      });
    }

    // 1. Validate the beneficiary account exists in our system
    const clabeAccount = await getClabeAccountByClabe(data.beneficiaryAccount);
    if (!clabeAccount) {
      console.warn(`CLABE account not found: ${data.beneficiaryAccount}`);
      return NextResponse.json({
        returnCode: 6, // Cuenta no existente
        errorDescription: 'Cuenta beneficiaria no encontrada en el sistema',
      });
    }

    // Check if CLABE account is active
    if (!clabeAccount.is_active) {
      return NextResponse.json({
        returnCode: 6, // Cuenta no existente
        errorDescription: 'Cuenta beneficiaria inactiva',
      });
    }

    // 2. Check for duplicate tracking key
    const existingTransaction = await getTransactionByTrackingKey(data.trackingKey);
    if (existingTransaction) {
      console.warn(`Duplicate tracking key: ${data.trackingKey}`);
      return NextResponse.json({
        returnCode: 12, // Operación duplicada
        errorDescription: 'Operación con clave de rastreo duplicada',
      });
    }

    // 3. Store the transaction in the database
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    try {
      await createTransaction({
        id: transactionId,
        clabeAccountId: clabeAccount.id,
        type: 'incoming',
        status: 'scattered', // Incoming deposits are already settled
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
    } catch (dbError) {
      console.error('Failed to save transaction:', dbError);
      // Still accept the transaction even if DB save fails
      // The deposit was received, we just failed to record it internally
    }

    // Accept the transaction
    return NextResponse.json({
      returnCode: 0, // Transacción aceptada
      metadata: {
        processedAt: Date.now(),
        internalTxId: transactionId,
        clabeAccountId: clabeAccount.id,
      },
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { returnCode: 99, errorDescription: 'Internal processing error' },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'deposit-webhook',
    timestamp: new Date().toISOString(),
  });
}
