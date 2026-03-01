import { hasAiPermission } from '@citadel/core';
import { audit } from '@citadel/core';
import { NextResponse } from 'next/server';

/**
 * Check if an app has AI permission. Returns null if allowed, or a NextResponse if denied.
 * Also logs the violation via audit.
 */
export function checkAiPermission(appId: string, route: string): NextResponse | null {
  const hasAi = hasAiPermission(appId);
  
  if (!hasAi) {
    // Log the violation
    audit(appId, 'permission.violation', {
      route,
      required: 'ai',
      manifestHasAi: false,
    });
    
    return NextResponse.json(
      { 
        ok: false, 
        error: `AI API access denied. App '${appId}' does not have 'ai: true' permission in app.yaml.` 
      },
      { status: 403 }
    );
  }
  
  return null;
}