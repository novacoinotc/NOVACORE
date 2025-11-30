import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency in MXN
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Format CLABE account with spaces
export function formatClabe(clabe: string): string {
  if (!clabe || clabe.length !== 18) return clabe;
  return `${clabe.slice(0, 3)} ${clabe.slice(3, 6)} ${clabe.slice(6, 10)} ${clabe.slice(10, 14)} ${clabe.slice(14)}`;
}

// Format date from epoch milliseconds
export function formatDate(epoch: number): string {
  const date = new Date(epoch);
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// Format relative time
export function formatRelativeTime(epoch: number): string {
  const now = Date.now();
  const diff = now - epoch;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Ahora mismo';
  if (minutes < 60) return `Hace ${minutes} min`;
  if (hours < 24) return `Hace ${hours}h`;
  if (days < 7) return `Hace ${days}d`;

  return formatDate(epoch);
}

// Calculate CLABE check digit
export function calculateClabeCheckDigit(clabe17: string): string {
  if (clabe17.length !== 17) {
    throw new Error('CLABE must have 17 digits');
  }

  const weights = [3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7];
  let sum = 0;

  for (let i = 0; i < 17; i++) {
    const digit = parseInt(clabe17[i], 10);
    const weighted = (digit * weights[i]) % 10;
    sum += weighted;
  }

  const remainder = sum % 10;
  const checkDigit = (10 - remainder) % 10;

  return checkDigit.toString();
}

// Validate CLABE
export function validateClabe(clabe: string): boolean {
  if (!/^\d{18}$/.test(clabe)) return false;

  const clabe17 = clabe.slice(0, 17);
  const providedCheckDigit = clabe.slice(17);
  const calculatedCheckDigit = calculateClabeCheckDigit(clabe17);

  return providedCheckDigit === calculatedCheckDigit;
}

// Generate tracking key
export function generateTrackingKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 30; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Get status color
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'text-yellow-400',
    sent: 'text-blue-400',
    scattered: 'text-green-400',
    canceled: 'text-gray-400',
    returned: 'text-red-400',
  };
  return colors[status] || 'text-gray-400';
}

// Get status background color
export function getStatusBgColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-400/10 border-yellow-400/30',
    sent: 'bg-blue-400/10 border-blue-400/30',
    scattered: 'bg-green-400/10 border-green-400/30',
    canceled: 'bg-gray-400/10 border-gray-400/30',
    returned: 'bg-red-400/10 border-red-400/30',
  };
  return colors[status] || 'bg-gray-400/10 border-gray-400/30';
}

// Get status text in Spanish
export function getStatusText(status: string): string {
  const texts: Record<string, string> = {
    pending: 'Pendiente',
    sent: 'Enviada',
    scattered: 'Liquidada',
    canceled: 'Cancelada',
    returned: 'Devuelta',
  };
  return texts[status] || status;
}

// Truncate text
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// Remove accents and special characters
export function sanitizeForSpei(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim();
}

// Format epoch to YYYY-MM-DD for API
export function epochToDateString(epoch: number): string {
  const date = new Date(epoch);
  return date.toISOString().split('T')[0];
}

// Parse date string to epoch milliseconds
export function dateStringToEpoch(dateStr: string): number {
  return new Date(dateStr).getTime();
}

// Generate random color for charts
export function generateChartColor(index: number): string {
  const colors = [
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#a855f7', // Purple
    '#00f5ff', // Cyan
    '#00ff66', // Green
    '#fbbf24', // Yellow
    '#f97316', // Orange
    '#ef4444', // Red
  ];
  return colors[index % colors.length];
}

// Mask account number for display
export function maskAccount(account: string): string {
  if (account.length < 8) return account;
  return `****${account.slice(-4)}`;
}

// ==================== OPM API FIELD VALIDATIONS ====================
// Based on OPM API Specification (Especificacion api.pdf)

export interface ValidationError {
  field: string;
  message: string;
  maxLength?: number;
  actualLength?: number;
}

// Validate order fields according to OPM API specification
export function validateOrderFields(order: {
  concept?: string;
  beneficiaryAccount?: string;
  beneficiaryBank?: string;
  beneficiaryName?: string;
  beneficiaryUid?: string;
  payerAccount?: string;
  payerBank?: string;
  payerName?: string;
  payerUid?: string;
  numericalReference?: number;
  trackingKey?: string;
  amount?: number;
}): ValidationError[] {
  const errors: ValidationError[] = [];

  // concept: string<40> - max 40 characters
  if (order.concept && order.concept.length > 40) {
    errors.push({
      field: 'concept',
      message: 'Concepto excede 40 caracteres',
      maxLength: 40,
      actualLength: order.concept.length,
    });
  }

  // beneficiaryAccount: string<18> - exactly 18 digits (CLABE)
  if (order.beneficiaryAccount) {
    if (!/^\d{18}$/.test(order.beneficiaryAccount)) {
      errors.push({
        field: 'beneficiaryAccount',
        message: 'Cuenta beneficiario debe ser CLABE de 18 dígitos',
        maxLength: 18,
        actualLength: order.beneficiaryAccount.length,
      });
    } else if (!validateClabe(order.beneficiaryAccount)) {
      errors.push({
        field: 'beneficiaryAccount',
        message: 'Dígito verificador de CLABE inválido',
      });
    }
  }

  // beneficiaryBank: string<5> - exactly 5 digits
  if (order.beneficiaryBank && !/^\d{5}$/.test(order.beneficiaryBank)) {
    errors.push({
      field: 'beneficiaryBank',
      message: 'Código de banco beneficiario debe ser 5 dígitos',
      maxLength: 5,
      actualLength: order.beneficiaryBank.length,
    });
  }

  // beneficiaryName: string<40> - max 40 characters
  if (order.beneficiaryName && order.beneficiaryName.length > 40) {
    errors.push({
      field: 'beneficiaryName',
      message: 'Nombre beneficiario excede 40 caracteres',
      maxLength: 40,
      actualLength: order.beneficiaryName.length,
    });
  }

  // beneficiaryUid: string<18> - max 18 characters (RFC/CURP)
  if (order.beneficiaryUid && order.beneficiaryUid.length > 18) {
    errors.push({
      field: 'beneficiaryUid',
      message: 'RFC/CURP beneficiario excede 18 caracteres',
      maxLength: 18,
      actualLength: order.beneficiaryUid.length,
    });
  }

  // payerAccount: string<18> - exactly 18 digits (CLABE)
  if (order.payerAccount && !/^\d{18}$/.test(order.payerAccount)) {
    errors.push({
      field: 'payerAccount',
      message: 'Cuenta ordenante debe ser CLABE de 18 dígitos',
      maxLength: 18,
      actualLength: order.payerAccount.length,
    });
  }

  // payerBank: string<5> - exactly 5 digits
  if (order.payerBank && !/^\d{5}$/.test(order.payerBank)) {
    errors.push({
      field: 'payerBank',
      message: 'Código de banco ordenante debe ser 5 dígitos',
      maxLength: 5,
      actualLength: order.payerBank.length,
    });
  }

  // payerName: string<40> - max 40 characters
  if (order.payerName && order.payerName.length > 40) {
    errors.push({
      field: 'payerName',
      message: 'Nombre ordenante excede 40 caracteres',
      maxLength: 40,
      actualLength: order.payerName.length,
    });
  }

  // payerUid: string<18> - max 18 characters (RFC/CURP) - optional
  if (order.payerUid && order.payerUid.length > 18) {
    errors.push({
      field: 'payerUid',
      message: 'RFC/CURP ordenante excede 18 caracteres',
      maxLength: 18,
      actualLength: order.payerUid.length,
    });
  }

  // numericalReference: integer<7> - max 7 digits (1000000-9999999)
  if (order.numericalReference !== undefined) {
    if (order.numericalReference < 1000000 || order.numericalReference > 9999999) {
      errors.push({
        field: 'numericalReference',
        message: 'Referencia numérica debe ser entre 1000000 y 9999999 (7 dígitos)',
      });
    }
  }

  // trackingKey: string<30> - max 30 characters
  if (order.trackingKey && order.trackingKey.length > 30) {
    errors.push({
      field: 'trackingKey',
      message: 'Clave de rastreo excede 30 caracteres',
      maxLength: 30,
      actualLength: order.trackingKey.length,
    });
  }

  // amount: double<18,2> - must be positive with max 2 decimal places
  if (order.amount !== undefined) {
    if (order.amount <= 0) {
      errors.push({
        field: 'amount',
        message: 'Monto debe ser mayor a 0',
      });
    }
    // Check if amount has more than 2 decimal places
    const amountStr = order.amount.toString();
    const decimalPart = amountStr.split('.')[1];
    if (decimalPart && decimalPart.length > 2) {
      errors.push({
        field: 'amount',
        message: 'Monto no puede tener más de 2 decimales',
      });
    }
  }

  return errors;
}

// Truncate and sanitize text for SPEI (max length + remove special chars)
export function prepareTextForSpei(text: string, maxLength: number): string {
  const sanitized = sanitizeForSpei(text);
  return sanitized.substring(0, maxLength);
}

// Format large numbers with K, M, B
export function formatCompactNumber(num: number): string {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}
