'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  SendHorizontal,
  History,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Bell,
  LogOut,
  Hexagon,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Transferencias', href: '/transfers', icon: SendHorizontal },
  { name: 'Historial', href: '/history', icon: History },
  { name: 'Clientes', href: '/clients', icon: Users },
  { name: 'Configuracion', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen flex flex-col bg-dark-800 border-r border-white/5 transition-all duration-300',
        isCollapsed ? 'w-20' : 'w-[280px]'
      )}
    >
      {/* Logo Section */}
      <div className="h-20 flex items-center justify-between px-4 border-b border-white/5">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-gold-400 rounded-xl opacity-80 blur-sm" />
            <div className="relative w-full h-full rounded-xl bg-dark-900 flex items-center justify-center border border-white/10">
              <Hexagon className="w-5 h-5 text-gold-400" />
            </div>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-lg text-white tracking-wider">
                NOVA<span className="text-gold-400">CORE</span>
              </span>
              <span className="text-[10px] text-gray-500 font-mono tracking-widest">
                BANKING SYSTEM
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  'relative flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200',
                  isActive
                    ? 'text-white bg-purple-600/20 border border-purple-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    'relative z-10 p-2 rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-purple-600/30 text-gold-400'
                      : 'bg-dark-600'
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>

                {/* Label */}
                {!isCollapsed && (
                  <span className="relative z-10 font-medium text-sm">
                    {item.name}
                  </span>
                )}

                {/* Active indicator */}
                {isActive && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gold-400 rounded-l-full" />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-white/5">
        {/* Wallet Balance */}
        {!isCollapsed && (
          <div className="mb-4 p-3 rounded-xl bg-dark-700 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-gold-400" />
              <span className="text-xs text-gray-400">Balance Disponible</span>
            </div>
            <div className="font-mono font-bold text-lg text-white">
              $<span className="text-gold-400">0.00</span>
              <span className="text-xs text-gray-500 ml-1">MXN</span>
            </div>
          </div>
        )}

        {/* User Actions */}
        <div className="flex items-center gap-2">
          <button className="flex-1 p-2 rounded-lg bg-dark-600 hover:bg-dark-500 transition-colors">
            <Bell className="w-5 h-5 mx-auto text-gray-400" />
          </button>
          <button className="flex-1 p-2 rounded-lg bg-dark-600 hover:bg-dark-500 transition-colors">
            <LogOut className="w-5 h-5 mx-auto text-gray-400" />
          </button>
        </div>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-24 w-6 h-6 rounded-full bg-dark-700 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:border-purple-500 transition-colors"
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </aside>
  );
}
