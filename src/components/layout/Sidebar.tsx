'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { X, LogOut } from 'lucide-react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Clock,
  Users,
  Settings,
  UserCog,
} from 'lucide-react';
import { Permission } from '@/types';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
  { name: 'Transferencias', href: '/transfers', icon: ArrowLeftRight, permission: 'orders.view' },
  { name: 'Historial', href: '/history', icon: Clock, permission: 'history.view' },
  { name: 'Clientes', href: '/clients', icon: Users, permission: 'clients.view' },
  { name: 'Usuarios', href: '/users', icon: UserCog, permission: 'users.view' },
  { name: 'Configuracion', href: '/settings', icon: Settings, permission: 'settings.view' },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, hasPermission, logout } = useAuth();

  // Filter navigation items based on permissions
  const filteredNavigation = navigation.filter(
    (item) => !item.permission || hasPermission(item.permission)
  );

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-screen w-64 flex flex-col border-r border-white/[0.06] bg-black/90 backdrop-blur-xl transition-transform duration-300 ease-in-out',
          'lg:w-60 lg:translate-x-0 lg:bg-black/40',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/[0.06]">
          <Link href="/dashboard">
            <span
              className="text-xl font-bold tracking-wider"
              style={{
                fontFamily: "'Orbitron', 'JetBrains Mono', monospace",
                color: '#fff',
                textShadow: `
                  0 0 5px rgba(168, 85, 247, 0.8),
                  0 0 10px rgba(168, 85, 247, 0.6),
                  0 0 20px rgba(168, 85, 247, 0.4),
                  0 0 40px rgba(168, 85, 247, 0.2)
                `,
              }}
            >
              NOVA<span style={{ color: '#a855f7' }}>CORE</span>
            </span>
          </Link>

          {/* Close button - mobile only */}
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-md text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4">
          {filteredNavigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;

            return (
              <Link key={item.name} href={item.href} onClick={onClose}>
                <div
                  className={cn(
                    'flex items-center gap-3 px-3 py-3 rounded-md text-sm transition-colors',
                    isActive
                      ? 'text-white bg-white/[0.08]'
                      : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        {user && (
          <div className="border-t border-white/[0.06] p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-medium truncate">{user.name}</p>
                <p className="text-white/40 text-xs truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 px-3 py-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-md text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
