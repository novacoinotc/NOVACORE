'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console (in production, send to error tracking service)
    console.error('[App Error]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#030014] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>

        <h2 className="text-xl font-semibold text-white mb-2">
          Algo salió mal
        </h2>

        <p className="text-white/60 mb-6 text-sm">
          Ha ocurrido un error inesperado. Puedes intentar recargar la página o volver al inicio.
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reintentar
          </button>

          <a
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            Ir al inicio
          </a>
        </div>

        {/* Show error digest in development for debugging */}
        {error?.digest && process.env.NODE_ENV === 'development' && (
          <p className="mt-6 text-xs text-white/30 font-mono">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
