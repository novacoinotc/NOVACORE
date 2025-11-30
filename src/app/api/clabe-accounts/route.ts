import { NextRequest, NextResponse } from 'next/server';
import { getAllClabeAccounts, getClabeAccountsByCompanyId, createClabeAccount, getClabeAccountByClabe, getCompanyById } from '@/lib/db';

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
    const { companyId, clabe, alias, description, isActive } = body;

    // Validation
    if (!companyId || !clabe || !alias) {
      return NextResponse.json(
        { error: 'Empresa, CLABE y alias son requeridos' },
        { status: 400 }
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
