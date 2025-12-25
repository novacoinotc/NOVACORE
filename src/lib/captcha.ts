/**
 * CAPTCHA Verification Module
 *
 * Supports:
 * - hCaptcha (recommended - privacy-friendly)
 * - reCAPTCHA v2/v3 (alternative)
 *
 * Usage:
 * 1. Enable after N failed login attempts
 * 2. Always require for password reset
 * 3. Optional for high-risk actions
 *
 * Configuration:
 * - HCAPTCHA_SECRET_KEY: hCaptcha secret key
 * - HCAPTCHA_SITE_KEY: hCaptcha site key (for frontend)
 * - RECAPTCHA_SECRET_KEY: reCAPTCHA secret key (alternative)
 * - CAPTCHA_PROVIDER: 'hcaptcha' | 'recaptcha' (default: hcaptcha)
 */

// CAPTCHA provider type
type CaptchaProvider = 'hcaptcha' | 'recaptcha' | 'none';

// Verification result
export interface CaptchaVerificationResult {
  success: boolean;
  provider: CaptchaProvider;
  errorCodes?: string[];
  hostname?: string;
  timestamp?: Date;
}

// Tracking failed attempts to trigger CAPTCHA
const failedAttemptsByIP = new Map<string, { count: number; lastAttempt: Date }>();
const CAPTCHA_THRESHOLD = 3; // Require CAPTCHA after 3 failed attempts
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Get the configured CAPTCHA provider
 */
export function getCaptchaProvider(): CaptchaProvider {
  const provider = process.env.CAPTCHA_PROVIDER as CaptchaProvider;

  if (provider === 'recaptcha' && process.env.RECAPTCHA_SECRET_KEY) {
    return 'recaptcha';
  }

  if (process.env.HCAPTCHA_SECRET_KEY) {
    return 'hcaptcha';
  }

  return 'none';
}

/**
 * Check if CAPTCHA is required for this IP
 */
export function isCaptchaRequired(ipAddress: string): boolean {
  // If no CAPTCHA configured, never require it
  if (getCaptchaProvider() === 'none') {
    return false;
  }

  const entry = failedAttemptsByIP.get(ipAddress);

  if (!entry) {
    return false;
  }

  // Check if window expired
  const now = Date.now();
  if (now - entry.lastAttempt.getTime() > ATTEMPT_WINDOW_MS) {
    failedAttemptsByIP.delete(ipAddress);
    return false;
  }

  return entry.count >= CAPTCHA_THRESHOLD;
}

/**
 * Record a failed attempt (to determine if CAPTCHA should be required)
 */
export function recordFailedAttemptForCaptcha(ipAddress: string): void {
  const now = new Date();
  const entry = failedAttemptsByIP.get(ipAddress);

  if (!entry || Date.now() - entry.lastAttempt.getTime() > ATTEMPT_WINDOW_MS) {
    failedAttemptsByIP.set(ipAddress, { count: 1, lastAttempt: now });
  } else {
    entry.count++;
    entry.lastAttempt = now;
  }
}

/**
 * Clear failed attempts (after successful login)
 */
export function clearFailedAttemptsForCaptcha(ipAddress: string): void {
  failedAttemptsByIP.delete(ipAddress);
}

/**
 * Verify CAPTCHA token
 */
export async function verifyCaptcha(
  token: string,
  ipAddress?: string
): Promise<CaptchaVerificationResult> {
  const provider = getCaptchaProvider();

  if (provider === 'none') {
    return { success: true, provider: 'none' };
  }

  if (!token) {
    return {
      success: false,
      provider,
      errorCodes: ['missing-input-response'],
    };
  }

  if (provider === 'hcaptcha') {
    return verifyHCaptcha(token, ipAddress);
  }

  if (provider === 'recaptcha') {
    return verifyReCaptcha(token, ipAddress);
  }

  return { success: false, provider: 'none', errorCodes: ['unknown-provider'] };
}

/**
 * Verify hCaptcha token
 */
async function verifyHCaptcha(
  token: string,
  ipAddress?: string
): Promise<CaptchaVerificationResult> {
  const secretKey = process.env.HCAPTCHA_SECRET_KEY;

  if (!secretKey) {
    console.error('[CAPTCHA] HCAPTCHA_SECRET_KEY not configured');
    return {
      success: false,
      provider: 'hcaptcha',
      errorCodes: ['missing-secret-key'],
    };
  }

  try {
    const params = new URLSearchParams({
      secret: secretKey,
      response: token,
      ...(ipAddress && { remoteip: ipAddress }),
    });

    const response = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json();

    return {
      success: data.success === true,
      provider: 'hcaptcha',
      errorCodes: data['error-codes'],
      hostname: data.hostname,
      timestamp: data.challenge_ts ? new Date(data.challenge_ts) : undefined,
    };
  } catch (error) {
    console.error('[CAPTCHA] hCaptcha verification error:', error);
    return {
      success: false,
      provider: 'hcaptcha',
      errorCodes: ['verification-failed'],
    };
  }
}

/**
 * Verify reCAPTCHA token
 */
async function verifyReCaptcha(
  token: string,
  ipAddress?: string
): Promise<CaptchaVerificationResult> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  if (!secretKey) {
    console.error('[CAPTCHA] RECAPTCHA_SECRET_KEY not configured');
    return {
      success: false,
      provider: 'recaptcha',
      errorCodes: ['missing-secret-key'],
    };
  }

  try {
    const params = new URLSearchParams({
      secret: secretKey,
      response: token,
      ...(ipAddress && { remoteip: ipAddress }),
    });

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json();

    return {
      success: data.success === true,
      provider: 'recaptcha',
      errorCodes: data['error-codes'],
      hostname: data.hostname,
      timestamp: data.challenge_ts ? new Date(data.challenge_ts) : undefined,
    };
  } catch (error) {
    console.error('[CAPTCHA] reCAPTCHA verification error:', error);
    return {
      success: false,
      provider: 'recaptcha',
      errorCodes: ['verification-failed'],
    };
  }
}

/**
 * Get CAPTCHA site key for frontend
 */
export function getCaptchaSiteKey(): string | null {
  const provider = getCaptchaProvider();

  if (provider === 'hcaptcha') {
    return process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || null;
  }

  if (provider === 'recaptcha') {
    return process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || null;
  }

  return null;
}

/**
 * Get CAPTCHA configuration for frontend
 */
export function getCaptchaConfig(): {
  enabled: boolean;
  provider: CaptchaProvider;
  siteKey: string | null;
} {
  const provider = getCaptchaProvider();

  return {
    enabled: provider !== 'none',
    provider,
    siteKey: getCaptchaSiteKey(),
  };
}

// Cleanup old entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of failedAttemptsByIP.entries()) {
      if (now - entry.lastAttempt.getTime() > ATTEMPT_WINDOW_MS) {
        failedAttemptsByIP.delete(ip);
      }
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}
