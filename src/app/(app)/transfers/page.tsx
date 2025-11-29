'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  ExternalLink,
} from 'lucide-react';
import { Button, Input, Select, Card, CardHeader, CardTitle, CardContent, Badge, Modal } from '@/components/ui';
import { formatCurrency, formatClabe, validateClabe, sanitizeForSpei } from '@/lib/utils';

// Demo banks
const banks = [
  { value: '40002', label: 'BANAMEX' },
  { value: '40012', label: 'BBVA MEXICO' },
  { value: '40014', label: 'SANTANDER' },
  { value: '40021', label: 'HSBC' },
  { value: '40072', label: 'BANORTE' },
  { value: '40127', label: 'AZTECA' },
  { value: '40140', label: 'NU MEXICO' },
  { value: '90684', label: 'OPM/TRANSFER' },
];

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

  // Form state
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

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.beneficiaryAccount) {
      newErrors.beneficiaryAccount = 'La cuenta es requerida';
    } else if (formData.beneficiaryAccountType === '40' && !validateClabe(formData.beneficiaryAccount)) {
      newErrors.beneficiaryAccount = 'CLABE invalida';
    }

    if (!formData.beneficiaryBank) {
      newErrors.beneficiaryBank = 'Selecciona un banco';
    }

    if (!formData.beneficiaryName) {
      newErrors.beneficiaryName = 'El nombre es requerido';
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Ingresa un monto valido';
    }

    if (!formData.concept) {
      newErrors.concept = 'El concepto es requerido';
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
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsProcessing(false);
    setShowConfirmModal(false);
    setShowSuccessModal(true);
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
    setShowSuccessModal(false);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-display font-bold text-white">
            Transferencias SPEI
          </h1>
          <p className="text-gray-400 mt-1">
            Envia y recibe fondos de forma instantanea
          </p>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-dark-700 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('send')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
            activeTab === 'send'
              ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-glow'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <SendHorizontal className="w-5 h-5" />
          Enviar
        </button>
        <button
          onClick={() => setActiveTab('receive')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
            activeTab === 'receive'
              ? 'bg-gradient-to-r from-green-500 to-green-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Download className="w-5 h-5" />
          Recibir
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'send' ? (
          <motion.div
            key="send"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Form */}
            <div className="lg:col-span-2 space-y-6">
              <Card variant="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-accent-primary" />
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
                      variant="glass"
                    />
                    <Select
                      label="Banco"
                      options={banks}
                      value={formData.beneficiaryBank}
                      onChange={(e) => handleInputChange('beneficiaryBank', e.target.value)}
                      error={errors.beneficiaryBank}
                      variant="glass"
                    />
                  </div>

                  <Input
                    label="Cuenta CLABE / Tarjeta"
                    placeholder="Ej: 012180015000000001"
                    value={formData.beneficiaryAccount}
                    onChange={(e) => handleInputChange('beneficiaryAccount', e.target.value)}
                    error={errors.beneficiaryAccount}
                    success={formData.beneficiaryAccount && validateClabe(formData.beneficiaryAccount) ? 'CLABE valida' : undefined}
                    leftIcon={<Hash className="w-4 h-4" />}
                    variant="glass"
                    maxLength={18}
                  />

                  <Input
                    label="Nombre del Beneficiario"
                    placeholder="Nombre completo (sin acentos)"
                    value={formData.beneficiaryName}
                    onChange={(e) => handleInputChange('beneficiaryName', sanitizeForSpei(e.target.value).toUpperCase())}
                    error={errors.beneficiaryName}
                    leftIcon={<User className="w-4 h-4" />}
                    variant="glass"
                    maxLength={40}
                  />

                  <Input
                    label="RFC/CURP (Opcional)"
                    placeholder="RFC o CURP del beneficiario"
                    value={formData.beneficiaryUid}
                    onChange={(e) => handleInputChange('beneficiaryUid', e.target.value.toUpperCase())}
                    leftIcon={<FileText className="w-4 h-4" />}
                    variant="glass"
                    maxLength={18}
                  />
                </CardContent>
              </Card>

              <Card variant="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-neon-cyan" />
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
                      leftIcon={<span className="text-sm">$</span>}
                      variant="glass"
                    />
                    <Input
                      label="Referencia Numerica"
                      type="number"
                      placeholder="7 digitos"
                      value={formData.numericalReference}
                      onChange={(e) => handleInputChange('numericalReference', e.target.value.slice(0, 7))}
                      leftIcon={<Hash className="w-4 h-4" />}
                      variant="glass"
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
                    variant="glass"
                    maxLength={40}
                  />

                  <div className="pt-4">
                    <Button
                      size="md"
                      className="w-full"
                      onClick={handleSubmit}
                      rightIcon={<ArrowRight className="w-5 h-5" />}
                    >
                      Continuar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Summary Sidebar */}
            <div className="space-y-6">
              <Card variant="gradient" className="sticky top-8">
                <CardHeader>
                  <CardTitle>Resumen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Monto a enviar</span>
                      <span className="font-mono text-white">
                        {formData.amount ? formatCurrency(parseFloat(formData.amount)) : '$0.00'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Comision</span>
                      <span className="font-mono text-green-400">$0.00</span>
                    </div>
                    <div className="border-t border-white/10 pt-3 flex justify-between">
                      <span className="text-white font-medium">Total</span>
                      <span className="font-mono text-xl text-neon-cyan">
                        {formData.amount ? formatCurrency(parseFloat(formData.amount)) : '$0.00'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-dark-800/50 border border-white/5">
                    <div className="flex items-center gap-2 text-sm">
                      <Shield className="w-4 h-4 text-green-400" />
                      <span className="text-gray-400">Transferencia protegida</span>
                    </div>
                  </div>

                  {formData.beneficiaryName && (
                    <div className="p-3 rounded-lg bg-accent-primary/10 border border-accent-primary/20">
                      <p className="text-xs text-gray-400 mb-1">Beneficiario</p>
                      <p className="font-medium text-white">{formData.beneficiaryName}</p>
                      {formData.beneficiaryAccount && (
                        <p className="text-xs text-gray-500 font-mono mt-1">
                          {formatClabe(formData.beneficiaryAccount)}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="receive"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="max-w-2xl"
          >
            <Card variant="gradient">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5 text-green-400" />
                  Recibir Fondos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center py-8">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 flex items-center justify-center">
                    <Building2 className="w-10 h-10 text-green-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Tu cuenta CLABE
                  </h3>
                  <p className="text-gray-400 text-sm max-w-md mx-auto">
                    Comparte esta CLABE para recibir transferencias SPEI desde cualquier banco en Mexico
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-dark-800 border border-neon-cyan/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">CLABE Interbancaria</p>
                      <p className="font-mono text-2xl text-neon-cyan text-glow-cyan">
                        684 180 017 00000 0001
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" leftIcon={<Copy className="w-4 h-4" />}>
                      Copiar
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-dark-700 border border-white/5">
                    <p className="text-xs text-gray-500">Banco</p>
                    <p className="font-medium text-white">OPM/TRANSFER</p>
                  </div>
                  <div className="p-3 rounded-lg bg-dark-700 border border-white/5">
                    <p className="text-xs text-gray-500">Titular</p>
                    <p className="font-medium text-white">NOVACORE SA DE CV</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <p className="text-sm text-yellow-400">
                    Verifica siempre que el nombre del beneficiario sea correcto antes de transferir
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirmar Transferencia"
        description="Revisa los datos antes de enviar"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-dark-700 border border-white/10 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Beneficiario</span>
              <span className="text-white font-medium">{formData.beneficiaryName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Cuenta</span>
              <span className="font-mono text-white">{formatClabe(formData.beneficiaryAccount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Banco</span>
              <span className="text-white">{banks.find((b) => b.value === formData.beneficiaryBank)?.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Concepto</span>
              <span className="text-white">{formData.concept}</span>
            </div>
            <div className="border-t border-white/10 pt-3 flex justify-between">
              <span className="text-white font-medium">Monto</span>
              <span className="font-mono text-2xl text-neon-cyan">
                {formatCurrency(parseFloat(formData.amount || '0'))}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setShowConfirmModal(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleConfirmTransfer}
              isLoading={isProcessing}
              leftIcon={<Shield className="w-4 h-4" />}
            >
              Confirmar y Enviar
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
        <div className="text-center py-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center"
          >
            <CheckCircle className="w-10 h-10 text-green-400" />
          </motion.div>

          <h3 className="text-2xl font-bold text-white mb-2">Transferencia Enviada</h3>
          <p className="text-gray-400 mb-6">
            Tu transferencia ha sido procesada exitosamente
          </p>

          <div className="p-4 rounded-xl bg-dark-700 border border-white/10 mb-6">
            <div className="flex justify-between mb-2">
              <span className="text-gray-400">Clave de rastreo</span>
              <span className="font-mono text-neon-cyan">NC2024112900006</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Monto enviado</span>
              <span className="font-mono text-white">
                {formatCurrency(parseFloat(formData.amount || '0'))}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={resetForm}>
              Nueva Transferencia
            </Button>
            <Button
              variant="ghost"
              className="flex-1"
              rightIcon={<ExternalLink className="w-4 h-4" />}
            >
              Ver Detalle
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
