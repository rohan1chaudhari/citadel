import { spawn } from 'child_process';
import { audit } from '@/lib/audit';
import { dbQuery } from '@/lib/db';

const APP_ID = 'scrum-board';

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
  runAt?: string;
  eligibleCount?: number;
  skipped?: boolean;
  error?: string;
}

/**
 * Trigger an autopilot agent run for a selected app.
 * Adds a one-time cron job via OpenClaw CLI.
 * Only schedules if there are eligible tasks to avoid wasting tokens.
 */
export async function triggerAutopilot(appId: string, appName?: string): Promise<TriggerResult> {
  const targetAppId = appId.trim();
  const targetAppName = (appName || appId).trim();

  if (!targetAppId) {
    return { ok: false, message: 'appId required', error: 'appId required' };
  }

  const cronJobId = `sb-${Date.now()}`;
  const cronRunTs = new Date().toISOString();
  const repoPath = '/home/rohanchaudhari/personal/citadel';

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

  // Build the agent turn message following AUTOPILOT.md
  const message = `Autopilot cycle for Citadel app: ${targetAppName} (${targetAppId})

Context:
- Repo: ${repoPath}
- Runbook: ${repoPath}/kb/AUTOPILOT.md
- Target app_id: ${targetAppId}
- Triggered by: scrum-board UI
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
8) Add structured comment with debug metadata and stop.`;

  try {
    // Schedule to run immediately
    const runAt = new Date(Date.now() + 1000).toISOString();

    // Call openclaw cron add with proper flags
    const args = [
      'cron', 'add',
      '--name', `autopilot-${targetAppId}-${cronJobId}`,
      '--session', 'isolated',
      '--at', runAt,
      '--message', message,
      '--thinking', 'low',
      '--timeout-seconds', '600',
      '--delete-after-run',
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

    audit(APP_ID, 'scrum.trigger_agent', {
      appId: targetAppId,
      appName: targetAppName,
      cronJobId: result.id || cronJobId,
    });

    return {
      ok: true,
      message: `Agent scheduled (${eligibleCount} eligible task${eligibleCount === 1 ? '' : 's'})`,
      cronJobId: result.id || cronJobId,
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
