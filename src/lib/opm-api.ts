// OPM/Transfer API Service for SPEI Integration
import {
  Order,
  CreateOrderRequest,
  Balance,
  Bank,
  AccountType,
  PaymentType,
  Client,
  ApiResponse
} from '@/types';
import crypto from 'crypto';

// SECURITY FIX: Use server-only env var (no NEXT_PUBLIC_ prefix)
// This prevents exposing the API URL to client-side JavaScript
const API_BASE_URL = process.env.OPM_API_URL || 'https://apiuat.opm.mx';
const API_VERSION = '1.0';

// ==================== RSA-SHA256 SIGNATURE ====================
// Based on MI-OPM-2.5.pdf - Digital signature generation

/**
 * Sign a string using RSA-SHA256 algorithm
 *
 * Uses the private key from environment variable OPM_PRIVATE_KEY
 * The key should be in PEM format (can be base64 encoded in env var)
 *
 * @param originalString - The "cadena original" to sign
 * @param privateKeyPem - Optional PEM private key, defaults to env var
 * @returns Base64 encoded signature
 */
export function signWithRSA(originalString: string, privateKeyPem?: string): string {
  const privateKey = privateKeyPem || process.env.OPM_PRIVATE_KEY || '';

  if (!privateKey) {
    throw new Error('OPM_PRIVATE_KEY environment variable is not set');
  }

  // Handle base64 encoded keys (if stored that way in env)
  let pemKey = privateKey;
  if (!privateKey.includes('-----BEGIN')) {
    // Assume it's base64 encoded, decode it
    pemKey = Buffer.from(privateKey, 'base64').toString('utf8');
  }

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(originalString, 'utf8');
  const signature = signer.sign(pemKey, 'base64');

  return signature;
}

/**
 * Verify a signature using RSA-SHA256 algorithm
 *
 * Uses the public key from environment variable OPM_PUBLIC_KEY
 * Useful for verifying webhook signatures from OPM
 *
 * @param originalString - The "cadena original" that was signed
 * @param signature - Base64 encoded signature to verify
 * @param publicKeyPem - Optional PEM public key, defaults to env var
 * @returns true if signature is valid
 */
export function verifyRSASignature(
  originalString: string,
  signature: string,
  publicKeyPem?: string
): boolean {
  const publicKey = publicKeyPem || process.env.OPM_PUBLIC_KEY || '';

  if (!publicKey) {
    throw new Error('OPM_PUBLIC_KEY environment variable is not set');
  }

  // Handle base64 encoded keys
  let pemKey = publicKey;
  if (!publicKey.includes('-----BEGIN')) {
    pemKey = Buffer.from(publicKey, 'base64').toString('utf8');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(originalString, 'utf8');

  return verifier.verify(pemKey, signature, 'base64');
}

// Helper to build API URL
function buildUrl(endpoint: string): string {
  return `${API_BASE_URL}/api/${API_VERSION}/${endpoint}`;
}

// Helper for API headers
function getHeaders(apiKey?: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Custom-Auth': apiKey || process.env.OPM_API_KEY || '',
  };
}

// SECURITY FIX: Default timeout for OPM API calls (30 seconds)
const OPM_API_TIMEOUT_MS = 30000;

// Generic fetch wrapper with error handling and timeout
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  apiKey?: string
): Promise<ApiResponse<T>> {
  const url = buildUrl(endpoint);

  // SECURITY FIX: Add timeout to prevent indefinite hangs
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPM_API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getHeaders(apiKey),
        ...options.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle empty responses gracefully
    const text = await response.text();

    if (!text || text.trim() === '') {
      if (!response.ok) {
        throw new Error(`OPM API Error: ${response.status} - Empty response`);
      }
      // Empty successful response - return empty object/array based on context
      return {} as ApiResponse<T>;
    }

    let data: ApiResponse<T>;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      throw new Error(`OPM API returned invalid JSON: ${text.substring(0, 100)}...`);
    }

    if (!response.ok) {
      throw new Error((data as any).error || `API Error: ${response.status}`);
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    // SECURITY FIX: Provide clear error message for timeouts
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`OPM API timeout after ${OPM_API_TIMEOUT_MS}ms - endpoint: ${endpoint}`);
    }
    throw error;
  }
}

// ==================== ORDERS API ====================

// Create a new payment order
export async function createOrder(
  orderData: CreateOrderRequest,
  apiKey?: string
): Promise<ApiResponse<Order>> {
  return fetchApi<Order>('orders/', {
    method: 'POST',
    body: JSON.stringify(orderData),
  }, apiKey);
}

/**
 * Create a signed payment order (SPEI Out)
 *
 * This function automatically:
 * 1. Builds the "cadena original" from order data
 * 2. Signs it using RSA-SHA256
 * 3. Includes the signature in the request
 *
 * Use this function instead of createOrder for production SPEI transfers.
 *
 * @param orderData - Order data without signature
 * @param apiKey - Optional API key
 * @returns API response with created order
 */
export async function createSignedOrder(
  orderData: Omit<CreateOrderRequest, 'sign'>,
  apiKey?: string
): Promise<ApiResponse<Order>> {
  // Build the original string for signing
  const originalString = buildOrderOriginalString({
    beneficiaryName: orderData.beneficiaryName,
    beneficiaryUid: orderData.beneficiaryUid,
    beneficiaryBank: orderData.beneficiaryBank,
    beneficiaryAccount: orderData.beneficiaryAccount,
    beneficiaryAccountType: orderData.beneficiaryAccountType,
    payerAccount: orderData.payerAccount,
    numericalReference: orderData.numericalReference,
    paymentDay: orderData.paymentDay,
    paymentType: orderData.paymentType,
    concept: orderData.concept,
    amount: orderData.amount,
  });

  // Sign the original string with RSA-SHA256
  const sign = signWithRSA(originalString);

  // Create the order with signature
  const signedOrderData: CreateOrderRequest = {
    ...orderData,
    sign,
  };

  return fetchApi<Order>('orders/', {
    method: 'POST',
    body: JSON.stringify(signedOrderData),
  }, apiKey);
}

// Get order by ID
export async function getOrder(
  orderId: string,
  apiKey?: string
): Promise<ApiResponse<Order>> {
  return fetchApi<Order>(`orders/${orderId}`, {
    method: 'GET',
  }, apiKey);
}

// Get order status by tracking key
export async function getOrderByTrackingKey(
  trackingKey: string,
  paymentDay: number,
  type: 0 | 1, // 0=speiOut, 1=speiIn
  apiKey?: string
): Promise<ApiResponse<Order>> {
  const params = new URLSearchParams({
    trackingKey,
    paymentDay: paymentDay.toString(),
    type: type.toString(),
  });

  return fetchApi<Order>(`orders/status?${params}`, {
    method: 'GET',
  }, apiKey);
}

// List all orders with filters (from Especificacion api.pdf)
export interface ListOrdersParams {
  type: 0 | 1;           // 0=speiOut (outgoing), 1=speiIn (incoming)
  itemsPerPage?: number; // Items per page (default varies)
  page?: number;         // Page number
  from?: number;         // Start date (epoch milliseconds)
  to?: number;           // End date (epoch milliseconds)
  hasSubProduct?: boolean; // Filter by subproduct presence
  productId?: string;    // Filter by product ID
  isSent?: boolean;      // Filter by sent status
  isScattered?: boolean; // Filter by scattered/settled status
  isReturned?: boolean;  // Filter by returned status
  isCanceled?: boolean;  // Filter by canceled status
}

export async function listOrders(
  params: ListOrdersParams,
  apiKey?: string
): Promise<ApiResponse<Order[]>> {
  const queryParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      queryParams.append(key, value.toString());
    }
  });

  return fetchApi<Order[]>(`orders/?${queryParams}`, {
    method: 'GET',
  }, apiKey);
}

// Cancel order
export async function cancelOrder(
  orderId: string,
  apiKey?: string
): Promise<ApiResponse<void>> {
  return fetchApi<void>(`orders/cancel/${orderId}`, {
    method: 'DELETE',
  }, apiKey);
}

// Get CEP URL for order
export async function getOrderCep(
  orderId: string,
  apiKey?: string
): Promise<ApiResponse<string>> {
  return fetchApi<string>(`orders/${orderId}/cep`, {
    method: 'GET',
  }, apiKey);
}

// Resend webhook notification
export async function notifyOrder(
  orderId: string,
  apiKey?: string
): Promise<ApiResponse<void>> {
  return fetchApi<void>(`orders/webhookNotify/${orderId}`, {
    method: 'POST',
  }, apiKey);
}

// Get orders by subproduct
export async function getOrdersBySubproduct(
  subproductId: string,
  params: {
    type: 0 | 1;
    page: number;
    itemsPerPage: number;
    from: number;
    to: number;
  },
  apiKey?: string
): Promise<ApiResponse<Order[]>> {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    queryParams.append(key, value.toString());
  });

  return fetchApi<Order[]>(`orders/subProduct/${subproductId}?${queryParams}`, {
    method: 'GET',
  }, apiKey);
}

// ==================== BALANCE API ====================

// Get account balance
export async function getBalance(
  account: string,
  apiKey?: string
): Promise<ApiResponse<Balance>> {
  return fetchApi<Balance>('balances/', {
    method: 'POST',
    body: JSON.stringify({ account }),
  }, apiKey);
}

// ==================== BANKS API ====================

// List all banks
export async function listBanks(
  apiKey?: string
): Promise<ApiResponse<Bank[]>> {
  return fetchApi<Bank[]>('banks/', {
    method: 'GET',
  }, apiKey);
}

// ==================== ACCOUNT TYPES API ====================

// List account types
export async function listAccountTypes(
  apiKey?: string
): Promise<ApiResponse<AccountType[]>> {
  return fetchApi<AccountType[]>('accountTypes/', {
    method: 'GET',
  }, apiKey);
}

// ==================== PAYMENT TYPES API ====================

// List payment types
export async function listPaymentTypes(
  apiKey?: string
): Promise<ApiResponse<PaymentType[]>> {
  return fetchApi<PaymentType[]>('paymentTypes/', {
    method: 'GET',
  }, apiKey);
}

// ==================== CLIENTS API ====================

// Create indirect participant client (without signature - for testing only)
export async function createClient(
  clientData: Client,
  apiKey?: string
): Promise<ApiResponse<Client>> {
  return fetchApi<Client>('indirectParticipantClients', {
    method: 'POST',
    body: JSON.stringify(clientData),
  }, apiKey);
}

/**
 * Create a signed indirect participant client
 *
 * This function automatically:
 * 1. Builds the "cadena original" from client data
 * 2. Signs it using RSA-SHA256
 * 3. Includes the signature in the request
 *
 * Use this function for production client creation.
 * Based on MI-OPM-2.5.pdf signature requirements.
 *
 * @param clientData - Client data without signature
 * @param apiKey - Optional API key
 * @returns API response with created client including virtualAccountNumber
 */
export async function createSignedClient(
  clientData: Omit<Client, 'signature'>,
  apiKey?: string
): Promise<ApiResponse<Client>> {
  // Build the original string for signing
  const originalString = buildClientOriginalString({
    name: clientData.name,
    businessName: clientData.businessName,
    commercialActivity: clientData.commercialActivity,
    rfc: clientData.rfc,
    curp: clientData.curp,
    address: clientData.address,
    email: clientData.email,
    mobileNumber: clientData.mobileNumber,
    birthDate: clientData.birthDate,
  });

  // Sign the original string with RSA-SHA256
  const signature = signWithRSA(originalString);

  // Create the client with signature
  const signedClientData: Client = {
    ...clientData,
    signature,
  };

  return fetchApi<Client>('indirectParticipantClients', {
    method: 'POST',
    body: JSON.stringify(signedClientData),
  }, apiKey);
}

// List all clients
export interface ListClientsParams {
  virtualAccountNumber?: string;
  rfc?: string;
  curp?: string;
  page?: number;
  itemsPerPage?: number;
  status?: string;
}

export async function listClients(
  params?: ListClientsParams,
  apiKey?: string
): Promise<ApiResponse<Client[]>> {
  const queryParams = new URLSearchParams();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, value.toString());
      }
    });
  }

  const query = queryParams.toString();
  return fetchApi<Client[]>(`indirectParticipantClients/${query ? `?${query}` : ''}`, {
    method: 'GET',
  }, apiKey);
}

// Get single client by ID
export async function getClientById(
  clientId: string,
  apiKey?: string
): Promise<ApiResponse<Client>> {
  return fetchApi<Client>(`indirectParticipantClients/${clientId}`, {
    method: 'GET',
  }, apiKey);
}

// Update client
export async function updateClient(
  clientId: string,
  clientData: Partial<Client>,
  apiKey?: string
): Promise<ApiResponse<Client>> {
  return fetchApi<Client>(`indirectParticipantClients/${clientId}`, {
    method: 'PUT',
    body: JSON.stringify(clientData),
  }, apiKey);
}

// Update client status
export async function updateClientStatus(
  clientId: string,
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'CANCELED',
  apiKey?: string
): Promise<ApiResponse<Client>> {
  return fetchApi<Client>(`indirectParticipantClients/${clientId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  }, apiKey);
}

// ==================== VIRTUAL CLABE GENERATION ====================

/**
 * Create a virtual CLABE account via OPM API
 *
 * UPDATED: Now uses the virtualAccounts endpoint instead of indirectParticipantClients
 * The virtualAccounts endpoint was discovered through API probing and returns 200.
 *
 * Based on API discovery:
 * - POST /api/1.0/virtualAccounts
 * - Creates a virtual/reference account (cuenta referenciadora)
 * - Response includes the generated CLABE in virtualAccountNumber
 *
 * @param clientData - Client data for the virtual account
 * @param apiKey - Optional API key
 * @returns Created virtual account with generated virtualAccountNumber (CLABE)
 */
export interface CreateVirtualClabeRequest {
  name: string;              // Account holder name (person or company name)
  lastName?: string;         // Person's last name (for individuals)
  secondLastName?: string;   // Person's second last name (for individuals)
  businessName?: string;     // Legal business name (for companies)
  commercialActivity?: string; // Business activity description
  rfc: string;               // RFC (tax ID)
  curp?: string;             // CURP (for individuals, required by API)
  address: string;           // Full address
  email: string;             // Contact email
  mobileNumber: string;      // Contact phone (10 digits)
  birthDate?: string;        // Birth date YYYY-MM-DD (for individuals)
  gender?: 'M' | 'F';        // Gender (for individuals)
  state: string;             // Mexican state
  country?: string;          // Country code (default: MX)
  nationality?: string;      // Nationality (default: MX)
  alias?: string;            // Friendly name for the CLABE (internal use)
}

/**
 * Virtual Account response from OPM API
 */
export interface VirtualAccount {
  id?: string;
  virtualAccountNumber?: string;  // The generated 18-digit CLABE
  accountNumber?: string;         // Alternative field for CLABE
  name?: string;
  businessName?: string;
  rfc?: string;
  status?: string;
  createdAt?: string;
  [key: string]: any;  // Allow additional fields from API
}

export async function createVirtualClabe(
  request: CreateVirtualClabeRequest,
  apiKey?: string
): Promise<ApiResponse<VirtualAccount>> {
  // The virtualAccounts endpoint accepts an empty body or optional metadata
  // It auto-generates a CLABE based on the authenticated account
  const requestBody = {
    // Store client info in metadata for our records (optional)
    metadata: {
      name: request.name,
      businessName: request.businessName || request.name,
      rfc: request.rfc,
      email: request.email,
      alias: request.alias || '',
    },
    // externalId can be used to link to our internal records
    externalId: request.alias || null,
  };

  console.log('Creating virtual account via virtualAccounts endpoint...');
  console.log('Request data:', JSON.stringify(requestBody, null, 2));

  // Use virtualAccounts endpoint (discovered via API probing)
  // This endpoint auto-generates a CLABE subaccount
  return fetchApi<VirtualAccount>('virtualAccounts', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  }, apiKey);
}

/**
 * Build original string for virtual account signature
 */
export function buildVirtualAccountOriginalString(data: {
  name: string;
  businessName?: string;
  commercialActivity?: string;
  rfc: string;
  curp: string;
  address: string;
  email: string;
  mobileNumber: string;
  birthDate: string;
}): string {
  return `||${data.name}|${data.businessName || ''}|${data.commercialActivity || ''}|${data.rfc}|${data.curp}|${data.address}|${data.email}|${data.mobileNumber}|${data.birthDate}||`;
}

/**
 * List virtual accounts from OPM API
 */
export async function listVirtualAccounts(
  params?: {
    page?: number;
    itemsPerPage?: number;
    virtualAccountNumber?: string;
    rfc?: string;
  },
  apiKey?: string
): Promise<ApiResponse<VirtualAccount[]>> {
  const queryParams = new URLSearchParams();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, value.toString());
      }
    });
  }

  const query = queryParams.toString();
  return fetchApi<VirtualAccount[]>(`virtualAccounts${query ? `?${query}` : ''}`, {
    method: 'GET',
  }, apiKey);
}

/**
 * Create multiple virtual CLABE subaccounts for a company
 *
 * Useful for creating cost center accounts or departmental accounts
 * that share the same company information but have unique CLABEs.
 *
 * @param baseData - Base company/client data
 * @param count - Number of subaccounts to create
 * @param aliasPrefix - Prefix for subaccount aliases (e.g., "Centro de Costos")
 * @param apiKey - Optional API key
 * @returns Array of created virtual accounts with their generated CLABEs
 */
export async function createVirtualClabeSubaccounts(
  baseData: CreateVirtualClabeRequest,
  count: number,
  aliasPrefix: string = 'Subcuenta',
  apiKey?: string
): Promise<ApiResponse<VirtualAccount>[]> {
  const results: ApiResponse<VirtualAccount>[] = [];

  for (let i = 1; i <= count; i++) {
    const subaccountData = {
      ...baseData,
      alias: `${aliasPrefix} ${i}`,
    };

    const result = await createVirtualClabe(subaccountData, apiKey);
    results.push(result);
  }

  return results;
}

// ==================== SIGNATURE HELPERS ====================
// Based on MI-OPM-2.5.pdf - Digital signature generation

/**
 * Build original string for signing payment orders
 *
 * Format from MI-OPM-2.5.pdf:
 * ||beneficiaryName|beneficiaryUid|beneficiaryBank|beneficiaryAccount|beneficiaryAccountType|
 * payerAccount|numericalReference|paymentDay|paymentType|concept|amount||
 *
 * Example:
 * ||OPMTEST|XAXX010101000|40684|6846010000000001|40|6846010000000002|1234567|2021-12-31|1|CONCEPTO|1.00||
 *
 * Notes:
 * - paymentDay must be formatted as YYYY-MM-DD
 * - amount must have exactly 2 decimal places
 */
export function buildOrderOriginalString(order: {
  beneficiaryName: string;
  beneficiaryUid: string;
  beneficiaryBank: string;
  beneficiaryAccount: string;
  beneficiaryAccountType: number;
  payerAccount: string;
  numericalReference: number;
  paymentDay: number;
  paymentType: number;
  concept: string;
  amount: number;
}): string {
  const date = new Date(order.paymentDay);
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
  const amountStr = order.amount.toFixed(2); // Always 2 decimal places

  return `||${order.beneficiaryName}|${order.beneficiaryUid}|${order.beneficiaryBank}|${order.beneficiaryAccount}|${order.beneficiaryAccountType}|${order.payerAccount}|${order.numericalReference}|${dateStr}|${order.paymentType}|${order.concept}|${amountStr}||`;
}

/**
 * Build original string for client (indirect participant) signature
 *
 * Format for indirect participant client registration
 */
export function buildClientOriginalString(client: {
  name: string;
  businessName?: string;
  commercialActivity?: string;
  rfc: string;
  curp: string;
  address: string;
  email: string;
  mobileNumber: string;
  birthDate: string;
}): string {
  return `||${client.name}|${client.businessName || ''}|${client.commercialActivity || ''}|${client.rfc}|${client.curp}|${client.address}|${client.email}|${client.mobileNumber}|${client.birthDate}||`;
}

/**
 * Build original string for webhook supply (incoming deposit) verification
 *
 * This is used to verify the signature on incoming deposit webhooks from OPM.
 * The original string format should match what OPM uses to sign the webhook.
 */
export function buildSupplyOriginalString(data: {
  beneficiaryName: string;
  beneficiaryUid: string;
  beneficiaryAccount: string;
  beneficiaryBank: string;
  beneficiaryAccountType: number;
  payerName: string;
  payerUid: string;
  payerAccount: string;
  payerBank: string;
  payerAccountType: number;
  amount: number;
  concept: string;
  trackingKey: string;
  numericalReference: number;
}): string {
  return `||${data.beneficiaryName}|${data.beneficiaryUid}|${data.beneficiaryAccount}|${data.beneficiaryBank}|${data.beneficiaryAccountType}|${data.payerName}|${data.payerUid}|${data.payerAccount}|${data.payerBank}|${data.payerAccountType}|${data.amount}|${data.concept}|${data.trackingKey}|${data.numericalReference}||`;
}

/**
 * Build original string for order status webhook verification
 *
 * This is used to verify the signature on order status webhooks from OPM.
 */
export function buildOrderStatusOriginalString(data: {
  id: string;
  status: string;
  detail?: string;
}): string {
  return `||${data.id}|${data.status}|${data.detail || ''}||`;
}
