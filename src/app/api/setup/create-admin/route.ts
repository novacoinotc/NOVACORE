import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { DEFAULT_ROLE_PERMISSIONS } from '@/types';

/**
 * POST /api/setup/create-admin
 *
 * One-time endpoint to create super admin user
 * Should be disabled or removed after use in production
 */
export async function POST(request: NextRequest) {
  try {
    const email = 'direccion@novacorp.mx';
    const password = 'IssacVM98.';
    const name = 'Director General';
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = 'super_admin_' + Date.now();
    const permissions = DEFAULT_ROLE_PERMISSIONS.super_admin;

    // First, try to ensure the users table has all required columns
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`;
    } catch (e) {
      console.log('Could not add is_active column (may already exist or different schema)');
    }

    // Check if user already exists
    const existingUsers = await sql`
      SELECT id, email FROM users WHERE email = ${email}
    `;

    if (existingUsers.length > 0) {
      // Update existing user - use dynamic approach to handle different schemas
      try {
        // Try with is_active first
        await sql`
          UPDATE users
          SET password = ${hashedPassword},
              role = 'super_admin',
              permissions = ${permissions},
              is_active = true,
              updated_at = CURRENT_TIMESTAMP
          WHERE email = ${email}
        `;
      } catch (updateError: any) {
        // If is_active doesn't exist, try without it
        if (updateError.message?.includes('is_active')) {
          await sql`
            UPDATE users
            SET password = ${hashedPassword},
                role = 'super_admin',
                permissions = ${permissions},
                updated_at = CURRENT_TIMESTAMP
            WHERE email = ${email}
          `;
        } else {
          throw updateError;
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Usuario actualizado correctamente',
        email,
        action: 'updated',
      });
    }

    // Create new super admin user - try different column combinations
    try {
      // Try with all columns including is_active
      await sql`
        INSERT INTO users (id, email, password, name, role, permissions, is_active)
        VALUES (${userId}, ${email}, ${hashedPassword}, ${name}, 'super_admin', ${permissions}, true)
      `;
    } catch (insertError: any) {
      // If is_active doesn't exist, try without it
      if (insertError.message?.includes('is_active')) {
        await sql`
          INSERT INTO users (id, email, password, name, role, permissions)
          VALUES (${userId}, ${email}, ${hashedPassword}, ${name}, 'super_admin', ${permissions})
        `;
      } else {
        throw insertError;
      }
    }

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
      SELECT column_name, data_type
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
