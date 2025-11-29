'use client';

import { useState } from 'react';
import { Search, Bell, User, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TopBar() {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-dark-900 border-b border-white/[0.04]">
      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar..."
            className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-white/[0.04] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-green-500/10">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-xs text-green-400">SPEI</span>
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-white/[0.03] transition-colors">
          <Bell className="w-5 h-5 text-gray-400" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-purple-500 rounded-full" />
        </button>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/[0.03] transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center">
              <User className="w-4 h-4 text-purple-400" />
            </div>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-44 rounded-lg bg-dark-800 border border-white/[0.04] shadow-xl overflow-hidden z-50">
              <div className="p-3 border-b border-white/[0.04]">
                <p className="text-sm font-medium text-white">Admin</p>
                <p className="text-xs text-gray-500">admin@novacore.mx</p>
              </div>
              <div className="p-1">
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-md transition-colors">
                  <LogOut className="w-4 h-4" />
                  Cerrar Sesion
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
