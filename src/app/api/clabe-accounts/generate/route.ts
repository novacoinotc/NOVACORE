import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClabeAccount, getCompanyById, getMainClabeAccount } from '@/lib/db';
import { createVirtualClabe, CreateVirtualClabeRequest } from '@/lib/opm-api';
import { authenticateRequest } from '@/lib/auth-middleware';

/**
 * POST /api/clabe-accounts/generate - Generate a new CLABE via OPM API
 *
 * This endpoint creates a virtual CLABE account through the OPM API.
 * OPM automatically generates the 18-digit CLABE number.
 *
 * Request body:
 * - companyId: string (required) - Company to associate the CLABE with
 * - alias: string (required) - Friendly name for the CLABE (e.g., "Sucursal Norte")
 * - description: string (optional) - Additional description
 * - isActive: boolean (optional) - Whether the CLABE is active (default: true)
 *
 * The company's information (RFC, name, email, etc.) will be used
 * to create the virtual account in OPM.
 */
export async function POST(request: NextRequest) {
  console.log('=== CLABE GENERATE ENDPOINT CALLED ===');
  try {
    // SECURITY FIX: Use proper authentication instead of trusting x-user-id header
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }
    const currentUser = authResult.user;
    console.log('Current user (authenticated):', { id: currentUser.id, role: currentUser.role, company_id: currentUser.companyId });

    const body = await request.json();
    console.log('Request body:', JSON.stringify(body, null, 2));
    const { companyId, alias, description, isActive } = body;

    // Validation
    if (!companyId || !alias) {
      console.log('Validation failed: missing companyId or alias');
      return NextResponse.json(
        { error: 'Empresa y alias son requeridos' },
        { status: 400 }
      );
    }

    // Authorization: super_admin can create for any company, company_admin only for their own
    console.log('Step 2: Checking authorization...');
    if (currentUser.role === 'company_admin') {
      // company_admin can only create CLABEs for their own company
      if (currentUser.companyId !== companyId) {
        console.log('Authorization failed: company_admin trying to create for different company');
        return NextResponse.json(
          { error: 'Solo puedes crear cuentas CLABE para tu propia empresa' },
          { status: 403 }
        );
      }
    } else if (currentUser.role !== 'super_admin') {
      console.log('Authorization failed: user role is', currentUser.role);
      return NextResponse.json(
        { error: 'No tienes permiso para crear cuentas CLABE' },
        { status: 403 }
      );
    }
    console.log('Authorization passed');

    // Get company information
    console.log('Step 3: Getting company by ID:', companyId);
    const company = await getCompanyById(companyId);
    console.log('Company found:', company ? { id: company.id, name: company.name, rfc: company.rfc, is_active: company.is_active } : 'null');
    if (!company) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    // Check if company is active
    if (!company.is_active) {
      console.log('Company is not active');
      return NextResponse.json(
        { error: 'No se pueden crear cuentas CLABE para empresas inactivas' },
        { status: 400 }
      );
    }

    // Check if company has a main CLABE account (concentrator)
    console.log('Step 4: Checking for main CLABE account...');
    const mainClabeAccount = await getMainClabeAccount(companyId);
    console.log('Main CLABE account:', mainClabeAccount ? { clabe: mainClabeAccount.clabe, alias: mainClabeAccount.alias } : 'null');

    if (!mainClabeAccount) {
      console.log('No main CLABE account found for company');
      return NextResponse.json(
        {
          error: 'La empresa no tiene una cuenta CLABE principal configurada',
          detail: 'Primero debes crear o marcar una cuenta CLABE como principal (concentradora) antes de generar sub-cuentas',
          hint: 'Ve a Gestión de CLABEs y marca una cuenta como principal'
        },
        { status: 400 }
      );
    }

    // Build request for OPM API
    console.log('Step 4: Building OPM request...');
    const opmRequest: CreateVirtualClabeRequest = {
      name: company.name,
      businessName: company.business_name,
      rfc: company.rfc,
      email: company.email,
      mobileNumber: company.phone?.replace(/\D/g, '') || '5555555555', // Remove non-digits
      address: company.address || 'Sin dirección registrada',
      state: 'Ciudad de México', // Default state, ideally should come from company
      alias: alias,
    };

    // Call OPM API to generate CLABE
    let generatedClabe: string;

    try {
      console.log('Calling OPM API with request:', JSON.stringify(opmRequest, null, 2));
      const opmResponse = await createVirtualClabe(opmRequest);
      console.log('OPM API response:', JSON.stringify(opmResponse, null, 2));

      // OPM virtualAccounts endpoint returns the CLABE directly in the response
      // Response format: { id, accountNumber, status, createdAt, metadata, externalId }
      // Note: Response comes directly, not wrapped in {code, data}

      // Handle both wrapped and unwrapped responses
      const responseData = opmResponse.data || opmResponse;

      // The CLABE is in the accountNumber field
      const clabeNumber = responseData.accountNumber ||
                          responseData.virtualAccountNumber ||
                          responseData.clabe;

      if (!clabeNumber) {
        return NextResponse.json(
          {
            error: 'OPM no devolvió un número de cuenta CLABE',
            detail: 'No se encontró accountNumber en la respuesta',
            opmResponse: opmResponse,
          },
          { status: 500 }
        );
      }

      generatedClabe = clabeNumber;
    } catch (opmError: any) {
      console.error('OPM API error:', opmError);
      return NextResponse.json(
        {
          error: 'Error al comunicarse con OPM API',
          detail: opmError.message || 'Error desconocido',
          stack: process.env.NODE_ENV === 'development' ? opmError.stack : undefined,
        },
        { status: 502 }
      );
    }

    // Save the generated CLABE to our database (always as sub-account, not main)
    // SECURITY FIX: Use crypto.randomUUID() for secure ID generation
    const dbClabeAccount = await createClabeAccount({
      id: `clabe_${crypto.randomUUID()}`,
      companyId,
      clabe: generatedClabe,
      alias,
      description,
      isActive: isActive ?? true,
      isMain: false, // Sub-accounts are never the main account
    });

    // Return CLABE account with reference to main account
    const clabeAccount = {
      id: dbClabeAccount.id,
      companyId: dbClabeAccount.company_id,
      clabe: dbClabeAccount.clabe,
      alias: dbClabeAccount.alias,
      description: dbClabeAccount.description,
      isActive: dbClabeAccount.is_active,
      isMain: dbClabeAccount.is_main,
      createdAt: new Date(dbClabeAccount.created_at).getTime(),
      updatedAt: new Date(dbClabeAccount.updated_at).getTime(),
      generatedViaOpm: true, // Flag to indicate this was auto-generated
      // Reference to the main/concentrator account
      mainAccount: {
        clabe: mainClabeAccount.clabe,
        alias: mainClabeAccount.alias,
      },
    };

    return NextResponse.json(clabeAccount, { status: 201 });
  } catch (error) {
    console.error('Generate CLABE account error:', error);
    return NextResponse.json(
      { error: 'Error al generar cuenta CLABE' },
      { status: 500 }
    );
  }
}
