'use client';

import { Search, Menu, Shield, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface TopBarProps {
  onMenuClick?: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { user } = useAuth();

  return (
    <header className="h-14 flex items-center justify-between px-4 lg:px-6 border-b border-white/[0.06]">
      {/* Left section - Menu */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-md text-white/60 hover:text-white hover:bg-white/[0.04]"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Center section - Logo (mobile only) */}
      <div className="lg:hidden flex flex-col items-center">
        <span
          className="text-sm font-bold tracking-wider text-white/80"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          NOVACORE
        </span>
      </div>

      {/* Search - desktop only */}
      <div className="hidden lg:block flex-1 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Buscar..."
            className="w-full pl-9 pr-4 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-md text-sm text-white placeholder-white/30 focus:border-white/20 transition-colors"
          />
        </div>
      </div>

      {/* Right section - Status and user role */}
      <div className="flex items-center gap-4">
        {/* SPEI Status */}
        <div className="flex items-center gap-2 text-xs text-white/40">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="hidden sm:inline">SPEI conectado</span>
          <span className="sm:hidden">SPEI</span>
        </div>

        {/* User role badge - desktop only */}
        {user && (
          <div className="hidden lg:flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                user.role === 'super_admin'
                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                  : user.role === 'company_admin'
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}
            >
              {user.role === 'super_admin' ? (
                <ShieldCheck className="w-3 h-3" />
              ) : (
                <Shield className="w-3 h-3" />
              )}
              {user.role === 'super_admin' ? 'Super Admin' : user.role === 'company_admin' ? 'Empresa' : 'Usuario'}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
