import { NextRequest, NextResponse } from 'next/server';
import { getOrderCep } from '@/lib/opm-api';

/**
 * GET /api/orders/[id]/cep
 *
 * Get the CEP (Comprobante Electrónico de Pago) URL for an order
 *
 * The CEP is the official SPEI payment receipt that can be used as
 * legal proof of the transfer.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const apiKey = process.env.OPM_API_KEY;
    const response = await getOrderCep(params.id, apiKey);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get CEP error:', error);
    return NextResponse.json(
      { error: 'Failed to get CEP', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
