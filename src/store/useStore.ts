import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Order, Balance, Bank, Client, DashboardStats } from '@/types';

interface AppState {
  // UI State
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;

  // Balance
  balance: Balance | null;
  setBalance: (balance: Balance | null) => void;
  isLoadingBalance: boolean;
  setIsLoadingBalance: (loading: boolean) => void;

  // Orders
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrder: (orderId: string, updates: Partial<Order>) => void;
  isLoadingOrders: boolean;
  setIsLoadingOrders: (loading: boolean) => void;

  // Banks
  banks: Bank[];
  setBanks: (banks: Bank[]) => void;

  // Clients
  clients: Client[];
  setClients: (clients: Client[]) => void;
  addClient: (client: Client) => void;
  updateClient: (clientId: string, updates: Partial<Client>) => void;
  isLoadingClients: boolean;
  setIsLoadingClients: (loading: boolean) => void;

  // Dashboard Stats
  dashboardStats: DashboardStats | null;
  setDashboardStats: (stats: DashboardStats | null) => void;

  // Settings
  apiKey: string;
  setApiKey: (key: string) => void;
  payerAccount: string;
  setPayerAccount: (account: string) => void;
  payerName: string;
  setPayerName: (name: string) => void;
  payerBank: string;
  setPayerBank: (bank: string) => void;

  // Notifications
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // UI State
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      theme: 'dark',
      setTheme: (theme) => set({ theme }),

      // Balance
      balance: null,
      setBalance: (balance) => set({ balance }),
      isLoadingBalance: false,
      setIsLoadingBalance: (loading) => set({ isLoadingBalance: loading }),

      // Orders
      orders: [],
      setOrders: (orders) => set({ orders }),
      addOrder: (order) => set((state) => ({ orders: [order, ...state.orders] })),
      updateOrder: (orderId, updates) =>
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === orderId ? { ...o, ...updates } : o
          ),
        })),
      isLoadingOrders: false,
      setIsLoadingOrders: (loading) => set({ isLoadingOrders: loading }),

      // Banks
      banks: [],
      setBanks: (banks) => set({ banks }),

      // Clients
      clients: [],
      setClients: (clients) => set({ clients }),
      addClient: (client) => set((state) => ({ clients: [client, ...state.clients] })),
      updateClient: (clientId, updates) =>
        set((state) => ({
          clients: state.clients.map((c) =>
            c.id === clientId ? { ...c, ...updates } : c
          ),
        })),
      isLoadingClients: false,
      setIsLoadingClients: (loading) => set({ isLoadingClients: loading }),

      // Dashboard Stats
      dashboardStats: null,
      setDashboardStats: (stats) => set({ dashboardStats: stats }),

      // Settings - persisted
      apiKey: '',
      setApiKey: (key) => set({ apiKey: key }),
      payerAccount: '',
      setPayerAccount: (account) => set({ payerAccount: account }),
      payerName: '',
      setPayerName: (name) => set({ payerName: name }),
      payerBank: '90684', // OPM/Transfer default
      setPayerBank: (bank) => set({ payerBank: bank }),

      // Notifications
      notifications: [],
      addNotification: (notification) =>
        set((state) => ({
          notifications: [
            {
              ...notification,
              id: Math.random().toString(36).substr(2, 9),
              timestamp: Date.now(),
            },
            ...state.notifications,
          ].slice(0, 50), // Keep only last 50
        })),
      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),
      clearNotifications: () => set({ notifications: [] }),
    }),
    {
      name: 'novacore-storage',
      partialize: (state) => ({
        apiKey: state.apiKey,
        payerAccount: state.payerAccount,
        payerName: state.payerName,
        payerBank: state.payerBank,
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);
