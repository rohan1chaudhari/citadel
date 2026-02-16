import { NextResponse } from 'next/server';
import { assertAppId } from '@/lib/appIds';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ appId: string }> }) {
  const { appId } = await ctx.params;
  assertAppId(appId);

  return NextResponse.json({ ok: true, appId, ts: new Date().toISOString() });
}
