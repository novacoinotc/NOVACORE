import { NextRequest, NextResponse } from 'next/server';
import { listPaymentTypes } from '@/lib/opm-api';
import { authenticateRequest } from '@/lib/auth-middleware';

/**
 * GET /api/payment-types
 *
 * List all SPEI payment types
 *
 * SECURITY: Requires authentication for audit logging and rate limiting
 *
 * Payment types determine the relationship between payer and beneficiary:
 * - 1: Third party to third party
 * - 2: Third party to own account
 * - 3: Own account to third party
 * - 4: Own account to own account
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
    const response = await listPaymentTypes(apiKey);

    return NextResponse.json(response);
  } catch (error) {
    console.error('List payment types error:', error);
    return NextResponse.json(
      { error: 'Failed to list payment types' },
      { status: 500 }
    );
  }
}
