import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  getUserByEmail,
  updateUser,
  disableTotp,
  createAuditLogEntry,
  createPasswordResetToken,
  validateAndConsumeResetToken,
  isKillSwitchEnabled,
} from '@/lib/db';
import { getClientIP, getUserAgent } from '@/lib/security';

// SECURITY: Bcrypt rounds for password hashing (12+ recommended for production)
const BCRYPT_ROUNDS = 12;

/**
 * Generate a cryptographically secure reset token
 * SECURITY FIX: Uses 32-byte hex token instead of 6-digit code
 * 6-digit codes can be brute-forced in ~500,000 attempts max
 * 32-byte hex = 256 bits of entropy = computationally infeasible to brute force
 */
function generateResetCode(): string {
  // Generate 32 bytes of random data and convert to hex string
  // This gives us 64 characters of hex = 256 bits of entropy
  return crypto.randomBytes(32).toString('hex');
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

  // SECURITY: Check kill switch
  if (isKillSwitchEnabled('PASSWORD_RESET')) {
    return NextResponse.json(
      { error: 'El restablecimiento de contraseña está temporalmente deshabilitado' },
      { status: 503 }
    );
  }

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

      // SECURITY FIX: Store token in database, not in memory
      // Token is hashed before storage for security
      await createPasswordResetToken(email, code, clientIP);

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

      // SECURITY FIX: Enhanced password complexity requirements
      if (newPassword.length < 12) {
        return NextResponse.json(
          { error: 'La contraseña debe tener al menos 12 caracteres' },
          { status: 400 }
        );
      }

      const hasUppercase = /[A-Z]/.test(newPassword);
      const hasLowercase = /[a-z]/.test(newPassword);
      const hasNumber = /\d/.test(newPassword);
      const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);

      if (!(hasUppercase && hasLowercase && hasNumber && hasSpecial)) {
        return NextResponse.json(
          { error: 'La contraseña debe contener mayúsculas, minúsculas, números y caracteres especiales' },
          { status: 400 }
        );
      }

      // SECURITY FIX: Validate and consume token atomically from database
      // This prevents race conditions and ensures token can only be used once
      const tokenEmail = await validateAndConsumeResetToken(resetCode);
      if (!tokenEmail) {
        return NextResponse.json(
          { error: 'Código inválido o expirado' },
          { status: 400 }
        );
      }

      // Get user
      const user = await getUserByEmail(tokenEmail);
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

      // Log the password reset
      await createAuditLogEntry({
        id: `audit_${crypto.randomUUID()}`,
        action: 'PASSWORD_RESET_COMPLETED',
        userId: user.id,
        userEmail: tokenEmail,
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
