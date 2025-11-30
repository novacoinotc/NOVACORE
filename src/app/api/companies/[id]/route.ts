import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById, updateCompany, deleteCompany, getCompanyByRfc, getUsersByCompanyId } from '@/lib/db';

// GET /api/companies/[id] - Get single company
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const dbCompany = await getCompanyById(params.id);

    if (!dbCompany) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

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

    return NextResponse.json(company);
  } catch (error) {
    console.error('Get company error:', error);
    return NextResponse.json(
      { error: 'Error al obtener empresa' },
      { status: 500 }
    );
  }
}

// PUT /api/companies/[id] - Update company
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, businessName, rfc, email, phone, address, isActive } = body;

    // Check if company exists
    const existingCompany = await getCompanyById(params.id);
    if (!existingCompany) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    // Check if RFC is being changed to one that already exists
    if (rfc && rfc.toUpperCase() !== existingCompany.rfc) {
      const companyWithRfc = await getCompanyByRfc(rfc.toUpperCase());
      if (companyWithRfc) {
        return NextResponse.json(
          { error: 'Ya existe una empresa con este RFC' },
          { status: 400 }
        );
      }
    }

    // Validate RFC format if provided
    if (rfc) {
      const rfcRegex = /^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/i;
      if (!rfcRegex.test(rfc)) {
        return NextResponse.json(
          { error: 'Formato de RFC inválido' },
          { status: 400 }
        );
      }
    }

    const dbCompany = await updateCompany(params.id, {
      name,
      businessName,
      rfc: rfc?.toUpperCase(),
      email,
      phone,
      address,
      isActive,
    });

    if (!dbCompany) {
      return NextResponse.json(
        { error: 'Error al actualizar empresa' },
        { status: 500 }
      );
    }

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

    return NextResponse.json(company);
  } catch (error) {
    console.error('Update company error:', error);
    return NextResponse.json(
      { error: 'Error al actualizar empresa' },
      { status: 500 }
    );
  }
}

// DELETE /api/companies/[id] - Delete company
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if company exists
    const existingCompany = await getCompanyById(params.id);
    if (!existingCompany) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    // Check if company has users
    const companyUsers = await getUsersByCompanyId(params.id);
    if (companyUsers.length > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar una empresa con usuarios asociados' },
        { status: 400 }
      );
    }

    await deleteCompany(params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete company error:', error);
    return NextResponse.json(
      { error: 'Error al eliminar empresa' },
      { status: 500 }
    );
  }
}
