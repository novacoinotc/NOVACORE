'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { X, LogOut, Building2, CreditCard } from 'lucide-react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Clock,
  Users,
  Settings,
  UserCog,
  Shield,
  ShieldCheck,
  User,
} from 'lucide-react';
import { Permission, UserRole } from '@/types';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
  { name: 'Empresas', href: '/companies', icon: Building2, permission: 'companies.view' },
  { name: 'Cuentas CLABE', href: '/clabe-accounts', icon: CreditCard, permission: 'clabe.view' },
  { name: 'Transferencias', href: '/transfers', icon: ArrowLeftRight, permission: 'orders.view' },
  { name: 'Historial', href: '/history', icon: Clock, permission: 'history.view' },
  { name: 'Clientes', href: '/clients', icon: Users, permission: 'clients.view' },
  { name: 'Usuarios', href: '/users', icon: UserCog, permission: 'users.view' },
  { name: 'Configuracion', href: '/settings', icon: Settings, permission: 'settings.view' },
];

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  company_admin: 'Admin Empresa',
  user: 'Usuario',
};

const roleIcons: Record<UserRole, React.ComponentType<{ className?: string }>> = {
  super_admin: ShieldCheck,
  company_admin: Shield,
  user: User,
};

const roleColors: Record<UserRole, string> = {
  super_admin: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  company_admin: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  user: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};

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

  const RoleIcon = user ? roleIcons[user.role] : User;

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

        {/* User section - at top */}
        {user && (
          <div className="border-b border-white/[0.06] p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white font-medium flex-shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-medium truncate">{user.name}</p>
                <p className="text-white/40 text-xs truncate">{user.email}</p>
              </div>
              <button
                onClick={logout}
                className="p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Role badge */}
            <div className="mt-3 flex items-center gap-2">
              <span className={cn(
                'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium border',
                roleColors[user.role]
              )}>
                <RoleIcon className="w-3 h-3" />
                {roleLabels[user.role]}
              </span>
            </div>

            {/* Company name for company_admin and user */}
            {user.company && (
              <div className="mt-2 flex items-center gap-1.5 text-white/40 text-xs">
                <Building2 className="w-3 h-3" />
                <span className="truncate">{user.company.name}</span>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
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

        {/* Footer with version */}
        <div className="px-5 py-3 border-t border-white/[0.06]">
          <p className="text-white/20 text-[10px] tracking-wider uppercase">
            v1.0.0 - Multi-tenant
          </p>
        </div>
      </aside>
    </>
  );
}
