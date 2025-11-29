'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Clock,
  Users,
  Settings,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Transferencias', href: '/transfers', icon: ArrowLeftRight },
  { name: 'Historial', href: '/history', icon: Clock },
  { name: 'Clientes', href: '/clients', icon: Users },
  { name: 'Configuracion', href: '/settings', icon: Settings },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();

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
          {navigation.map((item) => {
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
      </aside>
    </>
  );
}
