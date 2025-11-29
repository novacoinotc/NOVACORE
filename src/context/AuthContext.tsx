'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User, Permission, ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo users (in production, this would be a database/API)
const DEMO_USERS: Array<User & { password: string }> = [
  {
    id: '1',
    email: 'admin@novacore.mx',
    password: 'admin123',
    name: 'Administrador',
    role: 'admin',
    permissions: Object.keys(ALL_PERMISSIONS) as Permission[],
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: '2',
    email: 'usuario@novacore.mx',
    password: 'user123',
    name: 'Usuario Demo',
    role: 'user',
    permissions: DEFAULT_ROLE_PERMISSIONS.user,
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

// Pages that don't require authentication
const PUBLIC_PATHS = ['/login'];

// Get stored users from localStorage or use demo users
function getStoredUsers(): Array<User & { password: string }> {
  if (typeof window === 'undefined') return DEMO_USERS;
  const stored = localStorage.getItem('novacore_users');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return DEMO_USERS;
    }
  }
  // Initialize with demo users
  localStorage.setItem('novacore_users', JSON.stringify(DEMO_USERS));
  return DEMO_USERS;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = () => {
      try {
        const sessionStr = localStorage.getItem('novacore_session');
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          if (session.expiresAt > Date.now()) {
            setUser(session.user);
          } else {
            // Session expired
            localStorage.removeItem('novacore_session');
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
        localStorage.removeItem('novacore_session');
      }
      setIsLoading(false);
    };

    checkSession();
  }, []);

  // Redirect logic
  useEffect(() => {
    if (isLoading) return;

    const isPublicPath = PUBLIC_PATHS.includes(pathname);

    if (!user && !isPublicPath) {
      // Not logged in and trying to access protected page
      router.push('/login');
    } else if (user && pathname === '/login') {
      // Already logged in and on login page
      router.push('/dashboard');
    }
  }, [user, isLoading, pathname, router]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    const users = getStoredUsers();
    const foundUser = users.find(
      (u) => u.email === email && u.password === password
    );

    if (!foundUser || !foundUser.isActive) {
      return false;
    }

    const { password: _, ...userWithoutPassword } = foundUser;
    const sessionUser: User = {
      ...userWithoutPassword,
      lastLogin: Date.now(),
    };

    // Save session
    const session = {
      user: sessionUser,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };

    localStorage.setItem('novacore_session', JSON.stringify(session));
    setUser(sessionUser);

    return true;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('novacore_session');
    setUser(null);
    router.push('/login');
  }, [router]);

  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      if (!user) return false;
      // Admin has all permissions
      if (user.role === 'admin') return true;
      return user.permissions.includes(permission);
    },
    [user]
  );

  const hasAnyPermission = useCallback(
    (permissions: Permission[]): boolean => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      return permissions.some((p) => user.permissions.includes(p));
    },
    [user]
  );

  const hasAllPermissions = useCallback(
    (permissions: Permission[]): boolean => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      return permissions.every((p) => user.permissions.includes(p));
    },
    [user]
  );

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper hook to check permission and redirect if not allowed
export function useRequirePermission(permission: Permission, redirectTo = '/dashboard') {
  const { hasPermission, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !hasPermission(permission)) {
      router.push(redirectTo);
    }
  }, [hasPermission, isLoading, permission, redirectTo, router]);

  return { isLoading, hasAccess: hasPermission(permission) };
}

// Helper to get users (for admin panel)
export function getUsers(): User[] {
  const users = getStoredUsers();
  return users.map(({ password, ...user }) => user);
}

// Helper to save users (for admin panel)
export function saveUser(userData: User & { password?: string }): void {
  const users = getStoredUsers();
  const existingIndex = users.findIndex((u) => u.id === userData.id);

  if (existingIndex >= 0) {
    // Update existing user
    users[existingIndex] = {
      ...users[existingIndex],
      ...userData,
      password: userData.password || users[existingIndex].password,
      updatedAt: Date.now(),
    };
  } else {
    // Create new user
    users.push({
      ...userData,
      password: userData.password || 'password123',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as User & { password: string });
  }

  localStorage.setItem('novacore_users', JSON.stringify(users));
}

// Helper to delete user (for admin panel)
export function deleteUser(userId: string): void {
  const users = getStoredUsers();
  const filtered = users.filter((u) => u.id !== userId);
  localStorage.setItem('novacore_users', JSON.stringify(filtered));
}
