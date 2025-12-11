import { NextRequest, NextResponse } from 'next/server';
import { getPendingConfirmationTransactions, updateTransactionStatus } from '@/lib/db';
import { getOrder } from '@/lib/opm-api';

/**
 * POST /api/orders/confirm-pending
 *
 * Process all transactions that have passed their grace period.
 * This endpoint should be called periodically (e.g., every 5 seconds)
 * by a cron job or client-side polling.
 *
 * For each transaction:
 * 1. Check if grace period has expired
 * 2. Fetch current status from OPM API
 * 3. Update local status to match OPM (sent, scattered, etc.)
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
      errors: [] as string[],
    };

    for (const tx of pendingTransactions) {
      try {
        console.log(`Processing transaction ${tx.id} (OPM: ${tx.opm_order_id})`);

        // Default to 'sent' status after grace period
        let newStatus = 'sent';

        // Try to get current status from OPM
        if (tx.opm_order_id) {
          try {
            const opmResponse = await getOrder(tx.opm_order_id);

            if ((opmResponse.code === 200 || opmResponse.code === 0) && opmResponse.data) {
              const opmOrder = opmResponse.data;

              // Determine status from OPM order
              if (opmOrder.canceled) newStatus = 'canceled';
              else if (opmOrder.returned) newStatus = 'returned';
              else if (opmOrder.scattered) newStatus = 'scattered';
              else if (opmOrder.sent) newStatus = 'sent';
              else newStatus = 'pending';

              console.log(`OPM status for ${tx.opm_order_id}: ${newStatus}`);
            }
          } catch (opmError) {
            console.error(`Error fetching OPM status for ${tx.opm_order_id}:`, opmError);
            // Continue with default 'sent' status
          }
        }

        // Update local transaction
        const updated = await updateTransactionStatus(tx.id, newStatus);

        if (updated) {
          results.confirmed++;
          console.log(`Transaction ${tx.id} confirmed with status: ${newStatus}`);
        } else {
          results.errors.push(`Failed to update transaction ${tx.id}`);
        }

        results.processed++;
      } catch (error) {
        const errorMsg = `Error processing transaction ${tx.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
        results.processed++;
      }
    }

    console.log('=== CONFIRMATION PROCESSING COMPLETE ===');
    console.log(`Processed: ${results.processed}, Confirmed: ${results.confirmed}, Errors: ${results.errors.length}`);

    return NextResponse.json({
      success: true,
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
