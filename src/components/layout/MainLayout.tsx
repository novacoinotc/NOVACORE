'use client';

import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-dark-950">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="pl-64 transition-all duration-200">
        {/* Top Bar */}
        <TopBar />

        {/* Page Content */}
        <main className="min-h-[calc(100vh-4rem)] p-6 bg-dark-900/50">
          {children}
        </main>
      </div>
    </div>
  );
}
