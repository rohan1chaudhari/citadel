import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { ensureScrumBoardSchema, getSessionsForTask, getRecentSessions, archiveOldSessions } from '@/lib/scrumBoardSchema';

export const runtime = 'nodejs';
const APP_ID = 'scrum-board';

export interface SessionRow {
  id: string;
  task_id: number;
  cron_job_id: string | null;
  started_at: string;
  ended_at: string | null;
  status: string;
  logs_url: string | null;
  final_output: string | null;
  created_at: string;
  archived_at: string | null;
}

export async function GET(req: Request) {
  ensureScrumBoardSchema();
  const url = new URL(req.url);
  const taskId = url.searchParams.get('task');
  const archive = url.searchParams.get('archive') === 'true';

  // Archive old sessions if requested
  if (archive) {
    const archivedCount = archiveOldSessions();
    return NextResponse.json({ ok: true, archived: archivedCount });
  }

  // Get sessions for a specific task
  if (taskId) {
    const id = Number(taskId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ ok: false, error: 'Invalid task ID' }, { status: 400 });
    }
    const sessions = getSessionsForTask(id);
    return NextResponse.json({ ok: true, sessions });
  }

  // Get recent sessions with task titles
  const sessions = getRecentSessions(50);
  const taskIds = [...new Set(sessions.map((s) => s.task_id))];

  let tasks: { id: number; title: string }[] = [];
  if (taskIds.length > 0) {
    const placeholders = taskIds.map(() => '?').join(',');
    tasks = dbQuery<{ id: number; title: string }>(
      APP_ID,
      `SELECT id, title FROM tasks WHERE id IN (${placeholders})`,
      taskIds
    );
  }
  const taskMap = new Map(tasks.map((t) => [t.id, t.title]));

  const sessionsWithTitles = sessions.map((s) => ({
    ...s,
    task_title: taskMap.get(s.task_id) || 'Unknown Task',
  }));

  return NextResponse.json({ ok: true, sessions: sessionsWithTitles });
}
