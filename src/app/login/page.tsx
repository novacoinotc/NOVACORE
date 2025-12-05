'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail, AlertCircle, Loader2, KeyRound, CheckCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 2FA states
  const [requires2FA, setRequires2FA] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  // Password recovery states
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<'email' | 'code' | 'success'>('email');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState('');

  // Generate random gradient on mount (only client-side)
  const [gradient, setGradient] = useState('from-purple-900/40 via-violet-800/30 to-indigo-900/40');

  useEffect(() => {
    setMounted(true);
    const gradients = [
      'from-purple-900/40 via-violet-800/30 to-indigo-900/40',
      'from-indigo-900/40 via-purple-800/30 to-fuchsia-900/40',
      'from-violet-900/40 via-indigo-800/30 to-purple-900/40',
    ];
    setGradient(gradients[Math.floor(Math.random() * gradients.length)]);

    // Initialize database on first load (creates tables and demo users if not exist)
    fetch('/api/auth/init', { method: 'POST' }).catch(() => {
      // Ignore errors - database may already be initialized
    });
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (mounted && !authLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [mounted, authLoading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login(email, password, requires2FA ? totpCode : undefined);

      if (result.requires2FA) {
        // Password correct but 2FA code needed
        setRequires2FA(true);
        setIsLoading(false);
        return;
      }

      if (!result.success) {
        setError(result.error || 'Error de autenticación');
        // If 2FA failed, keep showing the TOTP input
        if (!requires2FA) {
          setRequires2FA(false);
        }
        setTotpCode('');
        setIsLoading(false);
        return;
      }

      // Redirect to dashboard (AuthContext will handle this too)
      router.push('/dashboard');
    } catch (err) {
      setError('Error al iniciar sesión. Intenta de nuevo.');
      setIsLoading(false);
    }
  };

  // Reset 2FA state when email/password changes
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (requires2FA) {
      setRequires2FA(false);
      setTotpCode('');
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (requires2FA) {
      setRequires2FA(false);
      setTotpCode('');
    }
  };

  // Request password reset code
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoveryLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail, action: 'request' }),
      });

      const data = await res.json();

      if (!res.ok) {
        setRecoveryError(data.error || 'Error al solicitar recuperación');
        return;
      }

      // In development, the code is returned in response
      if (data.resetCode) {
        setRecoveryCode(data.resetCode);
      }

      setRecoverySuccess('Revisa tu correo para el código de recuperación.');
      setRecoveryStep('code');
    } catch (err) {
      setRecoveryError('Error de conexión');
    } finally {
      setRecoveryLoading(false);
    }
  };

  // Complete password reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');

    if (newPassword !== confirmPassword) {
      setRecoveryError('Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 8) {
      setRecoveryError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setRecoveryLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset',
          resetCode: recoveryCode,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setRecoveryError(data.error || 'Error al restablecer contraseña');
        return;
      }

      setRecoveryStep('success');
    } catch (err) {
      setRecoveryError('Error de conexión');
    } finally {
      setRecoveryLoading(false);
    }
  };

  // Reset recovery state
  const resetRecovery = () => {
    setShowRecovery(false);
    setRecoveryEmail('');
    setRecoveryCode('');
    setNewPassword('');
    setConfirmPassword('');
    setRecoveryStep('email');
    setRecoveryError('');
    setRecoverySuccess('');
  };

  // Show loading state while checking auth
  if (!mounted || authLoading) {
    return (
      <div className="min-h-screen bg-[#030014] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  // Already authenticated, will redirect
  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#030014] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

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
              NOVACORP
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-white/30 text-xs tracking-[0.3em] mt-2 uppercase"
            >
              banking core
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
                  onChange={handleEmailChange}
                  placeholder="usuario@novacorp.mx"
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-3 pl-10 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all"
                  required
                  disabled={isLoading || requires2FA}
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
                  onChange={handlePasswordChange}
                  placeholder="••••••••"
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-3 pl-10 pr-12 text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all"
                  required
                  disabled={isLoading || requires2FA}
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

            {/* 2FA Code */}
            <AnimatePresence>
              {requires2FA && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1.5"
                >
                  <label className="text-white/40 text-xs uppercase tracking-wider">
                    Código de autenticación
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <input
                      type="text"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-3 pl-10 pr-4 text-white text-center text-lg tracking-widest font-mono placeholder:text-white/20 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all"
                      maxLength={6}
                      required
                      disabled={isLoading}
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-white/30 text-center">
                    Ingresa el código de Google Authenticator
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit button */}
            <motion.button
              type="submit"
              disabled={isLoading || (requires2FA && totpCode.length !== 6)}
              whileHover={{ scale: isLoading ? 1 : 1.01 }}
              whileTap={{ scale: isLoading ? 1 : 0.99 }}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {requires2FA ? 'Verificando...' : 'Iniciando sesión...'}
                </>
              ) : requires2FA ? (
                'Verificar código'
              ) : (
                'Iniciar sesión'
              )}
            </motion.button>

            {/* Forgot password link */}
            <button
              type="button"
              onClick={() => setShowRecovery(true)}
              className="w-full text-center text-sm text-white/40 hover:text-white/60 transition-colors mt-3"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </form>

          {/* Footer */}
          <p className="text-white/20 text-[10px] text-center mt-6 tracking-wider">
            secure banking solutions
          </p>
        </div>
      </motion.div>

      {/* Password Recovery Modal */}
      <AnimatePresence>
        {showRecovery && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={resetRecovery}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative z-10 w-full max-w-md"
            >
              <div className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 shadow-2xl">
                {/* Back button */}
                <button
                  onClick={resetRecovery}
                  className="flex items-center gap-2 text-white/40 hover:text-white/60 transition-colors mb-6"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm">Volver al login</span>
                </button>

                {/* Header */}
                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                    <KeyRound className="w-6 h-6 text-purple-400" />
                  </div>
                  <h2 className="text-xl font-medium text-white/90">
                    {recoveryStep === 'email' && 'Recuperar contraseña'}
                    {recoveryStep === 'code' && 'Establecer nueva contraseña'}
                    {recoveryStep === 'success' && '¡Contraseña restablecida!'}
                  </h2>
                  <p className="text-sm text-white/40 mt-2">
                    {recoveryStep === 'email' && 'Ingresa tu correo para recibir un código de recuperación'}
                    {recoveryStep === 'code' && 'Ingresa el código y tu nueva contraseña'}
                    {recoveryStep === 'success' && 'Ya puedes iniciar sesión con tu nueva contraseña'}
                  </p>
                </div>

                {/* Error/Success messages */}
                <AnimatePresence>
                  {recoveryError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm"
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {recoveryError}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Step 1: Email input */}
                {recoveryStep === 'email' && (
                  <form onSubmit={handleRequestReset} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-white/40 text-xs uppercase tracking-wider">
                        Correo electrónico
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                        <input
                          type="email"
                          value={recoveryEmail}
                          onChange={(e) => setRecoveryEmail(e.target.value)}
                          placeholder="usuario@novacorp.mx"
                          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-3 pl-10 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all"
                          required
                          disabled={recoveryLoading}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={recoveryLoading}
                      className="w-full py-3 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {recoveryLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        'Enviar código'
                      )}
                    </button>
                  </form>
                )}

                {/* Step 2: Code and new password */}
                {recoveryStep === 'code' && (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    {recoverySuccess && (
                      <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-400 text-sm">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        {recoverySuccess}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-white/40 text-xs uppercase tracking-wider">
                        Código de recuperación
                      </label>
                      <input
                        type="text"
                        value={recoveryCode}
                        onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-3 px-4 text-white text-center text-lg tracking-widest font-mono placeholder:text-white/20 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all"
                        maxLength={6}
                        required
                        disabled={recoveryLoading}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-white/40 text-xs uppercase tracking-wider">
                        Nueva contraseña
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Mínimo 8 caracteres"
                          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-3 pl-10 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all"
                          required
                          disabled={recoveryLoading}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-white/40 text-xs uppercase tracking-wider">
                        Confirmar contraseña
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Repite la contraseña"
                          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-3 pl-10 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all"
                          required
                          disabled={recoveryLoading}
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <p className="text-xs text-amber-200/70">
                        Al restablecer tu contraseña, el 2FA será deshabilitado y deberás configurarlo nuevamente al iniciar sesión.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={recoveryLoading || recoveryCode.length !== 6}
                      className="w-full py-3 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {recoveryLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Restableciendo...
                        </>
                      ) : (
                        'Restablecer contraseña'
                      )}
                    </button>
                  </form>
                )}

                {/* Step 3: Success */}
                {recoveryStep === 'success' && (
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                        <CheckCircle className="w-8 h-8 text-green-400" />
                      </div>
                    </div>

                    <p className="text-sm text-white/60 text-center">
                      Tu contraseña ha sido restablecida y el 2FA ha sido deshabilitado.
                      Deberás configurar el 2FA nuevamente al iniciar sesión.
                    </p>

                    <button
                      onClick={resetRecovery}
                      className="w-full py-3 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                      Ir a iniciar sesión
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shooting stars */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="shooting-star dir-1" style={{ top: '10%', left: '20%', animationDelay: '0s' }} />
        <div className="shooting-star dir-2" style={{ top: '30%', right: '30%', animationDelay: '3s' }} />
      </div>
    </div>
  );
}
