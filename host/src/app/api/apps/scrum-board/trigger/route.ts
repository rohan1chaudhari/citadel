import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';
const APP_ID = 'scrum-board';

/**
 * Trigger an autopilot agent run for a selected app.
 * This spawns an isolated OpenClaw session that follows AUTOPILOT.md.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const appId = String(body?.appId ?? '').trim();
  const appName = String(body?.appName ?? '').trim();

  if (!appId) {
    return NextResponse.json({ ok: false, error: 'appId required' }, { status: 400 });
  }

  const cronJobId = `manual-${Date.now()}`;
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

  // For now, we return the message that *would* be sent.
  // To wire this up:
  // Option A: Call OpenClaw Gateway cron API to schedule an immediate run
  // Option B: Call sessions_spawn via OpenClaw agent bridge
  // Option C: Write to a queue that a local OpenClaw cron job picks up

  audit(APP_ID, 'scrum.trigger_agent', { appId, appName, cronJobId });

  // Placeholder: return the constructed message for debugging
  // In production, this would actually spawn the agent via OpenClaw API
  return NextResponse.json({
    ok: true,
    message: 'Agent trigger queued',
    debug: {
      appId,
      appName,
      cronJobId,
      cronRunTs,
      agentMessage: message,
      nextStep:
        'Wire this to OpenClaw cron API or sessions_spawn to actually execute. For now, message is logged.',
    },
  });
}
