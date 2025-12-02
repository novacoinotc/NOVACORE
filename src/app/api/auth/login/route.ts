import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByEmail, updateLastLogin, getClabeAccountsForUser, getAllClabeAccounts } from '@/lib/db';
import { ALL_PERMISSIONS, Permission, UserRole } from '@/types';

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
    if (!dbUser.isActive) {
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

    // Get CLABE accounts based on role
    let clabeAccounts: any[] = [];
    let clabeAccountIds: string[] = [];

    try {
      if (dbUser.role === 'super_admin') {
        // Super admin has access to all CLABE accounts
        const dbClabeAccounts = await getAllClabeAccounts();
        clabeAccounts = dbClabeAccounts.map(ca => ({
          id: ca.id,
          companyId: ca.company_id,
          clabe: ca.clabe,
          alias: ca.alias,
          description: ca.description,
          isActive: ca.is_active,
          createdAt: new Date(ca.created_at).getTime(),
          updatedAt: new Date(ca.updated_at).getTime(),
        }));
        clabeAccountIds = clabeAccounts.map(ca => ca.id);
      } else {
        // Regular user has access only to assigned CLABE accounts
        const dbClabeAccounts = await getClabeAccountsForUser(dbUser.id);
        clabeAccounts = dbClabeAccounts.map(ca => ({
          id: ca.id,
          companyId: ca.company_id,
          clabe: ca.clabe,
          alias: ca.alias,
          description: ca.description,
          isActive: ca.is_active,
          createdAt: new Date(ca.created_at).getTime(),
          updatedAt: new Date(ca.updated_at).getTime(),
        }));
        clabeAccountIds = clabeAccounts.map(ca => ca.id);
      }
    } catch (e) {
      // CLABE tables might not exist yet
      console.log('Could not fetch CLABE accounts:', e);
    }

    // Create session token
    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // Determine permissions based on role
    const role = dbUser.role as UserRole;
    let permissions: Permission[];

    if (role === 'super_admin') {
      permissions = Object.keys(ALL_PERMISSIONS) as Permission[];
    } else {
      permissions = dbUser.permissions as Permission[];
    }

    // Return user data (without password)
    const user = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: role,
      permissions: permissions,
      clabeAccountIds: clabeAccountIds,
      isActive: dbUser.isActive,
      createdAt: dbUser.createdAt ? new Date(dbUser.createdAt).getTime() : Date.now(),
      updatedAt: dbUser.updatedAt ? new Date(dbUser.updatedAt).getTime() : Date.now(),
      lastLogin: Date.now(),
      clabeAccounts: clabeAccounts,
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
