/**
 * Intent Consent API
 * 
 * POST /api/intents/consent - Grant intent consent
 * DELETE /api/intents/consent - Revoke intent consent
 * GET /api/intents/consent?appId=xxx - Get intent consents
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  grantIntentConsent,
  revokeIntentConsent,
  getAppIntentConsents,
  findIntentProvider,
  audit,
} from '@citadel/core';

/**
 * POST /api/intents/consent
 * 
 * Grant consent for an app to invoke an intent action.
 * Body:
 *   { appId: string, action: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { appId: string; action: string };
    
    if (!body.appId || typeof body.appId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid appId field' },
        { status: 400 }
      );
    }
    
    if (!body.action || typeof body.action !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid action field' },
        { status: 400 }
      );
    }
    
    // Find the target app for this action
    const targetAppId = await findIntentProvider(body.action);
    if (!targetAppId) {
      return NextResponse.json(
        { ok: false, error: `No app provides the intent action: ${body.action}` },
        { status: 404 }
      );
    }
    
    // Grant consent
    grantIntentConsent(body.appId, body.action, targetAppId);
    
    // Audit the consent grant
    audit('citadel', 'intent.consent.grant', {
      appId: body.appId,
      action: body.action,
      targetAppId,
    });
    
    return NextResponse.json({
      ok: true,
      message: `Consent granted for ${body.appId} to invoke ${body.action}`,
      appId: body.appId,
      action: body.action,
      targetAppId,
    });
  } catch (err) {
    console.error('Intent consent grant error:', err);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/intents/consent
 * 
 * Revoke consent for an app to invoke an intent action.
 * Body:
 *   { appId: string, action: string }
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { appId: string; action: string };
    
    if (!body.appId || typeof body.appId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid appId field' },
        { status: 400 }
      );
    }
    
    if (!body.action || typeof body.action !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid action field' },
        { status: 400 }
      );
    }
    
    // Revoke consent
    revokeIntentConsent(body.appId, body.action);
    
    // Audit the consent revocation
    audit('citadel', 'intent.consent.revoke', {
      appId: body.appId,
      action: body.action,
    });
    
    return NextResponse.json({
      ok: true,
      message: `Consent revoked for ${body.appId} to invoke ${body.action}`,
      appId: body.appId,
      action: body.action,
    });
  } catch (err) {
    console.error('Intent consent revoke error:', err);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/intents/consent?appId=xxx
 * 
 * Get intent consents for an app (or all apps if no appId).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const appId = url.searchParams.get('appId');
    
    if (appId) {
      const consents = getAppIntentConsents(appId);
      return NextResponse.json({ ok: true, appId, consents });
    }
    
    // Get all consents
    const { getAllIntentConsents } = await import('@citadel/core');
    const consents = getAllIntentConsents();
    return NextResponse.json({ ok: true, consents });
  } catch (err) {
    console.error('Intent consent get error:', err);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
