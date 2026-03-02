/**
 * GET /api/auth/status
 * 
 * Returns the current authentication status.
 * Used by client components to show/hide logout button.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthStatus } from '@citadel/core';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    
    const status = getAuthStatus(cookieHeader);
    
    return NextResponse.json({
      ok: true,
      enabled: status.enabled,
      authenticated: status.authenticated,
      needsSetup: status.needsSetup,
    });

  } catch (error) {
    console.error('Auth status error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
