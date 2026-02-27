import { NextResponse } from 'next/server';
import { assertAppId } from '@/lib/appIds';
import { getRegisteredApp } from '@/lib/registry';

export const runtime = 'nodejs';

function joinUrl(base: string, path: string): string {
  const cleanBase = base.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${p}`;
}

export async function GET(_req: Request, ctx: { params: Promise<{ appId: string }> }) {
  const { appId } = await ctx.params;
  assertAppId(appId);

  const registered = getRegisteredApp(appId);
  if (registered?.upstream_base_url && registered.health) {
    const target = joinUrl(registered.upstream_base_url, registered.health);
    try {
      const res = await fetch(target, { method: 'GET' });
      return NextResponse.json({
        ok: res.ok,
        appId,
        source: 'registry',
        upstream: target,
        status: res.status,
        ts: new Date().toISOString()
      }, { status: res.ok ? 200 : 502 });
    } catch (e: any) {
      return NextResponse.json({
        ok: false,
        appId,
        source: 'registry',
        upstream: target,
        error: String(e?.message ?? e),
        ts: new Date().toISOString()
      }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: true, appId, source: 'local', ts: new Date().toISOString() });
}
