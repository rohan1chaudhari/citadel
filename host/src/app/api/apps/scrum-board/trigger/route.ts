import { NextResponse } from 'next/server';
import { triggerAutopilot } from '@/lib/triggerAutopilot';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const appId = String(body?.appId ?? '').trim();
  const appName = String(body?.appName ?? '').trim();

  if (!appId) {
    return NextResponse.json({ ok: false, error: 'appId required' }, { status: 400 });
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
    runAt: result.runAt,
    eligibleCount: result.eligibleCount,
  });
}
