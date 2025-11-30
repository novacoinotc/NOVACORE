import { NextRequest, NextResponse } from 'next/server';
import { getAllCompanies, createCompany, getCompanyByRfc } from '@/lib/db';

// GET /api/companies - List all companies
export async function GET() {
  try {
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

// POST /api/companies - Create new company
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, businessName, rfc, email, phone, address, isActive } = body;

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
