import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserById, disableTotp, isUserTotpEnabled, createAuditLogEntry, getUserTotpSecret } from '@/lib/db';
import { getClientIP, getUserAgent, verifyTOTP } from '@/lib/security';
import { authenticateRequest } from '@/lib/auth-middleware';
import crypto from 'crypto';

/**
 * POST /api/auth/2fa/disable
 * Disable 2FA for a user
 *
 * SECURITY: Requires authentication + password verification + CURRENT TOTP CODE
 * This ensures an attacker with stolen password cannot disable 2FA remotely
 */
export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);
  const userAgent = getUserAgent(request);

  try {
    // SECURITY FIX: Require authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }

    const { password, totpCode } = await request.json();

    // SECURITY FIX: User can only disable their own 2FA
    const userId = authResult.user.id;

    if (!password) {
      return NextResponse.json(
        { error: 'Se requiere contraseña' },
        { status: 400 }
      );
    }

    // SECURITY: Require TOTP code to disable 2FA
    // This prevents attackers with stolen passwords from disabling 2FA remotely
    if (!totpCode) {
      return NextResponse.json(
        { error: 'Se requiere código 2FA para deshabilitar la autenticación de dos factores' },
        { status: 400 }
      );
    }

    // Get full user data (with password hash) from database
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Verify password before allowing 2FA disable
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      await createAuditLogEntry({
        id: `audit_${crypto.randomUUID()}`,
        action: 'SUSPICIOUS_ACTIVITY',
        userId,
        userEmail: user.email,
        ipAddress: clientIP,
        userAgent,
        details: { reason: 'Failed password verification when disabling 2FA' },
        severity: 'warning',
      });

      return NextResponse.json(
        { error: 'Contraseña incorrecta' },
        { status: 401 }
      );
    }

    // Check if 2FA is actually enabled
    const totpEnabled = await isUserTotpEnabled(userId);
    if (!totpEnabled) {
      return NextResponse.json(
        { error: '2FA no está habilitado para este usuario' },
        { status: 400 }
      );
    }

    // SECURITY: Verify TOTP code before allowing disable
    const secret = await getUserTotpSecret(userId);
    if (!secret || !verifyTOTP(secret, totpCode)) {
      await createAuditLogEntry({
        id: `audit_${crypto.randomUUID()}`,
        action: 'SUSPICIOUS_ACTIVITY',
        userId,
        userEmail: user.email,
        ipAddress: clientIP,
        userAgent,
        details: { reason: 'Failed TOTP verification when disabling 2FA' },
        severity: 'critical',
      });

      return NextResponse.json(
        { error: 'Código 2FA inválido' },
        { status: 401 }
      );
    }

    // Disable 2FA
    await disableTotp(userId);

    // Log the action
    await createAuditLogEntry({
      id: `audit_${crypto.randomUUID()}`,
      action: '2FA_DISABLED',
      userId,
      userEmail: user.email,
      ipAddress: clientIP,
      userAgent,
      severity: 'warning', // Warning because disabling 2FA reduces security
    });

    return NextResponse.json({
      success: true,
      message: '2FA deshabilitado exitosamente. Tu cuenta ahora solo requiere contraseña para iniciar sesión.',
    });
  } catch (error) {
    console.error('2FA disable error:', error);

    await createAuditLogEntry({
      id: `audit_${crypto.randomUUID()}`,
      action: 'SUSPICIOUS_ACTIVITY',
      ipAddress: clientIP,
      userAgent,
      details: { reason: '2FA disable error', error: String(error) },
      severity: 'warning',
    });

    return NextResponse.json(
      { error: 'Error al deshabilitar 2FA' },
      { status: 500 }
    );
  }
}
