/**
 * Distributed Rate Limiter with Redis Support
 *
 * SECURITY: This rate limiter works across multiple server instances
 * Falls back to in-memory store if Redis is not available
 *
 * Features:
 * - Sliding window rate limiting
 * - Per-IP and per-user limits
 * - Redis-backed for distributed deployments
 * - Automatic fallback to memory for single-instance
 * - Configurable limits per endpoint
 */

import { createClient, RedisClientType } from 'redis';

// Rate limit configuration
export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  keyPrefix: string;     // Redis key prefix
}

// Default configurations for different endpoints
export const RATE_LIMIT_CONFIGS = {
  // Login: 5 attempts per 15 minutes
  login: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    keyPrefix: 'rl:login:',
  },
  // API general: 100 requests per minute
  api: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    keyPrefix: 'rl:api:',
  },
  // Webhooks: 60 requests per minute per IP
  webhook: {
    windowMs: 60 * 1000,
    maxRequests: 60,
    keyPrefix: 'rl:webhook:',
  },
  // Password reset: 3 requests per hour
  passwordReset: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 3,
    keyPrefix: 'rl:pwreset:',
  },
  // 2FA verification: 5 attempts per 5 minutes
  twoFactor: {
    windowMs: 5 * 60 * 1000,
    maxRequests: 5,
    keyPrefix: 'rl:2fa:',
  },
  // Transfer creation: 20 per hour
  transfer: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 20,
    keyPrefix: 'rl:transfer:',
  },
} as const;

// Redis client singleton
let redisClient: RedisClientType | null = null;
let redisConnected = false;
let redisConnectionAttempted = false;

// In-memory fallback store
const memoryStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Initialize Redis connection
 * Call this at app startup if you want Redis support
 */
export async function initRedisRateLimiter(): Promise<boolean> {
  if (redisConnectionAttempted) {
    return redisConnected;
  }

  redisConnectionAttempted = true;

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn('[RATE-LIMITER] REDIS_URL not configured - using in-memory fallback');
    console.warn('[RATE-LIMITER] WARNING: In-memory rate limiting does NOT work across multiple instances!');
    return false;
  }

  try {
    redisClient = createClient({ url: redisUrl });

    redisClient.on('error', (err) => {
      console.error('[RATE-LIMITER] Redis error:', err.message);
      redisConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('[RATE-LIMITER] Connected to Redis');
      redisConnected = true;
    });

    redisClient.on('reconnecting', () => {
      console.log('[RATE-LIMITER] Reconnecting to Redis...');
    });

    await redisClient.connect();
    redisConnected = true;

    console.log('[RATE-LIMITER] Redis rate limiter initialized successfully');
    return true;
  } catch (error) {
    console.error('[RATE-LIMITER] Failed to connect to Redis:', error);
    console.warn('[RATE-LIMITER] Falling back to in-memory rate limiting');
    redisConnected = false;
    return false;
  }
}

/**
 * Check rate limit using Redis or memory fallback
 */
export async function checkRateLimitDistributed(
  identifier: string,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.api
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}> {
  const key = `${config.keyPrefix}${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Try Redis first
  if (redisConnected && redisClient) {
    try {
      return await checkRateLimitRedis(key, config, now, windowStart);
    } catch (error) {
      console.error('[RATE-LIMITER] Redis error, falling back to memory:', error);
    }
  }

  // Fallback to in-memory
  return checkRateLimitMemory(key, config, now);
}

/**
 * Redis-based rate limiting using sorted sets (sliding window)
 */
async function checkRateLimitRedis(
  key: string,
  config: RateLimitConfig,
  now: number,
  windowStart: number
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}> {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }

  // Use a transaction for atomic operations
  const multi = redisClient.multi();

  // Remove old entries outside the window
  multi.zRemRangeByScore(key, 0, windowStart);

  // Count current entries in window
  multi.zCard(key);

  // Execute transaction
  const results = await multi.exec();
  const currentCount = (results[1] as number) || 0;

  const resetAt = now + config.windowMs;

  if (currentCount >= config.maxRequests) {
    // Rate limited
    const oldestEntry = await redisClient.zRange(key, 0, 0, { BY: 'SCORE' });
    let retryAfter = config.windowMs;

    if (oldestEntry && oldestEntry.length > 0) {
      const oldestTime = parseInt(oldestEntry[0], 10);
      retryAfter = Math.max(0, oldestTime + config.windowMs - now);
    }

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter: Math.ceil(retryAfter / 1000), // seconds
    };
  }

  // Add current request
  await redisClient.zAdd(key, { score: now, value: now.toString() });

  // Set expiry on the key
  await redisClient.expire(key, Math.ceil(config.windowMs / 1000));

  return {
    allowed: true,
    remaining: config.maxRequests - currentCount - 1,
    resetAt,
  };
}

/**
 * In-memory rate limiting (fallback)
 * WARNING: Does NOT work across multiple server instances!
 */
function checkRateLimitMemory(
  key: string,
  config: RateLimitConfig,
  now: number
): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
} {
  const entry = memoryStore.get(key);

  // No entry or expired - allow and create new
  if (!entry || now >= entry.resetAt) {
    memoryStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
    };
  }

  // Check if over limit
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  // Increment and allow
  entry.count++;
  memoryStore.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Record a failed attempt (for login attempts tracking)
 */
export async function recordFailedAttemptDistributed(
  identifier: string,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.login
): Promise<void> {
  // Simply check the rate limit - it automatically records the attempt
  await checkRateLimitDistributed(identifier, config);
}

/**
 * Clear rate limit for an identifier (e.g., after successful login)
 */
export async function clearRateLimitDistributed(
  identifier: string,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.login
): Promise<void> {
  const key = `${config.keyPrefix}${identifier}`;

  if (redisConnected && redisClient) {
    try {
      await redisClient.del(key);
      return;
    } catch (error) {
      console.error('[RATE-LIMITER] Failed to clear Redis key:', error);
    }
  }

  // Fallback to memory
  memoryStore.delete(key);
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: {
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString(),
  };

  if (result.retryAfter !== undefined) {
    headers['Retry-After'] = result.retryAfter.toString();
  }

  return headers;
}

// Cleanup memory store periodically (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (now >= entry.resetAt) {
        memoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * Graceful shutdown - close Redis connection
 */
export async function shutdownRateLimiter(): Promise<void> {
  if (redisClient && redisConnected) {
    try {
      await redisClient.quit();
      console.log('[RATE-LIMITER] Redis connection closed');
    } catch (error) {
      console.error('[RATE-LIMITER] Error closing Redis:', error);
    }
  }
}
