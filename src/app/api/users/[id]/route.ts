import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserById, updateUser, deleteUser, getUserByEmail, setUserClabeAccess, getUserClabeAccess, invalidateAllUserSessions, createAuditLogEntry } from '@/lib/db';
import { ALL_PERMISSIONS, Permission, UserRole } from '@/types';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getClientIP, getUserAgent } from '@/lib/security';
import crypto from 'crypto';

// GET /api/users/[id] - Get single user
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // SECURITY FIX: Use proper authentication instead of trusting x-user-id header
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }
    const currentUser = authResult.user;

    const dbUser = await getUserById(params.id);

    if (!dbUser) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Authorization: super_admin can view any user, others can only view themselves
    // company_admin can also view users in their company
    if (currentUser.role !== 'super_admin') {
      if (currentUser.id !== params.id) {
        // Check if company_admin viewing user from same company
        if (currentUser.role === 'company_admin' && dbUser.company_id === currentUser.companyId) {
          // Allowed - company admin viewing user from their company
        } else {
          return NextResponse.json(
            { error: 'No tienes permiso para ver este usuario' },
            { status: 403 }
          );
        }
      }
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
    // SECURITY FIX: Use proper authentication instead of trusting x-user-id header
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }
    const currentUser = authResult.user;

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

    // Authorization: super_admin can update any user, company_admin can update users in their company
    if (currentUser.role !== 'super_admin') {
      if (currentUser.role === 'company_admin') {
        // company_admin can update users in their company
        if (existingUser.company_id !== currentUser.companyId) {
          return NextResponse.json(
            { error: 'Solo puedes modificar usuarios de tu propia empresa' },
            { status: 403 }
          );
        }
        // Cannot change user to super_admin
        if (role === 'super_admin') {
          return NextResponse.json(
            { error: 'No puedes asignar el rol super_admin' },
            { status: 403 }
          );
        }
        // Cannot change company of user
        if (companyId && companyId !== currentUser.companyId) {
          return NextResponse.json(
            { error: 'No puedes mover usuarios a otra empresa' },
            { status: 403 }
          );
        }
      } else {
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

    // Hash new password if provided - SECURITY: Use 12 rounds for production security
    if (password) {
      // SECURITY FIX: Validate password policy (same as reset-password)
      if (password.length < 12) {
        return NextResponse.json(
          { error: 'La contraseña debe tener al menos 12 caracteres' },
          { status: 400 }
        );
      }
      const hasUppercase = /[A-Z]/.test(password);
      const hasLowercase = /[a-z]/.test(password);
      const hasNumber = /\d/.test(password);
      const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
      if (!(hasUppercase && hasLowercase && hasNumber && hasSpecial)) {
        return NextResponse.json(
          { error: 'La contraseña debe incluir mayúsculas, minúsculas, números y caracteres especiales' },
          { status: 400 }
        );
      }
      updates.password = await bcrypt.hash(password, 12);
    }

    const dbUser = await updateUser(params.id, updates);

    // SECURITY FIX: Invalidate ALL sessions when password is changed
    // This ensures that if an account is compromised and password is reset,
    // the attacker's session is immediately terminated
    if (password && dbUser) {
      await invalidateAllUserSessions(params.id);

      // Audit log the password change
      await createAuditLogEntry({
        id: `audit_${crypto.randomUUID()}`,
        action: 'PASSWORD_CHANGED',
        userId: params.id,
        userEmail: dbUser.email,
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
        details: {
          changedBy: currentUser.id,
          changedByEmail: currentUser.email,
          changedByRole: currentUser.role,
          selfChange: currentUser.id === params.id,
        },
        severity: 'warning',
      });

      console.log(`SECURITY: All sessions invalidated for user ${params.id} after password change`);
    }

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
    // SECURITY FIX: Use proper authentication instead of trusting x-user-id header
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }
    const currentUser = authResult.user;

    // Check if user exists
    const existingUser = await getUserById(params.id);
    if (!existingUser) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Authorization: only super_admin can delete users
    if (currentUser.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'No tienes permiso para eliminar usuarios' },
        { status: 403 }
      );
    }

    // Cannot delete yourself
    if (existingUser.id === currentUser.id) {
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
