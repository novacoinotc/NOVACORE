import { NextRequest, NextResponse } from 'next/server';
import { getUserById, saveTotpSecret, isUserTotpEnabled, createAuditLogEntry } from '@/lib/db';
import { generateTOTPSecret, generateTOTPUri, getClientIP, getUserAgent } from '@/lib/security';
import { authenticateRequest } from '@/lib/auth-middleware';
import crypto from 'crypto';

/**
 * POST /api/auth/2fa/setup
 * Generate a new TOTP secret and QR code URI for 2FA setup
 * SECURITY: Requires authentication - user can only setup 2FA for themselves
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

    // SECURITY FIX: User can only setup 2FA for themselves
    const userId = authResult.user.id;
    const user = authResult.user;

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

    // SECURITY FIX: Use crypto.randomUUID() instead of Math.random()
    await createAuditLogEntry({
      id: `audit_${crypto.randomUUID()}`,
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
      id: `audit_${crypto.randomUUID()}`,
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
