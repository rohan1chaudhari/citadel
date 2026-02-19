import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';
const APP_ID = 'scrum-board';

/**
 * Trigger an autopilot agent run for a selected app.
 * Adds a one-time cron job via OpenClaw CLI.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const appId = String(body?.appId ?? '').trim();
  const appName = String(body?.appName ?? '').trim();

  if (!appId) {
    return NextResponse.json({ ok: false, error: 'appId required' }, { status: 400 });
  }

  const cronJobId = `sb-${Date.now()}`;
  const cronRunTs = new Date().toISOString();
  const repoPath = '/home/rohanchaudhari/personal/citadel';

  // Build the agent turn message following AUTOPILOT.md
  const message = `Autopilot cycle for Citadel app: ${appName || appId} (${appId})

Context:
- Repo: ${repoPath}
- Runbook: ${repoPath}/kb/AUTOPILOT.md
- Target app_id: ${appId}
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
    // Schedule 5 seconds from now in ISO format
    const runAt = new Date(Date.now() + 5000).toISOString();

    // Call openclaw cron add with proper flags
    const args = [
      'cron', 'add',
      '--name', `autopilot-${appId}-${cronJobId}`,
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
      appId,
      appName,
      cronJobId: result.id || cronJobId,
    });

    return NextResponse.json({
      ok: true,
      message: 'Agent scheduled',
      cronJobId: result.id || cronJobId,
      runAt,
    });
  } catch (err: any) {
    audit(APP_ID, 'scrum.trigger_agent_failed', { appId, error: err?.message });
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to schedule agent' },
      { status: 502 }
    );
  }
}
