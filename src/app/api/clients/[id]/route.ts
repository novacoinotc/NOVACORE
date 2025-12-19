import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { updateClient, updateClientStatus } from '@/lib/opm-api';
import { Client } from '@/types';
import { authenticateRequest } from '@/lib/auth-middleware';
import { createAuditLogEntry } from '@/lib/db';

/**
 * PUT /api/clients/[id]
 *
 * Update an OPM indirect participant client
 *
 * Note: The client ID is the OPM-assigned ID, not the virtualAccountNumber
 *
 * SECURITY: Requires authentication and admin role
 */
export async function PUT(
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

    // SECURITY FIX: Require admin role
    if (!['super_admin', 'company_admin'].includes(authResult.user.role)) {
      return NextResponse.json(
        { error: 'No tienes permiso para actualizar clientes' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const clientData: Partial<Client> = body;

    const apiKey = process.env.OPM_API_KEY;
    const response = await updateClient(params.id, clientData, apiKey);

    // SECURITY FIX: Audit log
    await createAuditLogEntry({
      id: `audit_${crypto.randomUUID()}`,
      action: 'CLIENT_UPDATED',
      userId: authResult.user.id,
      userEmail: authResult.user.email,
      details: { clientId: params.id, changes: Object.keys(clientData) },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('Audit log error:', err));

    return NextResponse.json(response);
  } catch (error) {
    console.error('Update client error:', error);
    return NextResponse.json(
      { error: 'Failed to update client' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/clients/[id]
 *
 * Update client status only
 *
 * Request body:
 * - status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'CANCELED'
 *
 * Use this endpoint to activate, deactivate, block, or cancel a client/CLABE.
 *
 * SECURITY: Requires authentication and admin role
 */
export async function PATCH(
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

    // SECURITY FIX: Require admin role
    if (!['super_admin', 'company_admin'].includes(authResult.user.role)) {
      return NextResponse.json(
        { error: 'No tienes permiso para cambiar estado de clientes' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status } = body;

    // Validate status
    const validStatuses = ['ACTIVE', 'INACTIVE', 'BLOCKED', 'CANCELED'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        {
          error: 'Invalid status',
          validStatuses,
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPM_API_KEY;
    const response = await updateClientStatus(params.id, status, apiKey);

    // SECURITY FIX: Audit log for status change
    await createAuditLogEntry({
      id: `audit_${crypto.randomUUID()}`,
      action: 'CLIENT_STATUS_CHANGED',
      userId: authResult.user.id,
      userEmail: authResult.user.email,
      details: { clientId: params.id, newStatus: status },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      severity: 'warning',
    }).catch(err => console.error('Audit log error:', err));

    return NextResponse.json(response);
  } catch (error) {
    console.error('Update client status error:', error);
    return NextResponse.json(
      { error: 'Failed to update client status' },
      { status: 500 }
    );
  }
}
