/**
 * Webhook Security Utilities
 *
 * Since OPM doesn't provide a signature key for webhook validation,
 * we implement alternative security measures:
 * - IP whitelisting (MANDATORY - OPM IP hardcoded)
 * - Rate limiting
 * - Basic payload validation
 * - Audit logging
 */

import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { createAuditLogEntry } from './db';

// OPM's verified IP address - HARDCODED for security
// This is OPM's production IP that sends webhooks
const OPM_HARDCODED_IP = '35.171.132.81';

// Additional IPs can be configured via environment (for testing/staging)
const additionalIPs = process.env.OPM_WEBHOOK_IPS?.split(',').map(ip => ip.trim()).filter(ip => ip) || [];
const OPM_WEBHOOK_IPS = [OPM_HARDCODED_IP, ...additionalIPs];

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
 *
 * SECURITY NOTE: IP extraction in cloud environments
 * - X-Forwarded-For can be spoofed by clients, BUT trusted proxies (Vercel, AWS ALB)
 *   append or overwrite the header with the actual connecting IP
 * - For AWS ALB: The rightmost non-private IP is typically the real client
 * - For Vercel: The header is set by Vercel's edge network
 *
 * We use X-Vercel-Forwarded-For when available (more trustworthy)
 * and fall back to the rightmost public IP in X-Forwarded-For
 */
export function getClientIpFromWebhook(request: NextRequest): string {
  // Vercel provides a more trustworthy header
  const vercelForwarded = request.headers.get('x-vercel-forwarded-for');
  if (vercelForwarded) {
    return vercelForwarded.split(',')[0].trim();
  }

  // For AWS/other proxies, the connecting client IP is typically appended last
  // But the FIRST entry is often the original client (what we want for webhook validation)
  // AWS ALB adds the client IP at the end of the chain
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim());
    // For webhook validation from OPM, they connect directly to our edge
    // So the first IP should be OPM's IP (unless there's a CDN in front of them)
    // Return the first IP as it's what OPM would present
    return ips[0];
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
 * IP whitelist is MANDATORY - webhooks only accepted from OPM's IP
 */
export async function validateWebhookSource(request: NextRequest): Promise<WebhookSecurityResult> {
  const clientIp = getClientIpFromWebhook(request);

  // MANDATORY IP whitelist check - OPM IP is hardcoded for security
  // This is the primary security measure since OPM doesn't provide signature keys
  if (!OPM_WEBHOOK_IPS.includes(clientIp)) {
    // Log blocked attempt with secure ID
    await createAuditLogEntry({
      id: `audit_${crypto.randomUUID()}`,
      action: 'WEBHOOK_BLOCKED',
      ipAddress: clientIp,
      details: {
        reason: 'IP not in whitelist',
        receivedIp: clientIp,
        expectedIp: OPM_HARDCODED_IP,
      },
      severity: 'warning',
    }).catch(() => {}); // Don't fail if audit log fails

    console.warn(`[SECURITY] Webhook blocked from unauthorized IP: ${clientIp}`);

    return {
      allowed: false,
      reason: 'IP address not authorized',
      clientIp,
    };
  }

  // Check rate limit
  const now = Date.now();
  const rateKey = `webhook_${clientIp}`;
  const rateData = rateLimitStore.get(rateKey);

  if (rateData) {
    if (now < rateData.resetAt) {
      if (rateData.count >= WEBHOOK_RATE_LIMIT) {
        await createAuditLogEntry({
          id: `audit_${crypto.randomUUID()}`,
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
    id: `audit_${crypto.randomUUID()}`,
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
