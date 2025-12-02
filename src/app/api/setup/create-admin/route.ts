import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql, initializeDatabase, getUserByEmail, createUser } from '@/lib/db';
import { DEFAULT_ROLE_PERMISSIONS } from '@/types';

/**
 * POST /api/setup/create-admin
 *
 * One-time endpoint to create super admin user
 * Should be disabled or removed after use in production
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize database first
    await initializeDatabase();

    const email = 'direccion@novacorp.mx';
    const password = 'IssacVM98.';
    const name = 'Director General';

    // Check if user already exists
    const existingUser = await getUserByEmail(email);

    if (existingUser) {
      // Update existing user's password and ensure they're active
      const hashedPassword = await bcrypt.hash(password, 10);

      await sql`
        UPDATE users
        SET password = ${hashedPassword},
            role = 'super_admin',
            is_active = true,
            permissions = ${DEFAULT_ROLE_PERMISSIONS.super_admin},
            updated_at = CURRENT_TIMESTAMP
        WHERE email = ${email}
      `;

      return NextResponse.json({
        success: true,
        message: 'Usuario actualizado correctamente',
        email,
        action: 'updated',
      });
    }

    // Create new super admin user
    const hashedPassword = await bcrypt.hash(password, 10);
    await createUser({
      id: 'super_admin_' + Date.now(),
      email,
      password: hashedPassword,
      name,
      role: 'super_admin',
      permissions: DEFAULT_ROLE_PERMISSIONS.super_admin,
      isActive: true,
    });

    return NextResponse.json({
      success: true,
      message: 'Super admin creado correctamente',
      email,
      action: 'created',
    });

  } catch (error) {
    console.error('Error creating admin:', error);
    return NextResponse.json(
      { error: 'Error al crear admin', details: String(error) },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    endpoint: 'create-admin',
    message: 'Use POST to create super admin user',
    warning: 'This endpoint should be disabled after use',
  });
}
