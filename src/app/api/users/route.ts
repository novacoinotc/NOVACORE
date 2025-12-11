import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAllUsers, createUser, getUserByEmail, setUserClabeAccess, getUserClabeAccess, getUserById } from '@/lib/db';
import { ALL_PERMISSIONS, Permission, UserRole } from '@/types';

// Helper to get current user from request headers
async function getCurrentUser(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return null;
  return await getUserById(userId);
}

// GET /api/users - List users
export async function GET(request: NextRequest) {
  try {
    // Get current user for authorization
    const currentUser = await getCurrentUser(request);

    // Only super_admin can list all users
    if (currentUser && currentUser.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'No tienes permiso para ver usuarios' },
        { status: 403 }
      );
    }

    const dbUsers = await getAllUsers();

    // Transform to frontend format (without passwords)
    const usersPromises = dbUsers.map(async (u) => {
      // Get CLABE account access for each user
      let clabeAccountIds: string[] = [];
      try {
        clabeAccountIds = await getUserClabeAccess(u.id);
      } catch (e) {
        // Table might not exist
      }

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
        isActive: u.isActive,
        createdAt: u.createdAt ? new Date(u.createdAt).getTime() : Date.now(),
        updatedAt: u.updatedAt ? new Date(u.updatedAt).getTime() : Date.now(),
        lastLogin: u.lastLogin ? new Date(u.lastLogin).getTime() : undefined,
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

    // Authorization: only super_admin can create users
    if (currentUser && currentUser.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'No tienes permiso para crear usuarios' },
        { status: 403 }
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
      role,
      companyId: companyId || null,
      permissions: permissions || [],
      isActive: isActive ?? true,
    });

    // Set CLABE account access if provided
    if (clabeAccountIds && clabeAccountIds.length > 0) {
      try {
        await setUserClabeAccess(dbUser.id, clabeAccountIds);
      } catch (e) {
        console.log('Could not set CLABE access:', e);
      }
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
      isActive: dbUser.isActive,
      createdAt: dbUser.createdAt ? new Date(dbUser.createdAt).getTime() : Date.now(),
      updatedAt: dbUser.updatedAt ? new Date(dbUser.updatedAt).getTime() : Date.now(),
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
