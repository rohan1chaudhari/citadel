import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@/lib/db';
import { audit } from '@/lib/audit';
import { ensureScrumBoardSchema, getOrCreateBoardId, normalizePriority, normalizeStatus } from '@/lib/scrumBoardSchema';

export const runtime = 'nodejs';
const APP_ID = 'scrum-board';

type TaskRow = {
  id: number;
  board_id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee: string | null;
  due_at: string | null;
  session_id: string | null;
  created_at: string;
  updated_at: string | null;
  completed_at: string | null;
};

function priorityRank(p: string) {
  return p === 'high' ? 0 : p === 'medium' ? 1 : 2;
}

function toIsoOrNull(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function GET(req: Request) {
  ensureScrumBoardSchema();
  const appId = (new URL(req.url).searchParams.get('app') ?? '').trim();
  if (!appId) return NextResponse.json({ ok: false, error: 'app required' }, { status: 400 });

  const boardId = getOrCreateBoardId(appId);
  const tasks = dbQuery<TaskRow>(
    APP_ID,
    `SELECT id, board_id, title, description, status, priority, assignee, due_at, session_id, created_at, updated_at, completed_at
     FROM tasks
     WHERE board_id = ?
     ORDER BY created_at DESC, id DESC`,
    [boardId]
  );

  const commentCounts = dbQuery<{ task_id: number; n: number }>(
    APP_ID,
    `SELECT task_id, COUNT(*) as n FROM comments WHERE task_id IN (SELECT id FROM tasks WHERE board_id = ?) GROUP BY task_id`,
    [boardId]
  );
  const counts = new Map(commentCounts.map((r) => [Number(r.task_id), Number(r.n)]));

  const out = tasks
    .map((t) => ({ ...t, comment_count: counts.get(Number(t.id)) ?? 0 }))
    .sort((a, b) => {
      const sOrder: Record<string, number> = { backlog: 0, todo: 1, in_progress: 2, done: 3 };
      const sa = sOrder[a.status] ?? 9;
      const sb = sOrder[b.status] ?? 9;
      if (sa !== sb) return sa - sb;
      const pa = priorityRank(a.priority);
      const pb = priorityRank(b.priority);
      if (pa !== pb) return pa - pb;
      return Number(b.id) - Number(a.id);
    });

  return NextResponse.json({ ok: true, appId, boardId, tasks: out });
}

export async function POST(req: Request) {
  ensureScrumBoardSchema();
  const body = await req.json().catch(() => ({} as any));
  const appId = String(body?.appId ?? '').trim();
  const title = String(body?.title ?? '').trim().slice(0, 200);
  const description = String(body?.description ?? '').trim().slice(0, 5000);
  const status = normalizeStatus(body?.status);
  const priority = normalizePriority(body?.priority);
  const assignee = String(body?.assignee ?? '').trim().slice(0, 120) || null;
  const dueAt = toIsoOrNull(body?.due_at ?? body?.dueAt);
  const sessionId = String(body?.session_id ?? body?.sessionId ?? '').trim().slice(0, 120) || null;

  if (!appId) return NextResponse.json({ ok: false, error: 'appId required' }, { status: 400 });
  if (!title) return NextResponse.json({ ok: false, error: 'title required' }, { status: 400 });

  const boardId = getOrCreateBoardId(appId);
  const now = new Date().toISOString();
  dbExec(
    APP_ID,
    `INSERT INTO tasks (board_id, title, description, status, priority, assignee, due_at, session_id, created_at, updated_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [boardId, title, description || null, status, priority, assignee, dueAt, sessionId, now, now, status === 'done' ? now : null]
  );

  const id = dbQuery<{ id: number }>(APP_ID, `SELECT last_insert_rowid() as id`)[0]?.id;
  audit(APP_ID, 'scrum.tasks.create', { appId, boardId, id, status, priority, assignee, dueAt });
  return NextResponse.json({ ok: true, id });
}

export async function PATCH(req: Request) {
  ensureScrumBoardSchema();
  const body = await req.json().catch(() => ({} as any));
  const id = Number(body?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  const row = dbQuery<TaskRow>(APP_ID, `SELECT * FROM tasks WHERE id = ? LIMIT 1`, [id])[0];
  if (!row) return NextResponse.json({ ok: false, error: 'task not found' }, { status: 404 });

  const title = typeof body?.title === 'string' ? String(body.title).trim().slice(0, 200) : row.title;
  const description = typeof body?.description === 'string' ? String(body.description).trim().slice(0, 5000) : row.description;
  const status = body?.status != null ? normalizeStatus(body.status) : (row.status as any);
  const priority = body?.priority != null ? normalizePriority(body.priority) : (row.priority as any);
  const assignee = body?.assignee !== undefined
    ? String(body?.assignee ?? '').trim().slice(0, 120) || null
    : row.assignee;

  const dueAt = body?.due_at !== undefined || body?.dueAt !== undefined
    ? toIsoOrNull(body?.due_at ?? body?.dueAt)
    : row.due_at;

  const sessionId = body?.session_id !== undefined || body?.sessionId !== undefined
    ? String(body?.session_id ?? body?.sessionId ?? '').trim().slice(0, 120) || null
    : row.session_id;

  const now = new Date().toISOString();
  const completedAt = status === 'done' ? row.completed_at ?? now : null;

  dbExec(
    APP_ID,
    `UPDATE tasks
     SET title = ?, description = ?, status = ?, priority = ?, assignee = ?, due_at = ?, session_id = ?, updated_at = ?, completed_at = ?
     WHERE id = ?`,
    [title, description, status, priority, assignee, dueAt, sessionId, now, completedAt, id]
  );

  if (body?.comment) {
    const comment = String(body.comment).trim().slice(0, 4000);
    if (comment) {
      dbExec(APP_ID, `INSERT INTO comments (task_id, body, created_at) VALUES (?, ?, ?)`, [id, comment, now]);
    }
  }

  audit(APP_ID, 'scrum.tasks.update', { id, status, priority, assignee, dueAt });
  return NextResponse.json({ ok: true });
}
