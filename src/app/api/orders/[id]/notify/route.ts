import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { notifyOrder, getOrder } from '@/lib/opm-api';
import { authenticateRequest } from '@/lib/auth-middleware';
import { createAuditLogEntry, getClabeAccountsByCompanyId } from '@/lib/db';
import { getClientIP, getUserAgent } from '@/lib/security';

/**
 * SECURITY: Validate that an order belongs to the user's company
 */
async function validateOrderAccess(
  order: any,
  userRole: string,
  userCompanyId: string | null
): Promise<boolean> {
  if (userRole === 'super_admin') return true;

  if (userRole === 'company_admin' && userCompanyId) {
    const companyClabes = await getClabeAccountsByCompanyId(userCompanyId);
    const companyClabeNumbers = companyClabes.map(c => c.clabe);

    const payerAccount = order?.payerAccount || order?.data?.payerAccount;
    const beneficiaryAccount = order?.beneficiaryAccount || order?.data?.beneficiaryAccount;

    return !!(
      (payerAccount && companyClabeNumbers.includes(payerAccount)) ||
      (beneficiaryAccount && companyClabeNumbers.includes(beneficiaryAccount))
    );
  }

  return false;
}

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

    // SECURITY FIX: Validate that the order belongs to the user's company
    const orderInfo = await getOrder(params.id, apiKey);
    const hasAccess = await validateOrderAccess(orderInfo, authResult.user.role, authResult.user.companyId);
    if (!hasAccess) {
      await createAuditLogEntry({
        id: `audit_${crypto.randomUUID()}`,
        action: 'SUSPICIOUS_ACTIVITY',
        userId: authResult.user.id,
        userEmail: authResult.user.email,
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
        details: { reason: 'Attempted to notify order from another company', orderId: params.id },
        severity: 'warning',
      });

      return NextResponse.json(
        { error: 'No tienes permiso para esta orden' },
        { status: 403 }
      );
    }

    const response = await notifyOrder(params.id, apiKey);

    // SECURITY FIX: Audit log using secure IP extraction
    await createAuditLogEntry({
      id: `audit_${crypto.randomUUID()}`,
      action: 'WEBHOOK_RESENT',
      userId: authResult.user.id,
      userEmail: authResult.user.email,
      details: { orderId: params.id },
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
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
