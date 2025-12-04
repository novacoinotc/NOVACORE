/**
 * Security utilities for NOVACORP
 *
 * Includes:
 * - Rate limiting for brute force protection
 * - Account lockout after failed attempts
 * - Audit logging
 * - 2FA TOTP validation
 */

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
 * Generate TOTP code for a given counter
 * Implementation of RFC 6238 TOTP
 */
function generateTOTPCode(secret: string, counter: number): string {
  // Decode base32 secret
  const keyBytes = base32Decode(secret);

  // Convert counter to 8-byte big-endian
  const counterBytes = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }

  // HMAC-SHA1
  const hmac = hmacSha1(keyBytes, counterBytes);

  // Dynamic truncation
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

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

/**
 * Simple HMAC-SHA1 implementation
 * Note: In production, use crypto.subtle.sign with HMAC
 */
function hmacSha1(key: Uint8Array, message: Uint8Array): Uint8Array {
  // For serverless/edge compatibility, we use a pure JS implementation
  // This is a simplified version - in production use Web Crypto API

  const blockSize = 64;
  const outputSize = 20;

  // Pad or hash key
  let keyPadded = new Uint8Array(blockSize);
  if (key.length > blockSize) {
    // Hash key if too long (simplified - should use SHA1)
    keyPadded.set(key.slice(0, blockSize));
  } else {
    keyPadded.set(key);
  }

  // XOR with pads
  const ipad = new Uint8Array(blockSize);
  const opad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    ipad[i] = keyPadded[i] ^ 0x36;
    opad[i] = keyPadded[i] ^ 0x5c;
  }

  // Inner hash: SHA1(ipad || message)
  const innerData = new Uint8Array(blockSize + message.length);
  innerData.set(ipad);
  innerData.set(message, blockSize);
  const innerHash = sha1(innerData);

  // Outer hash: SHA1(opad || innerHash)
  const outerData = new Uint8Array(blockSize + outputSize);
  outerData.set(opad);
  outerData.set(innerHash, blockSize);

  return sha1(outerData);
}

/**
 * SHA1 implementation (pure JS for edge compatibility)
 */
function sha1(message: Uint8Array): Uint8Array {
  const H = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];

  // Pre-processing
  const msgLen = message.length;
  const bitLen = msgLen * 8;

  // Padding
  const padLen = ((msgLen + 8) % 64 < 56) ?
    56 - (msgLen + 8) % 64 :
    120 - (msgLen + 8) % 64;

  const padded = new Uint8Array(msgLen + 1 + padLen + 8);
  padded.set(message);
  padded[msgLen] = 0x80;

  // Append length in bits as 64-bit big-endian
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen, false);

  // Process in 64-byte chunks
  for (let i = 0; i < padded.length; i += 64) {
    const W = new Uint32Array(80);

    // Copy chunk into first 16 words
    for (let j = 0; j < 16; j++) {
      W[j] = view.getUint32(i + j * 4, false);
    }

    // Extend to 80 words
    for (let j = 16; j < 80; j++) {
      W[j] = rotateLeft(W[j-3] ^ W[j-8] ^ W[j-14] ^ W[j-16], 1);
    }

    let [a, b, c, d, e] = H;

    for (let j = 0; j < 80; j++) {
      let f: number, k: number;

      if (j < 20) {
        f = (b & c) | ((~b) & d);
        k = 0x5A827999;
      } else if (j < 40) {
        f = b ^ c ^ d;
        k = 0x6ED9EBA1;
      } else if (j < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8F1BBCDC;
      } else {
        f = b ^ c ^ d;
        k = 0xCA62C1D6;
      }

      const temp = (rotateLeft(a, 5) + f + e + k + W[j]) >>> 0;
      e = d;
      d = c;
      c = rotateLeft(b, 30);
      b = a;
      a = temp;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
  }

  const result = new Uint8Array(20);
  const resultView = new DataView(result.buffer);
  for (let i = 0; i < 5; i++) {
    resultView.setUint32(i * 4, H[i], false);
  }

  return result;
}

function rotateLeft(n: number, s: number): number {
  return ((n << s) | (n >>> (32 - s))) >>> 0;
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
