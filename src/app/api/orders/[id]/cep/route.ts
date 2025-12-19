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
    const orderId = params.id;
    console.log('Fetching CEP for order:', orderId);

    const apiKey = process.env.OPM_API_KEY;
    const response = await getOrderCep(orderId, apiKey);

    console.log('OPM CEP response:', JSON.stringify(response, null, 2));

    // OPM may return the CEP URL in different formats:
    // 1. { data: { cepUrl: "..." } }
    // 2. { data: "url" } - direct URL string
    // 3. { cepUrl: "..." } - direct field
    // 4. "url" - just the URL string
    let cepUrl: string | null = null;

    if (typeof response === 'string') {
      cepUrl = response;
    } else if (response?.data) {
      if (typeof response.data === 'string') {
        cepUrl = response.data;
      } else if (response.data.cepUrl) {
        cepUrl = response.data.cepUrl;
      } else if (response.data.url) {
        cepUrl = response.data.url;
      }
    } else if (response?.cepUrl) {
      cepUrl = response.cepUrl;
    } else if (response?.url) {
      cepUrl = response.url;
    }

    if (cepUrl) {
      return NextResponse.json({ cepUrl });
    }

    // CEP not available yet
    console.log('CEP not found in response');
    return NextResponse.json({
      error: 'CEP no disponible',
      message: 'El CEP aún no está disponible. Puede tardar unos minutos después de la liquidación.',
      rawResponse: response,
    }, { status: 404 });
  } catch (error) {
    console.error('Get CEP error:', error);
    return NextResponse.json(
      { error: 'Error al obtener CEP', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
