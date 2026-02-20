import { spawn } from 'child_process';
import { audit } from '@/lib/audit';
import { dbQuery, dbExec } from '@/lib/db';
import { getSetting, acquireAgentLock, isAgentLocked, getActiveLock, createSession, updateSessionStatus } from '@/lib/scrumBoardSchema';

const APP_ID = 'scrum-board';

/**
 * Poll an OpenClaw session and stream its messages to session_logs
 */
async function streamSessionToLogs(
  sessionId: string,
  cronJobId: string,
  openclawSessionKey: string
): Promise<void> {
  const pollIntervalMs = 2000;
  const maxWaitMs = 600000; // 10 minutes max
  const startTime = Date.now();
  let lastMessageCount = 0;
  let settledCount = 0;

  // eslint-disable-next-line no-console
  console.log(`[SessionStream] Starting stream for ${sessionId} -> ${openclawSessionKey}`);

  while (Date.now() - startTime < maxWaitMs) {
    try {
      // Query session history from OpenClaw
      const result = await new Promise<{ ok: boolean; messages?: Array<{ role: string; content?: string; timestamp?: string }>; error?: string }>((resolve) => {
        const child = spawn('openclaw', ['sessions', 'history', openclawSessionKey, '--json'], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', (d) => (stdout += d));
        child.stderr?.on('data', (d) => (stderr += d));
        child.on('close', (code) => {
          if (code !== 0) {
            resolve({ ok: false, error: stderr || `exit ${code}` });
            return;
          }
          try {
            const data = JSON.parse(stdout);
            resolve({ ok: true, messages: data.messages || [] });
          } catch {
            resolve({ ok: false, error: 'parse error' });
          }
        });
      });

      if (!result.ok || !result.messages) {
        await new Promise((r) => setTimeout(r, pollIntervalMs));
        continue;
      }

      const messages = result.messages;

      // If we have new messages, write them to session_logs
      if (messages.length > lastMessageCount) {
        const newMessages = messages.slice(lastMessageCount);
        for (const msg of newMessages) {
          const content = msg.content || '';
          if (content) {
            dbExec(
              APP_ID,
              `INSERT INTO session_logs (session_id, chunk, created_at) VALUES (?, ?, ?)`,
              [sessionId, `[${msg.role}] ${content}\n`, msg.timestamp || new Date().toISOString()]
            );
          }
        }
        lastMessageCount = messages.length;
        settledCount = 0;
      } else {
        settledCount++;
      }

      // Check if session is complete (no new messages for 3 polls and has messages)
      if (settledCount > 3 && messages.length > 0) {
        // Check if there's a final assistant message indicating completion
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.role === 'assistant') {
          // Session likely complete
          updateSessionStatus(sessionId, 'completed');
          // eslint-disable-next-line no-console
          console.log(`[SessionStream] Session ${sessionId} completed`);
          break;
        }
      }

      // Also check if the cron job still exists (indicates completion)
      const cronStatus = await new Promise<{ exists: boolean }>((resolve) => {
        const child = spawn('openclaw', ['cron', 'list', '--json'], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        child.stdout?.on('data', (d) => (stdout += d));
        child.on('close', () => {
          try {
            const jobs = JSON.parse(stdout);
            const exists = Array.isArray(jobs) && jobs.some((j: { id?: string }) => j.id === cronJobId);
            resolve({ exists });
          } catch {
            resolve({ exists: true }); // Assume exists on error
          }
        });
      });

      if (!cronStatus.exists && messages.length > 0) {
        // Job completed, finalize
        updateSessionStatus(sessionId, 'completed');
        // eslint-disable-next-line no-console
        console.log(`[SessionStream] Session ${sessionId} finalized (job removed)`);
        break;
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[SessionStream] Error polling:', err);
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
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

    // Call openclaw cron add with proper flags (session persists for history)
    const args = [
      'cron', 'add',
      '--name', `autopilot-${targetAppId}-${cronJobId}`,
      '--session', 'isolated',
      '--at', runAt,
      '--message', message,
      '--thinking', 'low',
      '--timeout-seconds', '600',
      '--json',
    ];

    // Execute and capture output
    const child = spawn('openclaw', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => (stdout += d));
    child.stderr?.on('data', (d) => (stderr += d));

    const exitCode = await new Promise<number>((resolve) => child.on('close', resolve));

    // Filter out config warnings from stderr
    const cleanStderr = stderr
      .split('\n')
      .filter((l) => !l.includes('Config was last written'))
      .join('\n')
      .trim();

    if (exitCode !== 0) {
      throw new Error(cleanStderr || `openclaw exited ${exitCode}`);
    }

    const result = JSON.parse(stdout || '{}');
    const openclawSessionKey = result.sessionKey || result.session || result.id;

    audit(APP_ID, 'scrum.trigger_agent', {
      appId: targetAppId,
      appName: targetAppName,
      cronJobId: result.id || cronJobId,
      openclawSessionKey,
    });

    // Start streaming session logs in the background (don't await, let it run)
    if (openclawSessionKey) {
      streamSessionToLogs(sessionId, result.id || cronJobId, openclawSessionKey).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[SessionStream] Background stream failed:', err);
      });
    }

    return {
      ok: true,
      message: `Agent scheduled (${eligibleCount} eligible task${eligibleCount === 1 ? '' : 's'})`,
      cronJobId: result.id || cronJobId,
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
