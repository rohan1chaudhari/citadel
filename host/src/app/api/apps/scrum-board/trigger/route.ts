import { NextResponse } from 'next/server';
import { triggerAutopilot } from '@/lib/triggerAutopilot';
import { listApps } from '@/lib/registry';
import { getPermissionOverrides, isPermissionGranted } from '@/lib/permissionBroker';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const appId = String(body?.appId ?? '').trim();
  const appName = String(body?.appName ?? '').trim();

  if (!appId) {
    return NextResponse.json({ ok: false, error: 'appId required' }, { status: 400 });
  }

  const apps = await listApps(true);
  const app = apps.find((a) => a.id === appId);
  if (app) {
    const overrides = getPermissionOverrides(appId);
    const allowed = isPermissionGranted(app.permissions, overrides, 'agent:run');
    if (!allowed.allowed) {
      return NextResponse.json(
        { ok: false, error: 'permission denied', permission: 'agent:run', details: allowed.reason },
        { status: 403 }
      );
    }
  }

  const result = await triggerAutopilot(appId, appName || appId, true); // true = skip toggle check (manual trigger always works)

  if (!result.ok) {
    if (result.skipped) {
      return NextResponse.json({ ok: false, skipped: true, message: result.message });
    }
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    message: result.message,
    cronJobId: result.cronJobId,
    sessionId: result.sessionId,
    runAt: result.runAt,
    eligibleCount: result.eligibleCount,
  });
}
