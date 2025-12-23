'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User, Permission, UserRole } from '@/types';

// Valid roles
const VALID_ROLES: UserRole[] = ['super_admin', 'company_admin', 'user'];

interface LoginResult {
  success: boolean;
  requires2FA?: boolean;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requiresTotpSetup: boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<LoginResult>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  clearTotpSetupRequired: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Pages that don't require authentication
const PUBLIC_PATHS = ['/login'];

// Pages allowed during 2FA setup (so user can configure 2FA)
const TOTP_SETUP_PATHS = ['/settings', '/login'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [requiresTotpSetup, setRequiresTotpSetup] = useState(false);

  // Set mounted state
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    if (!mounted) return;

    const checkSession = () => {
      try {
        const sessionStr = localStorage.getItem('novacorp_session');
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          // Validate session has valid role (clear stale sessions with old role format)
          if (session.expiresAt > Date.now() && session.user?.role && VALID_ROLES.includes(session.user.role)) {
            setUser(session.user);
            // Check if user still needs to setup 2FA
            if (session.requiresTotpSetup && !session.user?.totpEnabled) {
              setRequiresTotpSetup(true);
            }
          } else {
            // Session expired or has invalid role format
            localStorage.removeItem('novacorp_session');
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
        try {
          localStorage.removeItem('novacorp_session');
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
    const isTotpSetupAllowedPath = TOTP_SETUP_PATHS.includes(pathname);

    if (!user && !isPublicPath) {
      // Not logged in and trying to access protected page
      router.push('/login');
    } else if (user && pathname === '/login') {
      // Already logged in and on login page - check if needs 2FA setup
      if (requiresTotpSetup) {
        router.push('/settings');
      } else {
        router.push('/dashboard');
      }
    } else if (user && requiresTotpSetup && !isTotpSetupAllowedPath) {
      // User needs to setup 2FA but is trying to access other pages
      router.push('/settings');
    }
  }, [user, isLoading, pathname, router, mounted, requiresTotpSetup]);

  const login = useCallback(async (email: string, password: string, totpCode?: string): Promise<LoginResult> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, totpCode }),
      });

      const data = await response.json();

      // Check if 2FA is required
      if (!response.ok && data.requires2FA) {
        return { success: false, requires2FA: true };
      }

      if (!response.ok) {
        return { success: false, error: data.error || 'Error de autenticación' };
      }

      // SECURITY FIX: Save session to localStorage WITHOUT the token
      // The token is stored only in httpOnly cookie (set by server)
      // This prevents XSS attacks from stealing session tokens
      const session = {
        user: data.user,
        // NOTE: token is NOT stored here - it's only in httpOnly cookie
        expiresAt: data.expiresAt,
        requiresTotpSetup: data.requiresTotpSetup || false,
      };

      try {
        localStorage.setItem('novacorp_session', JSON.stringify(session));
      } catch {
        // Ignore storage errors
      }

      setUser(data.user);

      // Check if 2FA setup is required
      if (data.requiresTotpSetup) {
        setRequiresTotpSetup(true);
      }

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Error de conexión' };
    }
  }, []);

  const logout = useCallback(async () => {
    // Call server-side logout to invalidate session
    // SECURITY FIX: Use credentials: 'include' to send httpOnly cookie
    // No need to manually send token - cookie is sent automatically
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Send httpOnly cookie
        body: JSON.stringify({}),
      }).catch(() => {}); // Ignore errors - we're logging out anyway
    } catch {
      // Ignore errors during logout
    }

    // SECURITY FIX: Aggressively clear all NOVACORP-related localStorage data
    // This prevents PII leakage if XSS occurs after logout
    try {
      // Clear known keys
      localStorage.removeItem('novacorp_session');
      // Clear any other potential NOVACORP data
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('novacorp') || key.startsWith('nova_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch {
      // Ignore storage errors
    }

    setUser(null);
    setRequiresTotpSetup(false);
    router.push('/login');
  }, [router]);

  // Clear the 2FA setup requirement (called after user configures 2FA)
  const clearTotpSetupRequired = useCallback(() => {
    setRequiresTotpSetup(false);
    // Update stored session
    try {
      const sessionStr = localStorage.getItem('novacorp_session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        session.requiresTotpSetup = false;
        if (session.user) {
          session.user.totpEnabled = true;
        }
        localStorage.setItem('novacorp_session', JSON.stringify(session));
        // Also update the user state
        if (user) {
          setUser({ ...user, totpEnabled: true });
        }
      }
    } catch {
      // Ignore
    }
  }, [user]);

  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      if (!user) return false;
      // Super admin has all permissions
      if (user.role === 'super_admin') return true;
      return user.permissions.includes(permission);
    },
    [user]
  );

  const hasAnyPermission = useCallback(
    (permissions: Permission[]): boolean => {
      if (!user) return false;
      if (user.role === 'super_admin') return true;
      return permissions.some((p) => user.permissions.includes(p));
    },
    [user]
  );

  const hasAllPermissions = useCallback(
    (permissions: Permission[]): boolean => {
      if (!user) return false;
      if (user.role === 'super_admin') return true;
      return permissions.every((p) => user.permissions.includes(p));
    },
    [user]
  );

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading: !mounted || isLoading,
    requiresTotpSetup,
    login,
    logout,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    clearTotpSetupRequired,
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

/**
 * Get authentication headers for API requests
 * SECURITY FIX: No longer includes token - authentication is via httpOnly cookie
 * Returns basic headers, cookie is sent automatically via credentials: 'include'
 */
export function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // SECURITY FIX: Token is no longer sent via Authorization header
  // Authentication is handled by httpOnly cookie sent automatically
  // This prevents XSS attacks from stealing session tokens

  return headers;
}

/**
 * Create authenticated fetch function
 * SECURITY FIX: Uses credentials: 'include' to send httpOnly cookie
 * No longer sends token via Authorization header
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = getAuthHeaders();

  return fetch(url, {
    ...options,
    credentials: 'include', // SECURITY FIX: Send httpOnly cookie automatically
    headers: {
      ...headers,
      ...options.headers,
    },
  });
}
