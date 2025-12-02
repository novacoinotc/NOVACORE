'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  ArrowLeft,
  Users,
  CreditCard,
  History,
  Settings,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Percent,
  Ban,
  Check,
  Save,
  X,
} from 'lucide-react';
import { useAuth, useRequirePermission } from '@/context/AuthContext';
import { Company, Transaction } from '@/types';

interface CompanyUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  lastLogin: number | null;
  createdAt: number;
}

interface ClabeAccount {
  id: string;
  clabe: string;
  alias: string;
  description: string | null;
  isActive: boolean;
  createdAt: number;
}

interface CompanyDetails {
  company: Company;
  users: CompanyUser[];
  clabeAccounts: ClabeAccount[];
  transactions: Transaction[];
  stats: {
    totalIncoming: number;
    totalOutgoing: number;
    transactionCount: number;
  };
}

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser, hasPermission } = useAuth();
  const { isLoading: permLoading, hasAccess } = useRequirePermission('companies.view');

  const [data, setData] = useState<CompanyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'clabe' | 'history' | 'settings'>('overview');

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    speiInEnabled: true,
    speiOutEnabled: true,
    commissionPercentage: 0,
    parentClabe: '',
  });
  const [settingsChanged, setSettingsChanged] = useState(false);

  const companyId = params.id as string;

  // Get session headers
  const getHeaders = () => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    try {
      const sessionStr = localStorage.getItem('novacorp_session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session.user?.id) {
          headers['x-user-id'] = session.user.id;
        }
      }
    } catch (e) {}
    return headers;
  };

  // Fetch company details
  const fetchCompanyDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/companies/${companyId}?details=true`, {
        headers: getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('No tienes permiso para ver esta empresa');
        }
        if (response.status === 404) {
          throw new Error('Empresa no encontrada');
        }
        throw new Error('Error al cargar datos de la empresa');
      }

      const details = await response.json();

      // Transform transactions dates
      const transformedTransactions = details.transactions?.map((tx: any) => ({
        ...tx,
        date: new Date(tx.date),
      })) || [];

      setData({
        ...details,
        transactions: transformedTransactions,
      });

      // Initialize settings form
      setSettingsForm({
        speiInEnabled: details.company.speiInEnabled,
        speiOutEnabled: details.company.speiOutEnabled,
        commissionPercentage: details.company.commissionPercentage || 0,
        parentClabe: details.company.parentClabe || '',
      });
    } catch (err) {
      console.error('Fetch company error:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasAccess && companyId) {
      fetchCompanyDetails();
    }
  }, [hasAccess, companyId]);

  // Handle settings change
  const handleSettingsChange = (field: string, value: any) => {
    setSettingsForm(prev => ({ ...prev, [field]: value }));
    setSettingsChanged(true);
  };

  // Save settings
  const handleSaveSettings = async () => {
    if (!data) return;

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/companies/${companyId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          speiInEnabled: settingsForm.speiInEnabled,
          speiOutEnabled: settingsForm.speiOutEnabled,
          commissionPercentage: settingsForm.commissionPercentage,
          parentClabe: settingsForm.parentClabe || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al guardar configuración');
      }

      // Refresh data
      await fetchCompanyDetails();
      setSettingsChanged(false);
    } catch (err) {
      console.error('Save settings error:', err);
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  // Format date
  const formatDate = (timestamp: number | Date) => {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (permLoading || !hasAccess) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={() => router.push('/companies')}
          className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] text-white rounded-lg text-sm"
        >
          Volver a empresas
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { company, users, clabeAccounts, transactions, stats } = data;
  const isSuperAdmin = currentUser?.role === 'super_admin';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/companies')}
          className="p-2 hover:bg-white/[0.05] rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white/60" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-violet-600/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-purple-400" />
            </div>
            {company.name}
          </h1>
          <p className="text-white/40 text-sm mt-1">{company.businessName}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              company.isActive
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${company.isActive ? 'bg-green-400' : 'bg-red-400'}`} />
            {company.isActive ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-white/40 text-xs">Entradas</p>
              <p className="text-white font-semibold">{formatCurrency(stats.totalIncoming)}</p>
            </div>
          </div>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-white/40 text-xs">Salidas</p>
              <p className="text-white font-semibold">{formatCurrency(stats.totalOutgoing)}</p>
            </div>
          </div>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-white/40 text-xs">Usuarios</p>
              <p className="text-white font-semibold">{users.length}</p>
            </div>
          </div>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-white/40 text-xs">Cuentas CLABE</p>
              <p className="text-white font-semibold">{clabeAccounts.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/[0.02] rounded-lg w-fit">
        {[
          { id: 'overview', label: 'General', icon: Building2 },
          { id: 'users', label: 'Usuarios', icon: Users },
          { id: 'clabe', label: 'CLABE', icon: CreditCard },
          { id: 'history', label: 'Historial', icon: History },
          ...(isSuperAdmin ? [{ id: 'settings', label: 'Configuración', icon: Settings }] : []),
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white'
                : 'text-white/60 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
        >
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Información General</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-1">RFC</p>
                    <p className="text-white font-mono">{company.rfc}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Email</p>
                    <p className="text-white">{company.email}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Teléfono</p>
                    <p className="text-white">{company.phone || 'No registrado'}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Dirección</p>
                    <p className="text-white">{company.address || 'No registrada'}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Creada</p>
                    <p className="text-white">{formatDate(company.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Comisión</p>
                    <p className="text-white">{company.commissionPercentage}%</p>
                  </div>
                </div>
              </div>

              {/* SPEI Status */}
              <div className="mt-6 pt-6 border-t border-white/[0.06]">
                <h4 className="text-sm font-medium text-white mb-3">Estado SPEI</h4>
                <div className="flex gap-4">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                    company.speiInEnabled ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}>
                    {company.speiInEnabled ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className={company.speiInEnabled ? 'text-green-400' : 'text-red-400'}>
                      SPEI IN {company.speiInEnabled ? 'Habilitado' : 'Bloqueado'}
                    </span>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                    company.speiOutEnabled ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}>
                    {company.speiOutEnabled ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className={company.speiOutEnabled ? 'text-green-400' : 'text-red-400'}>
                      SPEI OUT {company.speiOutEnabled ? 'Habilitado' : 'Bloqueado'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/[0.06]">
                <h3 className="text-lg font-semibold text-white">Usuarios ({users.length})</h3>
              </div>
              {users.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="w-12 h-12 text-white/20 mx-auto mb-3" />
                  <p className="text-white/40">No hay usuarios registrados</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {users.map((user) => (
                    <div key={user.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02]">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white font-semibold">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-medium">{user.name}</p>
                          <p className="text-white/40 text-sm">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          user.role === 'company_admin'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-gray-500/10 text-gray-400'
                        }`}>
                          {user.role === 'company_admin' ? 'Admin' : 'Usuario'}
                        </span>
                        <span className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-green-400' : 'bg-red-400'}`} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CLABE Tab */}
          {activeTab === 'clabe' && (
            <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/[0.06]">
                <h3 className="text-lg font-semibold text-white">Cuentas CLABE ({clabeAccounts.length})</h3>
              </div>
              {clabeAccounts.length === 0 ? (
                <div className="p-8 text-center">
                  <CreditCard className="w-12 h-12 text-white/20 mx-auto mb-3" />
                  <p className="text-white/40">No hay cuentas CLABE registradas</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {clabeAccounts.map((clabe) => (
                    <div key={clabe.id} className="p-4 hover:bg-white/[0.02]">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-white font-medium">{clabe.alias}</p>
                        <span className={`w-2 h-2 rounded-full ${clabe.isActive ? 'bg-green-400' : 'bg-red-400'}`} />
                      </div>
                      <p className="text-white/60 font-mono text-sm">{clabe.clabe}</p>
                      {clabe.description && (
                        <p className="text-white/40 text-xs mt-1">{clabe.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/[0.06]">
                <h3 className="text-lg font-semibold text-white">Historial de Transacciones ({stats.transactionCount})</h3>
              </div>
              {transactions.length === 0 ? (
                <div className="p-8 text-center">
                  <History className="w-12 h-12 text-white/20 mx-auto mb-3" />
                  <p className="text-white/40">No hay transacciones registradas</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="p-4 hover:bg-white/[0.02]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            tx.type === 'incoming' ? 'bg-green-500/10' : 'bg-red-500/10'
                          }`}>
                            {tx.type === 'incoming' ? (
                              <ArrowDownLeft className="w-4 h-4 text-green-400" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4 text-red-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-white font-medium">{tx.concept || 'Sin concepto'}</p>
                            <p className="text-white/40 text-xs">{tx.trackingKey}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${tx.type === 'incoming' ? 'text-green-400' : 'text-red-400'}`}>
                            {tx.type === 'incoming' ? '+' : '-'}{formatCurrency(tx.amount)}
                          </p>
                          <p className="text-white/40 text-xs">{formatDate(tx.date)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Settings Tab (Super Admin Only) */}
          {activeTab === 'settings' && isSuperAdmin && (
            <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Configuración de Empresa</h3>

              <div className="space-y-6">
                {/* SPEI Controls */}
                <div>
                  <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                    <Ban className="w-4 h-4 text-purple-400" />
                    Control de SPEI
                  </h4>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-4 bg-white/[0.02] rounded-lg cursor-pointer hover:bg-white/[0.04]">
                      <div>
                        <p className="text-white font-medium">SPEI IN (Recibir)</p>
                        <p className="text-white/40 text-sm">Permitir recibir transferencias SPEI</p>
                      </div>
                      <button
                        onClick={() => handleSettingsChange('speiInEnabled', !settingsForm.speiInEnabled)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          settingsForm.speiInEnabled ? 'bg-green-500' : 'bg-white/20'
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                            settingsForm.speiInEnabled ? 'left-7' : 'left-1'
                          }`}
                        />
                      </button>
                    </label>
                    <label className="flex items-center justify-between p-4 bg-white/[0.02] rounded-lg cursor-pointer hover:bg-white/[0.04]">
                      <div>
                        <p className="text-white font-medium">SPEI OUT (Enviar)</p>
                        <p className="text-white/40 text-sm">Permitir enviar transferencias SPEI</p>
                      </div>
                      <button
                        onClick={() => handleSettingsChange('speiOutEnabled', !settingsForm.speiOutEnabled)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          settingsForm.speiOutEnabled ? 'bg-green-500' : 'bg-white/20'
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                            settingsForm.speiOutEnabled ? 'left-7' : 'left-1'
                          }`}
                        />
                      </button>
                    </label>
                  </div>
                </div>

                {/* Commission Settings */}
                <div>
                  <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                    <Percent className="w-4 h-4 text-purple-400" />
                    Comisiones
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-white/40 text-xs uppercase tracking-wider block mb-2">
                        Porcentaje de comisión (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={settingsForm.commissionPercentage}
                        onChange={(e) => handleSettingsChange('commissionPercentage', parseFloat(e.target.value) || 0)}
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 px-4 text-white text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
                      />
                      <p className="text-white/40 text-xs mt-1">
                        Este porcentaje se cobrará automáticamente sobre todas las transacciones
                      </p>
                    </div>
                    <div>
                      <label className="text-white/40 text-xs uppercase tracking-wider block mb-2">
                        CLABE destino de comisiones (cuenta madre)
                      </label>
                      <input
                        type="text"
                        maxLength={18}
                        value={settingsForm.parentClabe}
                        onChange={(e) => handleSettingsChange('parentClabe', e.target.value.replace(/\D/g, ''))}
                        placeholder="000000000000000000"
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 px-4 text-white text-sm font-mono focus:outline-none focus:border-purple-500/50 transition-colors"
                      />
                      <p className="text-white/40 text-xs mt-1">
                        Las comisiones serán transferidas automáticamente a esta cuenta CLABE
                      </p>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                {settingsChanged && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.06]"
                  >
                    <button
                      onClick={() => {
                        setSettingsForm({
                          speiInEnabled: company.speiInEnabled,
                          speiOutEnabled: company.speiOutEnabled,
                          commissionPercentage: company.commissionPercentage || 0,
                          parentClabe: company.parentClabe || '',
                        });
                        setSettingsChanged(false);
                      }}
                      className="px-4 py-2 text-white/60 hover:text-white transition-colors text-sm flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Cancelar
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSaveSettings}
                      disabled={saving}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Guardar cambios
                    </motion.button>
                  </motion.div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
