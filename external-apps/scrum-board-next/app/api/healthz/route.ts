import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export async function GET() { return NextResponse.json({ ok: true, app: 'scrum-board-external', ts: new Date().toISOString() }); }
