import { dbExec, dbQuery, audit } from '@citadel/core';
import { ensureScrumBoardSchema, releaseAgentLock } from '@/lib/scrumBoardSchema';

const APP_ID = 'scrum-board';
const WATCH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const STALE_AFTER_MS = 20 * 60 * 1000; // 20 minutes

let watcherInterval: NodeJS.Timeout | null = null;
let isRunning = false;

type StaleTask = {
  id: number;
  board_id: number;
  title: string;
  session_id: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  last_run_at: string | null;
  updated_at: string | null;
  created_at: string;
};

function hasAutopilotDoneMarker(taskId: number): boolean {
  const row = dbQuery<{ body: string }>(
    APP_ID,
    `SELECT body FROM comments WHERE task_id = ? ORDER BY id DESC LIMIT 1`,
    [taskId]
  )[0];

  if (!row?.body) return false;
  const body = row.body;
  return body.includes('[AUTOPILOT_DONE]') || /\b(build|validation)\b.*\b(pass|passed)\b/i.test(body);
}

function sessionLooksCompleted(sessionId: string | null): boolean {
  if (!sessionId) return false;
  const row = dbQuery<{ status: string }>(
    APP_ID,
    `SELECT status FROM sessions WHERE id = ? LIMIT 1`,
    [sessionId]
  )[0];
  return row?.status === 'completed';
}

function getStaleInProgressTasks(): StaleTask[] {
  const cutoffIso = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  return dbQuery<StaleTask>(
    APP_ID,
    `SELECT id, board_id, title, session_id, claimed_by, claimed_at, last_run_at, updated_at, created_at
     FROM tasks
     WHERE status = 'in_progress'
       AND COALESCE(last_run_at, claimed_at, updated_at, created_at) < ?
     ORDER BY COALESCE(last_run_at, claimed_at, updated_at, created_at) ASC`,
    [cutoffIso]
  );
}

export async function runStuckTaskSweep(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    ensureScrumBoardSchema();
    const stale = getStaleInProgressTasks();
    if (stale.length === 0) return;

    const now = new Date().toISOString();

    for (const task of stale) {
      const doneSignal = sessionLooksCompleted(task.session_id) || hasAutopilotDoneMarker(task.id);
      const nextStatus = doneSignal ? 'done' : 'todo';
      const comment = doneSignal
        ? '[AUTO_UNSTICK] Stale in_progress task auto-resolved to done (completion signal detected).'
        : '[AUTO_UNSTICK] Stale in_progress task moved back to todo (no completion signal detected).';

      dbExec(
        APP_ID,
        `UPDATE tasks
         SET status = ?,
             session_id = NULL,
             claimed_by = NULL,
             claimed_at = NULL,
             updated_at = ?,
             completed_at = CASE WHEN ? = 'done' THEN COALESCE(completed_at, ?) ELSE completed_at END
         WHERE id = ?`,
        [nextStatus, now, nextStatus, now, task.id]
      );

      dbExec(
        APP_ID,
        `INSERT INTO comments (task_id, body, created_at) VALUES (?, ?, ?)`,
        [task.id, comment, now]
      );

      audit(APP_ID, 'scrum.tasks.auto_unstick', {
        id: task.id,
        from: 'in_progress',
        to: nextStatus,
        sessionId: task.session_id,
      });
    }

    // If a stale task had the active lock, release it.
    releaseAgentLock();
  } catch (error) {
    console.error('[stuck-task-watcher] sweep failed:', error);
    audit(APP_ID, 'scrum.tasks.auto_unstick_failed', { error: String(error) });
  } finally {
    isRunning = false;
  }
}

export function startStuckTaskWatcher(): void {
  if (watcherInterval) return;

  console.log('[stuck-task-watcher] starting (interval: 10m, stale after: 45m)');

  runStuckTaskSweep();
  watcherInterval = setInterval(runStuckTaskSweep, WATCH_INTERVAL_MS);

  process.on('SIGTERM', stopStuckTaskWatcher);
  process.on('SIGINT', stopStuckTaskWatcher);
}

export function stopStuckTaskWatcher(): void {
  if (!watcherInterval) return;
  clearInterval(watcherInterval);
  watcherInterval = null;
  console.log('[stuck-task-watcher] stopped');
}
