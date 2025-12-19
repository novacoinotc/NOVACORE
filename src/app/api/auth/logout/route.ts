import { NextRequest, NextResponse } from 'next/server';
import { invalidateSession, invalidateAllUserSessions } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';

/**
 * POST /api/auth/logout
 * Invalidates the current session server-side
 */
export async function POST(request: NextRequest) {
  try {
    // Get token from request
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : request.headers.get('x-auth-token');

    if (token) {
      // Invalidate the specific session
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

    return NextResponse.json({
      success: true,
      message: 'Sesión cerrada correctamente',
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Even if there's an error, return success - the client will clear local storage anyway
    return NextResponse.json({
      success: true,
      message: 'Sesión cerrada',
    });
  }
}
