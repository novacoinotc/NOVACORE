import { NextResponse } from 'next/server';
import { listAccountTypes } from '@/lib/opm-api';

/**
 * GET /api/account-types
 *
 * List all SPEI account types
 *
 * Account types determine how accounts are classified in SPEI:
 * - 40: CLABE (Clave Bancaria Estandarizada)
 * - 3: Debit card
 * - 10: Phone number
 * - etc.
 */
export async function GET() {
  try {
    const apiKey = process.env.OPM_API_KEY;
    const response = await listAccountTypes(apiKey);

    return NextResponse.json(response);
  } catch (error) {
    console.error('List account types error:', error);
    return NextResponse.json(
      { error: 'Failed to list account types', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
