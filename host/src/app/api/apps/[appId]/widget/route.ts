import { NextResponse } from 'next/server';
import { assertAppId, getAppManifest } from '@citadel/core';
import { dbQuery } from '@citadel/core';

export const runtime = 'nodejs';

/**
 * Widget API endpoint
 * 
 * Apps with `widget: true` in their manifest can provide widget data
 * via their own /api/apps/{appId}/widget endpoint.
 * 
 * This is a fallback endpoint that returns basic info for apps
 * that don't implement their own widget endpoint.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ appId: string }> }) {
  const { appId } = await ctx.params;
  assertAppId(appId);

  try {
    // Check if the app has a widget enabled in manifest
    const manifest = await getAppManifest(appId);
    if (!manifest) {
      return NextResponse.json(
        { ok: false, error: 'App not found' },
        { status: 404 }
      );
    }

    if (!manifest.widget) {
      return NextResponse.json(
        { ok: false, error: 'Widget not enabled for this app' },
        { status: 404 }
      );
    }

    // Note: App-specific widget handlers would be implemented here
    // For now, we use the default widget data based on app activity

    // Default widget data based on app type
    const defaultData = await getDefaultWidgetData(appId, manifest.name);

    return NextResponse.json({
      ok: true,
      appId,
      title: defaultData.title,
      data: defaultData.data,
    });
  } catch (err) {
    console.error(`Widget error for ${appId}:`, err);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch widget data' },
      { status: 500 }
    );
  }
}

/**
 * Generate default widget data based on app activity
 */
async function getDefaultWidgetData(appId: string, appName: string): Promise<{ title: string; data: string }> {
  // Try to get recent activity count from audit log
  try {
    const today = new Date().toISOString().split('T')[0];
    const rows = dbQuery<{ count: number }>(
      'citadel',
      `SELECT COUNT(*) as count FROM audit_log 
       WHERE app_id = ? AND ts >= ?`,
      [appId, today]
    );
    const count = rows[0]?.count ?? 0;
    
    if (count > 0) {
      return {
        title: appName,
        data: `${count} actions today`,
      };
    }
  } catch {
    // Audit log might not exist, ignore
  }

  // Default fallback
  return {
    title: appName,
    data: 'Ready',
  };
}
