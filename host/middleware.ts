import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkRateLimit, getRateLimitStatus } from '@/lib/rateLimiter';

// Generate a random nonce for inline scripts
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Build CSP header value
function buildCSP(nonce: string, reportUri: string): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `report-uri ${reportUri}`,
  ];
  return directives.join('; ');
}

// Extract app ID from /api/apps/{appId}/* paths
function extractAppIdFromApiPath(pathname: string): string | null {
  const match = pathname.match(/^\/api\/apps\/([^\/]+)/);
  return match?.[1] ?? null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Apply rate limiting to /api/apps/* routes
  if (pathname.startsWith('/api/apps/')) {
    const appId = extractAppIdFromApiPath(pathname);
    
    if (appId) {
      const result = checkRateLimit(appId);
      const status = getRateLimitStatus(appId);
      
      // Set rate limit headers
      const headers = new Headers();
      headers.set('X-RateLimit-Limit', status.limit.toString());
      headers.set('X-RateLimit-Remaining', status.remaining.toString());
      
      if (!result.allowed) {
        // Return 429 Too Many Requests
        headers.set('Retry-After', result.retryAfter.toString());
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded',
            retryAfter: result.retryAfter,
            message: `Too many requests. Please retry after ${result.retryAfter} seconds.`
          },
          { 
            status: 429, 
            headers 
          }
        );
      }
      
      // Continue with rate limit headers
      const response = NextResponse.next();
      response.headers.set('X-RateLimit-Limit', status.limit.toString());
      response.headers.set('X-RateLimit-Remaining', status.remaining.toString());
      return response;
    }
  }

  // Only apply CSP to app routes
  if (!pathname.startsWith('/apps/')) {
    return NextResponse.next();
  }

  const nonce = generateNonce();
  const reportUri = '/api/csp-violation';
  const csp = buildCSP(nonce, reportUri);

  // Create response with CSP headers
  const response = NextResponse.next({
    headers: {
      'Content-Security-Policy': csp,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  });

  // Store nonce in a header that can be read by server components
  response.headers.set('x-csp-nonce', nonce);

  return response;
}

export const config = {
  matcher: ['/apps/:path*', '/api/apps/:path*'],
};
