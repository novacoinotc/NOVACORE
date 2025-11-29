'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed left-0 top-0 z-40 h-screen flex flex-col bg-dark-800 border-r border-white/5"
    >
      {/* Logo Section */}
      <div className="h-20 flex items-center justify-between px-4 border-b border-white/5">
        <Link href="/dashboard" className="flex items-center gap-3">
          <motion.div
            className="relative w-10 h-10"
            whileHover={{ rotate: 180 }}
            transition={{ duration: 0.5 }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan via-accent-primary to-neon-purple rounded-xl opacity-80 blur-sm" />
            <div className="relative w-full h-full rounded-xl bg-dark-900 flex items-center justify-center border border-white/10">
              <Hexagon className="w-5 h-5 text-neon-cyan" />
            </div>
          </motion.div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex flex-col"
              >
                <span className="font-display font-bold text-lg text-white tracking-wider">
                  NOVA<span className="text-neon-cyan">CORE</span>
                </span>
                <span className="text-[10px] text-gray-500 font-mono tracking-widest">
                  BANKING SYSTEM
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link key={item.name} href={item.href}>
              <motion.div
                onHoverStart={() => setHoveredItem(item.name)}
                onHoverEnd={() => setHoveredItem(null)}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300',
                  isActive
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                {/* Active/Hover Background */}
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 bg-gradient-to-r from-accent-primary/20 to-accent-secondary/10 rounded-xl border border-accent-primary/30"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}

                {/* Hover glow */}
                {hoveredItem === item.name && !isActive && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white/5 rounded-xl"
                  />
                )}

                {/* Icon */}
                <div
                  className={cn(
                    'relative z-10 p-2 rounded-lg transition-all duration-300',
                    isActive
                      ? 'bg-accent-primary/20 text-neon-cyan shadow-neon-cyan/30'
                      : 'bg-dark-600'
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>

                {/* Label */}
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="relative z-10 font-medium text-sm"
                    >
                      {item.name}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-neon-cyan rounded-l-full shadow-neon-cyan"
                  />
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-white/5">
        {/* Wallet Balance */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 rounded-xl bg-gradient-to-br from-dark-700 to-dark-600 border border-white/5"
            >
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-neon-cyan" />
                <span className="text-xs text-gray-400">Balance Disponible</span>
              </div>
              <div className="font-mono font-bold text-lg text-white">
                $<span className="text-neon-cyan">0.00</span>
                <span className="text-xs text-gray-500 ml-1">MXN</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* User Actions */}
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex-1 p-2 rounded-lg bg-dark-600 hover:bg-dark-500 transition-colors"
          >
            <Bell className="w-5 h-5 mx-auto text-gray-400" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex-1 p-2 rounded-lg bg-dark-600 hover:bg-dark-500 transition-colors"
          >
            <LogOut className="w-5 h-5 mx-auto text-gray-400" />
          </motion.button>
        </div>
      </div>

      {/* Collapse Toggle */}
      <motion.button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-24 w-6 h-6 rounded-full bg-dark-700 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:border-accent-primary transition-colors"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </motion.button>
    </motion.aside>
  );
}
