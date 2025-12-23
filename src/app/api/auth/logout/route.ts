import { NextRequest, NextResponse } from 'next/server';
import { invalidateSession, invalidateAllUserSessions } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';

/**
 * POST /api/auth/logout
 * Invalidates the current session server-side
 * SECURITY: Only accepts token from httpOnly cookie - no header-based auth
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY FIX: Only accept token from httpOnly cookie
    // This is consistent with our cookie-only auth model
    const tokenCookie = request.cookies.get('novacorp_token');
    const token = tokenCookie?.value;

    if (token) {
      // Invalidate the specific session in database
      await invalidateSession(token);
    }

    // Also try to get user and invalidate all their sessions (optional, for "logout everywhere")
    const body = await request.json().catch(() => ({}));
    if (body.logoutAll) {
      const authResult = await authenticateRequest(request);
      if (authResult.success && authResult.user) {
        await invalidateAllUserSessions(authResult.user.id);
      }
    }

    // SECURITY: Clear the cookie by setting maxAge to 0
    const response = NextResponse.json({
      success: true,
      message: 'Sesión cerrada correctamente',
    });

    // Clear the auth cookie
    response.cookies.set('novacorp_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0, // Expire immediately
      path: '/',
    });

    // Clear the CSRF cookie
    response.cookies.set('novacorp_csrf', '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0, // Expire immediately
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    // Even if there's an error, clear the cookie and return success
    const response = NextResponse.json({
      success: true,
      message: 'Sesión cerrada',
    });

    response.cookies.set('novacorp_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    });

    // Clear the CSRF cookie
    response.cookies.set('novacorp_csrf', '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    });

    return response;
  }
}
