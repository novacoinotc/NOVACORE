import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByEmail, updateLastLogin } from '@/lib/db';
import { ALL_PERMISSIONS, Permission } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      );
    }

    // Get user from database
    const dbUser = await getUserByEmail(email);

    if (!dbUser) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!dbUser.is_active) {
      return NextResponse.json(
        { error: 'Usuario desactivado' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, dbUser.password);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Update last login
    await updateLastLogin(dbUser.id);

    // Create session token
    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // Return user data (without password)
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
      lastLogin: Date.now(),
    };

    return NextResponse.json({
      user,
      token,
      expiresAt,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Error al iniciar sesión' },
      { status: 500 }
    );
  }
}
