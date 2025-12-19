import { NextRequest, NextResponse } from 'next/server';
import { getOrderCep } from '@/lib/opm-api';
import { authenticateRequest, validateClabeAccess } from '@/lib/auth-middleware';
import { getTransactionByOpmOrderId } from '@/lib/db';

/**
 * GET /api/orders/[id]/cep
 *
 * Get the CEP (Comprobante Electrónico de Pago) URL for an order
 *
 * The CEP is the official SPEI payment receipt that can be used as
 * legal proof of the transfer.
 *
 * SECURITY: Requires authentication and validates user has access to the order
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // SECURITY FIX: Require authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }

    const orderId = params.id;

    // SECURITY FIX: Validate user has access to this order (IDOR protection)
    const transaction = await getTransactionByOpmOrderId(orderId);
    if (transaction && transaction.clabe_account_id) {
      const hasAccess = await validateClabeAccess(
        authResult.user.id,
        transaction.clabe_account_id,
        authResult.user.role
      );
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'No tienes acceso a esta orden' },
          { status: 403 }
        );
      }
    }

    console.log('Fetching CEP for order:', orderId);

    const apiKey = process.env.OPM_API_KEY;
    const response = await getOrderCep(orderId, apiKey);

    console.log('OPM CEP response:', JSON.stringify(response, null, 2));

    // ApiResponse<string> returns the CEP URL in response.data
    // The data field should be the CEP URL string
    let cepUrl: string | null = null;

    if (response?.data) {
      // response.data is typed as string (the CEP URL)
      cepUrl = response.data;
    }

    if (cepUrl && cepUrl.length > 0) {
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
