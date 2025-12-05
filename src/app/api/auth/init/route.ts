import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { initializeDatabase, getUserByEmail, createUser, sql } from '@/lib/db';
import { DEFAULT_ROLE_PERMISSIONS } from '@/types';

// Ensure security columns exist in users table
async function ensureSecurityColumns() {
  const columns = [
    { name: 'failed_attempts', type: 'INTEGER DEFAULT 0' },
    { name: 'locked_until', type: 'TIMESTAMP' },
    { name: 'totp_secret', type: 'TEXT' },
    { name: 'totp_enabled', type: 'BOOLEAN DEFAULT false' },
    { name: 'totp_verified_at', type: 'TIMESTAMP' },
  ];

  for (const col of columns) {
    try {
      await sql`${sql.unsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`)}`;
      console.log(`Column ${col.name} ensured`);
    } catch (error: any) {
      // Column might already exist or other error
      if (!error.message?.includes('already exists')) {
        console.error(`Error adding column ${col.name}:`, error.message);
      }
    }
  }
}

export async function POST() {
  try {
    // Initialize database tables
    await initializeDatabase();

    // Ensure security columns exist (run separately to ensure they're added)
    await ensureSecurityColumns();
    console.log('Security columns migration completed');

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
