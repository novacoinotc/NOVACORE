'use client';

import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BitcoinPrice } from './BitcoinPrice';

interface MainLayoutProps {
  children: React.ReactNode;
}

const gradientColors = [
  { from: 'from-purple-900/25', via: 'via-indigo-900/15', to: 'to-blue-900/25' },
  { from: 'from-cyan-900/25', via: 'via-teal-900/15', to: 'to-emerald-900/25' },
  { from: 'from-blue-900/25', via: 'via-violet-900/15', to: 'to-purple-900/25' },
  { from: 'from-emerald-900/25', via: 'via-cyan-900/15', to: 'to-blue-900/25' },
  { from: 'from-violet-900/25', via: 'via-fuchsia-900/15', to: 'to-pink-900/25' },
  { from: 'from-indigo-900/25', via: 'via-purple-900/15', to: 'to-violet-900/25' },
];

const generateParticles = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 1,
    duration: Math.random() * 6 + 3,
    delay: Math.random() * 2,
  }));
};

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const [gradientIndex, setGradientIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const particles = useMemo(() => generateParticles(25), []);

  useEffect(() => {
    setGradientIndex(Math.floor(Math.random() * gradientColors.length));
  }, [pathname]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const currentGradient = gradientColors[gradientIndex];

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Gradient background */}
      <motion.div
        key={gradientIndex}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className={`absolute inset-0 bg-gradient-to-br ${currentGradient.from} ${currentGradient.via} ${currentGradient.to}`}
      />

      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute w-[500px] h-[500px] lg:w-[800px] lg:h-[800px] bg-purple-500/10 rounded-full blur-[100px] lg:blur-[150px]"
          style={{ left: '-20%', top: '-30%' }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.15, 0.1] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[400px] h-[400px] lg:w-[600px] lg:h-[600px] bg-blue-500/10 rounded-full blur-[100px] lg:blur-[150px]"
          style={{ right: '-15%', bottom: '-20%' }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.12, 0.1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* CSS Shooting Stars - hidden on mobile for performance */}
      <div className="hidden md:block absolute inset-0 pointer-events-none overflow-hidden">
        <div className="shooting-star dir-1" style={{ top: '8%', left: '25%', animationDelay: '0s' }} />
        <div className="shooting-star dir-1" style={{ top: '15%', left: '70%', animationDelay: '4s' }} />
        <div className="shooting-star dir-2" style={{ top: '12%', right: '30%', animationDelay: '2s' }} />
        <div className="shooting-star dir-2" style={{ top: '20%', right: '60%', animationDelay: '7s' }} />
        <div className="shooting-star dir-3" style={{ top: '25%', right: '10%', animationDelay: '5s' }} />
      </div>

      {/* Galaxy Explosions - hidden on mobile for performance */}
      <div className="hidden md:block absolute inset-0 pointer-events-none overflow-hidden">
        <div className="galaxy-explosion" style={{ top: '15%', left: '20%', animationDelay: '0s' }} />
        <div className="galaxy-explosion" style={{ top: '55%', right: '15%', animationDelay: '7s' }} />
        <div className="galaxy-explosion" style={{ top: '35%', left: '65%', animationDelay: '13s' }} />
        <div className="galaxy-explosion" style={{ top: '70%', left: '35%', animationDelay: '4s' }} />
        <div className="galaxy-explosion" style={{ top: '25%', right: '30%', animationDelay: '16s' }} />
      </div>

      {/* Floating particles - fewer on mobile */}
      <div className="absolute inset-0 pointer-events-none">
        {particles.slice(0, 15).map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute rounded-full bg-white/40"
            style={{
              width: particle.size,
              height: particle.size,
              left: `${particle.x}%`,
              top: `${particle.y}%`,
            }}
            animate={{
              y: [0, -40, 0],
              opacity: [0.2, 0.6, 0.2],
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              delay: particle.delay,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Twinkling stars - fewer on mobile */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={`twinkle-${i}`}
            className="absolute w-0.5 h-0.5 bg-white rounded-full"
            style={{
              left: `${10 + Math.random() * 80}%`,
              top: `${10 + Math.random() * 80}%`,
            }}
            animate={{ opacity: [0, 0.8, 0], scale: [0.5, 1.2, 0.5] }}
            transition={{
              duration: Math.random() * 2 + 1.5,
              repeat: Infinity,
              delay: Math.random() * 4,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:pl-60">
          <TopBar onMenuClick={() => setSidebarOpen(true)} />
          <AnimatePresence mode="wait">
            <motion.main
              key={pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="p-4 lg:p-6"
            >
              {children}
            </motion.main>
          </AnimatePresence>
        </div>
      </div>

      {/* Bitcoin Price - Bottom Left (desktop only, mobile shows in TopBar) */}
      <div className="hidden lg:block">
        <BitcoinPrice />
      </div>
    </div>
  );
}
