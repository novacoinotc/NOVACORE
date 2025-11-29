'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { forwardRef, ReactNode } from 'react';

interface CardProps {
  variant?: 'default' | 'glass' | 'neon' | 'gradient';
  glow?: boolean;
  hover?: boolean;
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant = 'default',
      glow = false,
      hover = true,
      children,
      onClick,
    },
    ref
  ) => {
    const variants = {
      default: 'bg-dark-700 border border-white/5',
      glass: 'glass',
      neon: 'bg-dark-800 neon-border',
      gradient:
        'bg-gradient-to-br from-dark-700 via-dark-800 to-dark-900 border border-white/5',
    };

    return (
      <motion.div
        ref={ref}
        whileHover={hover ? { y: -4, scale: 1.01 } : undefined}
        transition={{ duration: 0.2 }}
        className={cn(
          'relative rounded-xl p-6 overflow-hidden',
          variants[variant],
          glow && 'shadow-glow',
          hover && 'card-hover',
          className
        )}
        onClick={onClick}
      >
        {/* Scan line effect for neon variant */}
        {variant === 'neon' && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-neon-cyan to-transparent"
              animate={{
                y: ['-100%', '2000%'],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          </div>
        )}

        {/* Holographic overlay for gradient variant */}
        {variant === 'gradient' && (
          <div className="absolute inset-0 holographic pointer-events-none" />
        )}

        {/* Content */}
        <div className="relative z-10">{children}</div>
      </motion.div>
    );
  }
);

Card.displayName = 'Card';

// Card Header
const CardHeader = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 pb-4', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

// Card Title
const CardTitle = forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-none tracking-tight text-white',
      className
    )}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

// Card Description
const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-gray-400', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

// Card Content
const CardContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('', className)} {...props} />
));
CardContent.displayName = 'CardContent';

// Card Footer
const CardFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center pt-4', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
