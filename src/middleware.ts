import { NextRequest, NextResponse } from 'next/server';

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
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  const allowedOrigins = getAllowedOrigins();

  // Check for exact match
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Check for pattern match (e.g., *.novacore.mx)
  for (const allowed of allowedOrigins) {
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2);
      const originUrl = new URL(origin);
      if (originUrl.hostname.endsWith(domain) || originUrl.hostname === domain.slice(1)) {
        return true;
      }
    }
  }

  return false;
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const method = request.method;

  // Create response for the request
  const response = NextResponse.next();

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
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // HSTS - Force HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // SECURITY FIX: Strict Content Security Policy
  // Removed unsafe-inline and unsafe-eval for script-src (XSS protection)
  // Note: If inline scripts are needed, use nonces instead
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.opm.mx https://apiuat.opm.mx; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
  );

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
        'X-Custom-Auth, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-auth-token'
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
