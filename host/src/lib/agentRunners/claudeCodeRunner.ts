/**
 * Claude Code Agent Runner Implementation
 * 
 * Uses Anthropic's Claude Code CLI for agent execution.
 * Requires `claude` CLI to be installed and configured.
 */

import { spawn } from 'child_process';
import { AgentRunner, AgentTask, AgentSession } from '../agentRunner';

export class ClaudeCodeRunner implements AgentRunner {
  readonly name = 'claude-code';
  readonly description = 'Claude Code CLI (Anthropic)';

  async spawn(task: AgentTask, config?: Record<string, unknown>): Promise<AgentSession> {
    const workingDir = config?.workingDir as string || task.repoPath;
    
    // Claude Code uses a different invocation pattern
    // It runs interactively, so we need to write the task to a file
    // and have claude read/execute it
    const taskFile = `/tmp/claude-task-${task.sessionId}.md`;
    
    return new Promise((resolve, reject) => {
      // Write task to file for claude to read
      const fs = require('fs');
      fs.writeFileSync(taskFile, task.message);

      // Spawn claude with the task file
      const args = [
        '--cwd', workingDir,
        '--no-git',
        '--message-file', taskFile,
      ];

      // Claude Code doesn't have a --json flag, so we capture differently
      const child = spawn('claude', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
        },
      });

      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (d) => (stdout += d));
      child.stderr?.on('data', (d) => (stderr += d));

      child.on('close', (code) => {
        // Clean up task file
        try { fs.unlinkSync(taskFile); } catch {}

        // Claude Code doesn't have a job ID system like openclaw
        // We use our session ID as the handle
        resolve({
          sessionKey: task.sessionId,
          cronJobId: task.cronJobId,
        });
      });

      // For long-running tasks, resolve immediately and let polling handle it
      setTimeout(() => {
        resolve({
          sessionKey: task.sessionId,
          cronJobId: task.cronJobId,
        });
      }, 5000);
    });
  }

  async getSessionHistory(
    sessionKey: string
  ): Promise<Array<{ role: string; content?: string; timestamp?: string }>> {
    // Claude Code doesn't expose session history directly
    // Return empty - logs are captured via file/stderr
    return [];
  }

  async checkCronJobExists(cronJobId: string): Promise<boolean> {
    // Claude Code doesn't have a cron job system
    // Always return true to prevent premature completion detection
    return true;
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    return new Promise((resolve) => {
      // Check if ANTHROPIC_API_KEY is set
      if (!process.env.ANTHROPIC_API_KEY) {
        resolve({ valid: false, error: 'ANTHROPIC_API_KEY environment variable not set' });
        return;
      }

      const child = spawn('claude', ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      child.stderr?.on('data', (d) => (stderr += d));
      child.on('close', (code) => {
        if (code !== 0) {
          resolve({ valid: false, error: 'claude CLI not found in PATH. Install with: npm install -g @anthropic-ai/claude-code' });
        } else {
          resolve({ valid: true });
        }
      });
    });
  }
}
