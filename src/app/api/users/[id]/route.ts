import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserById, updateUser, deleteUser, getUserByEmail, getCompanyById, setUserClabeAccess, getUserClabeAccess } from '@/lib/db';
import { ALL_PERMISSIONS, Permission, UserRole } from '@/types';

// Helper to get current user from request headers
async function getCurrentUser(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return null;
  return await getUserById(userId);
}

// GET /api/users/[id] - Get single user
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get current user for authorization
    const currentUser = await getCurrentUser(request);

    const dbUser = await getUserById(params.id);

    if (!dbUser) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Authorization: company_admin can only view users from their company
    if (currentUser && currentUser.role === 'company_admin') {
      if (dbUser.company_id !== currentUser.company_id) {
        return NextResponse.json(
          { error: 'No tienes permiso para ver este usuario' },
          { status: 403 }
        );
      }
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

    // Get current user for authorization
    const currentUser = await getCurrentUser(request);

    // Check if user exists
    const existingUser = await getUserById(params.id);
    if (!existingUser) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Authorization: company_admin can only update users from their company
    if (currentUser && currentUser.role === 'company_admin') {
      // Cannot update users from other companies
      if (existingUser.company_id !== currentUser.company_id) {
        return NextResponse.json(
          { error: 'No tienes permiso para modificar usuarios de otra empresa' },
          { status: 403 }
        );
      }
      // Cannot change user's company
      if (companyId && companyId !== currentUser.company_id) {
        return NextResponse.json(
          { error: 'No puedes mover usuarios a otra empresa' },
          { status: 403 }
        );
      }
      // Cannot promote to super_admin
      if (role === 'super_admin') {
        return NextResponse.json(
          { error: 'No tienes permiso para crear super administradores' },
          { status: 403 }
        );
      }
      // Cannot modify super_admin users
      if (existingUser.role === 'super_admin') {
        return NextResponse.json(
          { error: 'No tienes permiso para modificar super administradores' },
          { status: 403 }
        );
      }
    } else if (currentUser && currentUser.role === 'user') {
      // Regular users can only update themselves
      if (params.id !== currentUser.id) {
        return NextResponse.json(
          { error: 'No tienes permiso para modificar otros usuarios' },
          { status: 403 }
        );
      }
      // Cannot change their own role or company
      if (role || companyId) {
        return NextResponse.json(
          { error: 'No tienes permiso para cambiar tu rol o empresa' },
          { status: 403 }
        );
      }
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
    // Get current user for authorization
    const currentUser = await getCurrentUser(request);

    // Check if user exists
    const existingUser = await getUserById(params.id);
    if (!existingUser) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Authorization: company_admin can only delete users from their company
    if (currentUser && currentUser.role === 'company_admin') {
      // Cannot delete users from other companies
      if (existingUser.company_id !== currentUser.company_id) {
        return NextResponse.json(
          { error: 'No tienes permiso para eliminar usuarios de otra empresa' },
          { status: 403 }
        );
      }
      // Cannot delete super_admin
      if (existingUser.role === 'super_admin') {
        return NextResponse.json(
          { error: 'No tienes permiso para eliminar super administradores' },
          { status: 403 }
        );
      }
      // Cannot delete themselves (for safety)
      if (existingUser.id === currentUser.id) {
        return NextResponse.json(
          { error: 'No puedes eliminarte a ti mismo' },
          { status: 400 }
        );
      }
    } else if (currentUser && currentUser.role === 'user') {
      // Regular users cannot delete anyone
      return NextResponse.json(
        { error: 'No tienes permiso para eliminar usuarios' },
        { status: 403 }
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
