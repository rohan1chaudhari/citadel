/**
 * Next.js middleware for optional authentication
 * 
 * When CITADEL_AUTH_ENABLED=true:
 * - Redirects requests without session cookie to /login
 * - Allows public access to /login, /api/auth/*, and /api/health
 * 
 * When disabled (default): passes all requests through with zero overhead
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public paths that don't require authentication
const PUBLIC_PATHS = ['/login', '/api/auth', '/api/health'];

// Auth enabled check from env var (evaluated at build time for middleware)
// Note: In middleware we can't access DB, so we rely on cookie presence when enabled
const AUTH_ENABLED = process.env.CITADEL_AUTH_ENABLED === 'true';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // If auth is disabled, pass through immediately (zero overhead)
  if (!AUTH_ENABLED) {
    return NextResponse.next();
  }
  
  // Allow public paths
  const isPublicPath = PUBLIC_PATHS.some(path => 
    pathname === path || pathname.startsWith(`${path}/`)
  );
  
  if (isPublicPath) {
    return NextResponse.next();
  }
  
  // Check for session cookie
  const sessionToken = request.cookies.get('citadel_session')?.value;
  
  if (!sessionToken) {
    // No session - redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // Session exists - let the request through
  // Actual session validation happens in API routes/components
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files, _next, and favicon
    '/((?!_next|static|.*\..*$).*)',
  ],
};
