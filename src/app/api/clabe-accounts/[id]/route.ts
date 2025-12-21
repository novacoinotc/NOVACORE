import { NextRequest, NextResponse } from 'next/server';
import { getClabeAccountById, updateClabeAccount, deleteClabeAccount, getCompanyById, getClabeAccountBalance } from '@/lib/db';
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
      currentUser.role,
      currentUser.companyId
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

// DELETE /api/clabe-accounts/[id] - Soft delete (deactivate) CLABE account
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

    // SECURITY: Check if account has balance before allowing deletion
    const balance = await getClabeAccountBalance(params.id);
    if (balance.availableBalance > 0 || balance.inTransit > 0) {
      return NextResponse.json(
        {
          error: 'No se puede eliminar una cuenta con saldo. Transfiere el saldo a otra cuenta primero.',
          balance: {
            available: balance.availableBalance,
            inTransit: balance.inTransit
          }
        },
        { status: 400 }
      );
    }

    // SOFT DELETE: Instead of hard delete, just deactivate the account
    // This preserves transaction history and allows restoration if needed
    const deactivatedAccount = await updateClabeAccount(params.id, {
      isActive: false,
    });

    if (!deactivatedAccount) {
      return NextResponse.json(
        { error: 'Error al desactivar cuenta CLABE' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Cuenta CLABE desactivada. Puede ser restaurada por un administrador.',
      canRestore: true
    });
  } catch (error) {
    console.error('Delete CLABE account error:', error);
    return NextResponse.json(
      { error: 'Error al eliminar cuenta CLABE' },
      { status: 500 }
    );
  }
}

// POST /api/clabe-accounts/[id] - Restore (reactivate) CLABE account
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }
    const currentUser = authResult.user;

    const body = await request.json();
    const { action } = body;

    // Only handle restore action
    if (action !== 'restore') {
      return NextResponse.json(
        { error: 'Acción no válida' },
        { status: 400 }
      );
    }

    // Check if CLABE account exists
    const existingClabeAccount = await getClabeAccountById(params.id);
    if (!existingClabeAccount) {
      return NextResponse.json(
        { error: 'Cuenta CLABE no encontrada' },
        { status: 404 }
      );
    }

    // Authorization: only super_admin can restore CLABE accounts
    if (currentUser.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'No tienes permiso para restaurar cuentas CLABE' },
        { status: 403 }
      );
    }

    // Check if account is already active
    if (existingClabeAccount.is_active) {
      return NextResponse.json(
        { error: 'La cuenta CLABE ya está activa' },
        { status: 400 }
      );
    }

    // Restore the account
    const restoredAccount = await updateClabeAccount(params.id, {
      isActive: true,
    });

    if (!restoredAccount) {
      return NextResponse.json(
        { error: 'Error al restaurar cuenta CLABE' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Cuenta CLABE restaurada exitosamente',
      clabeAccount: {
        id: restoredAccount.id,
        clabe: restoredAccount.clabe,
        alias: restoredAccount.alias,
        isActive: restoredAccount.is_active,
      }
    });
  } catch (error) {
    console.error('Restore CLABE account error:', error);
    return NextResponse.json(
      { error: 'Error al restaurar cuenta CLABE' },
      { status: 500 }
    );
  }
}
