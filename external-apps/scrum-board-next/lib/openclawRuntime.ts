import { spawn } from 'child_process';
import type { AgentRuntime, ScheduleOneShotInput, ScheduleOneShotResult, SessionMessage, CronRunEntry } from '@/lib/agentRuntime';

type CmdResult = { code: number; stdout: string; stderr: string };

function runOpenclaw(args: string[]): Promise<CmdResult> {
  return new Promise((resolve) => {
    const child = spawn('openclaw', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => (stdout += d));
    child.stderr?.on('data', (d) => (stderr += d));
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

function cleanStderr(stderr: string): string {
  return stderr
    .split('\n')
    .filter((l) => !l.includes('Config was last written'))
    .join('\n')
    .trim();
}

export class OpenClawRuntime implements AgentRuntime {
  id(): string {
    return 'openclaw';
  }

  async scheduleOneShot(input: ScheduleOneShotInput): Promise<ScheduleOneShotResult> {
    const args = [
      'cron', 'add',
      '--name', input.name,
      '--session', 'isolated',
      '--at', input.runAt,
      '--message', input.message,
      '--thinking', input.thinking ?? 'low',
      '--timeout-seconds', String(input.timeoutSeconds ?? 600),
      '--json',
    ];
    if (input.model) {
      args.splice(args.length - 1, 0, '--model', input.model);
    }

    const result = await runOpenclaw(args);
    if (result.code !== 0) {
      return { ok: false, error: cleanStderr(result.stderr) || `openclaw exited ${result.code}` };
    }

    try {
      const data = JSON.parse(result.stdout || '{}');
      return {
        ok: true,
        jobId: data.id || data.jobId,
        sessionKey: data.sessionKey || data.session || data.id,
      };
    } catch {
      return { ok: false, error: 'invalid JSON from openclaw cron add' };
    }
  }

  async sessionHistory(sessionKey: string): Promise<{ ok: boolean; messages?: SessionMessage[]; error?: string }> {
    const result = await runOpenclaw(['sessions', 'history', sessionKey, '--json']);
    if (result.code !== 0) {
      return { ok: false, error: cleanStderr(result.stderr) || `exit ${result.code}` };
    }

    try {
      const data = JSON.parse(result.stdout || '{}');
      return { ok: true, messages: Array.isArray(data.messages) ? data.messages : [] };
    } catch {
      return { ok: false, error: 'parse error' };
    }
  }

  async listCronJobs(): Promise<{ ok: boolean; ids?: string[]; error?: string }> {
    const result = await runOpenclaw(['cron', 'list', '--json']);
    if (result.code !== 0) {
      return { ok: false, error: cleanStderr(result.stderr) || `exit ${result.code}` };
    }

    try {
      const data = JSON.parse(result.stdout || '{}');
      const jobs = Array.isArray(data) ? data : (Array.isArray(data?.jobs) ? data.jobs : []);
      const ids = jobs.map((j: any) => String(j?.id ?? '')).filter(Boolean);
      return { ok: true, ids };
    } catch {
      return { ok: false, error: 'parse error' };
    }
  }

  async listCronRuns(jobId: string, limit = 10): Promise<{ ok: boolean; entries?: CronRunEntry[]; error?: string }> {
    const result = await runOpenclaw(['cron', 'runs', '--id', jobId, '--limit', String(limit)]);
    if (result.code !== 0) {
      return { ok: false, error: cleanStderr(result.stderr) || `exit ${result.code}` };
    }
    try {
      const data = JSON.parse(result.stdout || '{}');
      const entries = Array.isArray(data?.entries) ? data.entries : [];
      return { ok: true, entries };
    } catch {
      return { ok: false, error: 'parse error' };
    }
  }
}
