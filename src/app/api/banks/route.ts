import { NextRequest, NextResponse } from 'next/server';
import { listBanks } from '@/lib/opm-api';
import { authenticateRequest } from '@/lib/auth-middleware';

/**
 * GET /api/banks
 *
 * List all banks affiliated to SPEI
 *
 * SECURITY: Requires authentication for audit logging and rate limiting
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
    const response = await listBanks(apiKey);

    return NextResponse.json(response);
  } catch (error) {
    console.error('List banks error:', error);
    return NextResponse.json(
      { error: 'Failed to list banks' },
      { status: 500 }
    );
  }
}
