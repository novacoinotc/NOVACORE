import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAllUsers, getUsersByCompanyId, createUser, getUserByEmail, getCompanyById, setUserClabeAccess, getUserClabeAccess, getUserById } from '@/lib/db';
import { ALL_PERMISSIONS, Permission, UserRole } from '@/types';

// Helper to get current user from request headers
async function getCurrentUser(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return null;
  return await getUserById(userId);
}

// GET /api/users - List users (with optional companyId filter)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    // Get current user for authorization
    const currentUser = await getCurrentUser(request);

    let dbUsers;

    // company_admin can only see users from their company
    if (currentUser && currentUser.role === 'company_admin') {
      if (!currentUser.company_id) {
        return NextResponse.json(
          { error: 'No tienes una empresa asignada' },
          { status: 403 }
        );
      }
      // Force filter to their company only
      dbUsers = await getUsersByCompanyId(currentUser.company_id);
    } else if (companyId) {
      dbUsers = await getUsersByCompanyId(companyId);
    } else {
      dbUsers = await getAllUsers();
    }

    // Transform to frontend format (without passwords)
    const usersPromises = dbUsers.map(async (u) => {
      // Get CLABE account access for each user
      const clabeAccountIds = await getUserClabeAccess(u.id);

      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role as UserRole,
        companyId: u.company_id,
        permissions: u.role === 'super_admin'
          ? Object.keys(ALL_PERMISSIONS) as Permission[]
          : u.permissions as Permission[],
        clabeAccountIds,
        isActive: u.is_active,
        createdAt: new Date(u.created_at).getTime(),
        updatedAt: new Date(u.updated_at).getTime(),
        lastLogin: u.last_login ? new Date(u.last_login).getTime() : undefined,
      };
    });

    const users = await Promise.all(usersPromises);

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
    const { email, password, name, role, companyId, permissions, clabeAccountIds, isActive } = body;

    // Get current user for authorization
    const currentUser = await getCurrentUser(request);

    // Validation
    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { error: 'Email, contraseña, nombre y rol son requeridos' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles: UserRole[] = ['super_admin', 'company_admin', 'user'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Rol inválido' },
        { status: 400 }
      );
    }

    // Authorization: company_admin can only create users for their own company
    if (currentUser && currentUser.role === 'company_admin') {
      // company_admin cannot create super_admin
      if (role === 'super_admin') {
        return NextResponse.json(
          { error: 'No tienes permiso para crear super administradores' },
          { status: 403 }
        );
      }
      // company_admin can only create users for their own company
      if (companyId !== currentUser.company_id) {
        return NextResponse.json(
          { error: 'Solo puedes crear usuarios para tu propia empresa' },
          { status: 403 }
        );
      }
    } else if (currentUser && currentUser.role === 'user') {
      // Regular users cannot create users
      return NextResponse.json(
        { error: 'No tienes permiso para crear usuarios' },
        { status: 403 }
      );
    }

    // company_admin and user must have a companyId
    if ((role === 'company_admin' || role === 'user') && !companyId) {
      return NextResponse.json(
        { error: 'Los usuarios con rol company_admin o user deben pertenecer a una empresa' },
        { status: 400 }
      );
    }

    // super_admin should not have a companyId
    if (role === 'super_admin' && companyId) {
      return NextResponse.json(
        { error: 'Los super administradores no pueden pertenecer a una empresa' },
        { status: 400 }
      );
    }

    // If companyId provided, verify company exists and is active
    if (companyId) {
      const company = await getCompanyById(companyId);
      if (!company) {
        return NextResponse.json(
          { error: 'Empresa no encontrada' },
          { status: 404 }
        );
      }
      if (!company.is_active) {
        return NextResponse.json(
          { error: 'No se pueden crear usuarios para empresas inactivas' },
          { status: 400 }
        );
      }
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
      role,
      companyId,
      permissions: permissions || [],
      isActive: isActive ?? true,
    });

    // Set CLABE account access if provided
    if (clabeAccountIds && clabeAccountIds.length > 0) {
      await setUserClabeAccess(dbUser.id, clabeAccountIds);
    }

    // Return user without password
    const user = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role as UserRole,
      companyId: dbUser.company_id,
      permissions: dbUser.role === 'super_admin'
        ? Object.keys(ALL_PERMISSIONS) as Permission[]
        : dbUser.permissions as Permission[],
      clabeAccountIds: clabeAccountIds || [],
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
