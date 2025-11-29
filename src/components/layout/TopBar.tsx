'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Bell,
  User,
  ChevronDown,
  Settings,
  LogOut,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function TopBar() {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const notifications = [
    { id: 1, title: 'Transferencia recibida', message: '$5,000.00 MXN de Juan Perez', time: '2 min', unread: true },
    { id: 2, title: 'Orden liquidada', message: 'TX-001234 completada', time: '15 min', unread: true },
    { id: 3, title: 'Nuevo cliente', message: 'Maria Garcia registrada', time: '1h', unread: false },
  ];

  return (
    <header className="h-20 flex items-center justify-between px-8 bg-dark-800/50 backdrop-blur-xl border-b border-white/5">
      {/* Search */}
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar transacciones, clientes..."
            className="w-full pl-12 pr-4 py-3 bg-dark-700 border border-white/5 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-primary/50 transition-colors"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-md bg-dark-600 text-xs text-gray-500">
            <span>⌘</span>
            <span>K</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        {/* Network Status */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20"
        >
          <div className="status-dot success" />
          <span className="text-sm text-green-400 font-medium">SPEI Activo</span>
        </motion.div>

        {/* Quick Actions */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-accent-primary to-accent-secondary text-white font-medium text-sm shadow-glow"
        >
          <Zap className="w-4 h-4" />
          <span>Nueva Transferencia</span>
        </motion.button>

        {/* Notifications */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg bg-dark-700 border border-white/5 hover:border-white/10 transition-colors"
          >
            <Bell className="w-5 h-5 text-gray-400" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-neon-cyan rounded-full animate-pulse" />
          </motion.button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 top-full mt-2 w-80 rounded-xl bg-dark-800 border border-white/10 shadow-2xl overflow-hidden z-50"
              >
                <div className="p-4 border-b border-white/5">
                  <h3 className="font-semibold text-white">Notificaciones</h3>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={cn(
                        'p-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer',
                        notif.unread && 'bg-accent-primary/5'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {notif.unread && (
                          <div className="w-2 h-2 mt-2 rounded-full bg-neon-cyan" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">{notif.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{notif.message}</p>
                          <p className="text-xs text-gray-500 mt-1">{notif.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-white/5">
                  <button className="w-full text-center text-sm text-accent-primary hover:text-accent-secondary transition-colors">
                    Ver todas las notificaciones
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Menu */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.02 }}
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="text-left hidden lg:block">
              <p className="text-sm font-medium text-white">Admin</p>
              <p className="text-xs text-gray-500">admin@novacore.mx</p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400 hidden lg:block" />
          </motion.button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-dark-800 border border-white/10 shadow-2xl overflow-hidden z-50"
              >
                <div className="py-2">
                  <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                    <Settings className="w-4 h-4" />
                    Configuracion
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                    <LogOut className="w-4 h-4" />
                    Cerrar Sesion
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
