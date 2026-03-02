/**
 * POST /api/auth/login
 * 
 * Login or setup passphrase for auth.
 * Sets httpOnly session cookie on success.
 */

import { NextResponse } from 'next/server';
import {
  isAuthEnabled,
  isAuthConfigured,
  verifyPassphrase,
  setPassphrase,
  createSession,
  getSessionCookie,
} from '@citadel/core';

export async function POST(request: Request) {
  // Auth must be enabled
  if (!isAuthEnabled()) {
    return NextResponse.json(
      { ok: false, error: 'Authentication is disabled' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { passphrase, setup } = body;

    if (!passphrase || typeof passphrase !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Passphrase is required' },
        { status: 400 }
      );
    }

    if (passphrase.length < 8) {
      return NextResponse.json(
        { ok: false, error: 'Passphrase must be at least 8 characters' },
        { status: 400 }
      );
    }

    const needsSetup = !isAuthConfigured();

    if (needsSetup && setup) {
      // First-time setup: create passphrase hash
      await setPassphrase(passphrase);
      
      // Create session
      const token = createSession();
      const cookie = getSessionCookie(token);
      
      const response = NextResponse.json({ ok: true });
      response.headers.set('Set-Cookie', cookie);
      return response;
    }

    if (needsSetup && !setup) {
      // Setup required but user didn't indicate setup
      return NextResponse.json(
        { ok: false, error: 'First-time setup required' },
        { status: 400 }
      );
    }

    // Verify passphrase
    const storedHash = require('@citadel/core').getPassphraseHash();
    if (!storedHash) {
      return NextResponse.json(
        { ok: false, error: 'Authentication not configured' },
        { status: 500 }
      );
    }

    const isValid = await verifyPassphrase(passphrase, storedHash);
    if (!isValid) {
      return NextResponse.json(
        { ok: false, error: 'Invalid passphrase' },
        { status: 401 }
      );
    }

    // Create session
    const token = createSession();
    const cookie = getSessionCookie(token);
    
    const response = NextResponse.json({ ok: true });
    response.headers.set('Set-Cookie', cookie);
    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
