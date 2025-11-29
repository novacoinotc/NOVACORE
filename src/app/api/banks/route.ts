import { NextResponse } from 'next/server';
import { listBanks } from '@/lib/opm-api';

/**
 * GET /api/banks
 *
 * List all banks affiliated to SPEI
 */
export async function GET() {
  try {
    const apiKey = process.env.OPM_API_KEY;
    const response = await listBanks(apiKey);

    return NextResponse.json(response);
  } catch (error) {
    console.error('List banks error:', error);
    return NextResponse.json(
      { error: 'Failed to list banks', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
