import { NextRequest, NextResponse } from 'next/server';
import { getClabeAccountById, updateClabeAccount, deleteClabeAccount, getCompanyById } from '@/lib/db';
import { authenticateRequest, validateClabeAccess } from '@/lib/auth-middleware';

// GET /api/clabe-accounts/[id] - Get single CLABE account
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const dbClabeAccount = await getClabeAccountById(params.id);

    if (!dbClabeAccount) {
      return NextResponse.json(
        { error: 'Cuenta CLABE no encontrada' },
        { status: 404 }
      );
    }

    // SECURITY FIX: Validate user has access to this CLABE account
    const hasAccess = await validateClabeAccess(
      currentUser.id,
      params.id,
      currentUser.role
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'No tienes permiso para ver esta cuenta CLABE' },
        { status: 403 }
      );
    }

    // Get company info
    let company = null;
    if (dbClabeAccount.company_id) {
      const dbCompany = await getCompanyById(dbClabeAccount.company_id);
      if (dbCompany) {
        company = {
          id: dbCompany.id,
          name: dbCompany.name,
          businessName: dbCompany.business_name,
          rfc: dbCompany.rfc,
        };
      }
    }

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
      company,
    };

    return NextResponse.json(clabeAccount);
  } catch (error) {
    console.error('Get CLABE account error:', error);
    return NextResponse.json(
      { error: 'Error al obtener cuenta CLABE' },
      { status: 500 }
    );
  }
}

// PUT /api/clabe-accounts/[id] - Update CLABE account
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const body = await request.json();
    const { alias, description, isActive, isMain } = body;

    // Check if CLABE account exists
    const existingClabeAccount = await getClabeAccountById(params.id);
    if (!existingClabeAccount) {
      return NextResponse.json(
        { error: 'Cuenta CLABE no encontrada' },
        { status: 404 }
      );
    }

    // Authorization: super_admin can update any CLABE, company_admin only their own company's
    if (currentUser.role === 'company_admin') {
      // company_admin can only update CLABEs for their own company
      if (currentUser.companyId !== existingClabeAccount.company_id) {
        return NextResponse.json(
          { error: 'Solo puedes actualizar cuentas CLABE de tu propia empresa' },
          { status: 403 }
        );
      }
    } else if (currentUser.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'No tienes permiso para actualizar cuentas CLABE' },
        { status: 403 }
      );
    }

    // Note: CLABE number and companyId cannot be changed once created

    const dbClabeAccount = await updateClabeAccount(params.id, {
      alias,
      description,
      isActive,
      isMain,
    });

    if (!dbClabeAccount) {
      return NextResponse.json(
        { error: 'Error al actualizar cuenta CLABE' },
        { status: 500 }
      );
    }

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
    };

    return NextResponse.json(clabeAccount);
  } catch (error) {
    console.error('Update CLABE account error:', error);
    return NextResponse.json(
      { error: 'Error al actualizar cuenta CLABE' },
      { status: 500 }
    );
  }
}

// DELETE /api/clabe-accounts/[id] - Delete CLABE account
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Check if CLABE account exists
    const existingClabeAccount = await getClabeAccountById(params.id);
    if (!existingClabeAccount) {
      return NextResponse.json(
        { error: 'Cuenta CLABE no encontrada' },
        { status: 404 }
      );
    }

    // Authorization: only super_admin can delete CLABE accounts
    if (currentUser.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'No tienes permiso para eliminar cuentas CLABE' },
        { status: 403 }
      );
    }

    // Note: This will also cascade delete user_clabe_access entries

    await deleteClabeAccount(params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete CLABE account error:', error);
    return NextResponse.json(
      { error: 'Error al eliminar cuenta CLABE' },
      { status: 500 }
    );
  }
}
