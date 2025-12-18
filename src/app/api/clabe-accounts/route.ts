import { NextRequest, NextResponse } from 'next/server';
import { getAllClabeAccounts, getClabeAccountsByCompanyId, createClabeAccount, getClabeAccountByClabe, getCompanyById, getUserById } from '@/lib/db';
import { validateClabe } from '@/lib/utils';

// Helper to get current user from request headers
async function getCurrentUser(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return null;
  return await getUserById(userId);
}

// GET /api/clabe-accounts - List CLABE accounts (with optional companyId filter)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    let dbClabeAccounts;

    if (companyId) {
      dbClabeAccounts = await getClabeAccountsByCompanyId(companyId);
    } else {
      dbClabeAccounts = await getAllClabeAccounts();
    }

    // Transform to frontend format
    const clabeAccounts = dbClabeAccounts.map((ca) => ({
      id: ca.id,
      companyId: ca.company_id,
      clabe: ca.clabe,
      alias: ca.alias,
      description: ca.description,
      isActive: ca.is_active,
      isMain: ca.is_main,
      createdAt: new Date(ca.created_at).getTime(),
      updatedAt: new Date(ca.updated_at).getTime(),
    }));

    return NextResponse.json(clabeAccounts);
  } catch (error) {
    console.error('Get CLABE accounts error:', error);
    return NextResponse.json(
      { error: 'Error al obtener cuentas CLABE' },
      { status: 500 }
    );
  }
}

// POST /api/clabe-accounts - Create new CLABE account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, clabe, alias, description, isActive, isMain } = body;

    // Get current user for authorization
    const currentUser = await getCurrentUser(request);

    // Validation
    if (!companyId || !clabe || !alias) {
      return NextResponse.json(
        { error: 'Empresa, CLABE y alias son requeridos' },
        { status: 400 }
      );
    }

    // Authorization: super_admin can create for any company, company_admin only for their own
    if (currentUser) {
      if (currentUser.role === 'company_admin') {
        // company_admin can only create CLABEs for their own company
        if (currentUser.company_id !== companyId) {
          return NextResponse.json(
            { error: 'Solo puedes crear cuentas CLABE para tu propia empresa' },
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

    // Validate CLABE format (18 digits)
    const clabeRegex = /^[0-9]{18}$/;
    if (!clabeRegex.test(clabe)) {
      return NextResponse.json(
        { error: 'La CLABE debe tener exactamente 18 dígitos' },
        { status: 400 }
      );
    }

    // Validate CLABE check digit
    if (!validateClabe(clabe)) {
      return NextResponse.json(
        { error: 'La CLABE tiene un dígito verificador inválido' },
        { status: 400 }
      );
    }

    // Check if company exists
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

    // Check if CLABE already exists
    const existingClabe = await getClabeAccountByClabe(clabe);
    if (existingClabe) {
      return NextResponse.json(
        { error: 'Esta cuenta CLABE ya está registrada' },
        { status: 400 }
      );
    }

    // Create CLABE account
    const dbClabeAccount = await createClabeAccount({
      id: 'clabe_' + Date.now(),
      companyId,
      clabe,
      alias,
      description,
      isActive: isActive ?? true,
      isMain: isMain ?? false,
    });

    // Return CLABE account
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

    return NextResponse.json(clabeAccount, { status: 201 });
  } catch (error) {
    console.error('Create CLABE account error:', error);
    return NextResponse.json(
      { error: 'Error al crear cuenta CLABE' },
      { status: 500 }
    );
  }
}
