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

// Generate random particles
const generateParticles = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    duration: Math.random() * 8 + 4,
    delay: Math.random() * 3,
  }));
};

// Generate shooting stars
const generateShootingStars = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    startX: Math.random() * 100,
    startY: Math.random() * 50,
    duration: Math.random() * 2 + 1,
    delay: Math.random() * 8,
    size: Math.random() * 2 + 1,
  }));
};

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const [gradientIndex, setGradientIndex] = useState(0);
  const particles = useMemo(() => generateParticles(40), []);
  const shootingStars = useMemo(() => generateShootingStars(6), []);

  // Change gradient randomly on route change
  useEffect(() => {
    const newIndex = Math.floor(Math.random() * gradientColors.length);
    setGradientIndex(newIndex);
  }, [pathname]);

  const currentGradient = gradientColors[gradientIndex];

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Animated gradient background */}
      <motion.div
        key={gradientIndex}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className={`absolute inset-0 bg-gradient-to-br ${currentGradient.from} ${currentGradient.via} ${currentGradient.to}`}
      />

      {/* Ambient glow - dispersed across full screen */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute w-[600px] h-[600px] bg-purple-500/15 rounded-full blur-[120px]"
          style={{ left: '-15%', top: '-20%' }}
          animate={{
            x: [0, 100, 50, 0],
            y: [0, 80, -30, 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] bg-blue-500/15 rounded-full blur-[100px]"
          style={{ right: '-10%', top: '10%' }}
          animate={{
            x: [0, -80, 40, 0],
            y: [0, 60, -40, 0],
            scale: [1, 0.9, 1.1, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[450px] h-[450px] bg-emerald-500/12 rounded-full blur-[100px]"
          style={{ left: '30%', bottom: '-15%' }}
          animate={{
            x: [0, 60, -40, 0],
            y: [0, -70, 30, 0],
            scale: [1, 1.15, 0.95, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[80px]"
          style={{ right: '20%', bottom: '20%' }}
          animate={{
            x: [0, -50, 70, 0],
            y: [0, 50, -60, 0],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Floating particles - more and faster */}
      <div className="absolute inset-0 pointer-events-none">
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute rounded-full bg-white/30"
            style={{
              width: particle.size,
              height: particle.size,
              left: `${particle.x}%`,
              top: `${particle.y}%`,
            }}
            animate={{
              y: [0, -50, 0],
              x: [0, Math.random() * 30 - 15, 0],
              opacity: [0.1, 0.6, 0.1],
              scale: [1, 1.5, 1],
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

      {/* Shooting stars */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {shootingStars.map((star) => (
          <motion.div
            key={star.id}
            className="absolute"
            style={{
              left: `${star.startX}%`,
              top: `${star.startY}%`,
            }}
            initial={{ opacity: 0, x: 0, y: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: [0, 150, 300],
              y: [0, 75, 150],
            }}
            transition={{
              duration: star.duration,
              repeat: Infinity,
              delay: star.delay,
              repeatDelay: Math.random() * 5 + 3,
              ease: "easeOut",
            }}
          >
            <div
              className="bg-gradient-to-r from-white via-white/80 to-transparent"
              style={{
                width: '80px',
                height: `${star.size}px`,
                borderRadius: '50%',
                boxShadow: '0 0 10px rgba(255,255,255,0.5)',
              }}
            />
          </motion.div>
        ))}
      </div>

      {/* Twinkling stars */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={`star-${i}`}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: Math.random() * 2 + 1,
              repeat: Infinity,
              delay: Math.random() * 3,
            }}
          />
        ))}
      </div>

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        <Sidebar />
        <div className="pl-60">
          <TopBar />
          <AnimatePresence mode="wait">
            <motion.main
              key={pathname}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
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
