/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // SECURITY NOTE: All security headers (including CSP) are handled in middleware.ts
  // This provides dynamic control and avoids duplication
  // See src/middleware.ts for the authoritative security header configuration

  // SECURITY: Block sensitive endpoints in production builds
  // These endpoints should NEVER be accessible in production
  async rewrites() {
    if (process.env.NODE_ENV === 'production') {
      return {
        beforeFiles: [
          // Block database initialization endpoint
          {
            source: '/api/auth/init',
            destination: '/api/blocked',
          },
          // Block debug/probe endpoints
          {
            source: '/api/debug/:path*',
            destination: '/api/blocked',
          },
        ],
      };
    }
    return { beforeFiles: [] };
  },
};

module.exports = nextConfig;
