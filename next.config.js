/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // CORS and Security headers
  // SECURITY: CORS is handled by middleware for dynamic origin validation
  // Static security headers only in next.config.js
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          // SECURITY: CORS headers removed from static config
          // CORS is now handled dynamically in middleware.ts to:
          // 1. Validate Origin against allowed list
          // 2. Prevent wildcard with credentials (security vulnerability)
          // 3. Only allow trusted origins

          // Security headers
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https:; worker-src 'self' blob: https://cdn.jsdelivr.net;" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
