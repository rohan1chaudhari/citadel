import { NextResponse } from 'next/server';
import { getQuotaStatus, formatBytes } from '@citadel/core';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const quotaStatus = getQuotaStatus();
    
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      quotas: quotaStatus.map(app => ({
        app_id: app.app_id,
        used: {
          bytes: app.used_bytes,
          formatted: formatBytes(app.used_bytes),
        },
        limit: {
          mb: app.quota_mb,
          bytes: app.quota_bytes,
          formatted: formatBytes(app.quota_bytes),
        },
        usage_percent: app.used_percent,
        is_default: app.is_default,
      })),
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
