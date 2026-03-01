/**
 * OpenClaw Agent Runner Implementation
 * 
 * Uses the openclaw CLI to spawn isolated agent sessions.
 * This is the default/legacy implementation.
 */

import { spawn } from 'child_process';
import { AgentRunner, AgentTask, AgentSession } from '../agentRunner';

export class OpenClawRunner implements AgentRunner {
  readonly name = 'openclaw';
  readonly description = 'OpenClaw CLI (default)';

  async spawn(task: AgentTask, config?: Record<string, unknown>): Promise<AgentSession> {
    const args = [
      'cron', 'add',
      '--name', `autopilot-${task.appId}-${task.cronJobId}`,
      '--session', 'isolated',
      '--at', task.runAt,
      '--message', task.message,
      '--thinking', task.thinking || 'low',
      '--timeout-seconds', String(task.timeoutSeconds || 600),
      '--json',
    ];

    return new Promise((resolve, reject) => {
      const child = spawn('openclaw', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (d) => (stdout += d));
      child.stderr?.on('data', (d) => (stderr += d));

      child.on('close', (code) => {
        // Filter out config warnings from stderr
        const cleanStderr = stderr
          .split('\n')
          .filter((l) => !l.includes('Config was last written'))
          .join('\n')
          .trim();

        if (code !== 0) {
          reject(new Error(cleanStderr || `openclaw exited ${code}`));
          return;
        }

        try {
          const result = JSON.parse(stdout || '{}');
          resolve({
            sessionKey: result.sessionKey || result.session || result.id,
            cronJobId: result.id || task.cronJobId,
          });
        } catch (err) {
          reject(new Error(`Failed to parse openclaw response: ${err}`));
        }
      });
    });
  }

  async getSessionHistory(
    sessionKey: string
  ): Promise<Array<{ role: string; content?: string; timestamp?: string }>> {
    return new Promise((resolve, reject) => {
      const child = spawn('openclaw', ['sessions', 'history', sessionKey, '--json'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (d) => (stdout += d));
      child.stderr?.on('data', (d) => (stderr += d));

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `exit ${code}`));
          return;
        }
        try {
          const data = JSON.parse(stdout);
          resolve(data.messages || []);
        } catch {
          reject(new Error('parse error'));
        }
      });
    });
  }

  async checkCronJobExists(cronJobId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn('openclaw', ['cron', 'list', '--json'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      child.stdout?.on('data', (d) => (stdout += d));
      child.on('close', () => {
        try {
          const jobs = JSON.parse(stdout);
          const exists = Array.isArray(jobs) && jobs.some((j: { id?: string }) => j.id === cronJobId);
          resolve(exists);
        } catch {
          resolve(true); // Assume exists on error
        }
      });
    });
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    return new Promise((resolve) => {
      const child = spawn('openclaw', ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      child.stderr?.on('data', (d) => (stderr += d));
      child.on('close', (code) => {
        if (code !== 0) {
          resolve({ valid: false, error: 'openclaw CLI not found in PATH' });
        } else {
          resolve({ valid: true });
        }
      });
    });
  }
}
