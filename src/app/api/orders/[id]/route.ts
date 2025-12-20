import { NextRequest, NextResponse } from 'next/server';
import { getOrder, cancelOrder, getOrderCep, notifyOrder } from '@/lib/opm-api';
import { authenticateRequest } from '@/lib/auth-middleware';
import { createAuditLogEntry, getClabeAccountsByCompanyId } from '@/lib/db';
import { getClientIP, getUserAgent } from '@/lib/security';
import crypto from 'crypto';

/**
 * SECURITY: Validate that an order belongs to the user's company
 * Checks if the payer or beneficiary account is owned by the company
 */
async function validateOrderAccess(
  order: any,
  userRole: string,
  userCompanyId: string | null
): Promise<boolean> {
  // Super admin can access all orders
  if (userRole === 'super_admin') {
    return true;
  }

  // Company admin can only access orders involving their company's CLABEs
  if (userRole === 'company_admin' && userCompanyId) {
    const companyClabes = await getClabeAccountsByCompanyId(userCompanyId);
    const companyClabeNumbers = companyClabes.map(c => c.clabe);

    // Check if payer or beneficiary account belongs to the company
    const payerAccount = order?.payerAccount || order?.data?.payerAccount;
    const beneficiaryAccount = order?.beneficiaryAccount || order?.data?.beneficiaryAccount;

    if (payerAccount && companyClabeNumbers.includes(payerAccount)) {
      return true;
    }
    if (beneficiaryAccount && companyClabeNumbers.includes(beneficiaryAccount)) {
      return true;
    }

    return false;
  }

  // Regular users cannot access orders directly (only through their assigned CLABEs)
  return false;
}

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

    // SECURITY FIX: Validate that the order belongs to the user's company
    const hasAccess = await validateOrderAccess(response, authenticatedUser.role, authenticatedUser.companyId);
    if (!hasAccess) {
      await createAuditLogEntry({
        id: `audit_${crypto.randomUUID()}`,
        action: 'SUSPICIOUS_ACTIVITY',
        userId: authenticatedUser.id,
        userEmail: authenticatedUser.email,
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
        details: { reason: 'Attempted to access order from another company', orderId: params.id },
        severity: 'warning',
      });

      return NextResponse.json(
        { error: 'No tienes permiso para ver esta orden' },
        { status: 403 }
      );
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get order error:', error);
    return NextResponse.json(
      { error: 'Failed to get order' },
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

    // SECURITY FIX: Validate super_admin has access to this order's company
    // (Extra protection even for super_admin to prevent accidental cross-company operations)
    const orderInfo = await getOrder(params.id, apiKey);
    const hasAccess = await validateOrderAccess(orderInfo, authenticatedUser.role, authenticatedUser.companyId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'No tienes permiso para cancelar esta orden' },
        { status: 403 }
      );
    }

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
      { error: 'Failed to cancel order' },
      { status: 500 }
    );
  }
}
