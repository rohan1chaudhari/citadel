import { NextResponse } from 'next/server';
import { listApps } from '@/lib/registry';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const includeHidden = url.searchParams.get('includeHidden') === 'true';

  const apps = await listApps(includeHidden);
  return NextResponse.json({ ok: true, apps });
}
