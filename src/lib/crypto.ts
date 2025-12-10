// Cryptographic utilities for RSA signing (OPM API)
import { createSign, createVerify, createPrivateKey, createPublicKey } from 'crypto';

// Note: This file handles RSA-SHA256 signing for OPM API
// The private key should NEVER be exposed to the client
// All signing operations should happen server-side via API routes

/**
 * Decode a Base64-encoded PEM key from environment variable
 * The .env file stores keys as Base64-encoded PEM strings
 */
function decodeKeyFromEnv(encodedKey: string): string {
  // Check if the key is already in PEM format (starts with -----)
  if (encodedKey.trim().startsWith('-----')) {
    return encodedKey;
  }

  // Otherwise, decode from Base64
  try {
    const decoded = Buffer.from(encodedKey, 'base64').toString('utf-8');
    return decoded;
  } catch (error) {
    console.error('Failed to decode key from Base64:', error);
    return encodedKey;
  }
}

/**
 * Sign a string using RSA-SHA256 (Server-side only)
 * This function should only be called from API routes
 *
 * Supports both:
 * - PKCS#1 format: -----BEGIN RSA PRIVATE KEY-----
 * - PKCS#8 format: -----BEGIN PRIVATE KEY-----
 */
export async function signWithPrivateKey(
  originalString: string,
  privateKeyInput: string
): Promise<string> {
  try {
    // Decode the key if it's Base64 encoded
    const privateKeyPem = decodeKeyFromEnv(privateKeyInput);

    console.log('Signing with private key...');
    console.log('Key format detected:', privateKeyPem.includes('RSA PRIVATE KEY') ? 'PKCS#1' : 'PKCS#8');
    console.log('Original string to sign:', originalString);

    // Create a private key object - Node.js crypto handles both PKCS#1 and PKCS#8
    const privateKey = createPrivateKey({
      key: privateKeyPem,
      format: 'pem',
    });

    // Create signer with SHA256
    const signer = createSign('RSA-SHA256');
    signer.update(originalString);
    signer.end();

    // Sign and return Base64-encoded signature
    const signature = signer.sign(privateKey, 'base64');

    console.log('Signature generated successfully, length:', signature.length);
    return signature;
  } catch (error) {
    console.error('Error signing with private key:', error);
    throw new Error(`Failed to sign: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verify a signature using RSA-SHA256 public key
 *
 * Supports both:
 * - SPKI format: -----BEGIN PUBLIC KEY-----
 * - RSA format: -----BEGIN RSA PUBLIC KEY-----
 */
export async function verifySignature(
  originalString: string,
  signature: string,
  publicKeyInput: string
): Promise<boolean> {
  try {
    // Decode the key if it's Base64 encoded
    const publicKeyPem = decodeKeyFromEnv(publicKeyInput);

    console.log('Verifying signature...');
    console.log('Key format:', publicKeyPem.includes('RSA PUBLIC KEY') ? 'PKCS#1' : 'SPKI');

    // Create a public key object
    const publicKey = createPublicKey({
      key: publicKeyPem,
      format: 'pem',
    });

    // Create verifier
    const verifier = createVerify('RSA-SHA256');
    verifier.update(originalString);
    verifier.end();

    // Verify the signature
    const isValid = verifier.verify(publicKey, signature, 'base64');

    console.log('Signature verification result:', isValid);
    return isValid;
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

/**
 * Generate a random numerical reference (7 digits)
 */
export function generateNumericalReference(): number {
  return Math.floor(1000000 + Math.random() * 9000000);
}

/**
 * Generate a tracking key (alphanumeric, max 30 chars)
 */
export function generateTrackingKey(prefix: string = 'NC'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `${prefix}${timestamp}${random}`.substring(0, 30);
}
