/**
 * Webhook Security Utilities
 *
 * Since OPM doesn't provide a signature key for webhook validation,
 * we implement alternative security measures:
 * - IP whitelisting
 * - Rate limiting
 * - Basic payload validation
 * - Audit logging
 */

import { NextRequest } from 'next/server';
import { createAuditLogEntry } from './db';

// OPM's IP addresses (configure these in environment variables)
// Add multiple IPs separated by commas: OPM_WEBHOOK_IPS=1.2.3.4,5.6.7.8
const OPM_WEBHOOK_IPS = process.env.OPM_WEBHOOK_IPS?.split(',').map(ip => ip.trim()) || [];

// Rate limiting store (in-memory, consider Redis for production)
const rateLimitStore: Map<string, { count: number; resetAt: number }> = new Map();

// Max requests per minute per IP
const WEBHOOK_RATE_LIMIT = parseInt(process.env.WEBHOOK_RATE_LIMIT || '60', 10);
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

export interface WebhookSecurityResult {
  allowed: boolean;
  reason?: string;
  clientIp: string;
}

/**
 * Get client IP from request
 */
export function getClientIpFromWebhook(request: NextRequest): string {
  // Check various headers that might contain the real IP
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  // Fallback (usually localhost in dev)
  return '127.0.0.1';
}

/**
 * Check if the webhook request is from an allowed source
 */
export async function validateWebhookSource(request: NextRequest): Promise<WebhookSecurityResult> {
  const clientIp = getClientIpFromWebhook(request);

  // Check IP whitelist if configured
  const ipWhitelistEnabled = process.env.WEBHOOK_IP_WHITELIST_ENABLED === 'true';

  if (ipWhitelistEnabled && OPM_WEBHOOK_IPS.length > 0) {
    if (!OPM_WEBHOOK_IPS.includes(clientIp)) {
      // Log blocked attempt
      await createAuditLogEntry({
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        action: 'WEBHOOK_BLOCKED',
        ipAddress: clientIp,
        details: { reason: 'IP not in whitelist', allowedIPs: OPM_WEBHOOK_IPS.length },
        severity: 'warning',
      }).catch(() => {}); // Don't fail if audit log fails

      return {
        allowed: false,
        reason: 'IP address not authorized',
        clientIp,
      };
    }
  }

  // Check rate limit
  const now = Date.now();
  const rateKey = `webhook_${clientIp}`;
  const rateData = rateLimitStore.get(rateKey);

  if (rateData) {
    if (now < rateData.resetAt) {
      if (rateData.count >= WEBHOOK_RATE_LIMIT) {
        await createAuditLogEntry({
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          action: 'WEBHOOK_RATE_LIMITED',
          ipAddress: clientIp,
          details: { count: rateData.count, limit: WEBHOOK_RATE_LIMIT },
          severity: 'warning',
        }).catch(() => {});

        return {
          allowed: false,
          reason: 'Rate limit exceeded',
          clientIp,
        };
      }
      rateData.count++;
    } else {
      // Reset window
      rateLimitStore.set(rateKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    }
  } else {
    rateLimitStore.set(rateKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  }

  return {
    allowed: true,
    clientIp,
  };
}

/**
 * Validate webhook payload has minimum required structure
 */
export function validateWebhookPayload(body: unknown, type: 'deposit' | 'order-status'): { valid: boolean; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid payload: not an object' };
  }

  const payload = body as Record<string, unknown>;

  if (type === 'deposit') {
    // For deposit webhooks, we need tracking key, amount, and beneficiary account
    const hasDirectFields = payload.trackingKey && payload.amount && payload.beneficiaryAccount;
    const hasNestedFields = payload.type === 'supply' && payload.data &&
      typeof payload.data === 'object' &&
      (payload.data as Record<string, unknown>).trackingKey;

    if (!hasDirectFields && !hasNestedFields) {
      return { valid: false, error: 'Missing required deposit fields' };
    }
  } else if (type === 'order-status') {
    // For order status webhooks, we need order ID and status
    const hasDirectFields = (payload.orderId || payload.id) && payload.status;
    const hasNestedFields = payload.type === 'orderStatus' && payload.data &&
      typeof payload.data === 'object' &&
      ((payload.data as Record<string, unknown>).id || (payload.data as Record<string, unknown>).orderId);

    if (!hasDirectFields && !hasNestedFields) {
      return { valid: false, error: 'Missing required order status fields' };
    }
  }

  return { valid: true };
}

/**
 * Sanitize webhook data for logging (remove sensitive info)
 */
export function sanitizeWebhookDataForLog(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    return { _type: typeof body };
  }

  const payload = body as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  // Only log non-sensitive structural information
  if (payload.type) sanitized.type = payload.type;
  if (payload.trackingKey) sanitized.trackingKey = payload.trackingKey;
  if (payload.status) sanitized.status = payload.status;
  if (payload.orderId) sanitized.orderId = payload.orderId;
  if (payload.id) sanitized.id = payload.id;
  if (payload.amount) sanitized.amount = payload.amount;

  // Mask account numbers
  if (payload.beneficiaryAccount && typeof payload.beneficiaryAccount === 'string') {
    sanitized.beneficiaryAccount = maskAccount(payload.beneficiaryAccount);
  }
  if (payload.payerAccount && typeof payload.payerAccount === 'string') {
    sanitized.payerAccount = maskAccount(payload.payerAccount);
  }

  // Handle nested data
  if (payload.data && typeof payload.data === 'object') {
    sanitized.data = sanitizeWebhookDataForLog(payload.data);
  }

  return sanitized;
}

/**
 * Mask account number for logging
 */
function maskAccount(account: string): string {
  if (account.length <= 8) return '****';
  return account.substring(0, 4) + '****' + account.substring(account.length - 4);
}

/**
 * Log webhook event securely (without sensitive data)
 */
export async function logWebhookEvent(
  type: 'deposit' | 'order-status',
  clientIp: string,
  body: unknown,
  result: { processed: boolean; message?: string }
): Promise<void> {
  const sanitizedBody = sanitizeWebhookDataForLog(body);

  await createAuditLogEntry({
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    action: `WEBHOOK_${type.toUpperCase().replace('-', '_')}`,
    ipAddress: clientIp,
    details: {
      payload: sanitizedBody,
      processed: result.processed,
      message: result.message,
    },
    severity: 'info',
  }).catch((err) => {
    console.error('Failed to log webhook event:', err);
  });
}
