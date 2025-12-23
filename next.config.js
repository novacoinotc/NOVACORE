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
};

module.exports = nextConfig;
