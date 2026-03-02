import { NextResponse } from 'next/server';
import { invalidateRegistryCache } from '@citadel/core';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/invalidate-cache
 * 
 * Invalidates the app registry cache. Called by citadel-app CLI
 * after install/uninstall/update operations.
 */
export async function POST() {
  try {
    await invalidateRegistryCache();
    
    return NextResponse.json({
      ok: true,
      message: 'Registry cache invalidated',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[invalidate-cache] Failed:', err);
    
    return NextResponse.json({
      ok: false,
      error: err.message || 'Failed to invalidate cache',
    }, {
      status: 500,
    });
  }
}
