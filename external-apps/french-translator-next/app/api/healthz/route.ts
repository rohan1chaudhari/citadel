import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ ok: true, app: 'french-translator-external', ts: new Date().toISOString() });
}
