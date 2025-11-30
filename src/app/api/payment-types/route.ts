import { NextResponse } from 'next/server';
import { listPaymentTypes } from '@/lib/opm-api';

/**
 * GET /api/payment-types
 *
 * List all SPEI payment types
 *
 * Payment types determine the relationship between payer and beneficiary:
 * - 1: Third party to third party
 * - 2: Third party to own account
 * - 3: Own account to third party
 * - 4: Own account to own account
 */
export async function GET() {
  try {
    const apiKey = process.env.OPM_API_KEY;
    const response = await listPaymentTypes(apiKey);

    return NextResponse.json(response);
  } catch (error) {
    console.error('List payment types error:', error);
    return NextResponse.json(
      { error: 'Failed to list payment types', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
