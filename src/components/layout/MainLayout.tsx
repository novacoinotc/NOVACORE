'use client';

import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface MainLayoutProps {
  children: React.ReactNode;
}

// Color palettes for random gradients
const gradientColors = [
  { from: 'from-purple-900/30', via: 'via-indigo-900/20', to: 'to-blue-900/30' },
  { from: 'from-cyan-900/30', via: 'via-teal-900/20', to: 'to-emerald-900/30' },
  { from: 'from-blue-900/30', via: 'via-violet-900/20', to: 'to-purple-900/30' },
  { from: 'from-emerald-900/30', via: 'via-cyan-900/20', to: 'to-blue-900/30' },
  { from: 'from-violet-900/30', via: 'via-fuchsia-900/20', to: 'to-pink-900/30' },
  { from: 'from-indigo-900/30', via: 'via-purple-900/20', to: 'to-violet-900/30' },
  { from: 'from-teal-900/30', via: 'via-emerald-900/20', to: 'to-green-900/30' },
];

// Generate random positions for floating particles
const generateParticles = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 2,
    duration: Math.random() * 20 + 15,
    delay: Math.random() * 5,
  }));
};

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const [gradientIndex, setGradientIndex] = useState(0);
  const [particles] = useState(() => generateParticles(20));

  // Change gradient randomly on route change
  useEffect(() => {
    const newIndex = Math.floor(Math.random() * gradientColors.length);
    setGradientIndex(newIndex);
  }, [pathname]);

  const currentGradient = gradientColors[gradientIndex];

  // Memoize floating orbs with random properties
  const orbs = useMemo(() => [
    { color: 'bg-purple-500/20', size: 'w-96 h-96', x: -10, y: -10, duration: 25 },
    { color: 'bg-blue-500/15', size: 'w-80 h-80', x: 80, y: 20, duration: 30 },
    { color: 'bg-emerald-500/15', size: 'w-72 h-72', x: 30, y: 70, duration: 22 },
    { color: 'bg-cyan-500/20', size: 'w-64 h-64', x: 70, y: 60, duration: 28 },
    { color: 'bg-violet-500/15', size: 'w-56 h-56', x: 50, y: 30, duration: 20 },
  ], []);

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Animated gradient background */}
      <motion.div
        key={gradientIndex}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.5 }}
        className={`absolute inset-0 bg-gradient-to-br ${currentGradient.from} ${currentGradient.via} ${currentGradient.to}`}
      />

      {/* Large floating orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {orbs.map((orb, i) => (
          <motion.div
            key={i}
            className={`absolute ${orb.size} ${orb.color} rounded-full blur-3xl`}
            initial={{ x: `${orb.x}%`, y: `${orb.y}%` }}
            animate={{
              x: [`${orb.x}%`, `${orb.x + 15}%`, `${orb.x - 10}%`, `${orb.x}%`],
              y: [`${orb.y}%`, `${orb.y - 20}%`, `${orb.y + 15}%`, `${orb.y}%`],
              scale: [1, 1.1, 0.95, 1],
            }}
            transition={{
              duration: orb.duration,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute rounded-full bg-white/20"
            style={{
              width: particle.size,
              height: particle.size,
              left: `${particle.x}%`,
              top: `${particle.y}%`,
            }}
            animate={{
              y: [0, -30, 0],
              x: [0, Math.random() * 20 - 10, 0],
              opacity: [0.2, 0.5, 0.2],
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

      {/* Moving lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
        <motion.div
          className="absolute h-px w-full bg-gradient-to-r from-transparent via-white to-transparent"
          style={{ top: '20%' }}
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute h-px w-full bg-gradient-to-r from-transparent via-white to-transparent"
          style={{ top: '50%' }}
          animate={{ x: ['100%', '-100%'] }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute h-px w-full bg-gradient-to-r from-transparent via-white to-transparent"
          style={{ top: '80%' }}
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute w-px h-full bg-gradient-to-b from-transparent via-white to-transparent"
          style={{ left: '25%' }}
          animate={{ y: ['-100%', '100%'] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute w-px h-full bg-gradient-to-b from-transparent via-white to-transparent"
          style={{ left: '75%' }}
          animate={{ y: ['100%', '-100%'] }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      {/* Pulsing corner accents */}
      <motion.div
        className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent"
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-0 right-0 w-40 h-40 bg-gradient-to-tl from-cyan-500/10 to-transparent"
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 5, repeat: Infinity }}
      />

      {/* Content */}
      <div className="relative z-10">
        <Sidebar />
        <div className="pl-60">
          <TopBar />
          <AnimatePresence mode="wait">
            <motion.main
              key={pathname}
              initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="p-6"
            >
              {children}
            </motion.main>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
