import { NextRequest, NextResponse } from 'next/server';
import { getUserById, getUserTotpSecret, enableTotp, createAuditLogEntry } from '@/lib/db';
import { verifyTOTP, getClientIP, getUserAgent } from '@/lib/security';

/**
 * POST /api/auth/2fa/verify
 * Verify TOTP code and enable 2FA for the user
 * This is used during initial setup to confirm the user has correctly set up their authenticator
 */
export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);
  const userAgent = getUserAgent(request);

  try {
    const { userId, code } = await request.json();

    if (!userId || !code) {
      return NextResponse.json(
        { error: 'Se requiere ID de usuario y código' },
        { status: 400 }
      );
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: 'El código debe ser de 6 dígitos' },
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

    // Get the TOTP secret (should have been saved during setup)
    const secret = await getUserTotpSecret(userId);
    if (!secret) {
      return NextResponse.json(
        { error: 'No se ha configurado 2FA. Inicia el proceso de configuración primero.' },
        { status: 400 }
      );
    }

    // Verify the code
    const isValid = verifyTOTP(secret, code);

    if (!isValid) {
      await createAuditLogEntry({
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        action: '2FA_FAILED',
        userId,
        userEmail: user.email,
        ipAddress: clientIP,
        userAgent,
        details: { reason: 'Invalid verification code during setup' },
        severity: 'warning',
      });

      return NextResponse.json(
        { error: 'Código inválido. Asegúrate de que la hora de tu dispositivo esté sincronizada.' },
        { status: 401 }
      );
    }

    // Enable 2FA for the user
    await enableTotp(userId);

    // Log successful 2FA enablement
    await createAuditLogEntry({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      action: '2FA_ENABLED',
      userId,
      userEmail: user.email,
      ipAddress: clientIP,
      userAgent,
      severity: 'info',
    });

    return NextResponse.json({
      success: true,
      message: '2FA habilitado exitosamente. A partir de ahora necesitarás el código de autenticación para iniciar sesión.',
    });
  } catch (error) {
    console.error('2FA verify error:', error);

    await createAuditLogEntry({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      action: 'SUSPICIOUS_ACTIVITY',
      ipAddress: clientIP,
      userAgent,
      details: { reason: '2FA verify error', error: String(error) },
      severity: 'warning',
    });

    return NextResponse.json(
      { error: 'Error al verificar código 2FA' },
      { status: 500 }
    );
  }
}
