'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Button, Input, Select, Card, CardHeader, CardTitle, CardContent, Modal } from '@/components/ui';
import { formatCurrency, formatClabe, validateClabe, sanitizeForSpei } from '@/lib/utils';
import { getBankFromClabe, getBankSelectOptions, getPopularBanks, BankInfo } from '@/lib/banks';

// Account types for SPEI
const accountTypes = [
  { value: '40', label: 'CLABE' },
  { value: '3', label: 'Tarjeta de Debito' },
  { value: '10', label: 'Telefono Movil (CoDi)' },
];

export default function TransfersPage() {
  const [activeTab, setActiveTab] = useState<'send' | 'receive'>('send');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Bank loading state
  const [banks, setBanks] = useState<{ value: string; label: string }[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);
  const [detectedBank, setDetectedBank] = useState<BankInfo | null>(null);

  // Form data
  const [formData, setFormData] = useState({
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
    setIsProcessing(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
        throw new Error(data.error || 'Error al procesar la transferencia');
      }

      // Store success data
      setSuccessData({
        trackingKey: data.data?.trackingKey || data.trackingKey || 'N/A',
        orderId: data.data?.id || data.id || 'N/A',
      });

      setShowConfirmModal(false);
      setShowSuccessModal(true);
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
          </div>
        </div>
      ) : (
        <div className="max-w-lg">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-4 h-4 text-green-400/60" />
                Recibir Fondos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center py-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-white/40" />
                </div>
                <h3 className="text-lg font-medium text-white/90 mb-1">Tu cuenta CLABE</h3>
                <p className="text-sm text-white/40 max-w-sm mx-auto">
                  Comparte esta CLABE para recibir transferencias SPEI
                </p>
              </div>

              <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.08]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white/30 mb-1">CLABE Interbancaria</p>
                    <p className="font-mono text-xl text-white/90">
                      684 180 017 00000 0001
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Copy className="w-4 h-4" />}
                    onClick={() => copyToClipboard('684180017000000001')}
                  >
                    Copiar
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                  <p className="text-xs text-white/30">Banco</p>
                  <p className="text-sm text-white/80">OPM/TRANSFER</p>
                </div>
                <div className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                  <p className="text-xs text-white/30">Titular</p>
                  <p className="text-sm text-white/80">NOVACORE SA DE CV</p>
                </div>
              </div>

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

          {errors.submit && (
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {errors.submit}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowConfirmModal(false)}
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleConfirmTransfer}
              isLoading={isProcessing}
              leftIcon={isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            >
              {isProcessing ? 'Procesando...' : 'Confirmar'}
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
