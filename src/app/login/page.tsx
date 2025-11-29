'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';

// Simulated users for demo (in production, this would be a database)
const DEMO_USERS = [
  {
    id: '1',
    email: 'admin@novacore.mx',
    password: 'admin123',
    name: 'Administrador',
    role: 'admin' as const,
    permissions: [] as string[], // Admin has all permissions
    isActive: true,
  },
  {
    id: '2',
    email: 'usuario@novacore.mx',
    password: 'user123',
    name: 'Usuario Demo',
    role: 'user' as const,
    permissions: ['dashboard.view', 'balance.view', 'orders.view', 'orders.create', 'clients.view', 'history.view', 'banks.view', 'catalogs.view', 'settings.view'],
    isActive: true,
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Generate random gradient on mount
  const gradient = useMemo(() => {
    const gradients = [
      'from-purple-900/40 via-violet-800/30 to-indigo-900/40',
      'from-indigo-900/40 via-purple-800/30 to-fuchsia-900/40',
      'from-violet-900/40 via-indigo-800/30 to-purple-900/40',
    ];
    return gradients[Math.floor(Math.random() * gradients.length)];
  }, []);

  useEffect(() => {
    setMounted(true);
    // Check if already logged in
    const session = localStorage.getItem('novacore_session');
    if (session) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const user = DEMO_USERS.find(
      (u) => u.email === email && u.password === password
    );

    if (!user) {
      setError('Credenciales inválidas');
      setIsLoading(false);
      return;
    }

    if (!user.isActive) {
      setError('Usuario desactivado. Contacta al administrador.');
      setIsLoading(false);
      return;
    }

    // Save session
    const session = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
        lastLogin: Date.now(),
      },
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };

    localStorage.setItem('novacore_session', JSON.stringify(session));

    // Redirect to dashboard
    router.push('/dashboard');
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-[#030014]">
      {/* Animated gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} transition-all duration-1000`} />

      {/* Ambient glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-purple-600/20 rounded-full blur-[150px]" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-[150px]" />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Login card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-4xl font-bold tracking-wider"
              style={{
                fontFamily: "'Orbitron', sans-serif",
                textShadow: '0 0 30px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.3)',
                color: 'transparent',
                backgroundImage: 'linear-gradient(135deg, #a855f7 0%, #c084fc 50%, #e879f9 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
              }}
            >
              NOVACORE
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-white/30 text-xs tracking-[0.3em] mt-2 uppercase"
            >
              crypto banking core
            </motion.p>
          </div>

          {/* Error message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-white/40 text-xs uppercase tracking-wider">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@novacore.mx"
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-3 pl-10 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-white/40 text-xs uppercase tracking-wider">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-3 pl-10 pr-12 text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar sesión'
              )}
            </motion.button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 pt-6 border-t border-white/[0.06]">
            <p className="text-white/30 text-xs text-center mb-3">
              Credenciales de demo:
            </p>
            <div className="grid grid-cols-2 gap-3 text-[10px]">
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-2.5">
                <p className="text-purple-400 font-medium mb-1">Admin</p>
                <p className="text-white/40">admin@novacore.mx</p>
                <p className="text-white/40">admin123</p>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-2.5">
                <p className="text-blue-400 font-medium mb-1">Usuario</p>
                <p className="text-white/40">usuario@novacore.mx</p>
                <p className="text-white/40">user123</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-white/20 text-[10px] text-center mt-6 tracking-wider">
            in crypto we trust
          </p>
        </div>
      </motion.div>

      {/* Shooting stars */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="shooting-star dir-1" style={{ top: '10%', left: '20%', animationDelay: '0s' }} />
        <div className="shooting-star dir-2" style={{ top: '30%', right: '30%', animationDelay: '3s' }} />
      </div>
    </div>
  );
}
