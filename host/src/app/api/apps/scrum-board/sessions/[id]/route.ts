import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { ensureScrumBoardSchema, getSession, updateSessionStatus, type SessionStatus } from '@/lib/scrumBoardSchema';

export const runtime = 'nodejs';
const APP_ID = 'scrum-board';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  ensureScrumBoardSchema();
  const { id } = await params;
  const sessionId = String(id || '').trim();

  if (!sessionId) {
    return NextResponse.json({ ok: false, error: 'Session ID required' }, { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 });
  }

  // Get task details
  const task = dbQuery<{ id: number; title: string; status: string; board_id: number }>(
    APP_ID,
    `SELECT id, title, status, board_id FROM tasks WHERE id = ? LIMIT 1`,
    [session.task_id]
  )[0];

  // Get board/app details
  let appId: string | null = null;
  if (task?.board_id) {
    const board = dbQuery<{ app_id: string }>(
      APP_ID,
      `SELECT app_id FROM boards WHERE id = ? LIMIT 1`,
      [task.board_id]
    )[0];
    appId = board?.app_id || null;
  }

  // Get existing logs for this session (ordered by id for proper sequence)
  const logs = dbQuery<{ id: number; chunk: string; created_at: string }>(
    APP_ID,
    `SELECT id, chunk, created_at FROM session_logs 
     WHERE session_id = ? 
     ORDER BY id ASC`,
    [sessionId]
  );

  return NextResponse.json({
    ok: true,
    session: {
      ...session,
      task: task || null,
      app_id: appId,
    },
    logs: logs || [],
  });
}

export async function PATCH(req: Request, { params }: RouteParams) {
  ensureScrumBoardSchema();
  const { id } = await params;
  const sessionId = String(id || '').trim();

  if (!sessionId) {
    return NextResponse.json({ ok: false, error: 'Session ID required' }, { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({} as any));
  const status = String(body?.status || '').trim() as SessionStatus;
  const finalOutput = String(body?.final_output || '').trim() || undefined;

  const validStatuses: SessionStatus[] = ['running', 'completed', 'failed', 'blocked', 'needs_input', 'validating', 'archived'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ ok: false, error: 'Invalid status' }, { status: 400 });
  }

  updateSessionStatus(sessionId, status, finalOutput);

  return NextResponse.json({ ok: true, session: getSession(sessionId) });
}
