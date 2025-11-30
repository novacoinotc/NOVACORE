import { NextRequest, NextResponse } from 'next/server';
import { createClabeAccount, getCompanyById, getUserById } from '@/lib/db';
import { createVirtualClabe, CreateVirtualClabeRequest } from '@/lib/opm-api';

// Helper to get current user from request headers
async function getCurrentUser(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return null;
  return await getUserById(userId);
}

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
  try {
    const body = await request.json();
    const { companyId, alias, description, isActive } = body;

    // Get current user for authorization
    const currentUser = await getCurrentUser(request);

    // Validation
    if (!companyId || !alias) {
      return NextResponse.json(
        { error: 'Empresa y alias son requeridos' },
        { status: 400 }
      );
    }

    // Authorization: company_admin can only create CLABEs for their own company
    if (currentUser) {
      if (currentUser.role === 'company_admin') {
        if (currentUser.company_id !== companyId) {
          return NextResponse.json(
            { error: 'No tienes permiso para crear cuentas CLABE para esta empresa' },
            { status: 403 }
          );
        }
      } else if (currentUser.role !== 'super_admin') {
        return NextResponse.json(
          { error: 'No tienes permiso para crear cuentas CLABE' },
          { status: 403 }
        );
      }
    }

    // Get company information
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    // Check if company is active
    if (!company.is_active) {
      return NextResponse.json(
        { error: 'No se pueden crear cuentas CLABE para empresas inactivas' },
        { status: 400 }
      );
    }

    // Build request for OPM API
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
      const opmResponse = await createVirtualClabe(opmRequest);

      if (!opmResponse.data || !opmResponse.data.virtualAccountNumber) {
        return NextResponse.json(
          { error: 'OPM no devolvió un número de cuenta CLABE' },
          { status: 500 }
        );
      }

      generatedClabe = opmResponse.data.virtualAccountNumber;
    } catch (opmError: any) {
      console.error('OPM API error:', opmError);
      return NextResponse.json(
        {
          error: 'Error al comunicarse con OPM API',
          detail: opmError.message || 'Error desconocido',
        },
        { status: 502 }
      );
    }

    // Save the generated CLABE to our database
    const dbClabeAccount = await createClabeAccount({
      id: 'clabe_' + Date.now(),
      companyId,
      clabe: generatedClabe,
      alias,
      description,
      isActive: isActive ?? true,
    });

    // Return CLABE account
    const clabeAccount = {
      id: dbClabeAccount.id,
      companyId: dbClabeAccount.company_id,
      clabe: dbClabeAccount.clabe,
      alias: dbClabeAccount.alias,
      description: dbClabeAccount.description,
      isActive: dbClabeAccount.is_active,
      createdAt: new Date(dbClabeAccount.created_at).getTime(),
      updatedAt: new Date(dbClabeAccount.updated_at).getTime(),
      generatedViaOpm: true, // Flag to indicate this was auto-generated
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
