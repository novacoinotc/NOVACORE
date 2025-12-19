import { NextRequest, NextResponse } from 'next/server';
import { getOrder, cancelOrder, getOrderCep, notifyOrder } from '@/lib/opm-api';
import { authenticateRequest } from '@/lib/auth-middleware';
import { createAuditLogEntry } from '@/lib/db';
import { getClientIP, getUserAgent } from '@/lib/security';
import crypto from 'crypto';

/**
 * GET /api/orders/[id]
 *
 * Get a single order by ID
 *
 * SECURITY: Requires authentication. Only super_admin and company_admin can view orders.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ============================================
    // SECURITY: Authenticate user via session token
    // ============================================
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }

    const authenticatedUser = authResult.user;

    // Only super_admin and company_admin can view individual orders
    if (!['super_admin', 'company_admin'].includes(authenticatedUser.role)) {
      return NextResponse.json(
        { error: 'No tienes permiso para ver órdenes' },
        { status: 403 }
      );
    }

    const apiKey = process.env.OPM_API_KEY;
    const response = await getOrder(params.id, apiKey);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get order error:', error);
    return NextResponse.json(
      { error: 'Failed to get order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orders/[id]
 *
 * Cancel an order by ID
 *
 * SECURITY: Requires authentication. Only super_admin can cancel orders.
 * Note: Orders can only be canceled if they haven't been sent yet (status: pending)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const clientIP = getClientIP(request);
  const userAgent = getUserAgent(request);

  try {
    // ============================================
    // SECURITY: Authenticate user via session token
    // ============================================
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }

    const authenticatedUser = authResult.user;

    // Only super_admin can cancel orders (critical financial operation)
    if (authenticatedUser.role !== 'super_admin') {
      await createAuditLogEntry({
        id: `audit_${crypto.randomUUID()}`,
        action: 'SUSPICIOUS_ACTIVITY',
        userId: authenticatedUser.id,
        userEmail: authenticatedUser.email,
        ipAddress: clientIP,
        userAgent,
        details: { reason: 'Unauthorized order cancellation attempt', orderId: params.id },
        severity: 'warning',
      });

      return NextResponse.json(
        { error: 'Solo administradores pueden cancelar órdenes' },
        { status: 403 }
      );
    }

    const apiKey = process.env.OPM_API_KEY;
    const response = await cancelOrder(params.id, apiKey);

    // Log successful order cancellation
    await createAuditLogEntry({
      id: `audit_${crypto.randomUUID()}`,
      action: 'ORDER_CANCELLED',
      userId: authenticatedUser.id,
      userEmail: authenticatedUser.email,
      ipAddress: clientIP,
      userAgent,
      details: { orderId: params.id },
      severity: 'warning',
    });

    return NextResponse.json({
      success: true,
      message: 'Order canceled successfully',
      orderId: params.id,
      ...response,
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
