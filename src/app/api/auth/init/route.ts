import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { initializeDatabase, getUserByEmail, createUser, sql, initializeSecurityTables } from '@/lib/db';
import { DEFAULT_ROLE_PERMISSIONS } from '@/types';

// SECURITY: Bcrypt rounds for password hashing (12+ recommended for production)
const BCRYPT_ROUNDS = 12;

// SECURITY: Allowed column definitions for DDL operations
// Only these exact column names and types are allowed to prevent SQL injection
const ALLOWED_SECURITY_COLUMNS: Record<string, string> = {
  'failed_attempts': 'INTEGER DEFAULT 0',
  'locked_until': 'TIMESTAMP',
  'totp_secret': 'TEXT',
  'totp_enabled': 'BOOLEAN DEFAULT false',
  'totp_verified_at': 'TIMESTAMP',
};

// Ensure security columns exist in users table
async function ensureSecurityColumns() {
  // SECURITY FIX: Use validated column names from whitelist instead of dynamic interpolation
  for (const [colName, colType] of Object.entries(ALLOWED_SECURITY_COLUMNS)) {
    try {
      // The column names come from a hardcoded whitelist, so this is safe
      // We use sql.unsafe only for DDL which cannot use parameterized queries
      await sql`${sql.unsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${colName} ${colType}`)}`;
      console.log(`Column ${colName} ensured`);
    } catch (error: any) {
      // Column might already exist or other error
      if (!error.message?.includes('already exists')) {
        console.error(`Error adding column ${colName}:`, error.message);
      }
    }
  }
}

/**
 * POST /api/auth/init
 *
 * SECURITY CRITICAL: This endpoint initializes the database and creates the super admin.
 *
 * Protection layers:
 * 1. BLOCKED in production by default (requires ENABLE_DB_INIT=true)
 * 2. Requires one-time INIT_TOKEN secret in X-Init-Token header
 * 3. All access attempts are logged
 *
 * For production deployments:
 * - Prefer running initialization via deploy scripts, NOT via this endpoint
 * - If using this endpoint, set INIT_TOKEN to a strong random value
 * - After initialization, remove ENABLE_DB_INIT and INIT_TOKEN from environment
 */
export async function POST(request: NextRequest) {
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  console.log('=== DATABASE INIT ATTEMPT ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Client IP:', clientIP);
  console.log('User-Agent:', request.headers.get('user-agent') || 'unknown');

  try {
    // ============================================
    // SECURITY LAYER 1: Block in production by default
    // ============================================
    const isProduction = process.env.NODE_ENV === 'production';
    const initEnabled = process.env.ENABLE_DB_INIT === 'true';

    if (isProduction && !initEnabled) {
      console.error('SECURITY: Init endpoint blocked in production (ENABLE_DB_INIT not set)');
      return NextResponse.json(
        {
          error: 'Este endpoint está deshabilitado en producción',
          hint: 'Para operaciones de inicialización, use scripts de deploy o configure ENABLE_DB_INIT=true temporalmente'
        },
        { status: 403 }
      );
    }

    // ============================================
    // SECURITY LAYER 2: Require one-time init token
    // ============================================
    const expectedToken = process.env.INIT_TOKEN;
    const providedToken = request.headers.get('X-Init-Token');

    // INIT_TOKEN is required in production, optional in development
    if (isProduction || expectedToken) {
      if (!expectedToken) {
        console.error('SECURITY: INIT_TOKEN environment variable not configured');
        return NextResponse.json(
          {
            error: 'Configuración de seguridad incompleta',
            hint: 'Configure INIT_TOKEN en las variables de entorno'
          },
          { status: 500 }
        );
      }

      if (!providedToken) {
        console.error('SECURITY: Init attempt without token from IP:', clientIP);
        return NextResponse.json(
          { error: 'Se requiere token de inicialización en header X-Init-Token' },
          { status: 401 }
        );
      }

      // Timing-safe comparison to prevent timing attacks
      const expectedBuffer = Buffer.from(expectedToken);
      const providedBuffer = Buffer.from(providedToken);

      if (expectedBuffer.length !== providedBuffer.length ||
          !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
        console.error('SECURITY: Invalid init token from IP:', clientIP);
        return NextResponse.json(
          { error: 'Token de inicialización inválido' },
          { status: 401 }
        );
      }

      console.log('SECURITY: Valid init token provided');
    }

    // ============================================
    // PROCEED WITH INITIALIZATION
    // ============================================
    console.log('Proceeding with database initialization...');

    // Initialize database tables
    await initializeDatabase();

    // Ensure security columns exist (run separately to ensure they're added)
    await ensureSecurityColumns();
    console.log('Security columns migration completed');

    // SECURITY FIX: Initialize security tables (processed_webhooks, transaction_state_log)
    // These are critical for webhook idempotency and transaction state auditing
    await initializeSecurityTables();
    console.log('Security tables initialized (processed_webhooks, transaction_state_log)');

    // Check if super admin exists
    const existingSuperAdmin = await getUserByEmail('admin@novacorp.mx');

    if (!existingSuperAdmin) {
      // SECURITY: Get initial admin password from environment variable
      // NEVER use hardcoded passwords in production
      const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;

      if (!initialPassword) {
        console.error('INITIAL_ADMIN_PASSWORD environment variable is required for first-time setup');
        return NextResponse.json({
          success: false,
          error: 'Configuración incompleta: INITIAL_ADMIN_PASSWORD no está configurado',
          hint: 'Configure la variable de entorno INITIAL_ADMIN_PASSWORD antes de inicializar',
        }, { status: 500 });
      }

      if (initialPassword.length < 12) {
        console.error('INITIAL_ADMIN_PASSWORD must be at least 12 characters');
        return NextResponse.json({
          success: false,
          error: 'La contraseña inicial del administrador debe tener al menos 12 caracteres',
        }, { status: 400 });
      }

      // Create super admin user with secure bcrypt hashing
      const hashedPassword = await bcrypt.hash(initialPassword, BCRYPT_ROUNDS);
      await createUser({
        id: `super_admin_${crypto.randomUUID()}`,
        email: 'admin@novacorp.mx',
        password: hashedPassword,
        name: 'Super Administrador',
        role: 'super_admin',
        permissions: DEFAULT_ROLE_PERMISSIONS.super_admin,
        isActive: true,
      });
      console.log('Super admin user created with secure password');
    }

    // Note: Companies, company admins, and regular users should be created
    // by the super admin through the application interface.

    console.log('=== DATABASE INIT COMPLETED SUCCESSFULLY ===');

    return NextResponse.json({
      success: true,
      message: 'Base de datos inicializada correctamente',
      warning: isProduction
        ? 'IMPORTANTE: Elimine ENABLE_DB_INIT e INIT_TOKEN del entorno después de la inicialización'
        : undefined,
    });
  } catch (error) {
    console.error('=== DATABASE INIT ERROR ===');
    console.error('Error:', error);

    return NextResponse.json(
      { error: 'Error al inicializar la base de datos' },
      { status: 500 }
    );
  }
}
