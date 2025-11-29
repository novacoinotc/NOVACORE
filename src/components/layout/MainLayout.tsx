'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface MainLayoutProps {
  children: React.ReactNode;
}

// Different gradient themes for each section
const gradientThemes: Record<string, string> = {
  '/dashboard': 'from-purple-900/20 via-indigo-900/10 to-blue-900/20',
  '/transfers': 'from-cyan-900/20 via-teal-900/10 to-emerald-900/20',
  '/history': 'from-blue-900/20 via-indigo-900/10 to-violet-900/20',
  '/clients': 'from-emerald-900/20 via-teal-900/10 to-cyan-900/20',
  '/settings': 'from-violet-900/20 via-purple-900/10 to-fuchsia-900/20',
};

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();

  // Get the gradient based on current path
  const currentGradient = Object.entries(gradientThemes).find(
    ([path]) => pathname.startsWith(path)
  )?.[1] || gradientThemes['/dashboard'];

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Animated gradient background */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${currentGradient} transition-all duration-1000 ease-in-out`}
      />

      {/* Animated orbs for depth */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-40 right-1/3 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl animate-pulse-slow animation-delay-2000" />
      </div>

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        <Sidebar />
        <div className="pl-60">
          <TopBar />
          <main className="p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
