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
  // camera=(self) needed for OCR feature to use mobile camera
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');

  // HSTS - Force HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Content Security Policy - Environment-aware configuration
  // SECURITY: Production uses stricter CSP without 'unsafe-eval'
  // Note: Next.js requires 'unsafe-inline' for scripts due to hydration (nonce would require App Router changes)
  // worker-src 'self' blob: https://cdn.jsdelivr.net needed for Tesseract.js OCR
  const isProduction = process.env.NODE_ENV === 'production';

  // Base CSP directives (shared between environments)
  const baseCSP = [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://api.opm.mx https://apiuat.opm.mx",
    "worker-src 'self' blob: https://cdn.jsdelivr.net",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  // Script-src differs: production removes 'unsafe-eval' for security
  // 'unsafe-eval' is only needed in development for Next.js hot reload
  const scriptSrc = isProduction
    ? "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net"  // No unsafe-eval in production
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net";  // Dev needs eval for HMR

  // Production-only: upgrade HTTP to HTTPS
  const upgradeInsecure = isProduction ? "upgrade-insecure-requests" : "";

  const cspValue = [...baseCSP, scriptSrc, upgradeInsecure].filter(Boolean).join('; ') + ';';

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
