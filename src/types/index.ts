// API Types for OPM/Transfer SPEI Integration

// ==================== AUTH TYPES ====================

export type UserRole = 'super_admin' | 'company_admin' | 'user';

// All available permissions in the system
export const ALL_PERMISSIONS = {
  // Dashboard
  'dashboard.view': 'Ver dashboard',

  // Balance
  'balance.view': 'Ver saldos',

  // Orders/Transfers
  'orders.view': 'Ver transferencias',
  'orders.create': 'Crear transferencias SPEI',
  'orders.cancel': 'Cancelar transferencias',
  'orders.cep': 'Obtener CEP de transferencias',
  'orders.notify': 'Reenviar notificaciones webhook',

  // Saved Accounts (user's saved third-party accounts for transfers)
  'savedAccounts.view': 'Ver cuentas guardadas',
  'savedAccounts.create': 'Crear cuentas guardadas',
  'savedAccounts.update': 'Actualizar cuentas guardadas',
  'savedAccounts.delete': 'Eliminar cuentas guardadas',

  // History
  'history.view': 'Ver historial de transacciones',

  // Banks & Catalogs
  'banks.view': 'Ver catálogo de bancos',
  'catalogs.view': 'Ver tipos de cuenta y pago',

  // Settings
  'settings.view': 'Ver configuración',
  'settings.update': 'Modificar configuración',

  // User Management
  'users.view': 'Ver usuarios',
  'users.create': 'Crear usuarios',
  'users.update': 'Actualizar usuarios',
  'users.delete': 'Eliminar usuarios',

  // Company Management (super_admin only)
  'companies.view': 'Ver empresas',
  'companies.create': 'Crear empresas',
  'companies.update': 'Actualizar empresas',
  'companies.delete': 'Eliminar empresas',

  // CLABE Account Management
  'clabe.view': 'Ver cuentas CLABE',
  'clabe.create': 'Crear cuentas CLABE',
  'clabe.update': 'Actualizar cuentas CLABE',
  'clabe.delete': 'Eliminar cuentas CLABE',
  'clabe.assign': 'Asignar cuentas CLABE a usuarios',
} as const;

export type Permission = keyof typeof ALL_PERMISSIONS;

// Default permissions for each role
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: Object.keys(ALL_PERMISSIONS) as Permission[],
  company_admin: [
    'dashboard.view',
    'balance.view',
    'orders.view',
    'orders.create',
    'orders.cancel',
    'orders.cep',
    'savedAccounts.view',
    'savedAccounts.create',
    'savedAccounts.update',
    'savedAccounts.delete',
    'history.view',
    'banks.view',
    'catalogs.view',
    'settings.view',
    'users.view',
    'users.create',
    'users.update',
    'users.delete',
    'clabe.view',
    'clabe.create',
    'clabe.update',
    'clabe.assign',
  ],
  user: [
    'dashboard.view',
    'balance.view',
    'orders.view',
    'orders.create',
    'savedAccounts.view',
    'savedAccounts.create',
    'savedAccounts.update',
    'savedAccounts.delete',
    'history.view',
    'banks.view',
    'catalogs.view',
    'clabe.view',
  ],
};

// ==================== COMPANY TYPES ====================

export interface Company {
  id: string;
  name: string;              // Nombre comercial
  businessName: string;      // Razón social
  rfc: string;
  email: string;
  phone?: string;
  address?: string;
  isActive: boolean;
  speiInEnabled: boolean;    // SPEI IN habilitado
  speiOutEnabled: boolean;   // SPEI OUT habilitado
  commissionPercentage: number; // Porcentaje de comisión (0-100)
  parentClabe?: string;      // CLABE madre para comisiones
  createdAt: number;
  updatedAt: number;
}

// ==================== CLABE ACCOUNT TYPES ====================

export interface ClabeAccount {
  id: string;
  companyId: string;
  clabe: string;             // 18-digit CLABE number
  alias: string;             // Friendly name (e.g., "Sucursal Norte")
  description?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  // Populated fields
  company?: Company;
}

// ==================== USER TYPES ====================

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId?: string;        // null for super_admin
  permissions: Permission[];
  clabeAccountIds?: string[]; // CLABE accounts user has access to (for role 'user')
  avatar?: string;
  createdAt: number;
  updatedAt: number;
  lastLogin?: number;
  isActive: boolean;
  totpEnabled?: boolean;     // Whether 2FA is enabled for user
  // Populated fields
  company?: Company;
  clabeAccounts?: ClabeAccount[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  companyId?: string;
  permissions: Permission[];
  clabeAccountIds?: string[];
}

/**
 * Order interface - based on OPM API Specification (Especificacion api.pdf)
 *
 * Field specifications:
 * - concept: string<40> - max 40 characters
 * - beneficiaryAccount: string<18> - CLABE 18 digits
 * - beneficiaryBank: string<5> - 5 digit bank code
 * - beneficiaryName: string<40> - max 40 characters
 * - beneficiaryUid: string<18> - RFC/CURP max 18 chars
 * - payerAccount: string<18> - CLABE 18 digits
 * - payerBank: string<5> - 5 digit bank code
 * - payerName: string<40> - max 40 characters
 * - payerUid: string<18> - RFC/CURP max 18 chars
 * - amount: double<18,2> - max 2 decimal places
 * - numericalReference: integer<7> - 7 digits (1000000-9999999)
 * - paymentDay: integer<32> - epoch milliseconds
 * - trackingKey: string<30> - max 30 characters
 */
export interface Order {
  id: string;
  productId: string;
  subProductId: string;
  concept: string;                  // string<40>
  trackingKey: string;              // string<30>
  beneficiaryAccount: string;       // string<18> - CLABE
  beneficiaryBank: string;          // string<5>
  beneficiaryName: string;          // string<40>
  beneficiaryUid: string;           // string<18> - RFC/CURP
  beneficiaryAccountType: number;   // Account type code
  payerAccount: string;             // string<18> - CLABE
  payerBank: string;                // string<5>
  payerName: string;                // string<40>
  payerUid: string;                 // string<18> - RFC/CURP
  payerAccountType: number;         // Account type code
  amount: number;                   // double<18,2>
  numericalReference: number;       // integer<7>
  paymentDay: number;               // epoch milliseconds
  paymentType: number;              // Payment type code
  createdAt: number;
  queuedAt: number;
  sentAt: number;
  settlementDate: number;
  updatedAt: number;
  sent: boolean;
  scattered: boolean;               // liquidada/settled
  returned: boolean;                // devuelta/rejected
  canceled: boolean;
  canceledAt: number;
  errorDetail: string;
  accountBalance: number;
  type: number;                     // 0=speiOut (credit), 1=speiIn (debit)
  fraudulent: boolean;
  fraudulentReason: string;
  refundTrackingKey?: string;
  refundCause?: string;
}

/**
 * CreateOrderRequest - Request payload for creating SPEI orders
 * Based on OPM API Specification (Especificacion api.pdf) - POST /api/1.0/orders/
 */
export interface CreateOrderRequest {
  concept: string;                  // string<40> - Transaction concept
  beneficiaryAccount: string;       // string<18> - CLABE 18 digits
  beneficiaryBank: string;          // string<5> - Bank code
  beneficiaryName: string;          // string<40> - Beneficiary name
  beneficiaryUid: string;           // string<18> - RFC/CURP
  beneficiaryAccountType: number;   // integer<32> - Account type code
  payerAccount: string;             // string<18> - CLABE 18 digits
  payerBank: string;                // string<5> - Bank code
  payerName: string;                // string<40> - Payer name
  payerUid?: string;                // string<18> - RFC/CURP (optional)
  payerAccountType: number;         // integer<32> - Account type code
  amount: number;                   // double<18,2> - Amount with 2 decimals
  numericalReference: number;       // integer<7> - 7 digits (1000000-9999999)
  paymentDay: number;               // integer<32> - Epoch milliseconds
  paymentType: number;              // integer<32> - Payment type code
  sign: string;                     // string<1000> - RSA-SHA256 signature
  trackingKey?: string;             // string<30> - Optional tracking key
  // Optional CEP override fields
  cepPayerName?: string;            // Override payer name on CEP
  cepPayerUid?: string;             // Override payer RFC/CURP on CEP
  cepPayerAccount?: string;         // Override payer account on CEP
}

export interface Balance {
  account: string;
  balance: number;
  transitBalance: number;
  availableBalance: number;
  updatedAt: number;
}

export interface Bank {
  code: string;
  name: string;
  legalCode: string;
  isActive: boolean;
}

export interface AccountType {
  key: number;
  description: string;
  active: boolean;
}

export interface PaymentType {
  key: number;
  description: string;
  active: boolean;
}

// SavedAccount - Third-party accounts saved by users for frequent transfers
export interface SavedAccount {
  id: string;
  userId: string;
  alias: string;                  // Friendly name (e.g., "Mi proveedor")
  clabe: string;                  // 18-digit CLABE
  bankCode: string;               // Bank code
  bankName: string;               // Bank name
  beneficiaryName: string;        // Name of the account holder
  beneficiaryRfc?: string;        // RFC of the account holder
  accountType: number;            // Account type (default: 40 for CLABE)
  notes?: string;                 // Optional notes
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

// Legacy Client interface for OPM API compatibility (if needed)
export interface Client {
  id?: string;
  virtualAccountNumber?: string;
  name: string;
  lastName?: string;
  secondLastName?: string;
  businessName?: string;
  commercialActivity?: string;
  rfc: string;
  curp: string;
  address: string;
  email: string;
  mobileNumber: string;
  birthDate: string;
  gender: 'M' | 'F';
  state: string;
  country: string;
  nationality: string;
  occupation?: string;
  serialNumberCertificate?: string;
  idIne?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'CANCELED';
  signature?: string;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * WebhookSupplyData - Incoming SPEI deposit notification
 * Based on MI-OPM-2.5.pdf - Webhook for incoming transfers (supply)
 *
 * Response codes:
 * - 0: Transacción aceptada
 * - 4: Saldo de cuenta excede límite permitido
 * - 6: Cuenta no existente
 * - 7: Error en datos de pago
 * - 12: Operación duplicada
 * - 13: Beneficiario no reconoce pago
 * - 99: Error interno del sistema
 */
export interface WebhookSupplyData {
  type: 'supply';
  data: {
    beneficiaryName: string;        // string<40>
    beneficiaryUid: string;         // string<18> - RFC/CURP
    beneficiaryAccount: string;     // string<18> - CLABE
    beneficiaryBank: string;        // string<5>
    beneficiaryAccountType: number;
    payerName: string;              // string<40>
    payerUid: string;               // string<18> - RFC/CURP
    payerAccount: string;           // string<18> - CLABE
    payerBank: string;              // string<5>
    payerAccountType: number;
    amount: number;                 // double<18,2>
    concept: string;                // string<40>
    trackingKey: string;            // string<30>
    numericalReference: number;     // integer<7>
    operationDate: string;          // ISO date string
    receivedTimestamp: number;      // epoch milliseconds
    sign: string;                   // RSA-SHA256 signature for verification
  };
}

/**
 * WebhookOrderStatusData - Order status change notification
 * Based on MI-OPM-2.5.pdf - Webhook for outgoing order status updates
 *
 * Status values:
 * - pending: Order queued, waiting for balance
 * - sent: Order sent to SPEI, awaiting response
 * - scattered: Successfully settled/liquidated
 * - canceled: Order was canceled
 * - returned: Order was rejected by recipient bank
 */
export interface WebhookOrderStatusData {
  type: 'orderStatus';
  data: {
    id: string;                     // Order ID
    status: 'pending' | 'sent' | 'scattered' | 'canceled' | 'returned';
    detail?: string;                // Error/status detail message
  };
  sign: string;                     // RSA-SHA256 signature for verification
}

export interface ApiResponse<T> {
  code: number;
  data: T;
  error?: string;
  meta?: {
    totalItems: number;
    pageSize: number;
  };
}

// UI Types
export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export interface Transaction {
  id: string;
  type: 'incoming' | 'outgoing';
  amount: number;
  status: 'pending' | 'sent' | 'scattered' | 'canceled' | 'returned';
  beneficiaryName: string;
  payerName: string;
  concept: string;
  trackingKey: string;
  date: Date;
  bank: string;
}

export interface DashboardStats {
  totalBalance: number;
  availableBalance: number;
  transitBalance: number;
  todayIncoming: number;
  todayOutgoing: number;
  pendingOrders: number;
  totalClients: number;
}

// Chart Data Types
export interface ChartDataPoint {
  name: string;
  incoming: number;
  outgoing: number;
  date: string;
}

export interface PieChartData {
  name: string;
  value: number;
  color: string;
}
