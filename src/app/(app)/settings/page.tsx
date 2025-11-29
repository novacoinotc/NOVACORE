'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  Key,
  Building2,
  Shield,
  Bell,
  Palette,
  Globe,
  Server,
  CheckCircle,
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
} from '@/components/ui';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'api', label: 'API & Credenciales', icon: Key },
  { id: 'account', label: 'Cuenta Ordenante', icon: Building2 },
  { id: 'webhooks', label: 'Webhooks', icon: Server },
  { id: 'security', label: 'Seguridad', icon: Shield },
  { id: 'notifications', label: 'Notificaciones', icon: Bell },
  { id: 'appearance', label: 'Apariencia', icon: Palette },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('api');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState('your-api-key-here');
  const [environment, setEnvironment] = useState('uat');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'api':
        return (
          <div className="space-y-6">
            {/* Environment Toggle */}
            <Card variant="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-accent-primary" />
                  Ambiente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <button
                    onClick={() => setEnvironment('uat')}
                    className={cn(
                      'flex-1 p-4 rounded-xl border-2 transition-all duration-300',
                      environment === 'uat'
                        ? 'border-yellow-500 bg-yellow-500/10'
                        : 'border-white/10 hover:border-white/20'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-4 h-4 rounded-full',
                          environment === 'uat' ? 'bg-yellow-500' : 'bg-dark-500'
                        )}
                      />
                      <div className="text-left">
                        <p className="font-semibold text-white">UAT (Pruebas)</p>
                        <p className="text-sm text-gray-500">apiuat.opm.mx</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setEnvironment('production')}
                    className={cn(
                      'flex-1 p-4 rounded-xl border-2 transition-all duration-300',
                      environment === 'production'
                        ? 'border-green-500 bg-green-500/10'
                        : 'border-white/10 hover:border-white/20'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-4 h-4 rounded-full',
                          environment === 'production' ? 'bg-green-500' : 'bg-dark-500'
                        )}
                      />
                      <div className="text-left">
                        <p className="font-semibold text-white">Produccion</p>
                        <p className="text-sm text-gray-500">api.opm.mx</p>
                      </div>
                    </div>
                  </button>
                </div>

                {environment === 'production' && (
                  <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    <p className="text-sm text-yellow-400">
                      Las operaciones en produccion afectan cuentas reales
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* API Key */}
            <Card variant="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-neon-cyan" />
                  API Key
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    variant="glass"
                    className="font-mono"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="p-1 hover:bg-white/5 rounded"
                    >
                      {showApiKey ? (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    <button className="p-1 hover:bg-white/5 rounded">
                      <Copy className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="success">
                    Activa
                  </Badge>
                  <span className="text-sm text-gray-500">
                    Ultima vez usada: hace 2 minutos
                  </span>
                </div>

                <Button variant="secondary" leftIcon={<RefreshCw className="w-4 h-4" />}>
                  Regenerar API Key
                </Button>
              </CardContent>
            </Card>

            {/* RSA Keys */}
            <Card variant="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-neon-purple" />
                  Llaves RSA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-dark-700 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">Llave Privada</span>
                      <Badge variant="success" size="sm">
                        Configurada
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 font-mono truncate">
                      -----BEGIN PRIVATE KEY-----
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-dark-700 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">Llave Publica</span>
                      <Badge variant="success" size="sm">
                        Configurada
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 font-mono truncate">
                      -----BEGIN PUBLIC KEY-----
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="secondary" size="sm">
                    Subir Llave Privada
                  </Button>
                  <Button variant="secondary" size="sm">
                    Subir Llave Publica
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'account':
        return (
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-accent-primary" />
                Cuenta Ordenante
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-400 text-sm">
                Configura los datos de la cuenta desde la cual se realizaran las transferencias
                salientes.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="CLABE Ordenante"
                  placeholder="684180017000000001"
                  variant="glass"
                  hint="Cuenta operativa para dispersiones"
                />
                <Select
                  label="Banco Ordenante"
                  options={[
                    { value: '90684', label: 'OPM/TRANSFER' },
                    { value: '40012', label: 'BBVA MEXICO' },
                  ]}
                  variant="glass"
                />
              </div>

              <Input
                label="Nombre Ordenante"
                placeholder="NOVACORE SA DE CV"
                variant="glass"
                hint="Sin acentos ni caracteres especiales"
              />

              <Input
                label="RFC Ordenante (Opcional)"
                placeholder="NOV200101AAA"
                variant="glass"
              />

              <Button leftIcon={<Save className="w-4 h-4" />}>Guardar Cambios</Button>
            </CardContent>
          </Card>
        );

      case 'webhooks':
        return (
          <div className="space-y-6">
            <Card variant="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-green-400" />
                  Endpoints de Webhook
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="URL Webhook - Depositos (SPEI In)"
                  placeholder="https://tu-dominio.com/api/webhooks/deposit"
                  variant="glass"
                  hint="Recibe notificaciones de depositos entrantes"
                />

                <Input
                  label="URL Webhook - Estado de Ordenes"
                  placeholder="https://tu-dominio.com/api/webhooks/order-status"
                  variant="glass"
                  hint="Recibe cambios de estado en ordenes salientes"
                />

                <Input
                  label="Secret del Webhook"
                  type="password"
                  placeholder="whsec_xxxxxxxxxx"
                  variant="glass"
                  hint="Para verificar la autenticidad de las notificaciones"
                />

                <Button leftIcon={<Save className="w-4 h-4" />}>Guardar Configuracion</Button>
              </CardContent>
            </Card>

            <Card variant="glass">
              <CardHeader>
                <CardTitle>Eventos Recientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { type: 'supply', status: 'success', time: 'Hace 2 min' },
                    { type: 'orderStatus', status: 'success', time: 'Hace 5 min' },
                    { type: 'supply', status: 'failed', time: 'Hace 15 min' },
                  ].map((event, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg bg-dark-700"
                    >
                      <div className="flex items-center gap-3">
                        {event.status === 'success' ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-red-400" />
                        )}
                        <div>
                          <p className="text-white font-medium">{event.type}</p>
                          <p className="text-xs text-gray-500">{event.time}</p>
                        </div>
                      </div>
                      <Badge variant={event.status === 'success' ? 'success' : 'danger'}>
                        {event.status === 'success' ? 'Exitoso' : 'Fallido'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'security':
        return (
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-neon-cyan" />
                Seguridad
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-xl bg-dark-700 border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <Shield className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Autenticacion de 2 Factores</p>
                    <p className="text-sm text-gray-500">Protege tu cuenta con 2FA</p>
                  </div>
                </div>
                <Badge variant="success">Activo</Badge>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  IPs Permitidas
                </label>
                <div className="space-y-2">
                  {['192.168.1.100', '10.0.0.50', '203.45.67.89'].map((ip) => (
                    <div
                      key={ip}
                      className="flex items-center justify-between p-2 rounded-lg bg-dark-700"
                    >
                      <span className="font-mono text-gray-300">{ip}</span>
                      <button className="text-red-400 hover:text-red-300">Eliminar</button>
                    </div>
                  ))}
                </div>
                <Button variant="secondary" size="sm" className="mt-3">
                  Agregar IP
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'notifications':
        return (
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-yellow-400" />
                Preferencias de Notificaciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'Depositos recibidos', description: 'Notificar cuando llegue un SPEI' },
                { label: 'Ordenes liquidadas', description: 'Confirmar dispersiones exitosas' },
                { label: 'Ordenes rechazadas', description: 'Alertar sobre devoluciones' },
                { label: 'Alertas de seguridad', description: 'Intentos de acceso sospechosos' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between p-4 rounded-xl bg-dark-700"
                >
                  <div>
                    <p className="font-medium text-white">{item.label}</p>
                    <p className="text-sm text-gray-500">{item.description}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-dark-500 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-primary"></div>
                  </label>
                </div>
              ))}
            </CardContent>
          </Card>
        );

      case 'appearance':
        return (
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-neon-pink" />
                Apariencia
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Color de Acento
                </label>
                <div className="flex gap-3">
                  {[
                    { name: 'Cyan', color: 'bg-neon-cyan' },
                    { name: 'Purple', color: 'bg-neon-purple' },
                    { name: 'Pink', color: 'bg-neon-pink' },
                    { name: 'Blue', color: 'bg-neon-blue' },
                    { name: 'Green', color: 'bg-neon-green' },
                  ].map((c) => (
                    <button
                      key={c.name}
                      className={cn(
                        'w-10 h-10 rounded-xl transition-all duration-200 hover:scale-110',
                        c.color,
                        c.name === 'Cyan' && 'ring-2 ring-white'
                      )}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Efectos Visuales
                </label>
                <div className="space-y-3">
                  {[
                    { label: 'Particulas de fondo', enabled: true },
                    { label: 'Efectos de brillo', enabled: true },
                    { label: 'Animaciones', enabled: true },
                  ].map((effect) => (
                    <div
                      key={effect.label}
                      className="flex items-center justify-between p-3 rounded-lg bg-dark-700"
                    >
                      <span className="text-gray-300">{effect.label}</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          defaultChecked={effect.enabled}
                        />
                        <div className="w-11 h-6 bg-dark-500 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-primary"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-display font-bold text-white">Configuracion</h1>
        <p className="text-gray-400 mt-1">
          Administra las credenciales, webhooks y preferencias del sistema
        </p>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Tabs */}
        <div className="lg:w-64 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-left',
                    activeTab === tab.id
                      ? 'bg-accent-primary/20 text-white border border-accent-primary/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            {renderTabContent()}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
