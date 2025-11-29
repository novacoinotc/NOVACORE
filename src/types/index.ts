// API Types for OPM/Transfer SPEI Integration

// ==================== AUTH TYPES ====================

export type UserRole = 'admin' | 'user';

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

  // Clients
  'clients.view': 'Ver clientes',
  'clients.create': 'Crear clientes',
  'clients.update': 'Actualizar clientes',
  'clients.status': 'Cambiar estado de clientes',

  // History
  'history.view': 'Ver historial de transacciones',

  // Banks & Catalogs
  'banks.view': 'Ver catálogo de bancos',
  'catalogs.view': 'Ver tipos de cuenta y pago',

  // Settings
  'settings.view': 'Ver configuración',
  'settings.update': 'Modificar configuración',

  // User Management (admin only)
  'users.view': 'Ver usuarios',
  'users.create': 'Crear usuarios',
  'users.update': 'Actualizar usuarios',
  'users.delete': 'Eliminar usuarios',
} as const;

export type Permission = keyof typeof ALL_PERMISSIONS;

// Default permissions for each role
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: Object.keys(ALL_PERMISSIONS) as Permission[],
  user: [
    'dashboard.view',
    'balance.view',
    'orders.view',
    'orders.create',
    'clients.view',
    'history.view',
    'banks.view',
    'catalogs.view',
    'settings.view',
  ],
};

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: Permission[];
  avatar?: string;
  createdAt: number;
  updatedAt: number;
  lastLogin?: number;
  isActive: boolean;
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
  permissions: Permission[];
}

export interface Order {
  id: string;
  productId: string;
  subProductId: string;
  concept: string;
  trackingKey: string;
  beneficiaryAccount: string;
  beneficiaryBank: string;
  beneficiaryName: string;
  beneficiaryUid: string;
  beneficiaryAccountType: number;
  payerAccount: string;
  payerBank: string;
  payerName: string;
  payerUid: string;
  payerAccountType: number;
  amount: number;
  numericalReference: number;
  paymentDay: number;
  paymentType: number;
  createdAt: number;
  queuedAt: number;
  sentAt: number;
  settlementDate: number;
  updatedAt: number;
  sent: boolean;
  scattered: boolean;
  returned: boolean;
  canceled: boolean;
  canceledAt: number;
  errorDetail: string;
  accountBalance: number;
  type: number; // 0=credit, 1=debit
  fraudulent: boolean;
  fraudulentReason: string;
  refundTrackingKey?: string;
  refundCause?: string;
}

export interface CreateOrderRequest {
  concept: string;
  beneficiaryAccount: string;
  beneficiaryBank: string;
  beneficiaryName: string;
  beneficiaryUid: string;
  beneficiaryAccountType: number;
  payerAccount: string;
  payerBank: string;
  payerName: string;
  payerUid?: string;
  payerAccountType: number;
  amount: number;
  numericalReference: number;
  paymentDay: number;
  paymentType: number;
  sign: string;
  trackingKey?: string;
  cepPayerName?: string;
  cepPayerUid?: string;
  cepPayerAccount?: string;
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

export interface WebhookSupplyData {
  type: 'supply';
  data: {
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
    operationDate: string;
    receivedTimestamp: number;
    sign: string;
  };
}

export interface WebhookOrderStatusData {
  type: 'orderStatus';
  data: {
    id: string;
    status: 'pending' | 'sent' | 'scattered' | 'canceled' | 'returned';
    detail?: string;
  };
  sign: string;
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
