'use client';

import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ParticlesBackground, FloatingOrbs } from './ParticlesBackground';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-dark-900">
      {/* Background Effects */}
      <ParticlesBackground />
      <FloatingOrbs />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="pl-[280px] transition-all duration-200">
        {/* Top Bar */}
        <TopBar />

        {/* Page Content */}
        <main className="relative z-10 min-h-[calc(100vh-5rem)] p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
