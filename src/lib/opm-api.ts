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

// List all orders with filters
export interface ListOrdersParams {
  type: 0 | 1; // 0=outgoing, 1=incoming
  itemsPerPage?: number;
  page?: number;
  from?: number;
  to?: number;
  hasSubProduct?: boolean;
  productId?: string;
  isSent?: boolean;
  isScattered?: boolean;
  isReturned?: boolean;
  isCanceled?: boolean;
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

// ==================== SIGNATURE HELPERS ====================

// Build original string for signing payment orders
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
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const amountStr = order.amount.toFixed(2);

  return `||${order.beneficiaryName}|${order.beneficiaryUid}|${order.beneficiaryBank}|${order.beneficiaryAccount}|${order.beneficiaryAccountType}|${order.payerAccount}|${order.numericalReference}|${dateStr}|${order.paymentType}|${order.concept}|${amountStr}||`;
}

// Build original string for client signature
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

// Build original string for webhook supply verification
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

// Build original string for order status webhook verification
export function buildOrderStatusOriginalString(data: {
  id: string;
  status: string;
  detail?: string;
}): string {
  return `||${data.id}|${data.status}|${data.detail || ''}||`;
}
