import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { AuthProvider } from '@/context/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'NOVACORP - Core Bancario',
  description: 'Sistema bancario futurista con integración SPEI',
  keywords: ['banking', 'SPEI', 'fintech', 'Mexico'],
  authors: [{ name: 'NOVACORP' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a0f',
};

/**
 * Root Layout with CSP Nonce Support
 *
 * SECURITY: The nonce is generated per-request in middleware.ts
 * and passed via the x-nonce header. This enables:
 * - Inline scripts with matching nonce are allowed
 * - Scripts without nonce are blocked (in CSP Level 2+ browsers)
 * - 'unsafe-inline' fallback for older browsers/Next.js hydration
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read nonce from middleware for any custom inline scripts
  // Next.js hydration scripts use 'unsafe-inline' fallback
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') || '';

  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased" data-nonce={nonce}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
