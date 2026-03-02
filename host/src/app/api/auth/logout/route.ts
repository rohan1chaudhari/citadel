/**
 * POST /api/auth/logout
 * 
 * Clears the session cookie and destroys the server-side session.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { destroySession, getClearSessionCookie, extractSessionToken } from '@citadel/core';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('citadel_session')?.value;
    
    if (sessionToken) {
      // Destroy server-side session
      destroySession(sessionToken);
    }

    // Clear cookie
    const response = NextResponse.json({ ok: true });
    response.headers.set('Set-Cookie', getClearSessionCookie());
    return response;

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
