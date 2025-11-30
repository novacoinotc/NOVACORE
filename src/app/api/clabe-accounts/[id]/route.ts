import { NextRequest, NextResponse } from 'next/server';
import { getClabeAccountById, updateClabeAccount, deleteClabeAccount, getCompanyById } from '@/lib/db';

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
    const { alias, description, isActive } = body;

    // Check if CLABE account exists
    const existingClabeAccount = await getClabeAccountById(params.id);
    if (!existingClabeAccount) {
      return NextResponse.json(
        { error: 'Cuenta CLABE no encontrada' },
        { status: 404 }
      );
    }

    // Note: CLABE number and companyId cannot be changed once created

    const dbClabeAccount = await updateClabeAccount(params.id, {
      alias,
      description,
      isActive,
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
    // Check if CLABE account exists
    const existingClabeAccount = await getClabeAccountById(params.id);
    if (!existingClabeAccount) {
      return NextResponse.json(
        { error: 'Cuenta CLABE no encontrada' },
        { status: 404 }
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
