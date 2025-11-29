'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  SendHorizontal,
  Download,
  Users,
  FileText,
  QrCode,
  CreditCard,
  Building2,
  RefreshCw,
} from 'lucide-react';

const actions = [
  {
    name: 'Nueva Transferencia',
    description: 'Enviar SPEI',
    icon: SendHorizontal,
    href: '/transfers/new',
    color: 'from-neon-cyan to-neon-blue',
    glow: 'shadow-neon-cyan',
  },
  {
    name: 'Recibir Fondos',
    description: 'Generar CLABE',
    icon: Download,
    href: '/transfers/receive',
    color: 'from-green-400 to-green-600',
    glow: 'shadow-green-400/30',
  },
  {
    name: 'Nuevo Cliente',
    description: 'Registrar cuenta',
    icon: Users,
    href: '/clients/new',
    color: 'from-neon-purple to-neon-pink',
    glow: 'shadow-neon-purple',
  },
  {
    name: 'Reportes',
    description: 'Generar reporte',
    icon: FileText,
    href: '/reports',
    color: 'from-accent-primary to-accent-secondary',
    glow: 'shadow-accent-primary/30',
  },
];

const quickLinks = [
  { name: 'Consultar CLABE', icon: QrCode, href: '#' },
  { name: 'Ver Tarjetas', icon: CreditCard, href: '#' },
  { name: 'Bancos', icon: Building2, href: '#' },
  { name: 'Actualizar', icon: RefreshCw, href: '#' },
];

export function QuickActions() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="space-y-6"
    >
      {/* Main Actions */}
      <div className="grid grid-cols-2 gap-4">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Link key={action.name} href={action.href}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className={`relative p-4 rounded-xl bg-dark-700 border border-white/5 cursor-pointer overflow-hidden group`}
              >
                {/* Hover glow */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
                />

                <div className="relative z-10">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-3 ${action.glow}`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h4 className="font-semibold text-white">{action.name}</h4>
                  <p className="text-sm text-gray-500 mt-0.5">{action.description}</p>
                </div>

                {/* Corner decoration */}
                <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
                  <div
                    className={`absolute -top-8 -right-8 w-16 h-16 rounded-full bg-gradient-to-br ${action.color} opacity-10`}
                  />
                </div>
              </motion.div>
            </Link>
          );
        })}
      </div>

      {/* Quick Links */}
      <div className="rounded-xl bg-dark-700 border border-white/5 p-4">
        <h4 className="text-sm font-medium text-gray-400 mb-3">Acciones Rapidas</h4>
        <div className="grid grid-cols-4 gap-2">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <motion.button
                key={link.name}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className="p-2 rounded-lg bg-dark-600">
                  <Icon className="w-5 h-5 text-gray-400" />
                </div>
                <span className="text-xs text-gray-500">{link.name}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
