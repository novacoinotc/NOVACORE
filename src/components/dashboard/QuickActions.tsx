'use client';

import Link from 'next/link';
import { ArrowUpRight, ArrowDownLeft, Users, FileText } from 'lucide-react';

const actions = [
  { name: 'Enviar', icon: ArrowUpRight, href: '/transfers' },
  { name: 'Recibir', icon: ArrowDownLeft, href: '/transfers' },
  { name: 'Clientes', icon: Users, href: '/clients' },
  { name: 'Historial', icon: FileText, href: '/history' },
];

export function QuickActions() {
  return (
    <div className="flex gap-2">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link key={action.name} href={action.href} className="flex-1">
            <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer">
              <Icon className="w-4 h-4 text-white/40" />
              <span className="text-xs text-white/40">{action.name}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
