'use client';

// Simplified background - no heavy animations
export function ParticlesBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      {/* Subtle gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 20% 20%, rgba(147, 51, 234, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(251, 191, 36, 0.05) 0%, transparent 50%)',
        }}
      />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'linear-gradient(rgba(147, 51, 234, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(147, 51, 234, 0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  );
}

// Simple accent orbs - CSS only, no JS animations
export function FloatingOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Purple orb - top left */}
      <div
        className="absolute w-96 h-96 rounded-full blur-3xl opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(147, 51, 234, 0.4) 0%, transparent 70%)',
          top: '10%',
          left: '5%',
        }}
      />

      {/* Gold orb - bottom right */}
      <div
        className="absolute w-80 h-80 rounded-full blur-3xl opacity-15"
        style={{
          background: 'radial-gradient(circle, rgba(251, 191, 36, 0.3) 0%, transparent 70%)',
          bottom: '15%',
          right: '10%',
        }}
      />
    </div>
  );
}
