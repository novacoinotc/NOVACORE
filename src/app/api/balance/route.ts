import { NextRequest, NextResponse } from 'next/server';
import { getBalance } from '@/lib/opm-api';

/**
 * POST /api/balance
 *
 * Get account balance
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { account } = body;

    if (!account) {
      return NextResponse.json(
        { error: 'Account is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPM_API_KEY;
    const response = await getBalance(account, apiKey);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Balance query error:', error);
    return NextResponse.json(
      { error: 'Failed to get balance', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/balance?account={account}
 *
 * Get account balance (alternative endpoint)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const account = searchParams.get('account');

    if (!account) {
      return NextResponse.json(
        { error: 'Account parameter is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPM_API_KEY;
    const response = await getBalance(account, apiKey);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Balance query error:', error);
    return NextResponse.json(
      { error: 'Failed to get balance', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
