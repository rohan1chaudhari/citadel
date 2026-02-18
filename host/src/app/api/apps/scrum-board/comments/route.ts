import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@/lib/db';
import { ensureScrumBoardSchema } from '@/lib/scrumBoardSchema';

export const runtime = 'nodejs';
const APP_ID = 'scrum-board';

export async function GET(req: Request) {
  ensureScrumBoardSchema();
  const taskId = Number(new URL(req.url).searchParams.get('taskId'));
  if (!Number.isFinite(taskId)) return NextResponse.json({ ok: false, error: 'taskId required' }, { status: 400 });

  const comments = dbQuery(
    APP_ID,
    `SELECT id, task_id, body, created_at FROM comments WHERE task_id = ? ORDER BY id ASC`,
    [taskId]
  );

  return NextResponse.json({ ok: true, comments });
}

export async function POST(req: Request) {
  ensureScrumBoardSchema();
  const body = await req.json().catch(() => ({} as any));
  const taskId = Number(body?.taskId);
  const text = String(body?.body ?? '').trim().slice(0, 4000);
  if (!Number.isFinite(taskId)) return NextResponse.json({ ok: false, error: 'taskId required' }, { status: 400 });
  if (!text) return NextResponse.json({ ok: false, error: 'body required' }, { status: 400 });

  dbExec(APP_ID, `INSERT INTO comments (task_id, body, created_at) VALUES (?, ?, ?)`, [taskId, text, new Date().toISOString()]);
  return NextResponse.json({ ok: true });
}
