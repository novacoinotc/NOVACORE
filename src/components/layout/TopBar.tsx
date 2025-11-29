'use client';

import { Search, Menu } from 'lucide-react';

interface TopBarProps {
  onMenuClick?: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  return (
    <header className="h-14 flex items-center justify-between px-4 lg:px-6 border-b border-white/[0.06]">
      {/* Left section */}
      <div className="flex items-center gap-3">
        {/* Hamburger menu - mobile only */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-md text-white/60 hover:text-white hover:bg-white/[0.04]"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search - hidden on mobile */}
        <div className="hidden sm:block flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Buscar..."
              className="w-full pl-9 pr-4 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-md text-sm text-white placeholder-white/30 focus:border-white/20 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 text-xs text-white/40">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        <span className="hidden sm:inline">SPEI conectado</span>
        <span className="sm:hidden">SPEI</span>
      </div>
    </header>
  );
}
