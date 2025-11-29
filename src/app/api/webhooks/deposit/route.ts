import { NextRequest, NextResponse } from 'next/server';
import { WebhookSupplyData } from '@/types';
import { buildSupplyOriginalString } from '@/lib/opm-api';
import { verifySignature } from '@/lib/crypto';

/**
 * POST /api/webhooks/deposit
 *
 * Webhook endpoint for incoming SPEI deposits (supply notifications from OPM)
 *
 * This endpoint receives notifications when a SPEI transfer is received.
 * It must respond with a returnCode to accept or reject the transaction.
 *
 * Return Codes:
 * - 0: Accept transaction
 * - 4: Exceeds balance limit
 * - 6: Account does not exist
 * - 7: Payment type error
 * - 12: Duplicate tracking key
 * - 13: Beneficiary does not recognize payment
 * - 99: Internal error
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

    // Example: Validate account exists
    const accountExists = true; // Replace with actual validation
    if (!accountExists) {
      return NextResponse.json({
        returnCode: 6, // Account does not exist
        errorDescription: 'Cuenta beneficiaria no encontrada',
      });
    }

    // Example: Check balance limits
    const exceedsLimit = false; // Replace with actual check
    if (exceedsLimit) {
      return NextResponse.json({
        returnCode: 4, // Exceeds balance limit
        errorDescription: 'Excede limite de saldo permitido',
      });
    }

    // Accept the transaction
    // You can optionally include CEP beneficiary data
    return NextResponse.json({
      returnCode: 0, // Success
      // Optional: Override CEP beneficiary data
      // cepBeneficiaryName: 'CUSTOM NAME',
      // cepBeneficiaryUid: 'RFC123456789',
      // Optional: Store metadata
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
