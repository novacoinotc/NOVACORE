import { NextRequest, NextResponse } from 'next/server';
import { updateClient, updateClientStatus } from '@/lib/opm-api';
import { Client } from '@/types';

/**
 * PUT /api/clients/[id]
 *
 * Update an OPM indirect participant client
 *
 * Note: The client ID is the OPM-assigned ID, not the virtualAccountNumber
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const clientData: Partial<Client> = body;

    const apiKey = process.env.OPM_API_KEY;
    const response = await updateClient(params.id, clientData, apiKey);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Update client error:', error);
    return NextResponse.json(
      { error: 'Failed to update client', details: error instanceof Error ? error.message : 'Unknown error' },
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
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    return NextResponse.json(response);
  } catch (error) {
    console.error('Update client status error:', error);
    return NextResponse.json(
      { error: 'Failed to update client status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
