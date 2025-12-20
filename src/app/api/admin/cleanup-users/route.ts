import { NextRequest, NextResponse } from 'next/server';
import { getAllUsers, deleteUser } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';

/**
 * POST /api/admin/cleanup-users
 *
 * Delete all users except super_admin users
 * This is a dangerous operation and should only be used for initial setup
 *
 * Authorization: Requires super_admin role
 */
export async function POST(request: NextRequest) {
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

    if (currentUser.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Solo super_admin puede ejecutar esta operación' },
        { status: 403 }
      );
    }

    // Get all users
    const allUsers = await getAllUsers();

    // Filter users to delete (all except super_admin)
    const usersToDelete = allUsers.filter(user => user.role !== 'super_admin');

    if (usersToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay usuarios para eliminar',
        deletedCount: 0,
        remainingUsers: allUsers.length,
      });
    }

    // Delete each user
    const deletedIds: string[] = [];
    const errors: string[] = [];

    for (const user of usersToDelete) {
      try {
        await deleteUser(user.id);
        deletedIds.push(user.id);
        console.log(`Deleted user: ${user.email} (${user.id})`);
      } catch (error) {
        const errorMsg = `Failed to delete user ${user.email}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    // Get remaining users
    const remainingUsers = await getAllUsers();

    return NextResponse.json({
      success: errors.length === 0,
      message: `Eliminados ${deletedIds.length} usuarios`,
      deletedCount: deletedIds.length,
      remainingUsers: remainingUsers.length,
      remainingSuperAdmins: remainingUsers.filter(u => u.role === 'super_admin').map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
      })),
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Cleanup users error:', error);
    return NextResponse.json(
      {
        error: 'Error al limpiar usuarios',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/cleanup-users
 *
 * Preview which users would be deleted
 */
export async function GET(request: NextRequest) {
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

    if (currentUser.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Solo super_admin puede ver esta información' },
        { status: 403 }
      );
    }

    // Get all users
    const allUsers = await getAllUsers();

    // Group users by role
    const superAdmins = allUsers.filter(u => u.role === 'super_admin');
    const companyAdmins = allUsers.filter(u => u.role === 'company_admin');
    const regularUsers = allUsers.filter(u => u.role === 'user');

    return NextResponse.json({
      totalUsers: allUsers.length,
      superAdmins: {
        count: superAdmins.length,
        willBeDeleted: false,
        users: superAdmins.map(u => ({ id: u.id, email: u.email, name: u.name })),
      },
      companyAdmins: {
        count: companyAdmins.length,
        willBeDeleted: true,
        users: companyAdmins.map(u => ({ id: u.id, email: u.email, name: u.name })),
      },
      regularUsers: {
        count: regularUsers.length,
        willBeDeleted: true,
        users: regularUsers.map(u => ({ id: u.id, email: u.email, name: u.name })),
      },
      usersToDelete: companyAdmins.length + regularUsers.length,
      usersToKeep: superAdmins.length,
    });
  } catch (error) {
    console.error('Preview cleanup error:', error);
    return NextResponse.json(
      { error: 'Error al obtener información de usuarios' },
      { status: 500 }
    );
  }
}
