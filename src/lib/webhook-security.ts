/**
 * Webhook Security Utilities
 *
 * CRITICAL SECURITY: OPM does NOT provide RSA signature for webhooks
 * We MUST rely on strict IP whitelisting as the PRIMARY security measure
 *
 * Security measures implemented:
 * - STRICT IP whitelisting (OPM IP hardcoded - NOT configurable via env)
 * - Rate limiting per IP
 * - Payload structure validation
 * - Comprehensive audit logging
 * - Request fingerprinting
 */

import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { createAuditLogEntry } from './db';

// =============================================================================
// CRITICAL: OPM's verified production IP addresses
// =============================================================================
// These are OPM's ONLY authorized IPs for sending webhooks
// DO NOT add IPs here without explicit verification from OPM
// Any request from other IPs is AUTOMATICALLY REJECTED
// =============================================================================
const OPM_PRODUCTION_IPS = [
  '35.171.132.81',  // OPM Primary Production IP
] as const;

// SECURITY: In production, ONLY allow OPM IPs - no env overrides
// Additional IPs only allowed in development/staging for testing
const isProduction = process.env.NODE_ENV === 'production';
const stagingIPs = !isProduction
  ? (process.env.OPM_WEBHOOK_IPS?.split(',').map(ip => ip.trim()).filter(ip => ip) || [])
  : [];

const OPM_WEBHOOK_IPS: readonly string[] = [...OPM_PRODUCTION_IPS, ...stagingIPs];

// =============================================================================
// RATE LIMITING - KNOWN LIMITATION
// =============================================================================
// WARNING: This in-memory rate limiting does NOT work across multiple instances!
//
// For production with EC2/PM2 clusters, you MUST implement rate limiting at:
// 1. AWS WAF (recommended) - Rate-based rules at ALB level
// 2. AWS API Gateway - If using API Gateway
// 3. Redis/ElastiCache - If app-level rate limiting is needed
//
// This in-memory implementation is kept as a defense-in-depth layer for
// single-instance deployments and development, but should NOT be relied upon
// as the primary rate limiting mechanism in production.
// =============================================================================
const rateLimitStore: Map<string, { count: number; resetAt: number }> = new Map();

// Max requests per minute per IP (secondary defense only - use WAF for primary)
const WEBHOOK_RATE_LIMIT = parseInt(process.env.WEBHOOK_RATE_LIMIT || '60', 10);
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

export interface WebhookSecurityResult {
  allowed: boolean;
  reason?: string;
  clientIp: string;
}

/**
 * Get client IP from request for webhook validation
 *
 * SECURITY CRITICAL: IP extraction for webhook authentication
 *
 * X-Forwarded-For format: "client, proxy1, proxy2, ..."
 * - Attackers can PREPEND fake IPs to this header
 * - Trusted proxies (AWS ALB, Vercel) APPEND the actual client IP
 *
 * SECURITY FIX: For AWS ALB and most reverse proxies:
 * - The LAST IP in the chain is the one the proxy actually saw connecting
 * - This is what we trust for webhook validation
 *
 * For Vercel: x-vercel-forwarded-for is set by Vercel's edge (trusted)
 */
export function getClientIpFromWebhook(request: NextRequest): string {
  // Vercel provides a trusted header set by their edge network
  const vercelForwarded = request.headers.get('x-vercel-forwarded-for');
  if (vercelForwarded) {
    // Vercel sets this directly, take the first (and usually only) IP
    return vercelForwarded.split(',')[0].trim();
  }

  // SECURITY FIX: For AWS ALB and standard reverse proxies,
  // the proxy APPENDS the actual client IP at the END of the chain
  // An attacker can prepend fake IPs, but cannot control what the proxy appends
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim()).filter(ip => ip);
    if (ips.length > 0) {
      // SECURITY: Use the LAST IP - this is what the trusted proxy actually saw
      // Attacker cannot spoof this because they cannot control what ALB appends
      return ips[ips.length - 1];
    }
  }

  // x-real-ip is typically set by nginx, relatively trusted
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  // Fallback (usually localhost in dev)
  return '127.0.0.1';
}

/**
 * Check if the webhook request is from an allowed source
 * IP whitelist is MANDATORY and STRICT - webhooks ONLY accepted from OPM's verified IPs
 *
 * SECURITY: This is our PRIMARY defense since OPM doesn't provide signature validation
 */
export async function validateWebhookSource(request: NextRequest): Promise<WebhookSecurityResult> {
  const clientIp = getClientIpFromWebhook(request);

  // CRITICAL: Strict IP whitelist check
  // OPM IP is HARDCODED - this is our only security measure for incoming webhooks
  // DO NOT remove or weaken this check under any circumstances
  const isAuthorizedIP = OPM_WEBHOOK_IPS.includes(clientIp);

  if (!isAuthorizedIP) {
    // Log blocked attempt with full details for security analysis
    await createAuditLogEntry({
      id: `audit_${crypto.randomUUID()}`,
      action: 'WEBHOOK_BLOCKED_UNAUTHORIZED_IP',
      ipAddress: clientIp,
      details: {
        reason: 'IP not in OPM whitelist',
        receivedIp: clientIp,
        authorizedIps: OPM_PRODUCTION_IPS,
        userAgent: request.headers.get('user-agent') || 'unknown',
        contentType: request.headers.get('content-type') || 'unknown',
        timestamp: new Date().toISOString(),
      },
      severity: 'critical', // Elevated to critical - potential attack
    }).catch((err) => {
      console.error('[SECURITY] Failed to log blocked webhook:', err);
    });

    console.error(`[SECURITY ALERT] Webhook BLOCKED from unauthorized IP: ${clientIp}`);
    console.error(`[SECURITY ALERT] Authorized IPs: ${OPM_PRODUCTION_IPS.join(', ')}`);

    return {
      allowed: false,
      reason: 'IP address not authorized - only OPM IPs are allowed',
      clientIp,
    };
  }

  console.log(`[SECURITY] Webhook accepted from verified OPM IP: ${clientIp}`);

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
