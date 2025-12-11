import { NextRequest, NextResponse } from 'next/server';
import { getPendingConfirmationTransactions, confirmPendingTransaction, updateTransactionStatus } from '@/lib/db';
import { createOrder, buildOrderOriginalString } from '@/lib/opm-api';
import { signWithPrivateKey } from '@/lib/crypto';
import { CreateOrderRequest } from '@/types';

/**
 * POST /api/orders/confirm-pending
 *
 * Process all transactions that have passed their grace period.
 * This endpoint should be called periodically (e.g., every 5 seconds)
 * by a cron job or client-side polling.
 *
 * For each transaction:
 * 1. Check if grace period has expired
 * 2. Send the order to OPM API (order is created NOW, not before)
 * 3. Update local transaction with OPM order ID and status
 */
export async function POST(request: NextRequest) {
  console.log('=== PROCESSING PENDING CONFIRMATIONS ===');
  console.log('Timestamp:', new Date().toISOString());

  try {
    // Get all transactions past their confirmation deadline
    const pendingTransactions = await getPendingConfirmationTransactions();

    console.log(`Found ${pendingTransactions.length} transactions to confirm`);

    const results = {
      processed: 0,
      confirmed: 0,
      failed: 0,
      errors: [] as string[],
    };

    const apiKey = process.env.OPM_API_KEY;
    const privateKey = process.env.OPM_PRIVATE_KEY;

    if (!apiKey || !privateKey) {
      console.error('Missing OPM_API_KEY or OPM_PRIVATE_KEY');
      return NextResponse.json(
        { error: 'OPM API configuration missing' },
        { status: 500 }
      );
    }

    for (const tx of pendingTransactions) {
      try {
        console.log(`Processing transaction ${tx.id}`);

        // Get the stored order data
        const orderData = tx.pending_order_data as Record<string, unknown> | null;

        if (!orderData) {
          // Transaction already has opm_order_id, just update status to sent
          console.log(`Transaction ${tx.id} has no pending order data, marking as sent`);
          await updateTransactionStatus(tx.id, 'sent');
          results.confirmed++;
          results.processed++;
          continue;
        }

        console.log(`Sending order to OPM for transaction ${tx.id}...`);
        console.log('Order data:', JSON.stringify(orderData, null, 2));

        // Set payment day to NOW (when actually sending)
        const fullOrderData = {
          ...orderData,
          paymentDay: Date.now(),
        };

        // Build original string and sign
        const originalString = buildOrderOriginalString(fullOrderData as Parameters<typeof buildOrderOriginalString>[0]);
        const sign = await signWithPrivateKey(originalString, privateKey);

        // Create the order request
        const orderRequest: CreateOrderRequest = {
          ...(fullOrderData as Omit<CreateOrderRequest, 'sign'>),
          sign,
        };

        console.log('Calling OPM createOrder API...');
        const opmResponse = await createOrder(orderRequest, apiKey);
        console.log('OPM Response:', JSON.stringify(opmResponse, null, 2));

        if ((opmResponse.code === 200 || opmResponse.code === 0) && opmResponse.data) {
          const opmOrder = opmResponse.data;

          // Determine initial status from OPM response
          let newStatus = 'sent';
          if (opmOrder.scattered) newStatus = 'scattered';
          else if (opmOrder.sent) newStatus = 'sent';
          else if (opmOrder.canceled) newStatus = 'canceled';
          else if (opmOrder.returned) newStatus = 'returned';

          // Update transaction with OPM order ID
          const updated = await confirmPendingTransaction(
            tx.id,
            opmOrder.id,
            newStatus,
            opmOrder.trackingKey
          );

          if (updated) {
            results.confirmed++;
            console.log(`Transaction ${tx.id} sent to OPM successfully. OPM Order ID: ${opmOrder.id}, Status: ${newStatus}`);
          } else {
            results.errors.push(`Failed to update transaction ${tx.id} after OPM success`);
          }
        } else {
          // OPM rejected the order
          const errorDetail = opmResponse.error || `OPM returned code ${opmResponse.code}`;
          console.error(`OPM rejected order for transaction ${tx.id}:`, errorDetail);

          // Mark as failed
          await updateTransactionStatus(tx.id, 'failed', errorDetail);
          results.failed++;
          results.errors.push(`Transaction ${tx.id}: OPM error - ${errorDetail}`);
        }

        results.processed++;
      } catch (error) {
        const errorMsg = `Error processing transaction ${tx.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        console.error('Stack:', error instanceof Error ? error.stack : 'No stack');

        // Mark as failed
        try {
          await updateTransactionStatus(tx.id, 'failed', error instanceof Error ? error.message : 'Unknown error');
        } catch (updateError) {
          console.error('Failed to update transaction status:', updateError);
        }

        results.failed++;
        results.errors.push(errorMsg);
        results.processed++;
      }
    }

    console.log('=== CONFIRMATION PROCESSING COMPLETE ===');
    console.log(`Processed: ${results.processed}, Confirmed: ${results.confirmed}, Failed: ${results.failed}, Errors: ${results.errors.length}`);

    return NextResponse.json({
      success: results.failed === 0,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('=== CONFIRMATION PROCESSING ERROR ===');
    console.error('Error:', error);

    return NextResponse.json(
      {
        error: 'Error processing pending confirmations',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orders/confirm-pending
 *
 * Get count of transactions pending confirmation.
 * Useful for monitoring.
 */
export async function GET(request: NextRequest) {
  try {
    const pendingTransactions = await getPendingConfirmationTransactions();

    return NextResponse.json({
      count: pendingTransactions.length,
      transactions: pendingTransactions.map(tx => ({
        id: tx.id,
        opmOrderId: tx.opm_order_id,
        amount: tx.amount,
        beneficiaryName: tx.beneficiary_name,
        confirmationDeadline: tx.confirmation_deadline,
        createdAt: tx.created_at,
      })),
    });
  } catch (error) {
    console.error('Error getting pending confirmations:', error);
    return NextResponse.json(
      { error: 'Error getting pending confirmations' },
      { status: 500 }
    );
  }
}
