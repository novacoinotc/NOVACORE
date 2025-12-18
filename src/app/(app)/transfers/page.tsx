'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  SendHorizontal,
  Download,
  ArrowRight,
  Building2,
  User,
  Hash,
  FileText,
  DollarSign,
  Shield,
  CheckCircle,
  AlertTriangle,
  Copy,
  Loader2,
  RefreshCw,
  Bookmark,
  ChevronDown,
  XCircle,
  Clock,
  Ban,
} from 'lucide-react';
import { Button, Input, Select, Card, CardHeader, CardTitle, CardContent, Modal } from '@/components/ui';
import { formatCurrency, formatClabe, validateClabe, sanitizeForSpei } from '@/lib/utils';
import { getBankFromClabe, getBankSelectOptions, getPopularBanks, BankInfo } from '@/lib/banks';
import { useAuth } from '@/context/AuthContext';
import { SavedAccount } from '@/types';

// Account types for SPEI
const accountTypes = [
  { value: '40', label: 'CLABE' },
  { value: '3', label: 'Tarjeta de Debito' },
  { value: '10', label: 'Telefono Movil (CoDi)' },
];

export default function TransfersPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'send' | 'receive'>('send');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Grace period state (8 second countdown)
  const [gracePeriodData, setGracePeriodData] = useState<{
    transactionId: string;
    confirmationDeadline: string;
    secondsRemaining: number;
    trackingKey: string;
    orderId: string;
  } | null>(null);
  const [countdown, setCountdown] = useState(8);
  const [isCanceling, setIsCanceling] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  // Bank loading state
  const [banks, setBanks] = useState<{ value: string; label: string }[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);
  const [detectedBank, setDetectedBank] = useState<BankInfo | null>(null);

  // Saved accounts state
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [isLoadingSavedAccounts, setIsLoadingSavedAccounts] = useState(false);
  const [showSavedAccountsDropdown, setShowSavedAccountsDropdown] = useState(false);

  // Source CLABE accounts (payer accounts)
  const [clabeAccounts, setClabeAccounts] = useState<{ id: string; clabe: string; alias: string }[]>([]);
  const [isLoadingClabeAccounts, setIsLoadingClabeAccounts] = useState(false);

  // 2FA state for transfers
  const [requires2FA, setRequires2FA] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    payerAccount: '', // Source CLABE account
    beneficiaryAccount: '',
    beneficiaryBank: '',
    beneficiaryName: '',
    beneficiaryUid: '',
    beneficiaryAccountType: '40',
    amount: '',
    concept: '',
    numericalReference: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Success response data
  const [successData, setSuccessData] = useState<{
    trackingKey: string;
    orderId: string;
  } | null>(null);

  // Load banks from API or use local fallback
  useEffect(() => {
    async function loadBanks() {
      setIsLoadingBanks(true);
      try {
        const response = await fetch('/api/banks');
        if (response.ok) {
          const data = await response.json();
          // Transform API response to select options
          if (data.data && Array.isArray(data.data)) {
            const bankOptions = data.data.map((bank: any) => ({
              value: bank.code || bank.legalCode,
              label: bank.name,
            }));
            setBanks(bankOptions);
          } else {
            // Fallback to local bank list
            setBanks(getBankSelectOptions());
          }
        } else {
          // Fallback to local bank list
          setBanks(getBankSelectOptions());
        }
      } catch (error) {
        console.error('Error loading banks:', error);
        // Fallback to local bank list
        setBanks(getBankSelectOptions());
      } finally {
        setIsLoadingBanks(false);
      }
    }

    loadBanks();
  }, []);

  // Load saved accounts
  const loadSavedAccounts = useCallback(async () => {
    if (!user?.id) return;

    setIsLoadingSavedAccounts(true);
    try {
      const response = await fetch('/api/saved-accounts', {
        headers: {
          'x-user-id': user.id,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSavedAccounts(data.filter((acc: SavedAccount) => acc.isActive));
      }
    } catch (error) {
      console.error('Error loading saved accounts:', error);
    } finally {
      setIsLoadingSavedAccounts(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadSavedAccounts();
  }, [loadSavedAccounts]);

  // Grace period countdown effect
  useEffect(() => {
    if (!gracePeriodData || cancelSuccess) return;

    // Initial countdown from grace period data
    const deadline = new Date(gracePeriodData.confirmationDeadline).getTime();
    const updateCountdown = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
      setCountdown(remaining);

      if (remaining <= 0) {
        // Grace period expired - confirm the transaction
        handleGracePeriodExpired();
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [gracePeriodData, cancelSuccess]);

  // Handle grace period expiration
  const handleGracePeriodExpired = async () => {
    if (!gracePeriodData) return;

    try {
      // Call the confirm-pending endpoint to process this transaction
      await fetch('/api/orders/confirm-pending', { method: 'POST' });

      // Show success modal
      setSuccessData({
        trackingKey: gracePeriodData.trackingKey,
        orderId: gracePeriodData.orderId,
      });
      setShowSuccessModal(true);
      setGracePeriodData(null);
    } catch (error) {
      console.error('Error confirming transaction:', error);
      // Still show success - the transaction was created
      setSuccessData({
        trackingKey: gracePeriodData.trackingKey,
        orderId: gracePeriodData.orderId,
      });
      setShowSuccessModal(true);
      setGracePeriodData(null);
    }
  };

  // Handle cancel during grace period
  const handleCancelTransfer = async () => {
    if (!gracePeriodData) return;

    setIsCanceling(true);

    try {
      const response = await fetch(`/api/orders/${gracePeriodData.transactionId}/cancel`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al cancelar la transferencia');
      }

      // Show cancel success
      setCancelSuccess(true);

      // After 2 seconds, reset and allow new transfer
      setTimeout(() => {
        setCancelSuccess(false);
        setGracePeriodData(null);
        resetForm();
      }, 2000);
    } catch (error) {
      console.error('Cancel error:', error);
      setErrors({
        submit: error instanceof Error ? error.message : 'Error al cancelar',
      });
    } finally {
      setIsCanceling(false);
    }
  };

  // Load CLABE accounts (source accounts for transfers)
  useEffect(() => {
    async function loadClabeAccounts() {
      setIsLoadingClabeAccounts(true);
      try {
        const response = await fetch('/api/clabe-accounts');
        if (response.ok) {
          const data = await response.json();
          const activeClabes = data
            .filter((acc: any) => acc.isActive)
            .map((acc: any) => ({
              id: acc.id,
              clabe: acc.clabe,
              alias: acc.alias,
            }));
          setClabeAccounts(activeClabes);
          // Auto-select first account if only one exists
          if (activeClabes.length === 1) {
            setFormData(prev => ({ ...prev, payerAccount: activeClabes[0].clabe }));
          }
        }
      } catch (error) {
        console.error('Error loading CLABE accounts:', error);
      } finally {
        setIsLoadingClabeAccounts(false);
      }
    }

    loadClabeAccounts();
  }, []);

  // Select a saved account and fill the form
  const selectSavedAccount = (account: SavedAccount) => {
    // Get bank info from the saved account
    const bankFromClabe = getBankFromClabe(account.clabe);

    setFormData({
      payerAccount: formData.payerAccount, // Keep the current source account
      beneficiaryAccount: account.clabe,
      beneficiaryBank: account.bankCode.length === 3 ? (bankFromClabe?.speiCode || `40${account.bankCode}`) : account.bankCode,
      beneficiaryName: account.beneficiaryName,
      beneficiaryUid: account.beneficiaryRfc || '',
      beneficiaryAccountType: (account.accountType || 40).toString(),
      amount: formData.amount, // Keep the current amount
      concept: formData.concept, // Keep the current concept
      numericalReference: formData.numericalReference, // Keep the current reference
    });

    // Set detected bank
    if (bankFromClabe) {
      setDetectedBank(bankFromClabe);
    }

    // Clear any errors for filled fields
    setErrors((prev) => ({
      ...prev,
      beneficiaryAccount: '',
      beneficiaryBank: '',
      beneficiaryName: '',
    }));

    setShowSavedAccountsDropdown(false);
  };

  // Auto-detect bank from CLABE
  useEffect(() => {
    if (formData.beneficiaryAccountType === '40' && formData.beneficiaryAccount.length >= 3) {
      const bank = getBankFromClabe(formData.beneficiaryAccount);
      setDetectedBank(bank);

      // Auto-fill bank if detected and not already set
      if (bank && !formData.beneficiaryBank) {
        setFormData(prev => ({ ...prev, beneficiaryBank: bank.speiCode }));
        if (errors.beneficiaryBank) {
          setErrors(prev => ({ ...prev, beneficiaryBank: '' }));
        }
      }
    } else {
      setDetectedBank(null);
    }
  }, [formData.beneficiaryAccount, formData.beneficiaryAccountType, formData.beneficiaryBank, errors.beneficiaryBank]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }

    // Reset detected bank if account changes
    if (field === 'beneficiaryAccount') {
      setDetectedBank(null);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validate source account (payerAccount)
    if (!formData.payerAccount) {
      newErrors.payerAccount = 'Selecciona una cuenta de origen';
    }

    if (!formData.beneficiaryAccount) {
      newErrors.beneficiaryAccount = 'La cuenta es requerida';
    } else if (formData.beneficiaryAccountType === '40') {
      if (formData.beneficiaryAccount.length !== 18) {
        newErrors.beneficiaryAccount = 'La CLABE debe tener 18 digitos';
      } else if (!validateClabe(formData.beneficiaryAccount)) {
        newErrors.beneficiaryAccount = 'Digito verificador de CLABE invalido';
      }
    }

    if (!formData.beneficiaryBank) {
      newErrors.beneficiaryBank = 'Selecciona un banco';
    }

    if (!formData.beneficiaryName) {
      newErrors.beneficiaryName = 'El nombre es requerido';
    } else if (formData.beneficiaryName.length > 40) {
      newErrors.beneficiaryName = 'Maximo 40 caracteres';
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Ingresa un monto valido';
    }

    if (!formData.concept) {
      newErrors.concept = 'El concepto es requerido';
    } else if (formData.concept.length > 40) {
      newErrors.concept = 'Maximo 40 caracteres';
    }

    if (formData.numericalReference && (formData.numericalReference.length > 7 || !/^\d+$/.test(formData.numericalReference))) {
      newErrors.numericalReference = 'Debe ser un numero de 7 digitos maximo';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      setShowConfirmModal(true);
    }
  };

  const handleConfirmTransfer = async () => {
    // If 2FA is required but no code provided, show error
    if (requires2FA && totpCode.length !== 6) {
      setErrors({
        submit: 'Ingresa el código de 6 dígitos de Google Authenticator',
      });
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Authentication
          userId: user?.id,
          totpCode: requires2FA ? totpCode : undefined,
          // Source account
          payerAccount: formData.payerAccount,
          // Transfer data
          beneficiaryAccount: formData.beneficiaryAccount,
          beneficiaryBank: formData.beneficiaryBank,
          beneficiaryName: formData.beneficiaryName,
          beneficiaryUid: formData.beneficiaryUid || undefined,
          beneficiaryAccountType: parseInt(formData.beneficiaryAccountType),
          amount: parseFloat(formData.amount),
          concept: formData.concept,
          numericalReference: formData.numericalReference ? parseInt(formData.numericalReference) : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if 2FA is required
        if (data.requires2FA) {
          setRequires2FA(true);
          setErrors({
            submit: data.error || 'Se requiere código de autenticación 2FA',
          });
          setIsProcessing(false);
          return;
        }
        throw new Error(data.error || 'Error al procesar la transferencia');
      }

      // Check if grace period data is included in response
      if (data.gracePeriod) {
        // Show grace period card in sidebar with countdown
        setGracePeriodData({
          transactionId: data.gracePeriod.transactionId,
          confirmationDeadline: data.gracePeriod.confirmationDeadline,
          secondsRemaining: data.gracePeriod.secondsRemaining,
          trackingKey: data.data?.trackingKey || data.trackingKey || 'N/A',
          orderId: data.data?.id || data.id || 'N/A',
        });
        setCountdown(data.gracePeriod.secondsRemaining);
        setShowConfirmModal(false);
        setTotpCode('');
        setRequires2FA(false);
      } else {
        // No grace period - show success directly (fallback for older API)
        setSuccessData({
          trackingKey: data.data?.trackingKey || data.trackingKey || 'N/A',
          orderId: data.data?.id || data.id || 'N/A',
        });

        setShowConfirmModal(false);
        setShowSuccessModal(true);
        setTotpCode('');
        setRequires2FA(false);
      }
    } catch (error) {
      console.error('Transfer error:', error);
      setErrors({
        submit: error instanceof Error ? error.message : 'Error desconocido',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setFormData({
      payerAccount: clabeAccounts.length === 1 ? clabeAccounts[0].clabe : '',
      beneficiaryAccount: '',
      beneficiaryBank: '',
      beneficiaryName: '',
      beneficiaryUid: '',
      beneficiaryAccountType: '40',
      amount: '',
      concept: '',
      numericalReference: '',
    });
    setErrors({});
    setSuccessData(null);
    setDetectedBank(null);
    setShowSuccessModal(false);
  };

  // Copy to clipboard helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Get bank label from code
  const getBankLabel = (code: string): string => {
    const bank = banks.find(b => b.value === code);
    return bank?.label || code;
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-medium text-white/90">Transferencias SPEI</h1>
        <p className="text-sm text-white/40 mt-1">Envia y recibe fondos</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-white/[0.02] border border-white/[0.06] w-fit">
        <button
          onClick={() => setActiveTab('send')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors ${
            activeTab === 'send'
              ? 'bg-white/[0.08] text-white'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          <SendHorizontal className="w-4 h-4" />
          Enviar
        </button>
        <button
          onClick={() => setActiveTab('receive')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors ${
            activeTab === 'receive'
              ? 'bg-white/[0.08] text-white'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          <Download className="w-4 h-4" />
          Recibir
        </button>
      </div>

      {activeTab === 'send' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2 space-y-4">
            {/* Saved Accounts Selector */}
            {savedAccounts.length > 0 && (
              <Card>
                <CardContent className="py-3">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowSavedAccountsDropdown(!showSavedAccountsDropdown)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Bookmark className="w-4 h-4 text-purple-400" />
                        <span className="text-white/70 text-sm">Seleccionar cuenta guardada</span>
                        <span className="text-xs text-white/30">({savedAccounts.length} disponibles)</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${showSavedAccountsDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showSavedAccountsDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#0a0a1a] border border-white/[0.08] rounded-lg shadow-xl max-h-64 overflow-y-auto">
                        {savedAccounts.map((account) => (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => selectSavedAccount(account)}
                            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors text-left border-b border-white/[0.04] last:border-b-0"
                          >
                            <div className="w-8 h-8 rounded-md bg-white/[0.06] flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Building2 className="w-4 h-4 text-white/40" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-white/80 text-sm font-medium truncate">{account.alias}</span>
                                <span className="text-xs text-white/30 px-1.5 py-0.5 bg-white/[0.04] rounded">
                                  {account.bankName}
                                </span>
                              </div>
                              <p className="text-xs text-white/40 truncate">{account.beneficiaryName}</p>
                              <p className="text-xs text-white/30 font-mono">{formatClabe(account.clabe)}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Source Account Selector */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-white/40" />
                  Cuenta de Origen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  label="Selecciona la cuenta CLABE de origen"
                  options={[
                    { value: '', label: 'Seleccionar cuenta...' },
                    ...clabeAccounts.map((acc) => ({
                      value: acc.clabe,
                      label: `${acc.alias} - ${acc.clabe.replace(/(.{4})/g, '$1 ').trim()}`,
                    })),
                  ]}
                  value={formData.payerAccount}
                  onChange={(e) => handleInputChange('payerAccount', e.target.value)}
                  error={errors.payerAccount}
                  disabled={isLoadingClabeAccounts}
                />
                {clabeAccounts.length === 0 && !isLoadingClabeAccounts && (
                  <p className="text-xs text-amber-400/70 mt-2">
                    No hay cuentas CLABE registradas. Ve a "Cuentas CLABE" para agregar una.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-4 h-4 text-white/40" />
                  Datos del Beneficiario
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label="Tipo de Cuenta"
                    options={accountTypes}
                    value={formData.beneficiaryAccountType}
                    onChange={(e) => handleInputChange('beneficiaryAccountType', e.target.value)}
                  />
                  <div>
                    <Select
                      label="Banco"
                      options={[{ value: '', label: 'Seleccionar banco...' }, ...banks]}
                      value={formData.beneficiaryBank}
                      onChange={(e) => handleInputChange('beneficiaryBank', e.target.value)}
                      error={errors.beneficiaryBank}
                      disabled={isLoadingBanks}
                    />
                    {detectedBank && formData.beneficiaryBank === detectedBank.speiCode && (
                      <p className="text-xs text-green-400/70 mt-1 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Banco detectado automaticamente
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Input
                    label="Cuenta CLABE / Tarjeta"
                    placeholder="Ej: 012180015000000001"
                    value={formData.beneficiaryAccount}
                    onChange={(e) => handleInputChange('beneficiaryAccount', e.target.value.replace(/\D/g, ''))}
                    error={errors.beneficiaryAccount}
                    success={
                      formData.beneficiaryAccount.length === 18 && validateClabe(formData.beneficiaryAccount)
                        ? 'CLABE valida'
                        : undefined
                    }
                    leftIcon={<Hash className="w-4 h-4" />}
                    maxLength={18}
                  />
                  {detectedBank && (
                    <p className="text-xs text-white/50 mt-1">
                      Banco detectado: <span className="text-white/70">{detectedBank.shortName}</span>
                    </p>
                  )}
                </div>

                <Input
                  label="Nombre del Beneficiario"
                  placeholder="Nombre completo (sin acentos)"
                  value={formData.beneficiaryName}
                  onChange={(e) => handleInputChange('beneficiaryName', sanitizeForSpei(e.target.value).toUpperCase())}
                  error={errors.beneficiaryName}
                  leftIcon={<User className="w-4 h-4" />}
                  maxLength={40}
                  hint={`${formData.beneficiaryName.length}/40 caracteres`}
                />

                <Input
                  label="RFC/CURP (Opcional)"
                  placeholder="RFC o CURP del beneficiario"
                  value={formData.beneficiaryUid}
                  onChange={(e) => handleInputChange('beneficiaryUid', e.target.value.toUpperCase())}
                  leftIcon={<FileText className="w-4 h-4" />}
                  maxLength={18}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-white/40" />
                  Detalles de la Transferencia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Monto"
                    type="number"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => handleInputChange('amount', e.target.value)}
                    error={errors.amount}
                    leftIcon={<span className="text-sm text-white/30">$</span>}
                    step="0.01"
                    min="0.01"
                  />
                  <Input
                    label="Referencia Numerica"
                    type="text"
                    placeholder="7 digitos"
                    value={formData.numericalReference}
                    onChange={(e) => handleInputChange('numericalReference', e.target.value.replace(/\D/g, '').slice(0, 7))}
                    error={errors.numericalReference}
                    leftIcon={<Hash className="w-4 h-4" />}
                    maxLength={7}
                    hint="Opcional - 7 digitos max"
                  />
                </div>

                <Input
                  label="Concepto"
                  placeholder="Descripcion del pago (sin acentos)"
                  value={formData.concept}
                  onChange={(e) => handleInputChange('concept', sanitizeForSpei(e.target.value).toUpperCase())}
                  error={errors.concept}
                  leftIcon={<FileText className="w-4 h-4" />}
                  maxLength={40}
                  hint={`${formData.concept.length}/40 caracteres`}
                />

                {errors.submit && (
                  <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {errors.submit}
                  </div>
                )}

                <div className="pt-2">
                  <Button
                    size="md"
                    className="w-full"
                    onClick={handleSubmit}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Continuar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary Sidebar */}
          <div className="space-y-4">
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle>Resumen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Monto a enviar</span>
                    <span className="font-mono text-white/80">
                      {formData.amount ? formatCurrency(parseFloat(formData.amount)) : '$0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Comision</span>
                    <span className="font-mono text-green-400/80">$0.00</span>
                  </div>
                  <div className="border-t border-white/[0.06] pt-3 flex justify-between">
                    <span className="text-white/70 text-sm">Total</span>
                    <span className="font-mono text-lg text-white/90">
                      {formData.amount ? formatCurrency(parseFloat(formData.amount)) : '$0.00'}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="w-4 h-4 text-green-400/60" />
                    <span className="text-white/40">Transferencia protegida</span>
                  </div>
                </div>

                {formData.beneficiaryName && (
                  <div className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                    <p className="text-xs text-white/30 mb-1">Beneficiario</p>
                    <p className="text-sm text-white/80">{formData.beneficiaryName}</p>
                    {formData.beneficiaryAccount && (
                      <p className="text-xs text-white/30 font-mono mt-1">
                        {formatClabe(formData.beneficiaryAccount)}
                      </p>
                    )}
                    {detectedBank && (
                      <p className="text-xs text-white/40 mt-1">{detectedBank.shortName}</p>
                    )}
                  </div>
                )}

                {/* Quick bank selection */}
                {!formData.beneficiaryBank && !detectedBank && (
                  <div className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                    <p className="text-xs text-white/30 mb-2">Bancos frecuentes</p>
                    <div className="flex flex-wrap gap-1">
                      {getPopularBanks().slice(0, 6).map(bank => (
                        <button
                          key={bank.speiCode}
                          onClick={() => handleInputChange('beneficiaryBank', bank.speiCode)}
                          className="px-2 py-1 text-xs bg-white/[0.04] hover:bg-white/[0.08] rounded border border-white/[0.08] text-white/60 hover:text-white/80 transition-colors"
                        >
                          {bank.shortName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Grace Period Card - Shows during 8 second countdown */}
            {gracePeriodData && !cancelSuccess && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="py-4">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center relative">
                      <Clock className="w-5 h-5 text-amber-400 absolute opacity-30" />
                      <span className="text-2xl font-bold text-amber-400">{countdown}</span>
                    </div>

                    <h4 className="text-sm font-medium text-white/90 mb-1">Transferencia Programada</h4>
                    <p className="text-xs text-white/40 mb-3">
                      Se enviara en <span className="text-amber-400 font-semibold">{countdown}s</span>
                    </p>

                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-white/[0.06] rounded-full mb-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-1000 ease-linear"
                        style={{ width: `${(countdown / 8) * 100}%` }}
                      />
                    </div>

                    {/* Transfer summary */}
                    <div className="p-2 rounded bg-white/[0.02] border border-white/[0.06] mb-3 text-left text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="text-white/40">A:</span>
                        <span className="text-white/70 truncate ml-2">{formData.beneficiaryName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/40">Monto:</span>
                        <span className="font-mono text-white/90">
                          {formatCurrency(parseFloat(formData.amount || '0'))}
                        </span>
                      </div>
                    </div>

                    {/* Cancel button */}
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-400 hover:text-red-300"
                      onClick={handleCancelTransfer}
                      isLoading={isCanceling}
                      disabled={isCanceling || countdown <= 0}
                      leftIcon={isCanceling ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    >
                      {isCanceling ? 'Cancelando...' : 'Cancelar'}
                    </Button>

                    <p className="text-[10px] text-white/20 mt-2">
                      Se confirma automaticamente
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cancel Success Card */}
            {cancelSuccess && (
              <Card className="border-green-500/30 bg-green-500/5">
                <CardContent className="py-4">
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                      <Ban className="w-6 h-6 text-green-400" />
                    </div>
                    <h4 className="text-sm font-medium text-white/90">Transferencia Cancelada</h4>
                    <p className="text-xs text-white/40 mt-1">Cancelada exitosamente</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-4 h-4 text-green-400/60" />
                Recibir Fondos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-white/40" />
                </div>
                <h3 className="text-lg font-medium text-white/90 mb-1">Tus cuentas CLABE</h3>
                <p className="text-sm text-white/40 max-w-sm mx-auto">
                  Comparte estas CLABEs para recibir transferencias SPEI
                </p>
              </div>

              {isLoadingClabeAccounts ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                </div>
              ) : clabeAccounts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-white/40 text-sm">No tienes cuentas CLABE registradas</p>
                  <p className="text-white/30 text-xs mt-1">Ve a "Cuentas CLABE" para agregar una</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {clabeAccounts.map((account) => (
                    <div key={account.id} className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.08]">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-purple-400">{account.alias}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Copy className="w-4 h-4" />}
                          onClick={() => copyToClipboard(account.clabe)}
                        >
                          Copiar
                        </Button>
                      </div>
                      <div>
                        <p className="text-xs text-white/30 mb-1">CLABE Interbancaria</p>
                        <p className="font-mono text-lg text-white/90">
                          {formatClabe(account.clabe)}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div className="p-2 rounded-md bg-white/[0.02] border border-white/[0.06]">
                          <p className="text-xs text-white/30">Banco</p>
                          <p className="text-sm text-white/80">OPM/TRANSFER</p>
                        </div>
                        <div className="p-2 rounded-md bg-white/[0.02] border border-white/[0.06]">
                          <p className="text-xs text-white/30">Código Banco</p>
                          <p className="text-sm text-white/80">90684</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 p-3 rounded-md bg-yellow-500/5 border border-yellow-500/10">
                <AlertTriangle className="w-4 h-4 text-yellow-400/60" />
                <p className="text-xs text-yellow-400/80">
                  Verifica siempre el nombre del beneficiario antes de transferir
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => !isProcessing && setShowConfirmModal(false)}
        title="Confirmar Transferencia"
        description="Revisa los datos antes de enviar"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Beneficiario</span>
              <span className="text-white/80">{formData.beneficiaryName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Cuenta</span>
              <span className="font-mono text-white/80">{formatClabe(formData.beneficiaryAccount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Banco</span>
              <span className="text-white/80">{getBankLabel(formData.beneficiaryBank)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Concepto</span>
              <span className="text-white/80">{formData.concept}</span>
            </div>
            <div className="border-t border-white/[0.06] pt-3 flex justify-between">
              <span className="text-white/70 text-sm">Monto</span>
              <span className="font-mono text-xl text-white/90">
                {formatCurrency(parseFloat(formData.amount || '0'))}
              </span>
            </div>
          </div>

          {/* 2FA Code Input */}
          <div className="p-4 rounded-lg bg-purple-500/5 border border-purple-500/20">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-white/80 font-medium">Codigo de Verificacion 2FA</span>
            </div>
            <p className="text-xs text-white/40 mb-3">
              Ingresa el codigo de 6 digitos de Google Authenticator
            </p>
            <Input
              value={totpCode}
              onChange={(e) => {
                setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                if (errors.submit) setErrors({});
              }}
              placeholder="000000"
              className="font-mono text-center text-lg tracking-widest"
              maxLength={6}
            />
          </div>

          {errors.submit && (
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {errors.submit}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowConfirmModal(false);
                setTotpCode('');
                setErrors({});
              }}
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleConfirmTransfer}
              isLoading={isProcessing}
              disabled={totpCode.length !== 6}
              leftIcon={isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            >
              {isProcessing ? 'Procesando...' : 'Confirmar Envio'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={resetForm}
        size="md"
        showCloseButton={false}
      >
        <div className="text-center py-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-400/80" />
          </div>

          <h3 className="text-lg font-medium text-white/90 mb-1">Transferencia Enviada</h3>
          <p className="text-sm text-white/40 mb-6">Tu transferencia ha sido procesada</p>

          <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] mb-6 text-left">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white/40">Clave de rastreo</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-white/80">{successData?.trackingKey || 'N/A'}</span>
                <button
                  onClick={() => copyToClipboard(successData?.trackingKey || '')}
                  className="p-1 hover:bg-white/5 rounded"
                >
                  <Copy className="w-3 h-3 text-white/30" />
                </button>
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Monto enviado</span>
              <span className="font-mono text-white/80">
                {formatCurrency(parseFloat(formData.amount || '0'))}
              </span>
            </div>
          </div>

          <Button variant="secondary" className="w-full" onClick={resetForm}>
            Nueva Transferencia
          </Button>
        </div>
      </Modal>
    </div>
  );
}
