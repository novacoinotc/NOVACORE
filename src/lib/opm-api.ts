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

const API_BASE_URL = process.env.NEXT_PUBLIC_OPM_API_URL || 'https://apiuat.opm.mx';
const API_VERSION = '1.0';

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

// Generic fetch wrapper with error handling
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  apiKey?: string
): Promise<ApiResponse<T>> {
  const url = buildUrl(endpoint);

  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(apiKey),
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `API Error: ${response.status}`);
  }

  return data;
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

// Create indirect participant client
export async function createClient(
  clientData: Client,
  apiKey?: string
): Promise<ApiResponse<Client>> {
  return fetchApi<Client>('indirectParticipantClients', {
    method: 'POST',
    body: JSON.stringify(clientData),
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
 * This function creates an indirect participant client in OPM, which
 * automatically generates a virtual CLABE account number.
 *
 * Based on Especificacion api.pdf Section 4.14:
 * - POST /api/1.0/indirectParticipantClients
 * - If virtualAccountNumber is NOT provided, OPM auto-generates it
 * - Response includes virtualAccount.accountNumber with the generated CLABE
 *
 * @param clientData - Client data for the virtual account
 * @param apiKey - Optional API key
 * @returns Created client with generated virtualAccountNumber (CLABE)
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

export async function createVirtualClabe(
  request: CreateVirtualClabeRequest,
  apiKey?: string
): Promise<ApiResponse<Client>> {
  // Build client data for OPM API
  // Note: We do NOT send virtualAccountNumber so OPM auto-generates the CLABE
  const clientData: Client = {
    name: request.name,
    lastName: request.lastName || '',
    secondLastName: request.secondLastName || '',
    businessName: request.businessName || request.name,
    commercialActivity: request.commercialActivity || 'Servicios financieros',
    rfc: request.rfc,
    curp: request.curp || 'XEXX010101HNEXXXA4', // Generic CURP for companies
    address: request.address,
    email: request.email,
    mobileNumber: request.mobileNumber,
    birthDate: request.birthDate || '1990-01-01',
    gender: request.gender || 'M',
    state: request.state,
    country: request.country || 'MX',
    nationality: request.nationality || 'MX',
    status: 'ACTIVE',
  };

  return createClient(clientData, apiKey);
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
 * @returns Array of created clients with their generated CLABEs
 */
export async function createVirtualClabeSubaccounts(
  baseData: CreateVirtualClabeRequest,
  count: number,
  aliasPrefix: string = 'Subcuenta',
  apiKey?: string
): Promise<ApiResponse<Client>[]> {
  const results: ApiResponse<Client>[] = [];

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
