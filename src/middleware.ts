import { NextRequest, NextResponse } from 'next/server';

/**
 * Generate a unique Request ID for tracing
 * This ID follows requests through the entire system for debugging and security auditing
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `req_${timestamp}_${randomPart}`;
}

/**
 * Generate a cryptographically secure nonce for CSP
 * Uses Web Crypto API (available in Edge Runtime) instead of Node.js crypto
 * This nonce is unique per request and prevents inline script injection
 */
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  // Convert to base64 using btoa (available in Edge Runtime)
  // Use Array.from for TypeScript compatibility
  return btoa(String.fromCharCode.apply(null, Array.from(array)));
}

/**
 * SECURITY: Dynamic CORS Middleware
 *
 * This middleware handles CORS dynamically to prevent security vulnerabilities:
 * 1. No wildcard (*) origin with credentials - this is a CSRF vulnerability
 * 2. Only explicitly allowed origins can make cross-origin requests
 * 3. Webhook endpoints from OPM have their own IP-based validation
 *
 * Configure allowed origins via ALLOWED_ORIGINS environment variable
 * Format: comma-separated list of origins
 * Example: ALLOWED_ORIGINS=https://app.novacore.mx,https://admin.novacore.mx
 */

// Parse allowed origins from environment or use secure defaults
function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim()).filter(Boolean);
  }

  // Default allowed origins for development
  // In production, ALWAYS set ALLOWED_ORIGINS environment variable
  if (process.env.NODE_ENV === 'development') {
    return [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
    ];
  }

  // Production: No origins allowed by default - must be configured
  // This is the secure default - force explicit configuration
  return [];
}

// Check if the origin is allowed
// SECURITY: Only exact matches allowed - no wildcard patterns
// Wildcard subdomains with credentials are a security risk in banking apps
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  const allowedOrigins = getAllowedOrigins();

  // SECURITY: Only exact match - wildcards removed for banking security
  // If a subdomain is compromised, it could make authenticated requests
  return allowedOrigins.includes(origin);
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const method = request.method;

  // Generate unique Request ID for tracing through entire request lifecycle
  // This ID is used for: logging, debugging, security auditing, and correlating events
  const requestId = generateRequestId();

  // Create response for the request
  const response = NextResponse.next();

  // Add Request ID to response headers for client-side correlation
  // X-Request-ID: Standard header for request tracing
  response.headers.set('X-Request-ID', requestId);

  // Also pass to API routes via custom header (accessible in route handlers)
  response.headers.set('x-request-id', requestId);

  // SECURITY FIX: Add essential security headers to ALL responses
  // These headers protect against common web vulnerabilities

  // Prevent clickjacking attacks
  response.headers.set('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Enable XSS filter in browsers
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Control referrer information
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy (restrict browser features)
  // camera=(self) needed for OCR feature to use mobile camera
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');

  // HSTS - Force HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Content Security Policy - Nonce-based configuration for banking security
  // SECURITY: Uses per-request nonce instead of 'unsafe-inline' for maximum XSS protection
  // worker-src 'self' blob: https://cdn.jsdelivr.net needed for Tesseract.js OCR
  const isProduction = process.env.NODE_ENV === 'production';

  // Generate unique nonce for this request
  const nonce = generateNonce();

  // Pass nonce to Next.js via header (read by layout.tsx)
  response.headers.set('x-nonce', nonce);

  // Base CSP directives (shared between environments)
  const baseCSP = [
    "default-src 'self'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://api.opm.mx https://apiuat.opm.mx",
    "worker-src 'self' blob: https://cdn.jsdelivr.net",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  // Script-src with nonce + strict-dynamic (NO unsafe-inline in production)
  // SECURITY NOTES:
  // - 'nonce-xxx' allows only scripts with matching nonce attribute
  // - 'strict-dynamic' allows scripts loaded by nonced scripts to execute
  // - NO 'unsafe-inline' in production = maximum XSS protection
  // - 'unsafe-eval' only in development for Next.js HMR
  // - CDN allowed for Tesseract.js OCR (should use SRI in production)
  const scriptSrc = isProduction
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://cdn.jsdelivr.net`
    : `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net`;

  // Style-src with nonce (production: no unsafe-inline for maximum security)
  // Development keeps 'unsafe-inline' for CSS-in-JS hot reload compatibility
  const styleSrc = isProduction
    ? `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`
    : `style-src 'self' 'nonce-${nonce}' 'unsafe-inline' https://fonts.googleapis.com`;

  // Production-only: upgrade HTTP to HTTPS
  const upgradeInsecure = isProduction ? "upgrade-insecure-requests" : "";

  const cspValue = [...baseCSP, scriptSrc, styleSrc, upgradeInsecure].filter(Boolean).join('; ') + ';';

  response.headers.set('Content-Security-Policy', cspValue);

  // Handle preflight OPTIONS requests
  if (method === 'OPTIONS') {
    const preflightResponse = new NextResponse(null, { status: 204 });

    // Add security headers to preflight response
    preflightResponse.headers.set('X-Frame-Options', 'DENY');
    preflightResponse.headers.set('X-Content-Type-Options', 'nosniff');

    // Only set CORS headers if origin is allowed
    if (origin && isOriginAllowed(origin)) {
      preflightResponse.headers.set('Access-Control-Allow-Origin', origin);
      preflightResponse.headers.set('Access-Control-Allow-Credentials', 'true');
      preflightResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      preflightResponse.headers.set(
        'Access-Control-Allow-Headers',
        // SECURITY: x-auth-token removed - only httpOnly cookie authentication allowed
        'X-Custom-Auth, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
      );
      preflightResponse.headers.set('Access-Control-Max-Age', '86400'); // 24 hours cache
    }

    return preflightResponse;
  }

  // For non-OPTIONS requests, set CORS headers if origin is allowed
  if (origin && isOriginAllowed(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  // Webhook endpoints: These use IP-based validation, not CORS
  // The webhook routes have their own security (IP whitelist + signature verification)
  if (request.nextUrl.pathname.startsWith('/api/webhooks/')) {
    // Allow webhook requests without CORS (they come from OPM servers, not browsers)
    // Security is handled via IP whitelist and RSA signature verification
    return NextResponse.next();
  }

  return response;
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Exclude static files and internal Next.js routes
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
