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
