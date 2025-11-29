'use client';

import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

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

// Shooting star config - starts from edges, travels across screen
const generateShootingStars = () => {
  return Array.from({ length: 10 }, (_, i) => {
    // Random starting position from any edge
    const edge = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
    let startX: number, startY: number, endX: number, endY: number, angle: number;

    switch (edge) {
      case 0: // From top
        startX = Math.random() * 100;
        startY = -5;
        endX = startX + (Math.random() * 60 - 30);
        endY = 120;
        angle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);
        break;
      case 1: // From right
        startX = 105;
        startY = Math.random() * 60;
        endX = -20;
        endY = startY + (Math.random() * 40 + 20);
        angle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);
        break;
      case 2: // From bottom (going up)
        startX = Math.random() * 100;
        startY = 105;
        endX = startX + (Math.random() * 40 - 20);
        endY = -20;
        angle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);
        break;
      default: // From left
        startX = -5;
        startY = Math.random() * 60;
        endX = 120;
        endY = startY + (Math.random() * 40 + 20);
        angle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);
    }

    return {
      id: i,
      startX,
      startY,
      endX,
      endY,
      angle,
      duration: Math.random() * 1.2 + 0.6,
      delay: Math.random() * 8 + i * 0.5,
      tailLength: Math.random() * 40 + 60,
    };
  });
};

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
  const particles = useMemo(() => generateParticles(25), []);
  const shootingStars = useMemo(() => generateShootingStars(), []);

  useEffect(() => {
    setGradientIndex(Math.floor(Math.random() * gradientColors.length));
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
          className="absolute w-[800px] h-[800px] bg-purple-500/10 rounded-full blur-[150px]"
          style={{ left: '-20%', top: '-30%' }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.15, 0.1] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[150px]"
          style={{ right: '-15%', bottom: '-20%' }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.12, 0.1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Shooting stars - dot with trail */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {shootingStars.map((star) => (
          <motion.div
            key={star.id}
            className="absolute"
            style={{
              left: `${star.startX}%`,
              top: `${star.startY}%`,
            }}
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              left: [`${star.startX}%`, `${star.endX}%`],
              top: [`${star.startY}%`, `${star.endY}%`],
            }}
            transition={{
              duration: star.duration,
              repeat: Infinity,
              delay: star.delay,
              repeatDelay: Math.random() * 5 + 3,
              ease: "linear",
            }}
          >
            {/* The star head - bright dot */}
            <div
              className="absolute rounded-full bg-white"
              style={{
                width: '3px',
                height: '3px',
                boxShadow: '0 0 4px 2px rgba(255,255,255,0.9), 0 0 8px 4px rgba(255,255,255,0.5)',
                zIndex: 2,
              }}
            />
            {/* The trail - gradient that fades */}
            <div
              style={{
                position: 'absolute',
                width: `${star.tailLength}px`,
                height: '2px',
                background: 'linear-gradient(90deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.3) 30%, transparent 100%)',
                transformOrigin: 'right center',
                transform: `rotate(${star.angle + 180}deg) translateX(0)`,
                right: '1px',
                top: '0.5px',
              }}
            />
          </motion.div>
        ))}
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none">
        {particles.map((particle) => (
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

      {/* Twinkling stars */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
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
        <Sidebar />
        <div className="pl-60">
          <TopBar />
          <AnimatePresence mode="wait">
            <motion.main
              key={pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
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
