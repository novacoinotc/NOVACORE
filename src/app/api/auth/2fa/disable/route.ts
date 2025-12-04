import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserById, disableTotp, isUserTotpEnabled, createAuditLogEntry } from '@/lib/db';
import { getClientIP, getUserAgent } from '@/lib/security';

/**
 * POST /api/auth/2fa/disable
 * Disable 2FA for a user
 * Requires password verification for security
 */
export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);
  const userAgent = getUserAgent(request);

  try {
    const { userId, password } = await request.json();

    if (!userId || !password) {
      return NextResponse.json(
        { error: 'Se requiere ID de usuario y contraseña' },
        { status: 400 }
      );
    }

    // Get user from database
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
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
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

    // Disable 2FA
    await disableTotp(userId);

    // Log the action
    await createAuditLogEntry({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
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
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
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
