import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAllClabeAccounts, getClabeAccountsByCompanyId, createClabeAccount, getClabeAccountByClabe, getCompanyById, getClabeAccountsForUser, DbClabeAccount } from '@/lib/db';
import { validateClabe } from '@/lib/utils';
import { authenticateRequest } from '@/lib/auth-middleware';

// GET /api/clabe-accounts - List CLABE accounts (filtered by user access)
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    let dbClabeAccounts: DbClabeAccount[] = [];

    if (currentUser.role === 'super_admin') {
      // Super admin sees all CLABE accounts
      if (companyId) {
        dbClabeAccounts = await getClabeAccountsByCompanyId(companyId);
      } else {
        dbClabeAccounts = await getAllClabeAccounts();
      }
    } else if (currentUser.role === 'company_admin' && currentUser.company_id) {
      // Company admin sees all CLABEs from their company
      dbClabeAccounts = await getClabeAccountsByCompanyId(currentUser.company_id);
    } else {
      // Regular user sees only assigned CLABEs
      dbClabeAccounts = await getClabeAccountsForUser(currentUser.id);
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
    const { companyId, clabe, alias, description, isActive, isMain } = body;

    // Validation
    if (!companyId || !clabe || !alias) {
      return NextResponse.json(
        { error: 'Empresa, CLABE y alias son requeridos' },
        { status: 400 }
      );
    }

    // Authorization: super_admin can create for any company, company_admin only for their own
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

    // Create CLABE account - SECURITY FIX: Use crypto.randomUUID() for secure ID generation
    const dbClabeAccount = await createClabeAccount({
      id: `clabe_${crypto.randomUUID()}`,
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
