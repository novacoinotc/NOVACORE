import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserById, updateUser, deleteUser, getUserByEmail, getCompanyById, setUserClabeAccess, getUserClabeAccess } from '@/lib/db';
import { ALL_PERMISSIONS, Permission, UserRole } from '@/types';

// GET /api/users/[id] - Get single user
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const dbUser = await getUserById(params.id);

    if (!dbUser) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Get CLABE account access
    const clabeAccountIds = await getUserClabeAccess(dbUser.id);

    // Get company info if user has a company
    let company = null;
    if (dbUser.company_id) {
      const dbCompany = await getCompanyById(dbUser.company_id);
      if (dbCompany) {
        company = {
          id: dbCompany.id,
          name: dbCompany.name,
          businessName: dbCompany.business_name,
          rfc: dbCompany.rfc,
        };
      }
    }

    const user = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role as UserRole,
      companyId: dbUser.company_id,
      permissions: dbUser.role === 'super_admin'
        ? Object.keys(ALL_PERMISSIONS) as Permission[]
        : dbUser.permissions as Permission[],
      clabeAccountIds,
      isActive: dbUser.is_active,
      createdAt: new Date(dbUser.created_at).getTime(),
      updatedAt: new Date(dbUser.updated_at).getTime(),
      lastLogin: dbUser.last_login ? new Date(dbUser.last_login).getTime() : undefined,
      company,
    };

    return NextResponse.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Error al obtener usuario' },
      { status: 500 }
    );
  }
}

// PUT /api/users/[id] - Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { email, password, name, role, companyId, permissions, clabeAccountIds, isActive } = body;

    // Check if user exists
    const existingUser = await getUserById(params.id);
    if (!existingUser) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Check if email is being changed to one that already exists
    if (email && email !== existingUser.email) {
      const userWithEmail = await getUserByEmail(email);
      if (userWithEmail) {
        return NextResponse.json(
          { error: 'Ya existe un usuario con este email' },
          { status: 400 }
        );
      }
    }

    // Validate role if being changed
    if (role) {
      const validRoles: UserRole[] = ['super_admin', 'company_admin', 'user'];
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: 'Rol inválido' },
          { status: 400 }
        );
      }

      // company_admin and user must have a companyId
      const effectiveCompanyId = companyId !== undefined ? companyId : existingUser.company_id;
      if ((role === 'company_admin' || role === 'user') && !effectiveCompanyId) {
        return NextResponse.json(
          { error: 'Los usuarios con rol company_admin o user deben pertenecer a una empresa' },
          { status: 400 }
        );
      }

      // super_admin should not have a companyId
      if (role === 'super_admin' && effectiveCompanyId) {
        return NextResponse.json(
          { error: 'Los super administradores no pueden pertenecer a una empresa' },
          { status: 400 }
        );
      }
    }

    // If companyId provided, verify company exists
    if (companyId) {
      const company = await getCompanyById(companyId);
      if (!company) {
        return NextResponse.json(
          { error: 'Empresa no encontrada' },
          { status: 404 }
        );
      }
    }

    // Prepare updates
    const updates: Parameters<typeof updateUser>[1] = {};

    if (email) updates.email = email;
    if (name) updates.name = name;
    if (role) updates.role = role;
    if (companyId !== undefined) updates.companyId = companyId;
    if (permissions) updates.permissions = permissions;
    if (isActive !== undefined) updates.isActive = isActive;

    // Hash new password if provided
    if (password) {
      updates.password = await bcrypt.hash(password, 10);
    }

    const dbUser = await updateUser(params.id, updates);

    if (!dbUser) {
      return NextResponse.json(
        { error: 'Error al actualizar usuario' },
        { status: 500 }
      );
    }

    // Update CLABE account access if provided
    if (clabeAccountIds !== undefined) {
      await setUserClabeAccess(dbUser.id, clabeAccountIds);
    }

    // Get updated CLABE account access
    const updatedClabeAccountIds = await getUserClabeAccess(dbUser.id);

    const user = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role as UserRole,
      companyId: dbUser.company_id,
      permissions: dbUser.role === 'super_admin'
        ? Object.keys(ALL_PERMISSIONS) as Permission[]
        : dbUser.permissions as Permission[],
      clabeAccountIds: updatedClabeAccountIds,
      isActive: dbUser.is_active,
      createdAt: new Date(dbUser.created_at).getTime(),
      updatedAt: new Date(dbUser.updated_at).getTime(),
      lastLogin: dbUser.last_login ? new Date(dbUser.last_login).getTime() : undefined,
    };

    return NextResponse.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Error al actualizar usuario' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if user exists
    const existingUser = await getUserById(params.id);
    if (!existingUser) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    await deleteUser(params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'Error al eliminar usuario' },
      { status: 500 }
    );
  }
}
