'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User, Permission } from '@/types';

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

// Pages that don't require authentication
const PUBLIC_PATHS = ['/login'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Set mounted state
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    if (!mounted) return;

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
        try {
          localStorage.removeItem('novacore_session');
        } catch {
          // Ignore
        }
      }
      setIsLoading(false);
    };

    checkSession();
  }, [mounted]);

  // Redirect logic
  useEffect(() => {
    if (!mounted || isLoading) return;

    const isPublicPath = PUBLIC_PATHS.includes(pathname);

    if (!user && !isPublicPath) {
      // Not logged in and trying to access protected page
      router.push('/login');
    } else if (user && pathname === '/login') {
      // Already logged in and on login page
      router.push('/dashboard');
    }
  }, [user, isLoading, pathname, router, mounted]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();

      // Save session to localStorage
      const session = {
        user: data.user,
        token: data.token,
        expiresAt: data.expiresAt,
      };

      try {
        localStorage.setItem('novacore_session', JSON.stringify(session));
      } catch {
        // Ignore storage errors
      }

      setUser(data.user);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem('novacore_session');
    } catch {
      // Ignore
    }
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
    isLoading: !mounted || isLoading,
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
