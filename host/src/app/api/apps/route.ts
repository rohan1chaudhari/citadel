import { NextResponse } from 'next/server';
import { listApps, registerApp } from '@/lib/registry';
import { validateCitadelAppContract } from '@/lib/citadelAppContract';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const includeHidden = url.searchParams.get('includeHidden') === 'true';

  const apps = await listApps(includeHidden);
  return NextResponse.json({ ok: true, apps });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const validated = validateCitadelAppContract(body?.manifest);
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: 'invalid manifest', details: validated.errors },
      { status: 400 }
    );
  }

  const upstreamBaseUrl = String(body?.upstreamBaseUrl ?? '').trim();
  if (!upstreamBaseUrl) {
    return NextResponse.json({ ok: false, error: 'upstreamBaseUrl required' }, { status: 400 });
  }

  try {
    const result = registerApp({
      manifest: validated.value,
      upstreamBaseUrl,
      enabled: body?.enabled
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 400 });
  }
}
