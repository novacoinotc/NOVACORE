import { NextRequest, NextResponse } from 'next/server';
import { getTransactionForCancel, updateTransactionStatus, getTransactionById } from '@/lib/db';

/**
 * POST /api/orders/[id]/cancel
 *
 * Cancel a transfer during the 20-second grace period.
 *
 * This endpoint:
 * 1. Verifies the transaction is still in grace period (status = pending_confirmation)
 * 2. Updates local transaction status to 'canceled'
 *
 * NOTE: Since orders are only sent to OPM AFTER the grace period,
 * cancellation during the grace period only needs to update local status.
 * No OPM API call is needed.
 *
 * Returns error if:
 * - Transaction not found
 * - Grace period has expired (order already sent to OPM)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: transactionId } = await params;

  console.log('=== CANCEL TRANSFER REQUEST ===');
  console.log('Transaction ID:', transactionId);
  console.log('Timestamp:', new Date().toISOString());

  try {
    // Step 1: Check if transaction exists and is still cancelable
    const transaction = await getTransactionForCancel(transactionId);

    if (!transaction) {
      // Check if transaction exists at all
      const existingTx = await getTransactionById(transactionId);

      if (!existingTx) {
        console.log('Transaction not found:', transactionId);
        return NextResponse.json(
          { error: 'Transacción no encontrada' },
          { status: 404 }
        );
      }

      // Transaction exists but is not cancelable
      if (existingTx.status === 'canceled') {
        console.log('Transaction already canceled:', transactionId);
        return NextResponse.json(
          { error: 'Esta transferencia ya fue cancelada' },
          { status: 400 }
        );
      }

      console.log('Grace period expired for transaction:', transactionId);
      console.log('Current status:', existingTx.status);
      return NextResponse.json(
        {
          error: 'El período de gracia ha expirado',
          details: 'Esta transferencia ya fue enviada y no puede ser cancelada',
          status: existingTx.status,
        },
        { status: 400 }
      );
    }

    console.log('Transaction found and cancelable');
    console.log('Confirmation Deadline:', transaction.confirmation_deadline);
    console.log('NOTE: Order has NOT been sent to OPM yet, canceling locally only');

    // Step 2: Update local transaction status
    // Since order hasn't been sent to OPM, we just update local status
    console.log('Updating local transaction status to canceled');
    const updatedTransaction = await updateTransactionStatus(
      transactionId,
      'canceled',
      'Cancelado por el usuario durante el período de gracia'
    );

    if (!updatedTransaction) {
      console.error('Failed to update local transaction status');
      return NextResponse.json(
        { error: 'Error al actualizar el estado de la transacción' },
        { status: 500 }
      );
    }

    console.log('=== TRANSFER CANCELED SUCCESSFULLY ===');
    console.log('Transaction ID:', transactionId);
    console.log('New Status:', updatedTransaction.status);

    return NextResponse.json({
      success: true,
      message: 'Transferencia cancelada exitosamente',
      transaction: {
        id: updatedTransaction.id,
        status: updatedTransaction.status,
        amount: updatedTransaction.amount,
        beneficiaryName: updatedTransaction.beneficiary_name,
        canceledAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('=== CANCEL TRANSFER ERROR ===');
    console.error('Error:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack');

    return NextResponse.json(
      {
        error: 'Error al cancelar la transferencia',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orders/[id]/cancel
 *
 * Check if a transaction can still be canceled.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: transactionId } = await params;

  try {
    const transaction = await getTransactionForCancel(transactionId);

    if (!transaction) {
      const existingTx = await getTransactionById(transactionId);

      if (!existingTx) {
        return NextResponse.json(
          { canCancel: false, reason: 'Transaction not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        canCancel: false,
        reason: existingTx.status === 'canceled'
          ? 'Already canceled'
          : 'Grace period expired',
        status: existingTx.status,
      });
    }

    // Calculate remaining time
    // Note: confirmation_deadline is guaranteed to exist for cancelable transactions
    const deadline = new Date(transaction.confirmation_deadline!);
    const now = new Date();
    const secondsRemaining = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000));

    return NextResponse.json({
      canCancel: true,
      secondsRemaining,
      confirmationDeadline: transaction.confirmation_deadline!,
      status: transaction.status,
    });
  } catch (error) {
    console.error('Error checking cancel status:', error);
    return NextResponse.json(
      { error: 'Error al verificar estado de cancelación' },
      { status: 500 }
    );
  }
}
