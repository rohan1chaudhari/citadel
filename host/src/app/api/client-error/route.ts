import { NextResponse } from 'next/server';
import { audit } from '@citadel/core';

export const runtime = 'nodejs';

/**
 * Client error logging endpoint
 * 
 * Allows client-side error boundaries to log errors to the audit log.
 * Only logs in development mode to avoid leaking sensitive info in production.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { error, stack, url, digest, userAgent } = body;

    // Only log detailed errors in development
    if (process.env.NODE_ENV !== 'development') {
      // In production, log minimal info without stack traces
      audit('citadel', 'client.error', {
        digest,
        url,
        message: 'Client error occurred (details hidden in production)',
      });
      return NextResponse.json({ ok: true });
    }

    // Development: log full error details
    audit('citadel', 'client.error', {
      error,
      stack,
      url,
      digest,
      userAgent,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Don't fail if audit logging fails
    console.error('[client-error] Failed to log error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to log error' }, { status: 500 });
  }
}
