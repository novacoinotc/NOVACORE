'use client';

import { useState, useEffect } from 'react';
import {
  Shield,
  Bell,
  CheckCircle,
  AlertTriangle,
  Smartphone,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const tabs = [
  { id: 'security', label: 'Seguridad', icon: Shield },
  { id: 'notifications', label: 'Notificaciones', icon: Bell },
];

export default function SettingsPage() {
  const { user, requiresTotpSetup, clearTotpSetupRequired } = useAuth();

  // Auto-open security tab (default tab now that API/Account/Webhooks are removed)
  const [activeTab, setActiveTab] = useState('security');

  // 2FA States
  const [twoFAEnabled, setTwoFAEnabled] = useState(user?.totpEnabled || false);
  const [twoFASetupMode, setTwoFASetupMode] = useState(false);
  const [twoFASecret, setTwoFASecret] = useState('');
  const [twoFAQrUri, setTwoFAQrUri] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [twoFAError, setTwoFAError] = useState('');
  const [twoFASuccess, setTwoFASuccess] = useState('');
  const [disablePassword, setDisablePassword] = useState('');

  // Update 2FA enabled state when user changes
  useEffect(() => {
    if (user?.totpEnabled !== undefined) {
      setTwoFAEnabled(user.totpEnabled);
    }
  }, [user?.totpEnabled]);

  // Get user ID from session
  const getUserId = () => {
    if (typeof window !== 'undefined') {
      const session = localStorage.getItem('novacorp_session');
      if (session) {
        try {
          const parsed = JSON.parse(session);
          return parsed.user?.id;
        } catch {
          return null;
        }
      }
    }
    return user?.id || null;
  };

  // Setup 2FA - Generate secret and QR code
  const handleSetup2FA = async () => {
    setTwoFALoading(true);
    setTwoFAError('');
    try {
      const userId = getUserId();
      if (!userId) {
        setTwoFAError('Sesión no válida. Por favor inicia sesión de nuevo.');
        return;
      }

      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setTwoFAError(data.error || 'Error al configurar 2FA');
        return;
      }

      setTwoFASecret(data.secret);
      setTwoFAQrUri(data.qrCodeUri);
      setTwoFASetupMode(true);
    } catch (error) {
      setTwoFAError('Error de conexión');
    } finally {
      setTwoFALoading(false);
    }
  };

  // Verify 2FA code and enable
  const handleVerify2FA = async () => {
    if (twoFACode.length !== 6) {
      setTwoFAError('El código debe ser de 6 dígitos');
      return;
    }

    setTwoFALoading(true);
    setTwoFAError('');
    try {
      const userId = getUserId();
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code: twoFACode }),
      });

      const data = await res.json();
      if (!res.ok) {
        setTwoFAError(data.error || 'Código inválido');
        return;
      }

      setTwoFAEnabled(true);
      setTwoFASetupMode(false);
      setTwoFASuccess('2FA habilitado correctamente. Ya puedes acceder a todas las funciones.');
      setTwoFACode('');
      setTwoFASecret('');
      setTwoFAQrUri('');

      // Clear the 2FA setup requirement in the auth context
      clearTotpSetupRequired();
    } catch (error) {
      setTwoFAError('Error de conexión');
    } finally {
      setTwoFALoading(false);
    }
  };

  // Disable 2FA
  const handleDisable2FA = async () => {
    if (!disablePassword) {
      setTwoFAError('Ingresa tu contraseña para deshabilitar 2FA');
      return;
    }

    setTwoFALoading(true);
    setTwoFAError('');
    try {
      const userId = getUserId();
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password: disablePassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setTwoFAError(data.error || 'Error al deshabilitar 2FA');
        return;
      }

      setTwoFAEnabled(false);
      setDisablePassword('');
      setTwoFASuccess('2FA deshabilitado');
    } catch (error) {
      setTwoFAError('Error de conexión');
    } finally {
      setTwoFALoading(false);
    }
  };

  // Generate QR code URL using Google Charts API
  const getQRCodeUrl = (uri: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'security':
        return (
          <div className="space-y-4">
            {/* 2FA Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-white/40" />
                  Autenticación de 2 Factores (2FA)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Success/Error Messages */}
                {twoFAError && (
                  <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <p className="text-sm text-red-400">{twoFAError}</p>
                  </div>
                )}
                {twoFASuccess && (
                  <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <p className="text-sm text-green-400">{twoFASuccess}</p>
                  </div>
                )}

                {/* 2FA Not Enabled - Show Setup Button */}
                {!twoFAEnabled && !twoFASetupMode && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-md bg-yellow-500/5 border border-yellow-500/10">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-400/80 mt-0.5" />
                        <div>
                          <p className="text-sm text-white/80 font-medium">2FA no está habilitado</p>
                          <p className="text-xs text-white/40 mt-1">
                            Protege tu cuenta con autenticación de dos factores usando Google Authenticator.
                            Será obligatorio para iniciar sesión y realizar transferencias SPEI.
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={handleSetup2FA}
                      disabled={twoFALoading}
                      leftIcon={twoFALoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                    >
                      {twoFALoading ? 'Configurando...' : 'Habilitar 2FA'}
                    </Button>
                  </div>
                )}

                {/* 2FA Setup Mode - Show QR Code */}
                {twoFASetupMode && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-md bg-white/[0.02] border border-white/[0.06]">
                      <p className="text-sm text-white/80 font-medium mb-3">Paso 1: Escanea el código QR</p>
                      <p className="text-xs text-white/40 mb-4">
                        Abre Google Authenticator y escanea este código QR para agregar tu cuenta.
                      </p>
                      <div className="flex justify-center mb-4">
                        <div className="p-3 bg-white rounded-lg">
                          <img
                            src={getQRCodeUrl(twoFAQrUri)}
                            alt="QR Code para 2FA"
                            className="w-48 h-48"
                          />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-white/40 mb-1">¿No puedes escanear? Ingresa este código manualmente:</p>
                        <code className="text-sm text-white/80 bg-white/5 px-3 py-1 rounded font-mono">
                          {twoFASecret}
                        </code>
                      </div>
                    </div>

                    <div className="p-4 rounded-md bg-white/[0.02] border border-white/[0.06]">
                      <p className="text-sm text-white/80 font-medium mb-3">Paso 2: Verifica el código</p>
                      <p className="text-xs text-white/40 mb-4">
                        Ingresa el código de 6 dígitos que muestra Google Authenticator.
                      </p>
                      <div className="flex gap-3">
                        <Input
                          value={twoFACode}
                          onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                          className="font-mono text-center text-lg tracking-widest"
                          maxLength={6}
                        />
                        <Button
                          onClick={handleVerify2FA}
                          disabled={twoFALoading || twoFACode.length !== 6}
                        >
                          {twoFALoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verificar'}
                        </Button>
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      onClick={() => {
                        setTwoFASetupMode(false);
                        setTwoFASecret('');
                        setTwoFAQrUri('');
                        setTwoFACode('');
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                )}

                {/* 2FA Enabled - Show Status and Disable Option */}
                {twoFAEnabled && !twoFASetupMode && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-md bg-green-500/5 border border-green-500/20">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-green-500/10">
                          <Shield className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                          <p className="text-sm text-white/80 font-medium">2FA Habilitado</p>
                          <p className="text-xs text-white/40">Tu cuenta está protegida con autenticación de dos factores</p>
                        </div>
                      </div>
                      <Badge variant="success">Activo</Badge>
                    </div>

                    <div className="p-4 rounded-md bg-white/[0.02] border border-white/[0.06]">
                      <p className="text-sm text-white/80 font-medium mb-2">Deshabilitar 2FA</p>
                      <p className="text-xs text-white/40 mb-3">
                        Para deshabilitar 2FA, ingresa tu contraseña. Esto reducirá la seguridad de tu cuenta.
                      </p>
                      <div className="flex gap-3">
                        <Input
                          type="password"
                          value={disablePassword}
                          onChange={(e) => setDisablePassword(e.target.value)}
                          placeholder="Tu contraseña"
                        />
                        <Button
                          variant="secondary"
                          onClick={handleDisable2FA}
                          disabled={twoFALoading}
                          className="text-red-400 hover:text-red-300"
                        >
                          {twoFALoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Deshabilitar'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'notifications':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-white/40" />
                Preferencias de Notificaciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Depositos recibidos', description: 'Notificar cuando llegue un SPEI' },
                { label: 'Ordenes liquidadas', description: 'Confirmar dispersiones exitosas' },
                { label: 'Ordenes rechazadas', description: 'Alertar sobre devoluciones' },
                { label: 'Alertas de seguridad', description: 'Intentos de acceso sospechosos' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between p-3 rounded-md bg-white/[0.02]"
                >
                  <div>
                    <p className="text-sm text-white/80">{item.label}</p>
                    <p className="text-xs text-white/30">{item.description}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white/60 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-white/20"></div>
                  </label>
                </div>
              ))}
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 2FA Required Warning Banner */}
      {requiresTotpSetup && !twoFAEnabled && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-amber-300">Configuración de seguridad requerida</h3>
            <p className="text-xs text-amber-200/70 mt-1">
              Para continuar usando el sistema, debes configurar la autenticación de dos factores (2FA).
              Esto protegerá tu cuenta y será necesario para iniciar sesión y realizar transferencias SPEI.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl font-medium text-white/90">Configuracion</h1>
        <p className="text-sm text-white/40 mt-1">Administra credenciales y preferencias</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Tabs */}
        <div className="lg:w-48 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left',
                    activeTab === tab.id
                      ? 'bg-white/[0.08] text-white'
                      : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">{renderTabContent()}</div>
      </div>
    </div>
  );
}
