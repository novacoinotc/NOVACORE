import { NextRequest, NextResponse } from 'next/server';
import { getBalance } from '@/lib/opm-api';
import { authenticateRequest, validateClabeAccess } from '@/lib/auth-middleware';
import { getClabeAccountByClabe } from '@/lib/db';

/**
 * POST /api/balance
 *
 * Get account balance (SECURED - requires authentication and CLABE access)
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY FIX: Require authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }

    const body = await request.json();
    const { account } = body;

    if (!account) {
      return NextResponse.json(
        { error: 'Account is required' },
        { status: 400 }
      );
    }

    // SECURITY FIX: Validate user has access to this CLABE account
    const clabeAccount = await getClabeAccountByClabe(account);
    if (!clabeAccount) {
      return NextResponse.json(
        { error: 'Cuenta no encontrada' },
        { status: 404 }
      );
    }

    const hasAccess = await validateClabeAccess(
      authResult.user.id,
      clabeAccount.id,
      authResult.user.role,
      authResult.user.companyId
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'No tienes permiso para consultar esta cuenta' },
        { status: 403 }
      );
    }

    const apiKey = process.env.OPM_API_KEY;
    const response = await getBalance(account, apiKey);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Balance query error:', error);
    return NextResponse.json(
      { error: 'Failed to get balance' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/balance?account={account}
 *
 * Get account balance (SECURED - requires authentication and CLABE access)
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

    const { searchParams } = new URL(request.url);
    const account = searchParams.get('account');

    if (!account) {
      return NextResponse.json(
        { error: 'Account parameter is required' },
        { status: 400 }
      );
    }

    // SECURITY FIX: Validate user has access to this CLABE account
    const clabeAccount = await getClabeAccountByClabe(account);
    if (!clabeAccount) {
      return NextResponse.json(
        { error: 'Cuenta no encontrada' },
        { status: 404 }
      );
    }

    const hasAccess = await validateClabeAccess(
      authResult.user.id,
      clabeAccount.id,
      authResult.user.role,
      authResult.user.companyId
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'No tienes permiso para consultar esta cuenta' },
        { status: 403 }
      );
    }

    const apiKey = process.env.OPM_API_KEY;
    const response = await getBalance(account, apiKey);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Balance query error:', error);
    return NextResponse.json(
      { error: 'Failed to get balance' },
      { status: 500 }
    );
  }
}
