import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@/lib/db';
import { audit } from '@/lib/audit';
import { ensureScrumBoardSchema, getOrCreateBoardId, normalizePriority, normalizeStatus, releaseAgentLock, updateSessionStatus, type SessionStatus } from '@/lib/scrumBoardSchema';

export const runtime = 'nodejs';
const APP_ID = 'scrum-board';

type TaskRow = {
  id: number;
  board_id: number;
  title: string;
  description: string | null;
  acceptance_criteria: string | null;
  status: string;
  position: number;
  priority: string;
  assignee: string | null;
  due_at: string | null;
  session_id: string | null;
  attempt_count: number;
  max_attempts: number;
  claimed_by: string | null;
  claimed_at: string | null;
  last_error: string | null;
  last_run_at: string | null;
  needs_input_questions: string | null;
  input_deadline_at: string | null;
  created_at: string;
  updated_at: string | null;
  completed_at: string | null;
  validation_rounds: number;
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

function toIntOrDefault(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function nextPosition(boardId: number, status: string): number {
  const row = dbQuery<{ p: number }>(
    APP_ID,
    `SELECT COALESCE(MAX(position), -1) as p FROM tasks WHERE board_id = ? AND status = ?`,
    [boardId, status]
  )[0];
  return Number(row?.p ?? -1) + 1;
}

export async function GET(req: Request) {
  ensureScrumBoardSchema();
  const sp = new URL(req.url).searchParams;
  const appId = (sp.get('app') ?? sp.get('appId') ?? '').trim();
  if (!appId) return NextResponse.json({ ok: false, error: 'app required' }, { status: 400 });

  const boardId = getOrCreateBoardId(appId);
  const tasks = dbQuery<TaskRow>(
    APP_ID,
    `SELECT
      id, board_id, title, description, acceptance_criteria, status, position, priority, assignee, due_at, session_id,
      attempt_count, max_attempts, claimed_by, claimed_at, last_error, last_run_at, needs_input_questions, input_deadline_at,
      created_at, updated_at, completed_at, validation_rounds
     FROM tasks
     WHERE board_id = ?
     ORDER BY status ASC, position ASC, id ASC`,
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
      const sOrder: Record<string, number> = {
        backlog: 0,
        todo: 1,
        in_progress: 2,
        validating: 3,
        waiting: 4,
        done: 5,
        failed: 6
      };
      const sa = sOrder[a.status] ?? 99;
      const sb = sOrder[b.status] ?? 99;
      if (sa !== sb) return sa - sb;
      const pa = priorityRank(a.priority);
      const pb = priorityRank(b.priority);
      if (pa !== pb) return pa - pb;
      const pos = Number(a.position ?? 0) - Number(b.position ?? 0);
      if (pos !== 0) return pos;
      return Number(a.id) - Number(b.id);
    });

  return NextResponse.json({ ok: true, appId, boardId, tasks: out });
}

export async function POST(req: Request) {
  ensureScrumBoardSchema();
  const body = await req.json().catch(() => ({} as any));
  const appId = String(body?.appId ?? '').trim();
  const title = String(body?.title ?? '').trim().slice(0, 200);
  const description = String(body?.description ?? '').trim().slice(0, 5000);
  const acceptanceCriteria = String(body?.acceptance_criteria ?? body?.acceptanceCriteria ?? '').trim().slice(0, 5000) || null;
  const status = normalizeStatus(body?.status);
  const priority = normalizePriority(body?.priority);
  const assignee = String(body?.assignee ?? '').trim().slice(0, 120) || null;
  const dueAt = toIsoOrNull(body?.due_at ?? body?.dueAt);
  const sessionId = String(body?.session_id ?? body?.sessionId ?? '').trim().slice(0, 120) || null;
  const attemptCount = Math.max(0, toIntOrDefault(body?.attempt_count ?? body?.attemptCount, 0));
  const maxAttempts = Math.max(1, toIntOrDefault(body?.max_attempts ?? body?.maxAttempts, 3));
  const claimedBy = String(body?.claimed_by ?? body?.claimedBy ?? '').trim().slice(0, 120) || null;
  const claimedAt = toIsoOrNull(body?.claimed_at ?? body?.claimedAt);
  const lastError = String(body?.last_error ?? body?.lastError ?? '').trim().slice(0, 4000) || null;
  const lastRunAt = toIsoOrNull(body?.last_run_at ?? body?.lastRunAt);
  const needsInputQuestions = String(body?.needs_input_questions ?? body?.needsInputQuestions ?? '').trim().slice(0, 6000) || null;
  const inputDeadlineAt = toIsoOrNull(body?.input_deadline_at ?? body?.inputDeadlineAt);
  const validationRounds = Math.max(0, toIntOrDefault(body?.validation_rounds ?? body?.validationRounds, 0));
  const triggerImmediately = Boolean(body?.trigger_immediately ?? body?.triggerImmediately);

  if (!appId) return NextResponse.json({ ok: false, error: 'appId required' }, { status: 400 });
  if (!title) return NextResponse.json({ ok: false, error: 'title required' }, { status: 400 });

  // When triggering immediately, force status to 'todo' so autopilot can find it
  const effectiveStatus = triggerImmediately ? 'todo' : status;

  const boardId = getOrCreateBoardId(appId);
  const now = new Date().toISOString();
  const position = nextPosition(boardId, effectiveStatus);
  dbExec(
    APP_ID,
    `INSERT INTO tasks (
      board_id, title, description, acceptance_criteria, status, position, priority, assignee, due_at, session_id,
      attempt_count, max_attempts, claimed_by, claimed_at, last_error, last_run_at, needs_input_questions, input_deadline_at,
      created_at, updated_at, completed_at, validation_rounds
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      boardId, title, description || null, acceptanceCriteria, effectiveStatus, position, priority, assignee, dueAt, sessionId,
      attemptCount, maxAttempts, claimedBy, claimedAt, lastError, lastRunAt, needsInputQuestions, inputDeadlineAt,
      now, now, effectiveStatus === 'done' ? now : null, validationRounds
    ]
  );

  const id = dbQuery<{ id: number }>(APP_ID, `SELECT last_insert_rowid() as id`)[0]?.id;
  audit(APP_ID, 'scrum.tasks.create', { appId, boardId, id, status: effectiveStatus, priority, triggerImmediately });

  // Trigger autopilot immediately if requested
  if (triggerImmediately && id) {
    try {
      // Import trigger logic dynamically to avoid circular deps
      const { triggerAutopilot } = await import('@/lib/triggerAutopilot');
      const triggerResult = await triggerAutopilot(appId, appId);
      return NextResponse.json({ ok: true, id, triggered: true, triggerResult });
    } catch (err: any) {
      // Return success for task creation but note trigger failure
      return NextResponse.json({ ok: true, id, triggered: false, triggerError: err?.message || 'Trigger failed' });
    }
  }

  return NextResponse.json({ ok: true, id });
}

export async function PATCH(req: Request) {
  ensureScrumBoardSchema();
  const body = await req.json().catch(() => ({} as any));
  const id = Number(body?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  const row = dbQuery<TaskRow>(APP_ID, `SELECT * FROM tasks WHERE id = ? LIMIT 1`, [id])[0];
  if (!row) return NextResponse.json({ ok: false, error: 'task not found' }, { status: 404 });

  const targetAppId = typeof body?.targetAppId === 'string' ? body.targetAppId.trim() : '';
  const targetBoardId = targetAppId ? getOrCreateBoardId(targetAppId) : row.board_id;

  const title = typeof body?.title === 'string' ? String(body.title).trim().slice(0, 200) : row.title;
  const description = typeof body?.description === 'string' ? String(body.description).trim().slice(0, 5000) : row.description;
  const acceptanceCriteria = body?.acceptance_criteria !== undefined || body?.acceptanceCriteria !== undefined
    ? String(body?.acceptance_criteria ?? body?.acceptanceCriteria ?? '').trim().slice(0, 5000) || null
    : row.acceptance_criteria;

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

  const attemptCount = body?.attempt_count !== undefined || body?.attemptCount !== undefined
    ? Math.max(0, toIntOrDefault(body?.attempt_count ?? body?.attemptCount, row.attempt_count))
    : row.attempt_count;

  const maxAttempts = body?.max_attempts !== undefined || body?.maxAttempts !== undefined
    ? Math.max(1, toIntOrDefault(body?.max_attempts ?? body?.maxAttempts, row.max_attempts))
    : row.max_attempts;

  const claimedBy = body?.claimed_by !== undefined || body?.claimedBy !== undefined
    ? String(body?.claimed_by ?? body?.claimedBy ?? '').trim().slice(0, 120) || null
    : row.claimed_by;

  const claimedAt = body?.claimed_at !== undefined || body?.claimedAt !== undefined
    ? toIsoOrNull(body?.claimed_at ?? body?.claimedAt)
    : row.claimed_at;

  const lastError = body?.last_error !== undefined || body?.lastError !== undefined
    ? String(body?.last_error ?? body?.lastError ?? '').trim().slice(0, 4000) || null
    : row.last_error;

  const lastRunAt = body?.last_run_at !== undefined || body?.lastRunAt !== undefined
    ? toIsoOrNull(body?.last_run_at ?? body?.lastRunAt)
    : row.last_run_at;

  const needsInputQuestions = body?.needs_input_questions !== undefined || body?.needsInputQuestions !== undefined
    ? String(body?.needs_input_questions ?? body?.needsInputQuestions ?? '').trim().slice(0, 6000) || null
    : row.needs_input_questions;

  const inputDeadlineAt = body?.input_deadline_at !== undefined || body?.inputDeadlineAt !== undefined
    ? toIsoOrNull(body?.input_deadline_at ?? body?.inputDeadlineAt)
    : row.input_deadline_at;

  const validationRounds = body?.validation_rounds !== undefined || body?.validationRounds !== undefined
    ? Math.max(0, toIntOrDefault(body?.validation_rounds ?? body?.validationRounds, row.validation_rounds))
    : row.validation_rounds;

  const now = new Date().toISOString();

  if (body?.move === 'up' || body?.move === 'down') {
    const neighbor = dbQuery<TaskRow>(
      APP_ID,
      body.move === 'up'
        ? `SELECT * FROM tasks WHERE board_id = ? AND status = ? AND position < ? ORDER BY position DESC LIMIT 1`
        : `SELECT * FROM tasks WHERE board_id = ? AND status = ? AND position > ? ORDER BY position ASC LIMIT 1`,
      [row.board_id, row.status, row.position]
    )[0];

    if (neighbor) {
      dbExec(APP_ID, `UPDATE tasks SET position = ?, updated_at = ? WHERE id = ?`, [neighbor.position, now, row.id]);
      dbExec(APP_ID, `UPDATE tasks SET position = ?, updated_at = ? WHERE id = ?`, [row.position, now, neighbor.id]);
    }

    return NextResponse.json({ ok: true });
  }

  const completedAt = status === 'done' ? row.completed_at ?? now : null;
  const movedBoard = targetBoardId !== row.board_id;
  const position = movedBoard || status !== row.status ? nextPosition(targetBoardId, status) : row.position;

  dbExec(
    APP_ID,
    `UPDATE tasks
     SET board_id = ?, title = ?, description = ?, acceptance_criteria = ?, status = ?, position = ?, priority = ?, assignee = ?, due_at = ?, session_id = ?,
         attempt_count = ?, max_attempts = ?, claimed_by = ?, claimed_at = ?, last_error = ?, last_run_at = ?, needs_input_questions = ?, input_deadline_at = ?,
         updated_at = ?, completed_at = ?, validation_rounds = ?
     WHERE id = ?`,
    [
      targetBoardId, title, description, acceptanceCriteria, status, position, priority, assignee, dueAt, sessionId,
      attemptCount, maxAttempts, claimedBy, claimedAt, lastError, lastRunAt, needsInputQuestions, inputDeadlineAt,
      now, completedAt, validationRounds, id
    ]
  );

  // Release agent lock and update session status if task moved to a terminal state
  if (body?.status != null) {
    const newStatus = normalizeStatus(body.status);
    const terminalStatuses = ['done', 'failed', 'waiting', 'validating'];
    if (terminalStatuses.includes(newStatus)) {
      releaseAgentLock();
      
      // Also update session status to match task status (if task has a session)
      const taskSessionId = row.session_id;
      if (taskSessionId) {
        const sessionStatusMap: Record<string, SessionStatus> = {
          'done': 'completed',
          'failed': 'failed',
          'waiting': 'waiting',
          'validating': 'validating'
        };
        const sessionStatus = sessionStatusMap[newStatus];
        if (sessionStatus) {
          updateSessionStatus(taskSessionId, sessionStatus);
        }
      }
    }
  }

  if (body?.comment) {
    const comment = String(body.comment).trim().slice(0, 4000);
    if (comment) dbExec(APP_ID, `INSERT INTO comments (task_id, body, created_at) VALUES (?, ?, ?)`, [id, comment, now]);
  }

  audit(APP_ID, 'scrum.tasks.update', { id, status, priority, attemptCount, maxAttempts });
  return NextResponse.json({ ok: true });
}
