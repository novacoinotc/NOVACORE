'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
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

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 flex flex-col border-r border-white/[0.06] bg-black/40 backdrop-blur-xl">
      {/* Logo */}
      <div className="h-20 flex flex-col items-center justify-center px-5 border-b border-white/[0.06]">
        <Link href="/dashboard" className="flex flex-col items-center gap-1">
          {/* Neon Logo */}
          <div className="relative">
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
          </div>
          {/* Tagline */}
          <span
            className="text-[9px] tracking-[0.2em] text-white/40 uppercase"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            in crypto we trust
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'text-white bg-white/[0.08]'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </div>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
