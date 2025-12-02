import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { DEFAULT_ROLE_PERMISSIONS } from '@/types';

/**
 * POST /api/setup/create-admin
 *
 * One-time endpoint to create super admin user
 * Database uses camelCase columns (Prisma schema)
 */
export async function POST(request: NextRequest) {
  try {
    const email = 'direccion@novacorp.mx';
    const password = 'IssacVM98.';
    const name = 'Director General';
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = 'super_admin_' + Date.now();
    const permissions = DEFAULT_ROLE_PERMISSIONS.super_admin;
    const now = new Date();

    // Check if user already exists
    const existingUsers = await sql`
      SELECT id, email FROM users WHERE email = ${email}
    `;

    if (existingUsers.length > 0) {
      // Update existing user - using camelCase column names
      await sql`
        UPDATE users
        SET password = ${hashedPassword},
            role = 'super_admin',
            permissions = ${permissions},
            "isActive" = true,
            "updatedAt" = ${now}
        WHERE email = ${email}
      `;

      return NextResponse.json({
        success: true,
        message: 'Usuario actualizado correctamente',
        email,
        action: 'updated',
      });
    }

    // Create new super admin user - using camelCase column names
    await sql`
      INSERT INTO users (id, email, password, name, role, permissions, "isActive", "createdAt", "updatedAt")
      VALUES (${userId}, ${email}, ${hashedPassword}, ${name}, 'super_admin', ${permissions}, true, ${now}, ${now})
    `;

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

// Health check and schema info
export async function GET() {
  try {
    // Get table columns to help debug
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `;

    return NextResponse.json({
      endpoint: 'create-admin',
      message: 'Use POST to create super admin user',
      warning: 'This endpoint should be disabled after use',
      schema: columns,
    });
  } catch (error) {
    return NextResponse.json({
      endpoint: 'create-admin',
      message: 'Use POST to create super admin user',
      error: String(error),
    });
  }
}
