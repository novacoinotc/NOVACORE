import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserById, updateUser, deleteUser, getUserByEmail, setUserClabeAccess, getUserClabeAccess } from '@/lib/db';
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

    // Authorization: only super_admin can view other users
    if (currentUser && currentUser.role !== 'super_admin' && currentUser.id !== params.id) {
      return NextResponse.json(
        { error: 'No tienes permiso para ver este usuario' },
        { status: 403 }
      );
    }

    // Get CLABE account access
    const clabeAccountIds = await getUserClabeAccess(dbUser.id);

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
      isActive: dbUser.isActive,
      createdAt: dbUser.createdAt ? new Date(dbUser.createdAt).getTime() : Date.now(),
      updatedAt: dbUser.updatedAt ? new Date(dbUser.updatedAt).getTime() : Date.now(),
      lastLogin: dbUser.lastLogin ? new Date(dbUser.lastLogin).getTime() : undefined,
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

    // Authorization: only super_admin can update other users
    if (currentUser && currentUser.role !== 'super_admin') {
      // Regular users can only update themselves
      if (params.id !== currentUser.id) {
        return NextResponse.json(
          { error: 'No tienes permiso para modificar otros usuarios' },
          { status: 403 }
        );
      }
      // Cannot change their own role
      if (role) {
        return NextResponse.json(
          { error: 'No tienes permiso para cambiar tu rol' },
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
      isActive: dbUser.isActive,
      createdAt: dbUser.createdAt ? new Date(dbUser.createdAt).getTime() : Date.now(),
      updatedAt: dbUser.updatedAt ? new Date(dbUser.updatedAt).getTime() : Date.now(),
      lastLogin: dbUser.lastLogin ? new Date(dbUser.lastLogin).getTime() : undefined,
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

    // Authorization: only super_admin can delete users
    if (currentUser && currentUser.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'No tienes permiso para eliminar usuarios' },
        { status: 403 }
      );
    }

    // Cannot delete yourself
    if (currentUser && existingUser.id === currentUser.id) {
      return NextResponse.json(
        { error: 'No puedes eliminarte a ti mismo' },
        { status: 400 }
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
