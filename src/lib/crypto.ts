// Cryptographic utilities for RSA signing (OPM API)

// Note: This file handles RSA-SHA256 signing for OPM API
// The private key should NEVER be exposed to the client
// All signing operations should happen server-side via API routes

/**
 * Sign a string using RSA-SHA256 (Server-side only)
 * This function should only be called from API routes
 */
export async function signWithPrivateKey(
  originalString: string,
  privateKeyPem: string
): Promise<string> {
  // Convert PEM to ArrayBuffer
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = privateKeyPem
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');

  const binaryString = atob(pemContents);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Import the private key
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  // Sign the original string
  const encoder = new TextEncoder();
  const data = encoder.encode(originalString);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    data
  );

  // Convert to base64
  const signatureArray = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < signatureArray.length; i++) {
    binary += String.fromCharCode(signatureArray[i]);
  }

  return btoa(binary);
}

/**
 * Verify a signature using RSA-SHA256 public key
 */
export async function verifySignature(
  originalString: string,
  signature: string,
  publicKeyPem: string
): Promise<boolean> {
  try {
    // Convert PEM to ArrayBuffer
    const pemHeader = '-----BEGIN PUBLIC KEY-----';
    const pemFooter = '-----END PUBLIC KEY-----';
    const pemContents = publicKeyPem
      .replace(pemHeader, '')
      .replace(pemFooter, '')
      .replace(/\s/g, '');

    const binaryString = atob(pemContents);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Import the public key
    const publicKey = await crypto.subtle.importKey(
      'spki',
      bytes.buffer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['verify']
    );

    // Decode the signature
    const signatureBinary = atob(signature);
    const signatureBytes = new Uint8Array(signatureBinary.length);
    for (let i = 0; i < signatureBinary.length; i++) {
      signatureBytes[i] = signatureBinary.charCodeAt(i);
    }

    // Verify
    const encoder = new TextEncoder();
    const data = encoder.encode(originalString);

    return await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      signatureBytes.buffer,
      data
    );
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
