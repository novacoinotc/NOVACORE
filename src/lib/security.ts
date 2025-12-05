/**
 * Security utilities for NOVACORP
 *
 * Includes:
 * - Rate limiting for brute force protection
 * - Account lockout after failed attempts
 * - Audit logging
 * - 2FA TOTP validation
 */

import { createHmac } from 'crypto';

// ==================== RATE LIMITING ====================

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
}

// In-memory store for rate limiting (use Redis in production for multi-instance)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 5;

/**
 * Check if an IP/identifier is rate limited
 * Returns { allowed: boolean, remainingAttempts: number, resetTime: number }
 */
export function checkRateLimit(identifier: string): {
  allowed: boolean;
  remainingAttempts: number;
  resetTime: number;
  message?: string;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // No previous attempts
  if (!entry) {
    return {
      allowed: true,
      remainingAttempts: RATE_LIMIT_MAX_ATTEMPTS - 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    };
  }

  // Window expired, reset
  if (now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.delete(identifier);
    return {
      allowed: true,
      remainingAttempts: RATE_LIMIT_MAX_ATTEMPTS - 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    };
  }

  // Check if limit exceeded
  if (entry.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    const resetTime = entry.firstAttempt + RATE_LIMIT_WINDOW_MS;
    const waitMinutes = Math.ceil((resetTime - now) / 60000);
    return {
      allowed: false,
      remainingAttempts: 0,
      resetTime,
      message: `Demasiados intentos. Espera ${waitMinutes} minutos.`,
    };
  }

  return {
    allowed: true,
    remainingAttempts: RATE_LIMIT_MAX_ATTEMPTS - entry.count - 1,
    resetTime: entry.firstAttempt + RATE_LIMIT_WINDOW_MS,
  };
}

/**
 * Record a failed attempt for rate limiting
 */
export function recordFailedAttempt(identifier: string): void {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(identifier, {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
    });
  } else {
    entry.count++;
    entry.lastAttempt = now;
    rateLimitStore.set(identifier, entry);
  }
}

/**
 * Clear rate limit for an identifier (e.g., after successful login)
 */
export function clearRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

// Cleanup old entries periodically (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    const entries = Array.from(rateLimitStore.entries());
    for (let i = 0; i < entries.length; i++) {
      const [key, entry] = entries[i];
      if (now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

// ==================== ACCOUNT LOCKOUT ====================

const LOCKOUT_THRESHOLD = 5; // Lock after 5 failed attempts
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes lockout

/**
 * Check if account should be locked based on failed attempts
 */
export function shouldLockAccount(failedAttempts: number, lockedUntil: Date | null): {
  isLocked: boolean;
  remainingLockTime?: number;
  message?: string;
} {
  const now = new Date();

  // Check if currently locked
  if (lockedUntil && lockedUntil > now) {
    const remainingMs = lockedUntil.getTime() - now.getTime();
    const remainingMinutes = Math.ceil(remainingMs / 60000);
    return {
      isLocked: true,
      remainingLockTime: remainingMs,
      message: `Cuenta bloqueada. Intenta en ${remainingMinutes} minutos.`,
    };
  }

  // Check if should be locked due to failed attempts
  if (failedAttempts >= LOCKOUT_THRESHOLD) {
    return {
      isLocked: true,
      message: 'Cuenta bloqueada por demasiados intentos fallidos.',
    };
  }

  return { isLocked: false };
}

/**
 * Calculate lockout end time
 */
export function calculateLockoutTime(): Date {
  return new Date(Date.now() + LOCKOUT_DURATION_MS);
}

// ==================== AUDIT LOGGING ====================

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'TRANSFER_INITIATED'
  | 'TRANSFER_COMPLETED'
  | 'TRANSFER_FAILED'
  | '2FA_SETUP_INITIATED'
  | '2FA_ENABLED'
  | '2FA_DISABLED'
  | '2FA_VERIFIED'
  | '2FA_FAILED'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_UNLOCKED'
  | 'SETTINGS_CHANGED'
  | 'API_KEY_GENERATED'
  | 'SUSPICIOUS_ACTIVITY';

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: AuditAction;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
  severity: 'info' | 'warning' | 'critical';
}

/**
 * Create an audit log entry
 * In production, this should write to a database table
 */
export async function createAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
  const logEntry: AuditLogEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    timestamp: new Date(),
    ...entry,
  };

  // Log to console (in production, save to database)
  const logPrefix = entry.severity === 'critical' ? '🚨 CRITICAL' :
                    entry.severity === 'warning' ? '⚠️ WARNING' : 'ℹ️ INFO';

  console.log(`[AUDIT] ${logPrefix} | ${entry.action} | User: ${entry.userEmail || 'anonymous'} | IP: ${entry.ipAddress || 'unknown'}`);

  if (entry.details) {
    console.log(`[AUDIT] Details:`, JSON.stringify(entry.details, null, 2));
  }

  // TODO: Save to database
  // await sql`INSERT INTO audit_logs ...`
}

// ==================== 2FA TOTP ====================

/**
 * Generate a random base32 secret for TOTP
 */
export function generateTOTPSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  const randomBytes = new Uint8Array(20);
  crypto.getRandomValues(randomBytes);

  for (let i = 0; i < 20; i++) {
    secret += chars[randomBytes[i] % 32];
  }

  return secret;
}

/**
 * Generate TOTP URI for QR code (Google Authenticator compatible)
 */
export function generateTOTPUri(secret: string, email: string, issuer: string = 'NOVACORP'): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedEmail = encodeURIComponent(email);
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Verify a TOTP code
 * Allows for 1 period before and after current time (90 second window)
 */
export function verifyTOTP(secret: string, code: string): boolean {
  const now = Math.floor(Date.now() / 1000);
  const period = 30;

  // Check current period and adjacent periods (allows for clock skew)
  for (let i = -1; i <= 1; i++) {
    const counter = Math.floor((now + i * period) / period);
    const expectedCode = generateTOTPCode(secret, counter);
    if (expectedCode === code) {
      return true;
    }
  }

  return false;
}

/**
 * Generate TOTP code for a given counter using Node.js crypto
 * Implementation of RFC 6238 TOTP
 */
function generateTOTPCode(secret: string, counter: number): string {
  // Decode base32 secret
  const keyBytes = base32Decode(secret);

  // Convert counter to 8-byte big-endian buffer
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter), 0);

  // HMAC-SHA1 using Node.js native crypto
  const hmac = createHmac('sha1', Buffer.from(keyBytes));
  hmac.update(counterBuffer);
  const hmacResult = hmac.digest();

  // Dynamic truncation
  const offset = hmacResult[hmacResult.length - 1] & 0x0f;
  const binary =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Decode base32 string to Uint8Array
 */
function base32Decode(encoded: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanedInput = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');

  const output: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of cleanedInput) {
    const index = alphabet.indexOf(char);
    if (index === -1) continue;

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Get client IP from request headers
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  return 'unknown';
}

/**
 * Get user agent from request
 */
export function getUserAgent(request: Request): string {
  return request.headers.get('user-agent') || 'unknown';
}
