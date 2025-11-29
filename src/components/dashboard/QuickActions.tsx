'use client';

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
    color: 'from-purple-600 to-purple-500',
  },
  {
    name: 'Recibir Fondos',
    description: 'Generar CLABE',
    icon: Download,
    href: '/transfers/receive',
    color: 'from-green-500 to-green-600',
  },
  {
    name: 'Nuevo Cliente',
    description: 'Registrar cuenta',
    icon: Users,
    href: '/clients/new',
    color: 'from-gold-500 to-gold-400',
  },
  {
    name: 'Reportes',
    description: 'Generar reporte',
    icon: FileText,
    href: '/reports',
    color: 'from-purple-500 to-gold-500',
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
    <div className="space-y-6">
      {/* Main Actions */}
      <div className="grid grid-cols-2 gap-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.name} href={action.href}>
              <div className="relative p-4 rounded-xl bg-dark-800 border border-white/5 cursor-pointer overflow-hidden group hover:border-purple-500/30 transition-all duration-200">
                {/* Hover glow */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-10 transition-opacity duration-200`}
                />

                <div className="relative z-10">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-3`}
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
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Links */}
      <div className="rounded-xl bg-dark-800 border border-white/5 p-4">
        <h4 className="text-sm font-medium text-gray-400 mb-3">Acciones Rapidas</h4>
        <div className="grid grid-cols-4 gap-2">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.name}
                className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className="p-2 rounded-lg bg-dark-600">
                  <Icon className="w-5 h-5 text-gray-400" />
                </div>
                <span className="text-xs text-gray-500">{link.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
