'use client';

import Link from 'next/link';
import { ArrowUpRight, ArrowDownLeft, UserPlus, FileText } from 'lucide-react';

const actions = [
  { name: 'Enviar', icon: ArrowUpRight, href: '/transfers' },
  { name: 'Recibir', icon: ArrowDownLeft, href: '/transfers' },
  { name: 'Clientes', icon: UserPlus, href: '/clients' },
  { name: 'Reportes', icon: FileText, href: '/history' },
];

export function QuickActions() {
  return (
    <div className="rounded-xl bg-dark-800 border border-white/[0.04] p-4">
      <p className="text-sm text-gray-500 mb-4">Acciones rapidas</p>
      <div className="grid grid-cols-4 gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.name} href={action.href}>
              <div className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded-lg bg-dark-700 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-gray-400" />
                </div>
                <span className="text-xs text-gray-500">{action.name}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
