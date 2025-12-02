'use client';

import { useState } from 'react';
import {
  Key,
  Building2,
  Shield,
  Bell,
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
  { id: 'api', label: 'API', icon: Key },
  { id: 'account', label: 'Cuenta', icon: Building2 },
  { id: 'webhooks', label: 'Webhooks', icon: Server },
  { id: 'security', label: 'Seguridad', icon: Shield },
  { id: 'notifications', label: 'Notificaciones', icon: Bell },
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
          <div className="space-y-4">
            {/* Environment Toggle */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-white/40" />
                  Ambiente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <button
                    onClick={() => setEnvironment('uat')}
                    className={cn(
                      'flex-1 p-4 rounded-lg border transition-colors',
                      environment === 'uat'
                        ? 'border-yellow-500/50 bg-yellow-500/5'
                        : 'border-white/[0.06] hover:border-white/10'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-3 h-3 rounded-full',
                          environment === 'uat' ? 'bg-yellow-500/80' : 'bg-white/10'
                        )}
                      />
                      <div className="text-left">
                        <p className="text-sm text-white/80">UAT (Pruebas)</p>
                        <p className="text-xs text-white/30">apiuat.opm.mx</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setEnvironment('production')}
                    className={cn(
                      'flex-1 p-4 rounded-lg border transition-colors',
                      environment === 'production'
                        ? 'border-green-500/50 bg-green-500/5'
                        : 'border-white/[0.06] hover:border-white/10'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-3 h-3 rounded-full',
                          environment === 'production' ? 'bg-green-500/80' : 'bg-white/10'
                        )}
                      />
                      <div className="text-left">
                        <p className="text-sm text-white/80">Produccion</p>
                        <p className="text-xs text-white/30">api.opm.mx</p>
                      </div>
                    </div>
                  </button>
                </div>

                {environment === 'production' && (
                  <div className="mt-4 p-3 rounded-md bg-yellow-500/5 border border-yellow-500/10 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400/60" />
                    <p className="text-xs text-yellow-400/80">
                      Las operaciones en produccion afectan cuentas reales
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* API Key */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-white/40" />
                  API Key
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="font-mono pr-20"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="p-1 hover:bg-white/5 rounded"
                    >
                      {showApiKey ? (
                        <EyeOff className="w-4 h-4 text-white/30" />
                      ) : (
                        <Eye className="w-4 h-4 text-white/30" />
                      )}
                    </button>
                    <button className="p-1 hover:bg-white/5 rounded">
                      <Copy className="w-4 h-4 text-white/30" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="success">Activa</Badge>
                  <span className="text-xs text-white/30">Ultima vez usada: hace 2 minutos</span>
                </div>

                <Button variant="secondary" leftIcon={<RefreshCw className="w-4 h-4" />}>
                  Regenerar API Key
                </Button>
              </CardContent>
            </Card>

            {/* RSA Keys */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-white/40" />
                  Llaves RSA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-white/40">Llave Privada</span>
                      <Badge variant="success" size="sm">OK</Badge>
                    </div>
                    <p className="text-[10px] text-white/20 font-mono truncate">
                      -----BEGIN PRIVATE KEY-----
                    </p>
                  </div>
                  <div className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-white/40">Llave Publica</span>
                      <Badge variant="success" size="sm">OK</Badge>
                    </div>
                    <p className="text-[10px] text-white/20 font-mono truncate">
                      -----BEGIN PUBLIC KEY-----
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="secondary" size="sm">Subir Privada</Button>
                  <Button variant="secondary" size="sm">Subir Publica</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'account':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-white/40" />
                Cuenta Ordenante
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-white/40">
                Configura los datos de la cuenta para transferencias salientes.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="CLABE Ordenante"
                  placeholder="684180017000000001"
                  hint="Cuenta operativa para dispersiones"
                />
                <Select
                  label="Banco Ordenante"
                  options={[
                    { value: '90684', label: 'OPM/TRANSFER' },
                    { value: '40012', label: 'BBVA MEXICO' },
                  ]}
                />
              </div>

              <Input
                label="Nombre Ordenante"
                placeholder="NOVACORP SA DE CV"
                hint="Sin acentos ni caracteres especiales"
              />

              <Input
                label="RFC Ordenante (Opcional)"
                placeholder="NOV200101AAA"
              />

              <Button leftIcon={<Save className="w-4 h-4" />}>Guardar Cambios</Button>
            </CardContent>
          </Card>
        );

      case 'webhooks':
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-green-400/60" />
                  Endpoints de Webhook
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="URL Webhook - Depositos (SPEI In)"
                  placeholder="https://tu-dominio.com/api/webhooks/deposit"
                  hint="Recibe notificaciones de depositos entrantes"
                />

                <Input
                  label="URL Webhook - Estado de Ordenes"
                  placeholder="https://tu-dominio.com/api/webhooks/order-status"
                  hint="Recibe cambios de estado en ordenes salientes"
                />

                <Input
                  label="Secret del Webhook"
                  type="password"
                  placeholder="whsec_xxxxxxxxxx"
                  hint="Para verificar la autenticidad de las notificaciones"
                />

                <Button leftIcon={<Save className="w-4 h-4" />}>Guardar Configuracion</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Eventos Recientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { type: 'supply', status: 'success', time: 'Hace 2 min' },
                    { type: 'orderStatus', status: 'success', time: 'Hace 5 min' },
                    { type: 'supply', status: 'failed', time: 'Hace 15 min' },
                  ].map((event, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-md bg-white/[0.02]"
                    >
                      <div className="flex items-center gap-3">
                        {event.status === 'success' ? (
                          <CheckCircle className="w-4 h-4 text-green-400/80" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-400/80" />
                        )}
                        <div>
                          <p className="text-sm text-white/80">{event.type}</p>
                          <p className="text-xs text-white/30">{event.time}</p>
                        </div>
                      </div>
                      <Badge variant={event.status === 'success' ? 'success' : 'danger'}>
                        {event.status === 'success' ? 'OK' : 'Error'}
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-white/40" />
                Seguridad
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-md bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-green-500/10">
                    <Shield className="w-4 h-4 text-green-400/80" />
                  </div>
                  <div>
                    <p className="text-sm text-white/80">Autenticacion de 2 Factores</p>
                    <p className="text-xs text-white/40">Protege tu cuenta con 2FA</p>
                  </div>
                </div>
                <Badge variant="success">Activo</Badge>
              </div>

              <div>
                <label className="block text-xs text-white/40 mb-2">IPs Permitidas</label>
                <div className="space-y-2">
                  {['192.168.1.100', '10.0.0.50', '203.45.67.89'].map((ip) => (
                    <div
                      key={ip}
                      className="flex items-center justify-between p-2 rounded-md bg-white/[0.02]"
                    >
                      <span className="font-mono text-sm text-white/60">{ip}</span>
                      <button className="text-xs text-red-400/80 hover:text-red-400">Eliminar</button>
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
