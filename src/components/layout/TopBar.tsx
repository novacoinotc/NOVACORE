'use client';

import { Search } from 'lucide-react';

export function TopBar() {
  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-white/[0.06]">
      {/* Search */}
      <div className="flex-1 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Buscar..."
            className="w-full pl-9 pr-4 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-md text-sm text-white placeholder-white/30 focus:border-white/20 transition-colors"
          />
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 text-xs text-white/40">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
        <span>SPEI conectado</span>
      </div>
    </header>
  );
}
