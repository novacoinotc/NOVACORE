import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserById, updateUser, deleteUser, getUserByEmail } from '@/lib/db';
import { ALL_PERMISSIONS, Permission } from '@/types';

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

    const user = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role as 'admin' | 'user',
      permissions: dbUser.role === 'admin'
        ? Object.keys(ALL_PERMISSIONS) as Permission[]
        : dbUser.permissions as Permission[],
      isActive: dbUser.is_active,
      createdAt: new Date(dbUser.created_at).getTime(),
      updatedAt: new Date(dbUser.updated_at).getTime(),
      lastLogin: dbUser.last_login ? new Date(dbUser.last_login).getTime() : undefined,
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
    const { email, password, name, role, permissions, isActive } = body;

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

    // Prepare updates
    const updates: Parameters<typeof updateUser>[1] = {};

    if (email) updates.email = email;
    if (name) updates.name = name;
    if (role) updates.role = role;
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

    const user = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role as 'admin' | 'user',
      permissions: dbUser.role === 'admin'
        ? Object.keys(ALL_PERMISSIONS) as Permission[]
        : dbUser.permissions as Permission[],
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
