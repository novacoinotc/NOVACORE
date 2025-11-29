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

// Shooting star directions
type Direction = 'top-left' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom-right';

const getShootingStarAnimation = (direction: Direction) => {
  const animations: Record<Direction, { start: React.CSSProperties; end: { x: number; y: number }; rotation: number }> = {
    'top-left': { start: { top: '-5%', right: '-5%' }, end: { x: -2000, y: 1200 }, rotation: 225 },
    'top-right': { start: { top: '-5%', left: '-5%' }, end: { x: 2000, y: 1200 }, rotation: 135 },
    'left': { start: { top: '30%', right: '-5%' }, end: { x: -2000, y: 200 }, rotation: 190 },
    'right': { start: { top: '40%', left: '-5%' }, end: { x: 2000, y: 100 }, rotation: 10 },
    'bottom-left': { start: { bottom: '-5%', right: '20%' }, end: { x: -1500, y: -800 }, rotation: 315 },
    'bottom-right': { start: { bottom: '-5%', left: '20%' }, end: { x: 1500, y: -800 }, rotation: 45 },
  };
  return animations[direction];
};

const directions: Direction[] = ['top-left', 'top-right', 'left', 'right', 'bottom-left', 'bottom-right'];

const generateShootingStars = () => {
  return Array.from({ length: 8 }, (_, i) => ({
    id: i,
    direction: directions[Math.floor(Math.random() * directions.length)],
    duration: Math.random() * 1.5 + 0.8,
    delay: Math.random() * 6,
    size: Math.random() * 1.5 + 1,
    length: Math.random() * 60 + 100,
  }));
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

      {/* Ambient glows - simplified */}
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

      {/* Shooting stars - full screen, all directions */}
      <div className="absolute inset-0 pointer-events-none">
        {shootingStars.map((star) => {
          const anim = getShootingStarAnimation(star.direction);
          return (
            <motion.div
              key={star.id}
              className="absolute"
              style={{ ...anim.start }}
              initial={{ opacity: 0, x: 0, y: 0 }}
              animate={{
                opacity: [0, 1, 1, 0],
                x: [0, anim.end.x * 0.5, anim.end.x],
                y: [0, anim.end.y * 0.5, anim.end.y],
              }}
              transition={{
                duration: star.duration,
                repeat: Infinity,
                delay: star.delay,
                repeatDelay: Math.random() * 4 + 2,
                ease: "linear",
              }}
            >
              <div
                style={{
                  width: `${star.length}px`,
                  height: `${star.size}px`,
                  background: 'linear-gradient(90deg, white, rgba(255,255,255,0.6), transparent)',
                  borderRadius: '2px',
                  transform: `rotate(${anim.rotation}deg)`,
                  boxShadow: '0 0 6px rgba(255,255,255,0.8), 0 0 12px rgba(255,255,255,0.4)',
                }}
              />
            </motion.div>
          );
        })}
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
