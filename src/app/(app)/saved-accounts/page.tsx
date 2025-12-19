'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  Search,
  Plus,
  Copy,
  Edit,
  Trash2,
  Building2,
  Check,
  AlertCircle,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Card,
  CardContent,
  Badge,
  Modal,
} from '@/components/ui';
import { cn, formatDate, validateClabe } from '@/lib/utils';
import { SavedAccount, Bank } from '@/types';
import { useAuth, getAuthHeaders } from '@/context/AuthContext';
import { getBankFromClabe, getAllBanks, BankInfo } from '@/lib/banks';

export default function SavedAccountsPage() {
  const { user } = useAuth();
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [localBanks, setLocalBanks] = useState<BankInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<SavedAccount | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedBank, setDetectedBank] = useState<BankInfo | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    alias: '',
    clabe: '',
    bankCode: '',
    bankName: '',
    beneficiaryName: '',
    beneficiaryRfc: '',
    notes: '',
  });

  // Fetch saved accounts
  const fetchSavedAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/saved-accounts', {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Error al cargar cuentas guardadas');
      }

      const data = await response.json();
      setSavedAccounts(data);
    } catch (err) {
      console.error('Error fetching saved accounts:', err);
      setError('Error al cargar cuentas guardadas');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Fetch banks from API
  const fetchBanks = useCallback(async () => {
    try {
      const response = await fetch('/api/banks');
      if (response.ok) {
        const data = await response.json();
        setBanks(data.banks || data || []);
      }
    } catch (err) {
      console.error('Error fetching banks:', err);
    }
  }, []);

  // Load local bank list
  useEffect(() => {
    setLocalBanks(getAllBanks());
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchSavedAccounts();
      fetchBanks();
    }
  }, [user?.id, fetchSavedAccounts, fetchBanks]);

  // Auto-detect bank from CLABE
  useEffect(() => {
    if (formData.clabe.length >= 3) {
      const bank = getBankFromClabe(formData.clabe);
      setDetectedBank(bank);

      // Auto-fill bank if detected and not already set
      if (bank && !formData.bankCode) {
        setFormData((prev) => ({
          ...prev,
          bankCode: bank.code,
          bankName: bank.shortName,
        }));
      }
    } else {
      setDetectedBank(null);
    }
  }, [formData.clabe]);

  // Handle CLABE input change with auto-detection
  const handleClabeChange = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    setFormData((prev) => ({ ...prev, clabe: cleanValue }));

    // If CLABE is being cleared or changed significantly, reset bank
    if (cleanValue.length < 3) {
      setDetectedBank(null);
    }
  };

  // Filter accounts
  const filteredAccounts = savedAccounts.filter((account) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      account.alias.toLowerCase().includes(searchLower) ||
      account.beneficiaryName.toLowerCase().includes(searchLower) ||
      account.clabe.includes(searchQuery) ||
      account.bankName.toLowerCase().includes(searchLower)
    );
  });

  // Copy CLABE to clipboard
  const copyToClipboard = async (clabe: string, id: string) => {
    await navigator.clipboard.writeText(clabe);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      alias: '',
      clabe: '',
      bankCode: '',
      bankName: '',
      beneficiaryName: '',
      beneficiaryRfc: '',
      notes: '',
    });
    setError(null);
  };

  // Handle bank selection (manual)
  const handleBankChange = (bankCode: string) => {
    // First try to find in local banks (more complete list)
    const localBank = localBanks.find((b) => b.code === bankCode);
    if (localBank) {
      setFormData((prev) => ({
        ...prev,
        bankCode: localBank.code,
        bankName: localBank.shortName,
      }));
      return;
    }

    // Fallback to API banks
    const apiBank = banks.find((b) => b.code === bankCode);
    setFormData((prev) => ({
      ...prev,
      bankCode,
      bankName: apiBank?.name || '',
    }));
  };

  // Create saved account
  const handleCreate = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      const response = await fetch('/api/saved-accounts', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear cuenta guardada');
      }

      setSavedAccounts((prev) => [data, ...prev]);
      setShowNewModal(false);
      resetForm();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update saved account
  const handleUpdate = async () => {
    if (!selectedAccount) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await fetch(`/api/saved-accounts/${selectedAccount.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al actualizar cuenta guardada');
      }

      setSavedAccounts((prev) =>
        prev.map((acc) => (acc.id === selectedAccount.id ? data : acc))
      );
      setShowEditModal(false);
      resetForm();
      setSelectedAccount(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete saved account
  const handleDelete = async () => {
    if (!selectedAccount) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await fetch(`/api/saved-accounts/${selectedAccount.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al eliminar cuenta guardada');
      }

      setSavedAccounts((prev) => prev.filter((acc) => acc.id !== selectedAccount.id));
      setShowDeleteModal(false);
      setSelectedAccount(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open edit modal
  const openEditModal = (account: SavedAccount) => {
    setSelectedAccount(account);
    setFormData({
      alias: account.alias,
      clabe: account.clabe,
      bankCode: account.bankCode,
      bankName: account.bankName,
      beneficiaryName: account.beneficiaryName,
      beneficiaryRfc: account.beneficiaryRfc || '',
      notes: account.notes || '',
    });
    setShowEditModal(true);
  };

  // Open delete modal
  const openDeleteModal = (account: SavedAccount) => {
    setSelectedAccount(account);
    setShowDeleteModal(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-white/90">Cuentas Guardadas</h1>
          <p className="text-sm text-white/40 mt-1">
            Administra tus cuentas de terceros para transferencias frecuentes
          </p>
        </div>
        <Button
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            resetForm();
            setShowNewModal(true);
          }}
        >
          Nueva Cuenta
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.04] rounded-lg overflow-hidden">
        {[
          { label: 'Total', value: savedAccounts.length },
          {
            label: 'Activas',
            value: savedAccounts.filter((a) => a.isActive).length,
            isPositive: true,
          },
          {
            label: 'Bancos',
            value: new Set(savedAccounts.map((a) => a.bankCode)).size,
          },
          {
            label: 'Ultimo agregado',
            value: savedAccounts.length > 0 ? formatDate(savedAccounts[0]?.createdAt) : '-',
            isText: true,
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-black/40 p-4">
            <p className="text-xs text-white/30">{stat.label}</p>
            <p
              className={cn(
                'text-lg mt-1',
                stat.isText ? 'text-xs text-white/60' : 'font-mono',
                stat.isPositive ? 'text-green-400/80' : 'text-white/80'
              )}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Search */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por alias, beneficiario, CLABE o banco..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>
      </Card>

      {/* Accounts List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAccounts.map((account) => (
          <Card key={account.id} className="hover:bg-white/[0.02] transition-colors">
            <CardContent className="pt-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-white/[0.06] flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white/60" />
                  </div>
                  <div>
                    <h3 className="text-sm text-white/80">{account.alias}</h3>
                    <p className="text-xs text-white/40">{account.bankName}</p>
                  </div>
                </div>
                <Badge
                  variant={account.isActive ? 'success' : 'default'}
                  size="sm"
                >
                  {account.isActive ? 'Activa' : 'Inactiva'}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-[10px] text-white/30">Beneficiario</p>
                  <p className="text-white/60 text-xs truncate">
                    {account.beneficiaryName}
                  </p>
                </div>
                {account.beneficiaryRfc && (
                  <div>
                    <p className="text-[10px] text-white/30">RFC</p>
                    <p className="text-white/60 text-xs font-mono">
                      {account.beneficiaryRfc}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                <p className="text-[10px] text-white/30">CLABE</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-xs text-white/60 flex-1">
                    {account.clabe}
                  </p>
                  <button
                    onClick={() => copyToClipboard(account.clabe, account.id)}
                    className="p-1 hover:bg-white/[0.06] rounded transition-colors"
                    title="Copiar CLABE"
                  >
                    {copiedId === account.id ? (
                      <Check className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-white/40" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  leftIcon={<Edit className="w-3.5 h-3.5" />}
                  onClick={() => openEditModal(account)}
                >
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => openDeleteModal(account)}
                >
                  Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAccounts.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <Wallet className="w-10 h-10 mx-auto text-white/20 mb-3" />
          <p className="text-white/40 text-sm">
            {searchQuery
              ? 'No se encontraron cuentas guardadas'
              : 'No tienes cuentas guardadas aun'}
          </p>
          {!searchQuery && (
            <Button
              variant="ghost"
              className="mt-4"
              onClick={() => {
                resetForm();
                setShowNewModal(true);
              }}
            >
              Agregar primera cuenta
            </Button>
          )}
        </div>
      )}

      {/* New Account Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => {
          setShowNewModal(false);
          resetForm();
        }}
        title="Nueva Cuenta Guardada"
        description="Agrega una cuenta de tercero para transferencias frecuentes"
        size="md"
      >
        <div className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <Input
            label="Alias"
            placeholder="Ej: Mi proveedor, Nomina empleado"
            value={formData.alias}
            onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
          />

          <div>
            <Input
              label="CLABE (18 digitos)"
              placeholder="000000000000000000"
              maxLength={18}
              value={formData.clabe}
              onChange={(e) => handleClabeChange(e.target.value)}
            />
            {formData.clabe.length === 18 && validateClabe(formData.clabe) && (
              <p className="text-xs text-green-400/70 mt-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                CLABE valida
              </p>
            )}
            {formData.clabe.length === 18 && !validateClabe(formData.clabe) && (
              <p className="text-xs text-red-400/70 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Digito verificador invalido
              </p>
            )}
            {detectedBank && formData.clabe.length >= 3 && (
              <p className="text-xs text-blue-400/70 mt-1 flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                Banco detectado: {detectedBank.shortName}
              </p>
            )}
          </div>

          <div>
            <Select
              label="Banco"
              value={formData.bankCode}
              onChange={(e) => handleBankChange(e.target.value)}
              options={[
                { value: '', label: 'Seleccionar banco...' },
                ...localBanks.map((bank) => ({
                  value: bank.code,
                  label: `${bank.code} - ${bank.shortName}`,
                })),
              ]}
            />
            {detectedBank && formData.bankCode === detectedBank.code && (
              <p className="text-xs text-green-400/70 mt-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Detectado automaticamente
              </p>
            )}
          </div>

          <Input
            label="Nombre del Beneficiario"
            placeholder="Nombre completo o razon social"
            value={formData.beneficiaryName}
            onChange={(e) =>
              setFormData({ ...formData, beneficiaryName: e.target.value })
            }
          />

          <Input
            label="RFC (opcional)"
            placeholder="RFC del beneficiario"
            maxLength={13}
            value={formData.beneficiaryRfc}
            onChange={(e) =>
              setFormData({ ...formData, beneficiaryRfc: e.target.value.toUpperCase() })
            }
          />

          <Input
            label="Notas (opcional)"
            placeholder="Notas adicionales"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />

          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowNewModal(false);
                resetForm();
                setDetectedBank(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleCreate}
              disabled={
                isSubmitting ||
                !formData.alias ||
                !formData.clabe ||
                !formData.bankCode ||
                !formData.beneficiaryName ||
                formData.clabe.length !== 18
              }
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Guardar'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Account Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          resetForm();
          setSelectedAccount(null);
          setDetectedBank(null);
        }}
        title="Editar Cuenta Guardada"
        size="md"
      >
        <div className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <Input
            label="Alias"
            placeholder="Ej: Mi proveedor, Nomina empleado"
            value={formData.alias}
            onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
          />

          <div>
            <Input
              label="CLABE (18 digitos)"
              placeholder="000000000000000000"
              maxLength={18}
              value={formData.clabe}
              onChange={(e) => handleClabeChange(e.target.value)}
            />
            {formData.clabe.length === 18 && validateClabe(formData.clabe) && (
              <p className="text-xs text-green-400/70 mt-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                CLABE valida
              </p>
            )}
            {formData.clabe.length === 18 && !validateClabe(formData.clabe) && (
              <p className="text-xs text-red-400/70 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Digito verificador invalido
              </p>
            )}
            {detectedBank && formData.clabe.length >= 3 && (
              <p className="text-xs text-blue-400/70 mt-1 flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                Banco detectado: {detectedBank.shortName}
              </p>
            )}
          </div>

          <div>
            <Select
              label="Banco"
              value={formData.bankCode}
              onChange={(e) => handleBankChange(e.target.value)}
              options={[
                { value: '', label: 'Seleccionar banco...' },
                ...localBanks.map((bank) => ({
                  value: bank.code,
                  label: `${bank.code} - ${bank.shortName}`,
                })),
              ]}
            />
            {detectedBank && formData.bankCode === detectedBank.code && (
              <p className="text-xs text-green-400/70 mt-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Detectado automaticamente
              </p>
            )}
          </div>

          <Input
            label="Nombre del Beneficiario"
            placeholder="Nombre completo o razon social"
            value={formData.beneficiaryName}
            onChange={(e) =>
              setFormData({ ...formData, beneficiaryName: e.target.value })
            }
          />

          <Input
            label="RFC (opcional)"
            placeholder="RFC del beneficiario"
            maxLength={13}
            value={formData.beneficiaryRfc}
            onChange={(e) =>
              setFormData({ ...formData, beneficiaryRfc: e.target.value.toUpperCase() })
            }
          />

          <Input
            label="Notas (opcional)"
            placeholder="Notas adicionales"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />

          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowEditModal(false);
                resetForm();
                setSelectedAccount(null);
                setDetectedBank(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleUpdate}
              disabled={
                isSubmitting ||
                !formData.alias ||
                !formData.clabe ||
                !formData.bankCode ||
                !formData.beneficiaryName ||
                formData.clabe.length !== 18
              }
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Actualizar'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedAccount(null);
        }}
        title="Eliminar Cuenta Guardada"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-white/60 text-sm">
            ¿Estas seguro de que deseas eliminar la cuenta{' '}
            <span className="text-white font-medium">{selectedAccount?.alias}</span>?
          </p>
          <p className="text-white/40 text-xs">
            Esta accion no se puede deshacer.
          </p>

          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedAccount(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Eliminar'
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
