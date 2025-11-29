'use client';

import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ParticlesBackground, FloatingOrbs } from './ParticlesBackground';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-dark-900 cyber-grid-bg">
      {/* Background Effects */}
      <ParticlesBackground />
      <FloatingOrbs />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="pl-[280px] transition-all duration-300">
        {/* Top Bar */}
        <TopBar />

        {/* Page Content */}
        <main className="relative z-10 min-h-[calc(100vh-5rem)] p-8">
          {children}
        </main>
      </div>

      {/* Decorative grid overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-30">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:100px_100px]" />
      </div>
    </div>
  );
}
