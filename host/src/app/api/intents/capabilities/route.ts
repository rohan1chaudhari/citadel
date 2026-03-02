/**
 * Intent Capabilities API
 * 
 * GET /api/intents/capabilities - List all available intent actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIntentCapabilities } from '@citadel/core';

/**
 * GET /api/intents/capabilities
 * 
 * List all available intent actions (built-in and app-provided).
 */
export async function GET(): Promise<NextResponse> {
  try {
    const capabilities = await getIntentCapabilities();
    return NextResponse.json({ ok: true, capabilities });
  } catch (err) {
    console.error('Intent capabilities error:', err);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
