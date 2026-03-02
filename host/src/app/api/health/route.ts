import { NextResponse } from 'next/server';
import { getHostStatus, verifyAppDatabases } from '@citadel/core';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status = getHostStatus();
  
  // Verify app databases are accessible
  const dbErrors = await verifyAppDatabases();
  
  const isHealthy = dbErrors.length === 0;
  
  return NextResponse.json({
    ok: isHealthy,
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    host: {
      ready: status.ready,
      startupDurationMs: status.startupDurationMs,
      uptimeMs: status.uptimeMs,
      openConnections: status.openConnections,
    },
    databases: {
      checked: dbErrors.length === 0 ? 'all' : 'partial',
      errors: dbErrors.length > 0 ? dbErrors : undefined,
    },
  }, {
    status: isHealthy ? 200 : 503,
  });
}
