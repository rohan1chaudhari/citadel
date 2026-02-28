import { audit } from '@/lib/audit';
import { dbQuery, dbExec } from '@/lib/db';
import { getSetting, acquireAgentLock, isAgentLocked, getActiveLock, createSession, updateSessionStatus } from '@/lib/scrumBoardSchema';
import { OpenClawRuntime } from '@/lib/openclawRuntime';

const APP_ID = 'scrum-board';
const runtime = new OpenClawRuntime();

/**
 * Poll OpenClaw cron runs and stream run summaries/events into session_logs.
 * This replaces deprecated sessions-history polling in newer OpenClaw versions.
 */
async function streamSessionToLogs(
  sessionId: string,
  cronJobId: string,
  openclawSessionKey?: string
): Promise<void> {
  const pollIntervalMs = 3000;
  const maxWaitMs = 20 * 60 * 1000; // 20 min
  const startTime = Date.now();
  const seen = new Set<string>();

  // eslint-disable-next-line no-console
  console.log(`[SessionStream] Starting stream for ${sessionId} (job ${cronJobId}${openclawSessionKey ? `, key ${openclawSessionKey}` : ''})`);

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const runs = await runtime.listCronRuns(cronJobId, 20);
      if (runs.ok && runs.entries) {
        const ordered = [...runs.entries].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));

        for (const entry of ordered) {
          const sig = `${entry.ts ?? 0}:${entry.action ?? ''}:${entry.status ?? ''}`;
          if (seen.has(sig)) continue;
          seen.add(sig);

          let chunk = `[cron:${entry.action ?? 'event'}] status=${entry.status ?? 'unknown'}`;
          if (entry.summary) chunk += `\n\n${entry.summary}`;
          chunk += '\n';

          dbExec(
            APP_ID,
            `INSERT INTO session_logs (session_id, chunk, created_at) VALUES (?, ?, ?)`,
            [sessionId, chunk, new Date(entry.ts ?? Date.now()).toISOString()]
          );

          if (entry.action === 'finished') {
            const finalStatus = entry.status === 'ok' ? 'completed' : 'failed';
            updateSessionStatus(sessionId, finalStatus as any);
            // eslint-disable-next-line no-console
            console.log(`[SessionStream] Session ${sessionId} finalized from cron-runs (${finalStatus})`);
            return;
          }
        }
      }

      const cronStatus = await runtime.listCronJobs();
      const exists = cronStatus.ok ? (cronStatus.ids ?? []).includes(cronJobId) : true;
      if (!exists) {
        // If job is gone and we never saw finished event, settle conservatively.
        updateSessionStatus(sessionId, 'completed');
        return;
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[SessionStream] Error polling cron-runs:', err);
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  // Timeout fallback
  updateSessionStatus(sessionId, 'failed');
}

/**
 * Check if autopilot is enabled via settings toggle.
 */
export function isAutopilotEnabled(): boolean {
  const value = getSetting('autopilot_enabled');
  return value !== 'false';
}

/**
 * Check if there are any eligible tasks (todo status with attempts remaining)
 * for the given app. Returns the count of eligible tasks.
 */
function countEligibleTasks(appId: string): number {
  const result = dbQuery<{ count: number }>(
    APP_ID,
    `
    SELECT COUNT(*) as count
    FROM tasks t
    JOIN boards b ON t.board_id = b.id
    WHERE b.app_id = ?
      AND t.status = 'todo'
      AND t.attempt_count < t.max_attempts
    `,
    [appId]
  );
  return result[0]?.count ?? 0;
}

export interface TriggerResult {
  ok: boolean;
  message: string;
  cronJobId?: string;
  sessionId?: string;
  runAt?: string;
  eligibleCount?: number;
  skipped?: boolean;
  error?: string;
}

/**
 * Trigger an autopilot agent run for a selected app.
 * Adds a one-time cron job via OpenClaw CLI.
 * Only schedules if there are eligible tasks to avoid wasting tokens.
 * 
 * @param skipToggleCheck - If true, bypasses the autopilot_enabled toggle (for manual triggers)
 */
export async function triggerAutopilot(appId: string, appName?: string, skipToggleCheck = false): Promise<TriggerResult> {
  const targetAppId = appId.trim();
  const targetAppName = (appName || appId).trim();

  if (!targetAppId) {
    return { ok: false, message: 'appId required', error: 'appId required' };
  }

  // Check autopilot toggle (unless manually triggered)
  if (!skipToggleCheck && !isAutopilotEnabled()) {
    audit(APP_ID, 'scrum.trigger_agent_skipped', {
      appId: targetAppId,
      appName: targetAppName,
      reason: 'autopilot_disabled',
    });
    return {
      ok: false,
      skipped: true,
      message: 'Autopilot is disabled via toggle. Enable it in settings to run.',
    };
  }

  // Check for eligible tasks before starting session to save tokens
  const eligibleCount = countEligibleTasks(targetAppId);
  if (eligibleCount === 0) {
    audit(APP_ID, 'scrum.trigger_agent_skipped', {
      appId: targetAppId,
      appName: targetAppName,
      reason: 'no_eligible_tasks',
    });
    return {
      ok: false,
      skipped: true,
      message: 'No eligible tasks in todo status. Autopilot session not started to save tokens.',
    };
  }

  // Check agent lock - only one agent at a time
  if (isAgentLocked()) {
    const lock = getActiveLock();
    audit(APP_ID, 'scrum.trigger_agent_skipped', {
      appId: targetAppId,
      appName: targetAppName,
      reason: 'agent_locked',
      lockedTaskId: lock?.task_id,
    });
    return {
      ok: false,
      skipped: true,
      message: `Agent is busy with task #${lock?.task_id}. Try again later.`,
    };
  }

  const cronJobId = `sb-${Date.now()}`;
  const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const cronRunTs = new Date().toISOString();
  const repoPath = '/home/rohanchaudhari/personal/citadel';

  // Find the highest priority eligible task and acquire lock
  const highestTask = dbQuery<{ id: number }>(
    APP_ID,
    `
    SELECT t.id
    FROM tasks t
    JOIN boards b ON t.board_id = b.id
    WHERE b.app_id = ?
      AND t.status = 'todo'
      AND t.attempt_count < t.max_attempts
    ORDER BY 
      CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      t.created_at ASC,
      t.id ASC
    LIMIT 1
    `,
    [targetAppId]
  )[0];

  if (!highestTask) {
    return {
      ok: false,
      skipped: true,
      message: 'No eligible tasks found.',
    };
  }

  // Acquire lock for this task before scheduling
  if (!acquireAgentLock(highestTask.id, sessionId)) {
    return {
      ok: false,
      skipped: true,
      message: 'Could not acquire agent lock. Another agent may have started.',
    };
  }

  // Create session record before triggering
  createSession(sessionId, highestTask.id, cronJobId);

  // Build the agent turn message following AUTOPILOT.md
  const message = `Autopilot cycle for Citadel app: ${targetAppName} (${targetAppId})

Context:
- Repo: ${repoPath}
- Runbook: ${repoPath}/kb/AUTOPILOT.md
- Target app_id: ${targetAppId}
- Triggered by: scrum-board UI
- session_id: ${sessionId}
- cron_job_id: ${cronJobId}
- cron_run_ts: ${cronRunTs}

Execution contract:
1) Read AUTOPILOT.md and follow it strictly.
2) Read scrum-board tasks for this app only.
3) Pick highest-priority eligible task in status "todo" with attempt_count < max_attempts.
4) Claim task (set status "in_progress", set claimed_by/claimed_at/last_run_at/session_id).
5) Implement exactly one task.
6) Validate with "npm run build" in ${repoPath}/host.
7) Update task:
   - done if complete + validated
   - needs_input if human decision required
   - blocked if external dependency
   - failed if retries exhausted; else increment attempt_count and return to todo
8) Update session status and add structured comment with debug metadata.
9) Stop.`;

  try {
    // Schedule to run immediately
    const runAt = new Date(Date.now() + 1000).toISOString();

    const result = await runtime.scheduleOneShot({
      name: `autopilot-${targetAppId}-${cronJobId}`,
      runAt,
      message,
      thinking: 'low',
      timeoutSeconds: 600,
    });

    if (!result.ok) {
      throw new Error(result.error || 'failed to schedule runtime job');
    }

    const openclawSessionKey = result.sessionKey;

    dbExec(
      APP_ID,
      `INSERT INTO session_logs (session_id, chunk, created_at) VALUES (?, ?, ?)`,
      [
        sessionId,
        `[cron:scheduled] job=${result.jobId || cronJobId}${openclawSessionKey ? ` session=${openclawSessionKey}` : ''}\n`,
        new Date().toISOString(),
      ]
    );

    audit(APP_ID, 'scrum.trigger_agent', {
      appId: targetAppId,
      appName: targetAppName,
      cronJobId: result.jobId || cronJobId,
      openclawSessionKey,
      runtime: runtime.id(),
    });

    // Start streaming session logs in the background (don't await, let it run)
    if (openclawSessionKey) {
      streamSessionToLogs(sessionId, result.jobId || cronJobId, openclawSessionKey).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[SessionStream] Background stream failed:', err);
      });
    }

    return {
      ok: true,
      message: `Agent scheduled (${eligibleCount} eligible task${eligibleCount === 1 ? '' : 's'})`,
      cronJobId: result.jobId || cronJobId,
      sessionId,
      runAt,
      eligibleCount,
    };
  } catch (err: any) {
    audit(APP_ID, 'scrum.trigger_agent_failed', { appId: targetAppId, error: err?.message });
    return {
      ok: false,
      message: err?.message || 'Failed to schedule agent',
      error: err?.message || 'Failed to schedule agent',
    };
  }
}
