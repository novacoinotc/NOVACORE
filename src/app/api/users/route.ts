import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAllUsers, createUser, getUserByEmail } from '@/lib/db';
import { ALL_PERMISSIONS, Permission } from '@/types';

// GET /api/users - List all users
export async function GET() {
  try {
    const dbUsers = await getAllUsers();

    // Transform to frontend format (without passwords)
    const users = dbUsers.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role as 'admin' | 'user',
      permissions: u.role === 'admin'
        ? Object.keys(ALL_PERMISSIONS) as Permission[]
        : u.permissions as Permission[],
      isActive: u.is_active,
      createdAt: new Date(u.created_at).getTime(),
      updatedAt: new Date(u.updated_at).getTime(),
      lastLogin: u.last_login ? new Date(u.last_login).getTime() : undefined,
    }));

    return NextResponse.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { error: 'Error al obtener usuarios' },
      { status: 500 }
    );
  }
}

// POST /api/users - Create new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, role, permissions, isActive } = body;

    // Validation
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, contraseña y nombre son requeridos' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'Ya existe un usuario con este email' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const dbUser = await createUser({
      id: 'user_' + Date.now(),
      email,
      password: hashedPassword,
      name,
      role: role || 'user',
      permissions: permissions || [],
      isActive: isActive ?? true,
    });

    // Return user without password
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
    };

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: 'Error al crear usuario' },
      { status: 500 }
    );
  }
}
