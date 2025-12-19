import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getUserByEmail, updateUser, disableTotp, createAuditLogEntry } from '@/lib/db';
import { getClientIP, getUserAgent } from '@/lib/security';

// SECURITY: Bcrypt rounds for password hashing (12+ recommended for production)
const BCRYPT_ROUNDS = 12;

// Simple in-memory store for reset tokens (in production, use database or Redis)
const resetTokens = new Map<string, { email: string; expiresAt: number }>();

/**
 * Generate a cryptographically secure random 6-digit code
 * SECURITY FIX: Uses crypto.randomInt() instead of Math.random()
 */
function generateResetCode(): string {
  // crypto.randomInt generates a cryptographically secure random integer
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * POST /api/auth/reset-password
 *
 * Request password reset - generates a reset code
 * In production, this would send an email with the code
 */
export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);
  const userAgent = getUserAgent(request);

  try {
    const { email, action, resetCode, newPassword } = await request.json();

    if (action === 'request') {
      // Request a password reset
      if (!email) {
        return NextResponse.json(
          { error: 'Email es requerido' },
          { status: 400 }
        );
      }

      // Check if user exists
      const user = await getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not for security
        // But still return success to prevent email enumeration
        return NextResponse.json({
          success: true,
          message: 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña.',
        });
      }

      // Generate reset code
      const code = generateResetCode();
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

      // Store token
      resetTokens.set(code, { email, expiresAt });

      // Log the reset request
      await createAuditLogEntry({
        id: `audit_${crypto.randomUUID()}`,
        action: 'PASSWORD_RESET_REQUESTED',
        userId: user.id,
        userEmail: email,
        ipAddress: clientIP,
        userAgent,
        severity: 'info',
      });

      // In production, send email with the code
      // For now, we'll return it in the response (ONLY for development!)
      // In production, remove the resetCode from the response
      console.log(`[DEV] Password reset code for ${email}: ${code}`);

      return NextResponse.json({
        success: true,
        message: 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña.',
        // ONLY FOR DEVELOPMENT - Remove in production
        ...(process.env.NODE_ENV !== 'production' && { resetCode: code }),
      });
    }

    if (action === 'reset') {
      // Complete password reset with code
      if (!resetCode || !newPassword) {
        return NextResponse.json(
          { error: 'Código y nueva contraseña son requeridos' },
          { status: 400 }
        );
      }

      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: 'La contraseña debe tener al menos 8 caracteres' },
          { status: 400 }
        );
      }

      // Verify reset code
      const tokenData = resetTokens.get(resetCode);
      if (!tokenData) {
        return NextResponse.json(
          { error: 'Código inválido o expirado' },
          { status: 400 }
        );
      }

      if (tokenData.expiresAt < Date.now()) {
        resetTokens.delete(resetCode);
        return NextResponse.json(
          { error: 'El código ha expirado. Solicita uno nuevo.' },
          { status: 400 }
        );
      }

      // Get user
      const user = await getUserByEmail(tokenData.email);
      if (!user) {
        return NextResponse.json(
          { error: 'Usuario no encontrado' },
          { status: 404 }
        );
      }

      // Hash new password with secure bcrypt rounds
      const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

      // Update password
      await updateUser(user.id, { password: hashedPassword });

      // Disable 2FA so user can set it up again
      try {
        await disableTotp(user.id);
      } catch (e) {
        // Ignore if 2FA was not enabled
      }

      // Remove used token
      resetTokens.delete(resetCode);

      // Log the password reset
      await createAuditLogEntry({
        id: `audit_${crypto.randomUUID()}`,
        action: 'PASSWORD_RESET_COMPLETED',
        userId: user.id,
        userEmail: tokenData.email,
        ipAddress: clientIP,
        userAgent,
        details: { twoFAReset: true },
        severity: 'warning',
      });

      return NextResponse.json({
        success: true,
        message: 'Contraseña restablecida correctamente. El 2FA ha sido deshabilitado y deberás configurarlo nuevamente.',
      });
    }

    return NextResponse.json(
      { error: 'Acción no válida' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
}
