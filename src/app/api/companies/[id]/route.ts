import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById, updateCompany, deleteCompany, getCompanyByRfc, getCompanyWithDetails, getTransactionsByCompanyId } from '@/lib/db';
import { getBankName } from '@/lib/banks';
import { authenticateRequest } from '@/lib/auth-middleware';

// GET /api/companies/[id] - Get single company with optional details
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

    const { searchParams } = new URL(request.url);
    const includeDetails = searchParams.get('details') === 'true';

    // Authorization: super_admin can view any company, company_admin can view their own
    if (currentUser.role !== 'super_admin') {
      if (currentUser.role === 'company_admin' && currentUser.companyId === params.id) {
        // company_admin can view their own company
      } else {
        return NextResponse.json(
          { error: 'No tienes permiso para ver esta empresa' },
          { status: 403 }
        );
      }
    }

    if (includeDetails) {
      // Get company with all details (users, CLABE accounts, stats)
      const details = await getCompanyWithDetails(params.id);

      if (!details) {
        return NextResponse.json(
          { error: 'Empresa no encontrada' },
          { status: 404 }
        );
      }

      // Get transactions for this company
      const { transactions: recentTransactions, total: transactionCount } = await getTransactionsByCompanyId(params.id, { itemsPerPage: 20 });

      const company = {
        id: details.company.id,
        name: details.company.name,
        businessName: details.company.business_name,
        rfc: details.company.rfc,
        email: details.company.email,
        phone: details.company.phone,
        address: details.company.address,
        isActive: details.company.is_active,
        speiInEnabled: details.company.spei_in_enabled,
        speiOutEnabled: details.company.spei_out_enabled,
        commissionPercentage: parseFloat(details.company.commission_percentage?.toString() || '0'),
        parentClabe: details.company.parent_clabe,
        createdAt: new Date(details.company.created_at).getTime(),
        updatedAt: new Date(details.company.updated_at).getTime(),
      };

      const users = details.users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        isActive: u.isActive,
        lastLogin: u.lastLogin ? new Date(u.lastLogin).getTime() : null,
        createdAt: u.createdAt ? new Date(u.createdAt).getTime() : Date.now(),
      }));

      // Users with their CLABE access
      const usersWithClabeAccess = details.usersWithClabeAccess.map((item) => ({
        user: {
          id: item.user.id,
          email: item.user.email,
          name: item.user.name,
          role: item.user.role,
          isActive: item.user.isActive,
          lastLogin: item.user.lastLogin ? new Date(item.user.lastLogin).getTime() : null,
          createdAt: item.user.createdAt ? new Date(item.user.createdAt).getTime() : Date.now(),
        },
        clabeAccounts: item.clabeAccounts.map((c) => ({
          id: c.id,
          clabe: c.clabe,
          alias: c.alias,
        })),
      }));

      const clabeAccounts = details.clabeAccounts.map((c) => ({
        id: c.id,
        clabe: c.clabe,
        alias: c.alias,
        description: c.description,
        isActive: c.is_active,
        createdAt: new Date(c.created_at).getTime(),
      }));

      const transactions = recentTransactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: parseFloat(tx.amount?.toString() || '0'),
        status: tx.status,
        beneficiaryName: tx.beneficiary_name,
        payerName: tx.payer_name,
        concept: tx.concept,
        trackingKey: tx.tracking_key,
        date: new Date(tx.created_at),
        bank: tx.type === 'incoming'
          ? getBankName(tx.payer_bank || '')
          : getBankName(tx.beneficiary_bank || ''),
      }));

      return NextResponse.json({
        company,
        users,
        usersWithClabeAccess,
        clabeAccounts,
        transactions,
        stats: {
          ...details.stats,
          transactionCount,
        },
      });
    }

    // Basic company info only
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
      speiInEnabled: dbCompany.spei_in_enabled,
      speiOutEnabled: dbCompany.spei_out_enabled,
      commissionPercentage: parseFloat(dbCompany.commission_percentage?.toString() || '0'),
      parentClabe: dbCompany.parent_clabe,
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
    const { name, businessName, rfc, email, phone, address, isActive, speiInEnabled, speiOutEnabled, commissionPercentage, parentClabe } = body;

    // Authorization: only super_admin can modify companies
    if (currentUser.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'No tienes permiso para modificar empresas' },
        { status: 403 }
      );
    }

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

    // Validate commission percentage
    if (commissionPercentage !== undefined && (commissionPercentage < 0 || commissionPercentage > 100)) {
      return NextResponse.json(
        { error: 'El porcentaje de comisión debe estar entre 0 y 100' },
        { status: 400 }
      );
    }

    const dbCompany = await updateCompany(params.id, {
      name,
      businessName,
      rfc: rfc?.toUpperCase(),
      email,
      phone,
      address,
      isActive,
      speiInEnabled,
      speiOutEnabled,
      commissionPercentage,
      parentClabe,
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
      speiInEnabled: dbCompany.spei_in_enabled,
      speiOutEnabled: dbCompany.spei_out_enabled,
      commissionPercentage: parseFloat(dbCompany.commission_percentage?.toString() || '0'),
      parentClabe: dbCompany.parent_clabe,
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
    // SECURITY FIX: Use proper authentication instead of trusting x-user-id header
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }
    const currentUser = authResult.user;

    // Authorization: only super_admin can delete companies
    if (currentUser.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'No tienes permiso para eliminar empresas' },
        { status: 403 }
      );
    }

    // Check if company exists
    const existingCompany = await getCompanyById(params.id);
    if (!existingCompany) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    // Note: Users no longer have company_id, so we don't check for associated users

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
