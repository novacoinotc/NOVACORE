import { NextRequest, NextResponse } from 'next/server';
import { listAccountTypes } from '@/lib/opm-api';
import { authenticateRequest } from '@/lib/auth-middleware';

/**
 * GET /api/account-types
 *
 * List all SPEI account types
 *
 * SECURITY: Requires authentication for audit logging and rate limiting
 *
 * Account types determine how accounts are classified in SPEI:
 * - 40: CLABE (Clave Bancaria Estandarizada)
 * - 3: Debit card
 * - 10: Phone number
 * - etc.
 */
export async function GET(request: NextRequest) {
  try {
    // SECURITY FIX: Require authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }

    const apiKey = process.env.OPM_API_KEY;
    const response = await listAccountTypes(apiKey);

    return NextResponse.json(response);
  } catch (error) {
    console.error('List account types error:', error);
    return NextResponse.json(
      { error: 'Failed to list account types' },
      { status: 500 }
    );
  }
}
