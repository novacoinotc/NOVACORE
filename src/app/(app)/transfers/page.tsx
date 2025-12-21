'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  RotateCcw,
  Camera,
  ImageIcon,
  ClipboardPaste,
} from 'lucide-react';
import Tesseract from 'tesseract.js';
import { Button, Input, Select, Card, CardHeader, CardTitle, CardContent, Modal } from '@/components/ui';
import { formatCurrency, formatClabe, validateClabe, sanitizeForSpei } from '@/lib/utils';
import { getBankFromClabe, getBankSelectOptions, getPopularBanks, BankInfo } from '@/lib/banks';
import { useAuth, getAuthHeaders } from '@/context/AuthContext';
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

  // Source CLABE accounts (payer accounts) - includes balance info
  const [clabeAccounts, setClabeAccounts] = useState<{
    id: string;
    clabe: string;
    alias: string;
    availableBalance?: number;
    inTransit?: number;
  }[]>([]);
  const [isLoadingClabeAccounts, setIsLoadingClabeAccounts] = useState(false);

  // Recent transfers for "repeat transfer" feature
  interface RecentTransfer {
    id: string;
    beneficiaryAccount: string;
    beneficiaryBank: string;
    beneficiaryName: string;
    amount: number;
    concept: string;
    createdAt: number;
    payerAccount: string;
  }
  const [recentTransfers, setRecentTransfers] = useState<RecentTransfer[]>([]);
  const [showRecentTransfers, setShowRecentTransfers] = useState(false);

  // OCR state for image extraction
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState('');

  // Smart paste text field state
  const [showPasteField, setShowPasteField] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteStatus, setPasteStatus] = useState('');

  // 2FA state for transfers - initialize based on user's 2FA status
  const [requires2FA, setRequires2FA] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  // Pre-initialize requires2FA based on user's totpEnabled status
  // This prevents the "double-click" issue where user has to submit twice
  useEffect(() => {
    if (user?.totpEnabled) {
      setRequires2FA(true);
    }
  }, [user?.totpEnabled]);

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

  // Get selected account balance (must be after formData is defined)
  const selectedAccount = clabeAccounts.find(acc => acc.clabe === formData.payerAccount);

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
        headers: getAuthHeaders(),
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

  // Load recent outgoing transfers for "repeat transfer" feature
  const loadRecentTransfers = useCallback(async () => {
    try {
      const response = await fetch('/api/transactions?type=outgoing&itemsPerPage=5', {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        const transfers = data.transactions
          .filter((tx: any) => tx.status === 'scattered' || tx.status === 'sent')
          .map((tx: any) => ({
            id: tx.id,
            beneficiaryAccount: tx.beneficiaryAccount,
            beneficiaryBank: tx.beneficiaryBank,
            beneficiaryName: tx.beneficiaryName,
            amount: tx.amount,
            concept: tx.concept,
            createdAt: tx.createdAt,
            payerAccount: tx.payerAccount,
          }));
        setRecentTransfers(transfers);
      }
    } catch (error) {
      console.error('Error loading recent transfers:', error);
    }
  }, []);

  useEffect(() => {
    loadRecentTransfers();
  }, [loadRecentTransfers]);

  // Select a recent transfer to repeat (pre-fills form but does NOT execute)
  const selectRecentTransfer = (transfer: RecentTransfer) => {
    // Pre-fill the form with transfer data
    setFormData(prev => ({
      ...prev,
      payerAccount: transfer.payerAccount || prev.payerAccount,
      beneficiaryAccount: transfer.beneficiaryAccount || '',
      beneficiaryBank: transfer.beneficiaryBank || '',
      beneficiaryName: transfer.beneficiaryName || '',
      amount: transfer.amount.toString(),
      concept: transfer.concept || '',
    }));
    setShowRecentTransfers(false);
    // Detect bank from CLABE
    if (transfer.beneficiaryAccount && transfer.beneficiaryAccount.length >= 3) {
      const bank = getBankFromClabe(transfer.beneficiaryAccount);
      setDetectedBank(bank);
    }
  };

  // Smart paste handler - detects CLABE, name, amount, and concept from pasted text
  const handleSmartPaste = useCallback((pastedText: string) => {
    const updates: Partial<typeof formData> = {};

    // Keep original text for line-based matching, also create space-normalized version
    const originalText = pastedText.trim();
    const text = pastedText.replace(/\s+/g, ' ').trim();
    const lines = originalText.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);

    // Detect CLABE (18 consecutive digits or with spaces/separators)
    const clabePatterns = [
      /CLABE[:\s]*(\d{18})/i,
      /Cuenta[:\s]*(\d{18})/i,
      /Cuenta\s*CLABE[:\s]*(\d{18})/i,
      /(\d{3}[\s.-]?\d{3}[\s.-]?\d{11}[\s.-]?\d{1})/,
      /\b(\d{18})\b/,
    ];

    for (const pattern of clabePatterns) {
      const match = text.match(pattern);
      if (match) {
        const clabe = match[1].replace(/[\s.-]/g, '');
        if (clabe.length === 18 && validateClabe(clabe)) {
          updates.beneficiaryAccount = clabe;
          const bank = getBankFromClabe(clabe);
          if (bank) {
            updates.beneficiaryBank = bank.code;
            setDetectedBank(bank);
          }
          break;
        }
      }
    }

    // Detect beneficiary name - more flexible patterns for OCR
    const namePatterns = [
      // Common labels with various separators
      /(?:Beneficiario|Nombre|Titular|A nombre de|Destinatario|Para|Receptor)[:\s]+([A-Za-záéíóúñÁÉÍÓÚÑüÜ\s]+?)(?:\s+(?:CLABE|Cuenta|RFC|Banco|Monto|Importe|\$|\d{18})|\s*$)/i,
      /(?:Razón\s*Social|Razon\s*Social)[:\s]+([A-Za-záéíóúñÁÉÍÓÚÑüÜ\s.,]+?)(?:\s+(?:CLABE|Cuenta|RFC|\d{18})|\s*$)/i,
      // Handle name after CLABE (common format: "CLABE: 123... Nombre: Juan...")
      /(?:Nombre|Beneficiario)[:\s]+([A-Z][A-Za-záéíóúñÁÉÍÓÚÑüÜ\s]{2,39})/i,
    ];

    // First try labeled patterns on original text
    for (const pattern of namePatterns) {
      const match = originalText.match(pattern);
      if (match) {
        const name = sanitizeForSpei(match[1].trim());
        if (name.length >= 3 && name.length <= 40) {
          updates.beneficiaryName = name.toUpperCase();
          break;
        }
      }
    }

    // If no name found with labels, try unlabeled line detection
    // Look for a line that looks like a name (letters only, 2+ words)
    if (!updates.beneficiaryName) {
      for (const line of lines) {
        // Skip if line is a CLABE (18 digits)
        if (/^\d{18}$/.test(line.replace(/[\s.-]/g, ''))) continue;
        // Skip if line looks like an amount (numbers with comma/period)
        if (/^[\$]?\s*[\d,]+(\.\d{1,2})?$/.test(line)) continue;
        // Skip if line is too short or too long
        if (line.length < 5 || line.length > 50) continue;

        // Check if line looks like a name (mostly letters, possibly with spaces)
        const nameMatch = line.match(/^([A-Za-záéíóúñÁÉÍÓÚÑüÜ\s]{5,40})$/);
        if (nameMatch) {
          const potentialName = sanitizeForSpei(nameMatch[1].trim());
          // Must have at least one space (first + last name) or be a reasonable single word
          if (potentialName.length >= 5 && /[A-Za-z]/.test(potentialName)) {
            updates.beneficiaryName = potentialName.toUpperCase();
            break;
          }
        }
      }
    }

    // Detect amount - more patterns for different formats
    const amountPatterns = [
      // With labels
      /(?:Monto|Importe|Total|Cantidad|Pago|Transferencia)[:\s]*\$?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
      /(?:Monto|Importe|Total|Cantidad)[:\s]*MXN?\s*\$?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
      // Currency symbol with amount
      /\$\s*([0-9,]+\.[0-9]{2})\b/,
      /MXN\s*\$?\s*([0-9,]+(?:\.[0-9]{2})?)/i,
      // Large amounts with commas (1,000.00 or 1000.00)
      /\b([1-9][0-9]{0,2}(?:,[0-9]{3})*\.[0-9]{2})\b/,
    ];

    for (const pattern of amountPatterns) {
      const match = text.match(pattern);
      if (match) {
        const amount = match[1].replace(/,/g, '');
        const numAmount = parseFloat(amount);
        if (!isNaN(numAmount) && numAmount > 0 && numAmount < 100000000) {
          updates.amount = numAmount.toString();
          break;
        }
      }
    }

    // If no amount found with labels, try unlabeled amount detection
    if (!updates.amount) {
      for (const line of lines) {
        // Skip if line is a CLABE
        if (/^\d{18}$/.test(line.replace(/[\s.-]/g, ''))) continue;
        // Skip if line looks like a name
        if (/^[A-Za-záéíóúñÁÉÍÓÚÑüÜ\s]+$/.test(line) && line.length > 4) continue;

        // Match amount patterns: 15,000 or 15000 or 15,000.00 or $15,000
        const amountMatch = line.match(/^\$?\s*([0-9,]+(?:\.[0-9]{1,2})?)$/);
        if (amountMatch) {
          const amount = amountMatch[1].replace(/,/g, '');
          const numAmount = parseFloat(amount);
          if (!isNaN(numAmount) && numAmount > 0 && numAmount < 100000000) {
            updates.amount = numAmount.toString();
            break;
          }
        }
      }
    }

    // Detect concept/reference - more flexible patterns
    const conceptPatterns = [
      /(?:Concepto|Referencia|Descripción|Descripcion|Motivo|Por concepto de)[:\s]+([A-Za-z0-9áéíóúñÁÉÍÓÚÑüÜ\s.,\-\/]+?)(?:\s+(?:Monto|Importe|Total|\$|Fecha)|\s*$)/i,
      /(?:Concepto|Referencia)[:\s]+([A-Za-z0-9áéíóúñÁÉÍÓÚÑüÜ\s.,\-\/]{3,40})/i,
    ];

    // Try labeled patterns on original text first
    for (const pattern of conceptPatterns) {
      const match = originalText.match(pattern);
      if (match) {
        const concept = sanitizeForSpei(match[1].trim());
        if (concept.length >= 3 && concept.length <= 40) {
          updates.concept = concept.toUpperCase();
          break;
        }
      }
    }

    // If we found at least CLABE or name, apply defaults for missing fields
    if (updates.beneficiaryAccount || updates.beneficiaryName) {
      // Default concept if not detected
      if (!updates.concept) {
        updates.concept = 'TRANSFER';
      }
      // Default numerical reference if not set
      if (!formData.numericalReference) {
        updates.numericalReference = '1';
      }
    }

    // Apply updates if any were found
    if (Object.keys(updates).length > 0) {
      setFormData(prev => ({ ...prev, ...updates }));
      return true;
    }
    return false;
  }, [formData.numericalReference]);

  // OCR image processing handler
  const handleImageUpload = useCallback(async (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    setIsProcessingOcr(true);
    setOcrProgress(0);
    setOcrStatus('Cargando imagen...');

    try {
      const result = await Tesseract.recognize(
        file,
        'spa', // Spanish language for better accuracy with Mexican banking documents
        {
          logger: (info) => {
            if (info.status === 'recognizing text') {
              setOcrProgress(Math.round(info.progress * 100));
              setOcrStatus('Extrayendo texto...');
            } else if (info.status === 'loading language traineddata') {
              setOcrStatus('Cargando idioma español...');
            } else if (info.status === 'initializing tesseract') {
              setOcrStatus('Inicializando OCR...');
            }
          },
        }
      );

      const extractedText = result.data.text;

      if (extractedText && extractedText.length > 10) {
        // Use the smart paste handler to extract data from OCR text
        const found = handleSmartPaste(extractedText);
        if (found) {
          setOcrStatus('¡Datos detectados y llenados!');
        } else {
          setOcrStatus('No se detectaron datos bancarios');
        }
      } else {
        setOcrStatus('No se pudo extraer texto de la imagen');
      }
    } catch (error) {
      console.error('OCR error:', error);
      setOcrStatus('Error al procesar la imagen');
    } finally {
      setIsProcessingOcr(false);
      // Clear status after a delay
      setTimeout(() => {
        setOcrStatus('');
        setOcrProgress(0);
      }, 3000);
    }
  }, [handleSmartPaste]);

  // File input change handler
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
    // Reset the input so the same file can be selected again
    e.target.value = '';
  }, [handleImageUpload]);

  // Manual paste text processing
  const handleProcessPasteText = useCallback(() => {
    if (!pasteText.trim()) {
      setPasteStatus('Ingresa texto para procesar');
      return;
    }

    const found = handleSmartPaste(pasteText);
    if (found) {
      setPasteStatus('¡Datos detectados y llenados!');
      setPasteText('');
      // Auto-hide after success
      setTimeout(() => {
        setShowPasteField(false);
        setPasteStatus('');
      }, 2000);
    } else {
      setPasteStatus('No se detectaron datos bancarios en el texto');
    }

    // Clear status after delay
    setTimeout(() => setPasteStatus(''), 3000);
  }, [pasteText, handleSmartPaste]);

  // Global paste event listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Only process if we're in the transfers tab and sending
      if (activeTab !== 'send') return;

      const pastedText = e.clipboardData?.getData('text');
      if (pastedText && pastedText.length > 10) {
        // Only auto-detect if pasting more than just a single value
        if (pastedText.includes('\n') || pastedText.length > 20) {
          handleSmartPaste(pastedText);
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [activeTab, handleSmartPaste]);

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
      await fetch('/api/orders/confirm-pending', { method: 'POST', headers: getAuthHeaders() });

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
        headers: getAuthHeaders(),
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
        const response = await fetch('/api/clabe-accounts', {
          headers: getAuthHeaders(),
        });
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
  }, [user?.id]);

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
        headers: getAuthHeaders(),
        body: JSON.stringify({
          // 2FA code if required
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
    <div className="space-y-4 md:space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-lg md:text-xl font-medium text-white/90">Transferencias SPEI</h1>
        <p className="text-xs md:text-sm text-white/40 mt-1">Envia y recibe fondos</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-white/[0.02] border border-white/[0.06] w-full sm:w-fit">
        <button
          onClick={() => setActiveTab('send')}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm transition-colors touch-manipulation ${
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
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm transition-colors touch-manipulation ${
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
              <Card className="overflow-visible relative z-20">
                <CardContent className="py-2 md:py-3 overflow-visible">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowSavedAccountsDropdown(!showSavedAccountsDropdown)}
                      className="w-full flex items-center justify-between px-3 md:px-4 py-3 rounded-lg bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.04] transition-colors touch-manipulation"
                    >
                      <div className="flex items-center gap-2 md:gap-3 min-w-0">
                        <Bookmark className="w-4 h-4 text-purple-400 flex-shrink-0" />
                        <span className="text-white/70 text-sm truncate">Cuenta guardada</span>
                        <span className="text-xs text-white/30 hidden sm:inline">({savedAccounts.length})</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-white/40 transition-transform flex-shrink-0 ${showSavedAccountsDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showSavedAccountsDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-[100] bg-[#0a0a1a] border border-white/[0.08] rounded-lg shadow-2xl max-h-[50vh] overflow-y-auto">
                        {savedAccounts.map((account) => (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => selectSavedAccount(account)}
                            className="w-full flex items-start gap-2 md:gap-3 px-3 md:px-4 py-3 hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors text-left border-b border-white/[0.04] last:border-b-0 touch-manipulation"
                          >
                            <div className="w-8 h-8 rounded-md bg-white/[0.06] flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Building2 className="w-4 h-4 text-white/40" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-white/80 text-sm font-medium truncate max-w-[150px] md:max-w-none">{account.alias}</span>
                                <span className="text-[10px] md:text-xs text-white/30 px-1.5 py-0.5 bg-white/[0.04] rounded">
                                  {account.bankName}
                                </span>
                              </div>
                              <p className="text-xs text-white/40 truncate">{account.beneficiaryName}</p>
                              <p className="text-[10px] md:text-xs text-white/30 font-mono truncate">{formatClabe(account.clabe)}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Transfers - Repeat Feature */}
            {recentTransfers.length > 0 && (
              <Card className="overflow-visible relative z-10">
                <CardContent className="py-2 md:py-3 overflow-visible">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowRecentTransfers(!showRecentTransfers)}
                      className="w-full flex items-center justify-between px-3 md:px-4 py-3 rounded-lg bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.04] transition-colors touch-manipulation"
                    >
                      <div className="flex items-center gap-2 md:gap-3 min-w-0">
                        <RotateCcw className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <span className="text-white/70 text-sm truncate">Repetir reciente</span>
                        <span className="text-xs text-white/30 hidden sm:inline">({recentTransfers.length})</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-white/40 transition-transform flex-shrink-0 ${showRecentTransfers ? 'rotate-180' : ''}`} />
                    </button>

                    {showRecentTransfers && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-[90] bg-[#0a0a1a] border border-white/[0.08] rounded-lg shadow-2xl max-h-[50vh] overflow-y-auto">
                        <p className="px-3 md:px-4 py-2 text-[10px] md:text-xs text-amber-400/80 bg-amber-500/5 border-b border-white/[0.04]">
                          Al seleccionar, se llenarán los datos pero NO se ejecutará automáticamente.
                        </p>
                        {recentTransfers.map((transfer) => (
                          <button
                            key={transfer.id}
                            type="button"
                            onClick={() => selectRecentTransfer(transfer)}
                            className="w-full flex items-start gap-2 md:gap-3 px-3 md:px-4 py-3 hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors text-left border-b border-white/[0.04] last:border-b-0 touch-manipulation"
                          >
                            <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <SendHorizontal className="w-4 h-4 text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-white/80 text-sm font-medium truncate max-w-[120px] md:max-w-none">{transfer.beneficiaryName || 'Sin nombre'}</span>
                                <span className="text-green-400 text-xs md:text-sm font-mono font-medium flex-shrink-0">{formatCurrency(transfer.amount)}</span>
                              </div>
                              <p className="text-xs text-white/40 truncate">{transfer.concept || 'Sin concepto'}</p>
                              <p className="text-[10px] md:text-xs text-white/30 font-mono truncate">{formatClabe(transfer.beneficiaryAccount)}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Smart Data Extraction Tools */}
            <Card>
              <CardContent className="py-2 md:py-3 space-y-2">
                {/* OCR Image Upload Button */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                    capture="environment"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingOcr}
                    className="w-full flex items-center justify-between px-3 md:px-4 py-3 rounded-lg bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                  >
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                      {isProcessingOcr ? (
                        <Loader2 className="w-4 h-4 text-green-400 animate-spin flex-shrink-0" />
                      ) : (
                        <Camera className="w-4 h-4 text-green-400 flex-shrink-0" />
                      )}
                      <span className="text-white/70 text-sm truncate">
                        {isProcessingOcr ? ocrStatus : 'Extraer de imagen'}
                      </span>
                      {!isProcessingOcr && (
                        <span className="text-xs text-white/30 hidden sm:inline">(OCR)</span>
                      )}
                    </div>
                    {isProcessingOcr ? (
                      <span className="text-xs text-green-400 font-mono flex-shrink-0">{ocrProgress}%</span>
                    ) : (
                      <ImageIcon className="w-4 h-4 text-white/40 flex-shrink-0" />
                    )}
                  </button>

                  {/* Progress bar during OCR */}
                  {isProcessingOcr && (
                    <div className="mt-2 w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-300"
                        style={{ width: `${ocrProgress}%` }}
                      />
                    </div>
                  )}

                  {/* OCR Status message */}
                  {ocrStatus && !isProcessingOcr && (
                    <p className={`text-xs mt-2 px-4 ${
                      ocrStatus.includes('detectados') ? 'text-green-400' : 'text-amber-400/80'
                    }`}>
                      {ocrStatus}
                    </p>
                  )}
                </div>

                {/* Paste Text Button */}
                <button
                  type="button"
                  onClick={() => setShowPasteField(!showPasteField)}
                  className="w-full flex items-center justify-between px-3 md:px-4 py-3 rounded-lg bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors touch-manipulation"
                >
                  <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <ClipboardPaste className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <span className="text-white/70 text-sm truncate">Pegar datos bancarios</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-white/40 transition-transform flex-shrink-0 ${showPasteField ? 'rotate-180' : ''}`} />
                </button>

                {/* Paste Text Field - Expandable */}
                {showPasteField && (
                  <div className="p-2 md:p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-2 md:space-y-3">
                    <textarea
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      placeholder="Pega aquí el texto del comprobante...

Ejemplo:
JUAN PEREZ LOPEZ
012180015000000001
$1,500.00"
                      className="w-full h-28 md:h-32 px-3 py-2 text-sm bg-white/[0.02] border border-white/[0.08] rounded-lg text-white/80 placeholder:text-white/20 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                    />
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleProcessPasteText}
                        disabled={!pasteText.trim()}
                        leftIcon={<CheckCircle className="w-4 h-4" />}
                        className="w-full sm:w-auto touch-manipulation"
                      >
                        Detectar datos
                      </Button>
                      {pasteStatus && (
                        <p className={`text-xs ${
                          pasteStatus.includes('detectados') ? 'text-green-400' : 'text-amber-400/80'
                        }`}>
                          {pasteStatus}
                        </p>
                      )}
                    </div>
                    <p className="text-[10px] text-white/20">
                      Detecta: CLABE, nombre, monto y concepto
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Source Account Selector */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-white/40" />
                    Cuenta de Origen
                  </span>
                  {selectedAccount && typeof selectedAccount.availableBalance === 'number' && (
                    <span className="text-sm font-normal">
                      <span className="text-white/40">Disponible: </span>
                      <span className="text-green-400 font-mono font-medium">
                        {formatCurrency(selectedAccount.availableBalance)}
                      </span>
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  label="Selecciona la cuenta CLABE de origen"
                  options={[
                    { value: '', label: 'Seleccionar cuenta...' },
                    ...clabeAccounts.map((acc) => ({
                      value: acc.clabe,
                      label: `${acc.alias} - ${acc.clabe.replace(/(.{4})/g, '$1 ').trim()}${typeof acc.availableBalance === 'number' ? ` (${formatCurrency(acc.availableBalance)})` : ''}`,
                    })),
                  ]}
                  value={formData.payerAccount}
                  onChange={(e) => handleInputChange('payerAccount', e.target.value)}
                  error={errors.payerAccount}
                  disabled={isLoadingClabeAccounts}
                />
                {selectedAccount && typeof selectedAccount.inTransit === 'number' && selectedAccount.inTransit > 0 && (
                  <p className="text-xs text-yellow-400/70 mt-2">
                    En tránsito: {formatCurrency(selectedAccount.inTransit)}
                  </p>
                )}
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
          <div className="space-y-4 order-first lg:order-none">
            <Card className="lg:sticky lg:top-8">
              <CardHeader className="py-3 md:py-4">
                <CardTitle className="text-sm md:text-base">Resumen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 md:space-y-4 py-3 md:py-4">
                <div className="space-y-2 md:space-y-3">
                  <div className="flex justify-between text-xs md:text-sm">
                    <span className="text-white/40">Monto a enviar</span>
                    <span className="font-mono text-white/80">
                      {formData.amount ? formatCurrency(parseFloat(formData.amount)) : '$0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs md:text-sm">
                    <span className="text-white/40">Comision</span>
                    <span className="font-mono text-green-400/80">$0.00</span>
                  </div>
                  <div className="border-t border-white/[0.06] pt-2 md:pt-3 flex justify-between">
                    <span className="text-white/70 text-xs md:text-sm">Total</span>
                    <span className="font-mono text-base md:text-lg text-white/90">
                      {formData.amount ? formatCurrency(parseFloat(formData.amount)) : '$0.00'}
                    </span>
                  </div>
                </div>

                <div className="p-2 md:p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center gap-2 text-xs md:text-sm">
                    <Shield className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-400/60" />
                    <span className="text-white/40">Transferencia protegida</span>
                  </div>
                </div>

                {formData.beneficiaryName && (
                  <div className="p-2 md:p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                    <p className="text-[10px] md:text-xs text-white/30 mb-1">Beneficiario</p>
                    <p className="text-xs md:text-sm text-white/80 truncate">{formData.beneficiaryName}</p>
                    {formData.beneficiaryAccount && (
                      <p className="text-[10px] md:text-xs text-white/30 font-mono mt-1 truncate">
                        {formatClabe(formData.beneficiaryAccount)}
                      </p>
                    )}
                    {detectedBank && (
                      <p className="text-[10px] md:text-xs text-white/40 mt-1">{detectedBank.shortName}</p>
                    )}
                  </div>
                )}

                {/* Quick bank selection - hide on mobile to save space */}
                {!formData.beneficiaryBank && !detectedBank && (
                  <div className="hidden md:block p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                    <p className="text-xs text-white/30 mb-2">Bancos frecuentes</p>
                    <div className="flex flex-wrap gap-1">
                      {getPopularBanks().slice(0, 6).map(bank => (
                        <button
                          key={bank.speiCode}
                          onClick={() => handleInputChange('beneficiaryBank', bank.speiCode)}
                          className="px-2 py-1 text-xs bg-white/[0.04] hover:bg-white/[0.08] rounded border border-white/[0.08] text-white/60 hover:text-white/80 transition-colors touch-manipulation"
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
