import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByEmail, updateLastLogin, getCompanyById, getClabeAccountsByCompanyId, getClabeAccountsForUser, getAllClabeAccounts } from '@/lib/db';
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
          email: dbCompany.email,
          phone: dbCompany.phone,
          address: dbCompany.address,
          isActive: dbCompany.is_active,
          createdAt: new Date(dbCompany.created_at).getTime(),
          updatedAt: new Date(dbCompany.updated_at).getTime(),
        };
      }
    }

    // Get CLABE accounts based on role
    let clabeAccounts: any[] = [];
    let clabeAccountIds: string[] = [];

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
    } else if (dbUser.role === 'company_admin' && dbUser.company_id) {
      // Company admin has access to all CLABE accounts in their company
      const dbClabeAccounts = await getClabeAccountsByCompanyId(dbUser.company_id);
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
      companyId: dbUser.company_id,
      permissions: permissions,
      clabeAccountIds: clabeAccountIds,
      isActive: dbUser.is_active,
      createdAt: new Date(dbUser.created_at).getTime(),
      updatedAt: new Date(dbUser.updated_at).getTime(),
      lastLogin: Date.now(),
      company: company,
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
