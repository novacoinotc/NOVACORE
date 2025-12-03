import { NextRequest, NextResponse } from 'next/server';
import { getUserById, saveTotpSecret, isUserTotpEnabled, createAuditLogEntry } from '@/lib/db';
import { generateTOTPSecret, generateTOTPUri, getClientIP, getUserAgent } from '@/lib/security';

/**
 * POST /api/auth/2fa/setup
 * Generate a new TOTP secret and QR code URI for 2FA setup
 * Requires authenticated user (userId in body)
 */
export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);
  const userAgent = getUserAgent(request);

  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'Se requiere ID de usuario' },
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

    // Check if 2FA is already enabled
    const totpEnabled = await isUserTotpEnabled(userId);
    if (totpEnabled) {
      return NextResponse.json(
        { error: '2FA ya está habilitado para este usuario' },
        { status: 400 }
      );
    }

    // Generate new TOTP secret
    const secret = generateTOTPSecret();

    // Generate QR code URI (compatible with Google Authenticator)
    const qrCodeUri = generateTOTPUri(secret, user.email, 'NOVACORP');

    // Save the secret (but don't enable 2FA yet - that happens after verification)
    await saveTotpSecret(userId, secret);

    // Log the setup attempt
    await createAuditLogEntry({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      action: '2FA_SETUP_INITIATED',
      userId,
      userEmail: user.email,
      ipAddress: clientIP,
      userAgent,
      severity: 'info',
    });

    return NextResponse.json({
      success: true,
      secret,
      qrCodeUri,
      message: 'Escanea el código QR con Google Authenticator y luego verifica con el código generado',
    });
  } catch (error) {
    console.error('2FA setup error:', error);

    await createAuditLogEntry({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      action: 'SUSPICIOUS_ACTIVITY',
      ipAddress: clientIP,
      userAgent,
      details: { reason: '2FA setup error', error: String(error) },
      severity: 'warning',
    });

    return NextResponse.json(
      { error: 'Error al configurar 2FA' },
      { status: 500 }
    );
  }
}
