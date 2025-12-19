'use client';

import { cn } from '@/lib/utils';

interface NovacorpLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
}

export function NovacorpLogo({ size = 'md', className, showText = true }: NovacorpLogoProps) {
  const sizes = {
    sm: { icon: 24, text: 'text-sm' },
    md: { icon: 32, text: 'text-lg' },
    lg: { icon: 48, text: 'text-2xl' },
  };

  const { icon, text } = sizes[size];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Logo Icon - Stylized N with neon glow */}
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Outer glow effect */}
        <defs>
          <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>

        {/* Background circle with subtle transparency */}
        <circle cx="24" cy="24" r="22" fill="rgba(6, 182, 212, 0.1)" stroke="url(#neonGradient)" strokeWidth="1.5" />

        {/* Stylized N */}
        <path
          d="M16 34V14L24 26L32 14V34"
          stroke="url(#neonGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter="url(#neonGlow)"
        />

        {/* Inner accent lines */}
        <path
          d="M16 14L32 34"
          stroke="rgba(6, 182, 212, 0.3)"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>

      {showText && (
        <div className="flex flex-col leading-none">
          <span className={cn(
            'font-bold tracking-tight',
            text,
            'bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent'
          )}>
            NOVACORP
          </span>
          <span className="text-[9px] text-white/30 tracking-[0.2em] uppercase">
            Pagos SPEI
          </span>
        </div>
      )}
    </div>
  );
}

export default NovacorpLogo;
