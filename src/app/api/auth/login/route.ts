import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  getUserByEmail,
  updateLastLogin,
  getClabeAccountsForUser,
  getAllClabeAccounts,
  recordFailedLoginAttempt,
  lockUserAccount,
  resetFailedLoginAttempts,
  getUserSecurityStatus,
  getUserTotpSecret,
  createAuditLogEntry,
} from '@/lib/db';
import { ALL_PERMISSIONS, Permission, UserRole } from '@/types';
import {
  checkRateLimit,
  recordFailedAttempt,
  clearRateLimit,
  shouldLockAccount,
  calculateLockoutTime,
  verifyTOTP,
  getClientIP,
  getUserAgent,
} from '@/lib/security';

const LOCKOUT_THRESHOLD = 5;

// SECURITY: Generate dummy hash at startup for timing attack prevention
// Uses cryptographically random bytes - no hardcoded strings
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);
  const userAgent = getUserAgent(request);

  try {
    // Check rate limit first (by IP)
    const rateLimitCheck = checkRateLimit(clientIP);
    if (!rateLimitCheck.allowed) {
      // Log suspicious activity
      await createAuditLogEntry({
        id: `audit_${crypto.randomUUID()}`,
        action: 'SUSPICIOUS_ACTIVITY',
        ipAddress: clientIP,
        userAgent,
        details: { reason: 'Rate limit exceeded', attempts: LOCKOUT_THRESHOLD },
        severity: 'warning',
      });

      return NextResponse.json(
        {
          error: rateLimitCheck.message,
          retryAfter: Math.ceil((rateLimitCheck.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitCheck.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    const { email, password, totpCode } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      );
    }

    // Get user from database
    const dbUser = await getUserByEmail(email);

    // SECURITY: Always perform password comparison to prevent timing attacks
    // If user doesn't exist, compare against module-level dummy hash to maintain constant time
    if (!dbUser) {
      // Perform a dummy bcrypt comparison to prevent timing attacks
      // This ensures the response time is the same whether user exists or not
      await bcrypt.compare(password, DUMMY_HASH);

      // Record failed attempt for rate limiting (by IP)
      recordFailedAttempt(clientIP);

      // Log failed login attempt
      await createAuditLogEntry({
        id: `audit_${crypto.randomUUID()}`,
        action: 'LOGIN_FAILED',
        userEmail: email,
        ipAddress: clientIP,
        userAgent,
        details: { reason: 'User not found' },
        severity: 'info',
      });

      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!dbUser.isActive) {
      await createAuditLogEntry({
        id: `audit_${crypto.randomUUID()}`,
        action: 'LOGIN_FAILED',
        userId: dbUser.id,
        userEmail: email,
        ipAddress: clientIP,
        userAgent,
        details: { reason: 'Account disabled' },
        severity: 'warning',
      });

      return NextResponse.json(
        { error: 'Usuario desactivado' },
        { status: 401 }
      );
    }

    // Check account lockout status
    const securityStatus = await getUserSecurityStatus(dbUser.id);
    const lockStatus = shouldLockAccount(securityStatus.failedAttempts, securityStatus.lockedUntil);

    if (lockStatus.isLocked) {
      await createAuditLogEntry({
        id: `audit_${crypto.randomUUID()}`,
        action: 'LOGIN_FAILED',
        userId: dbUser.id,
        userEmail: email,
        ipAddress: clientIP,
        userAgent,
        details: { reason: 'Account locked', remainingLockTime: lockStatus.remainingLockTime },
        severity: 'warning',
      });

      return NextResponse.json(
        { error: lockStatus.message },
        { status: 423 } // Locked status code
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, dbUser.password);

    if (!isValidPassword) {
      // Record failed attempt
      recordFailedAttempt(clientIP);
      const { failedAttempts } = await recordFailedLoginAttempt(dbUser.id);

      // Check if should lock account
      if (failedAttempts >= LOCKOUT_THRESHOLD) {
        const lockUntil = calculateLockoutTime();
        await lockUserAccount(dbUser.id, lockUntil);

        await createAuditLogEntry({
          id: `audit_${crypto.randomUUID()}`,
          action: 'ACCOUNT_LOCKED',
          userId: dbUser.id,
          userEmail: email,
          ipAddress: clientIP,
          userAgent,
          details: { failedAttempts, lockedUntil: lockUntil.toISOString() },
          severity: 'critical',
        });

        return NextResponse.json(
          { error: 'Cuenta bloqueada por demasiados intentos fallidos. Intenta en 30 minutos.' },
          { status: 423 }
        );
      }

      await createAuditLogEntry({
        id: `audit_${crypto.randomUUID()}`,
        action: 'LOGIN_FAILED',
        userId: dbUser.id,
        userEmail: email,
        ipAddress: clientIP,
        userAgent,
        details: { reason: 'Invalid password', failedAttempts },
        severity: 'info',
      });

      return NextResponse.json(
        {
          error: 'Credenciales inválidas',
          remainingAttempts: LOCKOUT_THRESHOLD - failedAttempts,
        },
        { status: 401 }
      );
    }

    // Check if 2FA is enabled
    if (securityStatus.totpEnabled) {
      if (!totpCode) {
        // Password correct, but 2FA code required
        return NextResponse.json(
          {
            error: 'Se requiere código de autenticación',
            requires2FA: true,
          },
          { status: 401 }
        );
      }

      // Verify TOTP code
      const secret = await getUserTotpSecret(dbUser.id);
      if (!secret || !verifyTOTP(secret, totpCode)) {
        recordFailedAttempt(clientIP);
        await recordFailedLoginAttempt(dbUser.id);

        await createAuditLogEntry({
          id: `audit_${crypto.randomUUID()}`,
          action: '2FA_FAILED',
          userId: dbUser.id,
          userEmail: email,
          ipAddress: clientIP,
          userAgent,
          details: { reason: 'Invalid TOTP code' },
          severity: 'warning',
        });

        return NextResponse.json(
          { error: 'Código de autenticación inválido', requires2FA: true },
          { status: 401 }
        );
      }

      // Log successful 2FA verification
      await createAuditLogEntry({
        id: `audit_${crypto.randomUUID()}`,
        action: '2FA_VERIFIED',
        userId: dbUser.id,
        userEmail: email,
        ipAddress: clientIP,
        userAgent,
        severity: 'info',
      });
    }

    // Login successful - reset failed attempts and rate limit
    await resetFailedLoginAttempts(dbUser.id);
    clearRateLimit(clientIP);

    // Update last login
    await updateLastLogin(dbUser.id);

    // Log successful login
    await createAuditLogEntry({
      id: `audit_${crypto.randomUUID()}`,
      action: 'LOGIN_SUCCESS',
      userId: dbUser.id,
      userEmail: email,
      ipAddress: clientIP,
      userAgent,
      severity: 'info',
    });

    // Get CLABE accounts based on role
    let clabeAccounts: any[] = [];
    let clabeAccountIds: string[] = [];

    try {
      if (dbUser.role === 'super_admin') {
        // Super admin has access to all CLABE accounts
        const dbClabeAccounts = await getAllClabeAccounts();
        clabeAccounts = dbClabeAccounts.map(ca => ({
          id: ca.id,
          companyId: ca.company_id,
          clabe: ca.clabe,
          alias: ca.alias,
          description: ca.description,
          isActive: ca.is_active,
          createdAt: new Date(ca.created_at).getTime(),
          updatedAt: new Date(ca.updated_at).getTime(),
        }));
        clabeAccountIds = clabeAccounts.map(ca => ca.id);
      } else {
        // Regular user has access only to assigned CLABE accounts
        const dbClabeAccounts = await getClabeAccountsForUser(dbUser.id);
        clabeAccounts = dbClabeAccounts.map(ca => ({
          id: ca.id,
          companyId: ca.company_id,
          clabe: ca.clabe,
          alias: ca.alias,
          description: ca.description,
          isActive: ca.is_active,
          createdAt: new Date(ca.created_at).getTime(),
          updatedAt: new Date(ca.updated_at).getTime(),
        }));
        clabeAccountIds = clabeAccounts.map(ca => ca.id);
      }
    } catch (e) {
      // CLABE tables might not exist yet
      console.log('Could not fetch CLABE accounts:', e);
    }

    // Create session token
    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    const sessionId = `session_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;

    // Save session to database for server-side validation
    try {
      const { createSession, deleteExpiredSessions } = await import('@/lib/db');
      await createSession({
        id: sessionId,
        userId: dbUser.id,
        token: token,
        expiresAt: new Date(expiresAt),
      });

      // SECURITY FIX: Probabilistic cleanup of expired sessions (1% chance)
      // This prevents session table bloat without adding overhead to every login
      if (Math.random() < 0.01) {
        deleteExpiredSessions().catch(e => console.error('Session cleanup failed:', e));
      }
    } catch (sessionError) {
      console.error('Failed to create session:', sessionError);
      // Continue anyway - session validation will fail but user can retry
    }

    // Determine permissions based on role
    const role = dbUser.role as UserRole;
    let permissions: Permission[];

    if (role === 'super_admin') {
      permissions = Object.keys(ALL_PERMISSIONS) as Permission[];
    } else {
      permissions = dbUser.permissions as Permission[];
    }

    // Return user data (without password)
    const user = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: role,
      companyId: dbUser.company_id, // Include companyId for company_admin users
      permissions: permissions,
      clabeAccountIds: clabeAccountIds,
      isActive: dbUser.isActive,
      totpEnabled: securityStatus.totpEnabled,
      createdAt: dbUser.createdAt ? new Date(dbUser.createdAt).getTime() : Date.now(),
      updatedAt: dbUser.updatedAt ? new Date(dbUser.updatedAt).getTime() : Date.now(),
      lastLogin: Date.now(),
      clabeAccounts: clabeAccounts,
    };

    // Check if user needs to setup 2FA (required for security)
    const requiresTotpSetup = !securityStatus.totpEnabled;

    // SECURITY FIX: Create response with httpOnly secure cookie
    // SECURITY: Token is NOT included in JSON response - only sent via httpOnly cookie
    // This prevents XSS attacks from stealing the session token
    const response = NextResponse.json({
      user,
      expiresAt,
      requiresTotpSetup, // Frontend should redirect to 2FA setup if true
    });

    // Set httpOnly secure cookie for session token
    response.cookies.set({
      name: 'novacorp_token',
      value: token,
      httpOnly: true,           // Prevent XSS access to cookie
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict',       // Prevent CSRF
      maxAge: 24 * 60 * 60,     // 24 hours (matches session expiry)
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);

    await createAuditLogEntry({
      id: `audit_${crypto.randomUUID()}`,
      action: 'LOGIN_FAILED',
      ipAddress: clientIP,
      userAgent,
      details: { reason: 'Internal error', error: String(error) },
      severity: 'critical',
    });

    return NextResponse.json(
      { error: 'Error al iniciar sesión' },
      { status: 500 }
    );
  }
}
