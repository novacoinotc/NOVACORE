import { NextRequest, NextResponse } from 'next/server';
import { createClient, listClients, createVirtualClabe, CreateVirtualClabeRequest } from '@/lib/opm-api';
import { Client } from '@/types';

/**
 * GET /api/clients
 *
 * List OPM indirect participant clients (virtual CLABE accounts)
 *
 * Query parameters:
 * - virtualAccountNumber: Filter by CLABE number
 * - rfc: Filter by RFC
 * - curp: Filter by CURP
 * - page: Page number
 * - itemsPerPage: Items per page
 * - status: Filter by status (ACTIVE, INACTIVE, BLOCKED, CANCELED)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const params: Record<string, string | number | undefined> = {};

    const virtualAccountNumber = searchParams.get('virtualAccountNumber');
    if (virtualAccountNumber) params.virtualAccountNumber = virtualAccountNumber;

    const rfc = searchParams.get('rfc');
    if (rfc) params.rfc = rfc;

    const curp = searchParams.get('curp');
    if (curp) params.curp = curp;

    const page = searchParams.get('page');
    if (page) params.page = parseInt(page);

    const itemsPerPage = searchParams.get('itemsPerPage');
    if (itemsPerPage) params.itemsPerPage = parseInt(itemsPerPage);

    const status = searchParams.get('status');
    if (status) params.status = status;

    const apiKey = process.env.OPM_API_KEY;
    const response = await listClients(params as any, apiKey);

    return NextResponse.json(response);
  } catch (error) {
    console.error('List clients error:', error);
    return NextResponse.json(
      { error: 'Failed to list clients', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients
 *
 * Create a new OPM indirect participant client (virtual CLABE account)
 *
 * If virtualAccountNumber is not provided, OPM will auto-generate a CLABE.
 *
 * Required fields:
 * - name: Client name
 * - rfc: RFC (tax ID)
 * - curp: CURP
 * - address: Full address
 * - email: Contact email
 * - mobileNumber: Contact phone (10 digits)
 * - birthDate: Birth date (YYYY-MM-DD)
 * - gender: 'M' or 'F'
 * - state: Mexican state
 * - country: Country code
 * - nationality: Nationality
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if this is a simplified request (for virtual CLABE generation)
    if (body.simplified === true) {
      // Use the simplified createVirtualClabe function
      const clabeRequest: CreateVirtualClabeRequest = {
        name: body.name,
        lastName: body.lastName,
        secondLastName: body.secondLastName,
        businessName: body.businessName,
        commercialActivity: body.commercialActivity,
        rfc: body.rfc,
        curp: body.curp,
        address: body.address,
        email: body.email,
        mobileNumber: body.mobileNumber,
        birthDate: body.birthDate,
        gender: body.gender,
        state: body.state,
        country: body.country,
        nationality: body.nationality,
        alias: body.alias,
      };

      // Validate required fields for simplified request
      if (!clabeRequest.name || !clabeRequest.rfc || !clabeRequest.email || !clabeRequest.address || !clabeRequest.state) {
        return NextResponse.json(
          {
            error: 'Missing required fields for simplified client creation',
            requiredFields: ['name', 'rfc', 'email', 'address', 'state'],
          },
          { status: 400 }
        );
      }

      const apiKey = process.env.OPM_API_KEY;
      const response = await createVirtualClabe(clabeRequest, apiKey);

      return NextResponse.json(response, { status: 201 });
    }

    // Full client creation
    const clientData: Client = body;

    // Validate required fields
    const requiredFields = ['name', 'rfc', 'curp', 'address', 'email', 'mobileNumber', 'birthDate', 'gender', 'state', 'country', 'nationality'];
    const missingFields = requiredFields.filter((field) => !clientData[field as keyof Client]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          missingFields,
        },
        { status: 400 }
      );
    }

    // Set default status if not provided
    if (!clientData.status) {
      clientData.status = 'ACTIVE';
    }

    const apiKey = process.env.OPM_API_KEY;
    const response = await createClient(clientData, apiKey);

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Create client error:', error);
    return NextResponse.json(
      { error: 'Failed to create client', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
