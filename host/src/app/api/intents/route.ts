/**
 * Intent System API
 * 
 * POST /api/intents/invoke - Invoke an intent action
 * GET /api/intents/capabilities - List all available intent actions
 * GET /api/intents/consent?appId=xxx - Get intent consents for an app
 * POST /api/intents/consent - Grant/revoke intent consent
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  invokeIntent,
  getIntentCapabilities,
  hasIntentConsent,
  grantIntentConsent,
  revokeIntentConsent,
  getAppIntentConsents,
  getAllIntentConsents,
  findIntentProvider,
  audit,
  type IntentInvokeRequest,
} from '@citadel/core';

/**
 * POST /api/intents/invoke
 * 
 * Invoke an intent action.
 * Headers:
 *   X-App-Id: The source app ID (required)
 * Body:
 *   { action: string, payload?: Record<string, unknown> }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get source app ID from header
    const sourceAppId = request.headers.get('X-App-Id') ?? 'citadel';
    
    // Parse request body
    const body = (await request.json()) as IntentInvokeRequest;
    
    if (!body.action || typeof body.action !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid action field' },
        { status: 400 }
      );
    }
    
    // Invoke the intent
    const result = await invokeIntent(sourceAppId, {
      action: body.action,
      payload: body.payload,
    });
    
    // Audit the invocation attempt
    audit(sourceAppId, 'intent.invoke', {
      action: body.action,
      success: result.ok,
      error: result.ok ? undefined : result.error,
    });
    
    if (!result.ok) {
      const statusCode = result.code === 'CONSENT_REQUIRED' ? 403 : 404;
      return NextResponse.json(
        { ok: false, error: result.error, code: result.code },
        { status: statusCode }
      );
    }
    
    return NextResponse.json({ ok: true, result: result.result });
  } catch (err) {
    console.error('Intent invocation error:', err);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/intents/capabilities
 * 
 * List all available intent actions (built-in and app-provided).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Route based on path
    if (path.endsWith('/capabilities')) {
      const capabilities = await getIntentCapabilities();
      return NextResponse.json({ ok: true, capabilities });
    }
    
    // Check for specific queries
    const appId = url.searchParams.get('appId');
    const action = url.searchParams.get('action');
    const checkConsent = url.searchParams.get('checkConsent');
    
    if (checkConsent && appId && action) {
      const hasConsent = hasIntentConsent(appId, action);
      const provider = await findIntentProvider(action);
      return NextResponse.json({
        ok: true,
        appId,
        action,
        hasConsent,
        provider,
      });
    }
    
    if (appId) {
      // Get consents for a specific app
      const consents = getAppIntentConsents(appId);
      return NextResponse.json({ ok: true, appId, consents });
    }
    
    // Get all consents
    const consents = getAllIntentConsents();
    return NextResponse.json({ ok: true, consents });
  } catch (err) {
    console.error('Intent capabilities error:', err);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
