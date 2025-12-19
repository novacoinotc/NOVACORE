import { NextRequest, NextResponse } from 'next/server';
import { getAllCompanies, createCompany, getCompanyByRfc } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';

// GET /api/companies - List all companies (requires super_admin)
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }

    // Only super_admin can list all companies
    if (authResult.user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'No tienes permiso para ver empresas' },
        { status: 403 }
      );
    }

    const dbCompanies = await getAllCompanies();

    // Transform to frontend format
    const companies = dbCompanies.map((c) => ({
      id: c.id,
      name: c.name,
      businessName: c.business_name,
      rfc: c.rfc,
      email: c.email,
      phone: c.phone,
      address: c.address,
      isActive: c.is_active,
      speiInEnabled: c.spei_in_enabled,
      speiOutEnabled: c.spei_out_enabled,
      commissionPercentage: parseFloat(c.commission_percentage?.toString() || '0'),
      parentClabe: c.parent_clabe,
      createdAt: new Date(c.created_at).getTime(),
      updatedAt: new Date(c.updated_at).getTime(),
    }));

    return NextResponse.json(companies);
  } catch (error) {
    console.error('Get companies error:', error);
    return NextResponse.json(
      { error: 'Error al obtener empresas' },
      { status: 500 }
    );
  }
}

// POST /api/companies - Create new company (requires super_admin)
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }

    // Only super_admin can create companies
    if (authResult.user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'No tienes permiso para crear empresas' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, businessName, rfc, email, phone, address, isActive, speiInEnabled, speiOutEnabled, commissionPercentage, parentClabe } = body;

    // Validation
    if (!name || !businessName || !rfc || !email) {
      return NextResponse.json(
        { error: 'Nombre, razón social, RFC y email son requeridos' },
        { status: 400 }
      );
    }

    // Validate RFC format (basic validation for Mexican RFC)
    const rfcRegex = /^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/i;
    if (!rfcRegex.test(rfc)) {
      return NextResponse.json(
        { error: 'Formato de RFC inválido' },
        { status: 400 }
      );
    }

    // Validate commission percentage
    if (commissionPercentage !== undefined && (commissionPercentage < 0 || commissionPercentage > 100)) {
      return NextResponse.json(
        { error: 'El porcentaje de comisión debe estar entre 0 y 100' },
        { status: 400 }
      );
    }

    // Check if RFC already exists
    const existingCompany = await getCompanyByRfc(rfc.toUpperCase());
    if (existingCompany) {
      return NextResponse.json(
        { error: 'Ya existe una empresa con este RFC' },
        { status: 400 }
      );
    }

    // Create company
    const dbCompany = await createCompany({
      id: 'company_' + Date.now(),
      name,
      businessName,
      rfc: rfc.toUpperCase(),
      email,
      phone,
      address,
      isActive: isActive ?? true,
      speiInEnabled: speiInEnabled ?? true,
      speiOutEnabled: speiOutEnabled ?? true,
      commissionPercentage: commissionPercentage ?? 0,
      parentClabe: parentClabe || undefined,
    });

    // Return company
    const company = {
      id: dbCompany.id,
      name: dbCompany.name,
      businessName: dbCompany.business_name,
      rfc: dbCompany.rfc,
      email: dbCompany.email,
      phone: dbCompany.phone,
      address: dbCompany.address,
      isActive: dbCompany.is_active,
      speiInEnabled: dbCompany.spei_in_enabled,
      speiOutEnabled: dbCompany.spei_out_enabled,
      commissionPercentage: parseFloat(dbCompany.commission_percentage?.toString() || '0'),
      parentClabe: dbCompany.parent_clabe,
      createdAt: new Date(dbCompany.created_at).getTime(),
      updatedAt: new Date(dbCompany.updated_at).getTime(),
    };

    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    console.error('Create company error:', error);
    return NextResponse.json(
      { error: 'Error al crear empresa' },
      { status: 500 }
    );
  }
}
