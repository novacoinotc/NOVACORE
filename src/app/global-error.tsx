'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global Error]', error);
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            minHeight: '100vh',
            backgroundColor: '#030014',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '400px',
              width: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '32px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                margin: '0 auto 24px',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
              }}
            >
              ⚠️
            </div>

            <h2
              style={{
                fontSize: '20px',
                fontWeight: 600,
                color: 'white',
                marginBottom: '8px',
              }}
            >
              Error crítico
            </h2>

            <p
              style={{
                color: 'rgba(255, 255, 255, 0.6)',
                marginBottom: '24px',
                fontSize: '14px',
              }}
            >
              Ha ocurrido un error crítico. Por favor, recarga la página.
            </p>

            <button
              onClick={() => reset()}
              style={{
                padding: '12px 24px',
                backgroundColor: '#9333ea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              Recargar página
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
