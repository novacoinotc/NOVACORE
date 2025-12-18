import { NextRequest, NextResponse } from 'next/server';
import { getClabeAccountById, updateClabeAccount, deleteClabeAccount, getCompanyById, getUserById } from '@/lib/db';

// Helper to get current user from request headers
async function getCurrentUser(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return null;
  return await getUserById(userId);
}

// GET /api/clabe-accounts/[id] - Get single CLABE account
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const dbClabeAccount = await getClabeAccountById(params.id);

    if (!dbClabeAccount) {
      return NextResponse.json(
        { error: 'Cuenta CLABE no encontrada' },
        { status: 404 }
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
    const body = await request.json();
    const { alias, description, isActive, isMain } = body;

    // Get current user for authorization
    const currentUser = await getCurrentUser(request);

    // Check if CLABE account exists
    const existingClabeAccount = await getClabeAccountById(params.id);
    if (!existingClabeAccount) {
      return NextResponse.json(
        { error: 'Cuenta CLABE no encontrada' },
        { status: 404 }
      );
    }

    // Authorization: only super_admin can update CLABE accounts
    if (currentUser && currentUser.role !== 'super_admin') {
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
    // Get current user for authorization
    const currentUser = await getCurrentUser(request);

    // Check if CLABE account exists
    const existingClabeAccount = await getClabeAccountById(params.id);
    if (!existingClabeAccount) {
      return NextResponse.json(
        { error: 'Cuenta CLABE no encontrada' },
        { status: 404 }
      );
    }

    // Authorization: only super_admin can delete CLABE accounts
    if (currentUser && currentUser.role !== 'super_admin') {
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
