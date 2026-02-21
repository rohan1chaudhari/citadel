import { dbExec, dbQuery } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const CITADEL_APP_ID = 'citadel';

function ensureTable() {
  dbExec(CITADEL_APP_ID, `
    CREATE TABLE IF NOT EXISTS hidden_apps (
      app_id TEXT PRIMARY KEY,
      hidden_at TEXT NOT NULL
    )
  `);
}

export async function GET() {
  try {
    ensureTable();
    const rows = dbQuery<{ app_id: string; hidden_at: string }>(
      CITADEL_APP_ID,
      'SELECT app_id, hidden_at FROM hidden_apps ORDER BY hidden_at DESC'
    );
    return NextResponse.json({ ok: true, hiddenApps: rows.map((r) => r.app_id) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { appId } = await req.json();
    if (!appId || typeof appId !== 'string') {
      return NextResponse.json({ ok: false, error: 'appId required' }, { status: 400 });
    }
    ensureTable();
    dbExec(
      CITADEL_APP_ID,
      'INSERT OR REPLACE INTO hidden_apps (app_id, hidden_at) VALUES (?, ?)',
      [appId, new Date().toISOString()]
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { appId } = await req.json();
    if (!appId || typeof appId !== 'string') {
      return NextResponse.json({ ok: false, error: 'appId required' }, { status: 400 });
    }
    ensureTable();
    dbExec(CITADEL_APP_ID, 'DELETE FROM hidden_apps WHERE app_id = ?', [appId]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
