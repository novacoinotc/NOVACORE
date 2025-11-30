import { NextRequest, NextResponse } from 'next/server';
import { WebhookSupplyData } from '@/types';
import { buildSupplyOriginalString } from '@/lib/opm-api';
import { verifySignature } from '@/lib/crypto';

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

    // Here you would typically:
    // 1. Validate the beneficiary account exists in your system
    // 2. Check if the account can receive funds
    // 3. Credit the funds to the internal account
    // 4. Store the transaction in your database

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

    // Example: Validate account exists
    // TODO: Replace with actual database lookup for CLABE account
    const accountExists = true; // Replace with actual validation
    if (!accountExists) {
      return NextResponse.json({
        returnCode: 6, // Cuenta no existente
        errorDescription: 'Cuenta beneficiaria no encontrada',
      });
    }

    // Example: Check for duplicate tracking key
    // TODO: Replace with actual duplicate check in database
    const isDuplicate = false; // Replace with actual check
    if (isDuplicate) {
      return NextResponse.json({
        returnCode: 12, // Operación duplicada
        errorDescription: 'Operación con clave de rastreo duplicada',
      });
    }

    // Example: Check balance limits
    // TODO: Replace with actual balance limit check
    const exceedsLimit = false; // Replace with actual check
    if (exceedsLimit) {
      return NextResponse.json({
        returnCode: 4, // Saldo excede límite
        errorDescription: 'Excede límite de saldo permitido',
      });
    }

    // Example: Beneficiary recognition check
    // TODO: Implement if you need manual approval for certain transfers
    const beneficiaryRecognizes = true;
    if (!beneficiaryRecognizes) {
      return NextResponse.json({
        returnCode: 13, // Beneficiario no reconoce pago
        errorDescription: 'Beneficiario no reconoce el pago',
      });
    }

    // Accept the transaction
    // You can optionally include CEP beneficiary data to override what shows on CEP
    return NextResponse.json({
      returnCode: 0, // Transacción aceptada
      // Optional: Override CEP beneficiary data
      // cepBeneficiaryName: 'CUSTOM NAME FOR CEP',
      // cepBeneficiaryUid: 'RFC123456789',
      // Optional: Store metadata (not sent to OPM, for internal use)
      metadata: {
        processedAt: Date.now(),
        internalTxId: `TX-${Date.now()}`,
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
