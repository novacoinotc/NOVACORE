/**
 * Transaction Signing System
 *
 * SECURITY: Provides cryptographic integrity verification for internal transactions
 * This ensures that transaction data has not been tampered with after creation.
 *
 * Uses HMAC-SHA256 for signing transaction data with a server-side secret key.
 * Each transaction gets a unique signature based on its critical fields.
 *
 * IMPORTANT: The TRANSACTION_SIGNING_KEY must be:
 * - At least 32 bytes (256 bits) of entropy
 * - Stored securely (AWS Secrets Manager)
 * - Never exposed to clients
 * - Rotated periodically
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

// Signing key from environment (must be at least 32 bytes, base64 encoded)
const SIGNING_KEY = process.env.TRANSACTION_SIGNING_KEY;

/**
 * Critical transaction fields that are included in the signature.
 * Any modification to these fields will invalidate the signature.
 */
interface TransactionSigningData {
  transactionId: string;
  type: 'incoming' | 'outgoing';
  amount: string | number;
  beneficiaryAccount?: string;
  beneficiaryName?: string;
  payerAccount?: string;
  trackingKey: string;
  createdAt: string | Date;
}

/**
 * Generate a cryptographic signature for a transaction
 *
 * @param data - Critical transaction fields to sign
 * @returns Base64-encoded HMAC-SHA256 signature, or null if signing not configured
 */
export function signTransaction(data: TransactionSigningData): string | null {
  // Gracefully handle missing signing key - don't break the app
  if (!SIGNING_KEY || SIGNING_KEY.length < 32) {
    console.warn('[SECURITY] TRANSACTION_SIGNING_KEY not configured or too short. Transactions will not be signed.');
    return null;
  }

  try {
    // Normalize and canonicalize the data to ensure consistent signing
    const canonicalData = buildCanonicalString(data);

    // Create HMAC-SHA256 signature
    const hmac = createHmac('sha256', SIGNING_KEY);
    hmac.update(canonicalData);
    return hmac.digest('base64');
  } catch (error) {
    console.error('[SECURITY] Failed to sign transaction:', error);
    return null;
  }
}

/**
 * Verify a transaction's signature
 *
 * @param data - Transaction data to verify
 * @param signature - The signature to verify against
 * @returns true if signature is valid, false otherwise
 */
export function verifyTransactionSignature(
  data: TransactionSigningData,
  signature: string
): boolean {
  if (!SIGNING_KEY || SIGNING_KEY.length < 32) {
    console.error('[SECURITY] Transaction signing key not configured');
    return false;
  }

  try {
    // Regenerate the signature
    const expectedSignature = signTransaction(data);

    // Use timing-safe comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature, 'base64');
    const expectedBuffer = Buffer.from(expectedSignature, 'base64');

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch (error) {
    console.error('[SECURITY] Error verifying transaction signature:', error);
    return false;
  }
}

/**
 * Build a canonical string representation of transaction data
 * This ensures consistent ordering and formatting for signature generation
 *
 * @param data - Transaction data
 * @returns Canonical string representation
 */
function buildCanonicalString(data: TransactionSigningData): string {
  // Normalize amount to string with 2 decimal places
  const normalizedAmount = typeof data.amount === 'number'
    ? data.amount.toFixed(2)
    : parseFloat(data.amount).toFixed(2);

  // Normalize date to ISO string
  const normalizedDate = data.createdAt instanceof Date
    ? data.createdAt.toISOString()
    : new Date(data.createdAt).toISOString();

  // Build canonical string with sorted fields
  const parts = [
    `txId:${data.transactionId}`,
    `type:${data.type}`,
    `amount:${normalizedAmount}`,
    `trackingKey:${data.trackingKey}`,
    `createdAt:${normalizedDate}`,
  ];

  // Add optional fields if present
  if (data.beneficiaryAccount) {
    parts.push(`beneficiaryAccount:${data.beneficiaryAccount}`);
  }
  if (data.beneficiaryName) {
    parts.push(`beneficiaryName:${data.beneficiaryName}`);
  }
  if (data.payerAccount) {
    parts.push(`payerAccount:${data.payerAccount}`);
  }

  // Sort for consistency and join with pipe separator
  return parts.sort().join('|');
}

/**
 * Generate a new random signing key (for initial setup)
 *
 * @returns Base64-encoded 256-bit random key
 */
export function generateSigningKey(): string {
  return randomBytes(32).toString('base64');
}

/**
 * Check if transaction signing is properly configured
 *
 * @returns true if signing is available
 */
export function isSigningConfigured(): boolean {
  return Boolean(SIGNING_KEY && SIGNING_KEY.length >= 32);
}

/**
 * Transaction integrity check result
 */
export interface IntegrityCheckResult {
  valid: boolean;
  reason?: string;
  checkedAt: Date;
}

/**
 * Perform full integrity check on a transaction
 *
 * @param transaction - Full transaction object from database
 * @param storedSignature - Signature stored with the transaction
 * @returns Integrity check result
 */
export function checkTransactionIntegrity(
  transaction: {
    id: string;
    type: 'incoming' | 'outgoing';
    amount: number | string;
    beneficiary_account?: string | null;
    beneficiary_name?: string | null;
    payer_account?: string | null;
    tracking_key: string;
    created_at: Date | string;
  },
  storedSignature: string | null
): IntegrityCheckResult {
  const now = new Date();

  if (!storedSignature) {
    return {
      valid: false,
      reason: 'No signature stored for transaction',
      checkedAt: now,
    };
  }

  if (!isSigningConfigured()) {
    return {
      valid: false,
      reason: 'Transaction signing not configured',
      checkedAt: now,
    };
  }

  const signingData: TransactionSigningData = {
    transactionId: transaction.id,
    type: transaction.type,
    amount: transaction.amount,
    beneficiaryAccount: transaction.beneficiary_account || undefined,
    beneficiaryName: transaction.beneficiary_name || undefined,
    payerAccount: transaction.payer_account || undefined,
    trackingKey: transaction.tracking_key,
    createdAt: transaction.created_at,
  };

  const isValid = verifyTransactionSignature(signingData, storedSignature);

  return {
    valid: isValid,
    reason: isValid ? undefined : 'Signature mismatch - possible tampering detected',
    checkedAt: now,
  };
}
