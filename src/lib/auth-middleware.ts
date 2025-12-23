/**
 * Authentication Middleware for NOVACORE
 *
 * Provides secure session validation for all API routes.
 * Validates tokens against the database, not just headers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionByToken, getUserById, invalidateSession, validateCsrfToken } from './db';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string | null;
  permissions: string[];
  isActive: boolean;
}

export interface AuthResult {
  success: boolean;
  user?: AuthenticatedUser;
  error?: string;
  statusCode?: number;
}

/**
 * Extract token from request
 * SECURITY: Only accepts httpOnly cookie - no header-based token
 * This prevents XSS attacks from stealing session tokens
 */
function extractToken(request: NextRequest): string | null {
  // SECURITY FIX: Only accept token from httpOnly cookie
  // Headers (Authorization, x-auth-token) are disabled to prevent XSS token theft
  // The token is set by the server via Set-Cookie with httpOnly flag
  const tokenCookie = request.cookies.get('novacorp_token');
  if (tokenCookie?.value) {
    return tokenCookie.value;
  }

  return null;
}

/**
 * Authenticate request by validating session token
 * Returns user if valid, error otherwise
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  try {
    const token = extractToken(request);

    if (!token) {
      return {
        success: false,
        error: 'Token de autenticación no proporcionado',
        statusCode: 401,
      };
    }

    // Validate token against database
    const session = await getSessionByToken(token);

    if (!session) {
      return {
        success: false,
        error: 'Sesión inválida o expirada',
        statusCode: 401,
      };
    }

    // Check if session is expired (double-check even though DB query filters)
    if (new Date(session.expiresAt) < new Date()) {
      return {
        success: false,
        error: 'Sesión expirada',
        statusCode: 401,
      };
    }

    // Get user details
    const user = await getUserById(session.userId);

    if (!user) {
      return {
        success: false,
        error: 'Usuario no encontrado',
        statusCode: 401,
      };
    }

    // Check if user is active
    if (!user.isActive) {
      return {
        success: false,
        error: 'Cuenta desactivada',
        statusCode: 403,
      };
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.company_id || null,
        permissions: user.permissions || [],
        isActive: user.isActive,
      },
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'Error de autenticación',
      statusCode: 500,
    };
  }
}

/**
 * Validate CSRF token for state-changing requests
 * SECURITY: Uses double-submit cookie pattern
 * - Cookie is set with SameSite=strict (prevents CSRF from other domains)
 * - Header must match cookie value (prevents subdomain attacks)
 */
export function validateCsrfForRequest(request: NextRequest): { valid: boolean; error?: string } {
  const method = request.method.toUpperCase();

  // CSRF only required for state-changing methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { valid: true };
  }

  const csrfCookie = request.cookies.get('novacorp_csrf')?.value;
  const csrfHeader = request.headers.get('X-CSRF-Token');

  if (!validateCsrfToken(csrfCookie, csrfHeader || undefined)) {
    return {
      valid: false,
      error: 'Token CSRF inválido o faltante'
    };
  }

  return { valid: true };
}

/**
 * Higher-order function to wrap API route handlers with authentication
 */
export function withAuth(
  handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>,
  options?: {
    requiredRole?: string | string[];
    requiredPermission?: string;
    requireCsrf?: boolean; // SECURITY: Set true for critical state-changing operations
  }
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const authResult = await authenticateRequest(request);

    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }

    // SECURITY: Validate CSRF token for critical operations
    if (options?.requireCsrf) {
      const csrfResult = validateCsrfForRequest(request);
      if (!csrfResult.valid) {
        return NextResponse.json(
          { error: csrfResult.error || 'Error de validación CSRF' },
          { status: 403 }
        );
      }
    }

    const user = authResult.user;

    // Check required role if specified
    if (options?.requiredRole) {
      const requiredRoles = Array.isArray(options.requiredRole)
        ? options.requiredRole
        : [options.requiredRole];

      if (!requiredRoles.includes(user.role)) {
        return NextResponse.json(
          { error: 'No tienes permiso para realizar esta acción' },
          { status: 403 }
        );
      }
    }

    // Check required permission if specified
    if (options?.requiredPermission) {
      const hasPermission =
        user.role === 'super_admin' ||
        user.permissions.includes(options.requiredPermission) ||
        user.permissions.includes('*');

      if (!hasPermission) {
        return NextResponse.json(
          { error: 'Permiso insuficiente' },
          { status: 403 }
        );
      }
    }

    // Call the actual handler with authenticated user
    return handler(request, user);
  };
}

/**
 * Helper to create unauthorized response
 */
export function unauthorizedResponse(message: string = 'No autorizado'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Helper to create forbidden response
 */
export function forbiddenResponse(message: string = 'Acceso denegado'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Validate that user has access to specific CLABE accounts
 * Used for IDOR protection
 *
 * SECURITY: This is a CRITICAL function for multi-tenant isolation.
 * - super_admin: Access to all CLABE accounts
 * - company_admin: Access to all CLABE accounts in their company
 * - user: Access only to explicitly assigned CLABE accounts
 */
export async function validateClabeAccess(
  userId: string,
  clabeAccountId: string,
  userRole: string,
  userCompanyId?: string | null
): Promise<boolean> {
  // SECURITY FIX: Validate that role is one of the known valid roles
  const validRoles = ['super_admin', 'company_admin', 'user'];
  if (!validRoles.includes(userRole)) {
    console.error(`[SECURITY] Invalid role in validateClabeAccess: ${userRole}`);
    return false;
  }

  // Super admin has access to all
  if (userRole === 'super_admin') {
    return true;
  }

  // SECURITY FIX: Company admin has access to all CLABEs in their company
  if (userRole === 'company_admin' && userCompanyId) {
    const { getClabeAccountById } = await import('./db');
    const clabeAccount = await getClabeAccountById(clabeAccountId);
    if (clabeAccount && clabeAccount.company_id === userCompanyId) {
      return true;
    }
    return false;
  }

  // For regular users, check user_clabe_access table
  const { getClabeAccountsForUser } = await import('./db');
  const userClabes = await getClabeAccountsForUser(userId);

  return userClabes.some(clabe => clabe.id === clabeAccountId);
}

/**
 * Get current user from request (backwards compatible helper)
 * Uses the secure authentication instead of trusting x-user-id header
 */
export async function getCurrentUserSecure(request: NextRequest): Promise<AuthenticatedUser | null> {
  const authResult = await authenticateRequest(request);
  return authResult.success ? authResult.user || null : null;
}
