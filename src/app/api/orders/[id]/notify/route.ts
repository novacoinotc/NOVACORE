import { NextRequest, NextResponse } from 'next/server';
import { notifyOrder } from '@/lib/opm-api';
import { authenticateRequest } from '@/lib/auth-middleware';
import { createAuditLogEntry } from '@/lib/db';

/**
 * POST /api/orders/[id]/notify
 *
 * Resend webhook notification for an order
 *
 * Use this endpoint if a webhook notification was missed and you need
 * OPM to resend the status update.
 *
 * SECURITY: Requires authentication and admin role
 */
export async function POST(
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

    // SECURITY FIX: Require admin role for re-sending webhooks
    if (!['super_admin', 'company_admin'].includes(authResult.user.role)) {
      return NextResponse.json(
        { error: 'No tienes permiso para reenviar notificaciones' },
        { status: 403 }
      );
    }

    const apiKey = process.env.OPM_API_KEY;
    const response = await notifyOrder(params.id, apiKey);

    // SECURITY FIX: Audit log
    await createAuditLogEntry({
      action: 'WEBHOOK_RESENT',
      userId: authResult.user.id,
      userEmail: authResult.user.email,
      details: { orderId: params.id },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('Audit log error:', err));

    return NextResponse.json({
      success: true,
      message: 'Webhook notification resent',
      orderId: params.id,
      ...response,
    });
  } catch (error) {
    console.error('Notify order error:', error);
    return NextResponse.json(
      { error: 'Failed to resend notification' },
      { status: 500 }
    );
  }
}
