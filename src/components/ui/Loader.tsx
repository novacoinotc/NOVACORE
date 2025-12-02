'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'spinner' | 'dots' | 'pulse' | 'bars';
  className?: string;
}

export function Loader({ size = 'md', variant = 'spinner', className }: LoaderProps) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  if (variant === 'spinner') {
    return (
      <div className={cn('relative', sizes[size], className)}>
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-neon-cyan border-r-neon-cyan"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-1 rounded-full border-2 border-transparent border-b-neon-purple border-l-neon-purple"
          animate={{ rotate: -360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (variant === 'dots') {
    return (
      <div className={cn('flex gap-1', className)}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className={cn(
              'rounded-full bg-gradient-to-r from-neon-cyan to-neon-purple',
              size === 'sm' && 'w-1.5 h-1.5',
              size === 'md' && 'w-2 h-2',
              size === 'lg' && 'w-3 h-3'
            )}
            animate={{
              y: [0, -8, 0],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.1,
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div className={cn('relative', sizes[size], className)}>
        <motion.div
          className="absolute inset-0 rounded-full bg-neon-cyan"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <div className="absolute inset-2 rounded-full bg-neon-cyan" />
      </div>
    );
  }

  if (variant === 'bars') {
    return (
      <div className={cn('flex items-end gap-1', className)}>
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className={cn(
              'bg-gradient-to-t from-neon-cyan to-neon-purple rounded-full',
              size === 'sm' && 'w-1',
              size === 'md' && 'w-1.5',
              size === 'lg' && 'w-2'
            )}
            animate={{
              height: ['20%', '100%', '20%'],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: i * 0.1,
            }}
            style={{
              height: size === 'sm' ? 16 : size === 'md' ? 24 : 32,
            }}
          />
        ))}
      </div>
    );
  }

  return null;
}

// Full page loader
export function PageLoader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-dark-900">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-6"
      >
        {/* Logo animation */}
        <motion.div
          className="relative w-24 h-24"
          animate={{ rotateY: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        >
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-neon-cyan via-accent-primary to-neon-purple opacity-80 blur-xl" />
          <div className="relative w-full h-full rounded-2xl bg-dark-800 border border-white/10 flex items-center justify-center">
            <span className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-purple">
              N
            </span>
          </div>
        </motion.div>

        <div className="flex flex-col items-center gap-2">
          <Loader variant="bars" size="md" />
          <motion.p
            className="text-sm text-gray-400 font-mono"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            Cargando NOVACORP...
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}
