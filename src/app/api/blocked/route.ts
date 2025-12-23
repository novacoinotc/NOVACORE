import { NextResponse } from 'next/server';

/**
 * SECURITY: Catch-all endpoint for blocked routes in production
 *
 * This endpoint is the destination for rewrites of sensitive endpoints
 * that should not be accessible in production:
 * - /api/auth/init (database initialization)
 * - /api/debug/* (debug/probe tools)
 *
 * Returns 404 to make it appear as if the endpoint doesn't exist.
 */

export async function GET() {
  return NextResponse.json(
    { error: 'Not Found' },
    { status: 404 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: 'Not Found' },
    { status: 404 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Not Found' },
    { status: 404 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Not Found' },
    { status: 404 }
  );
}
