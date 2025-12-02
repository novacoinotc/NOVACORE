import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { initializeDatabase, getUserByEmail, createUser } from '@/lib/db';
import { DEFAULT_ROLE_PERMISSIONS } from '@/types';

export async function POST() {
  try {
    // Initialize database tables
    await initializeDatabase();

    // Check if super admin exists
    const existingSuperAdmin = await getUserByEmail('admin@novacorp.mx');

    if (!existingSuperAdmin) {
      // Create super admin user (no company association)
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await createUser({
        id: 'super_admin_' + Date.now(),
        email: 'admin@novacorp.mx',
        password: hashedPassword,
        name: 'Super Administrador',
        role: 'super_admin',
        permissions: DEFAULT_ROLE_PERMISSIONS.super_admin,
        isActive: true,
      });
      console.log('Super admin user created');
    }

    // Note: Companies, company admins, and regular users should be created
    // by the super admin through the application interface.

    return NextResponse.json({
      success: true,
      message: 'Base de datos inicializada correctamente',
    });
  } catch (error) {
    console.error('Init error:', error);
    return NextResponse.json(
      { error: 'Error al inicializar la base de datos', details: String(error) },
      { status: 500 }
    );
  }
}
