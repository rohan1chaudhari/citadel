/**
 * Script Agent Runner Implementation
 * 
 * Executes a custom script as the agent runner.
 * The script receives the task message via stdin or environment variable.
 */

import { spawn } from 'child_process';
import { AgentRunner, AgentTask, AgentSession } from '../agentRunner';

export interface ScriptRunnerConfig {
  /** Path to the script to execute */
  scriptPath: string;
  /** How to pass the task: 'stdin' | 'env' | 'file' */
  inputMode?: 'stdin' | 'env' | 'file';
  /** Working directory for the script */
  workingDir?: string;
  /** Timeout in seconds */
  timeout?: number;
  /** Extra environment variables */
  env?: Record<string, string>;
}

export class ScriptRunner implements AgentRunner {
  readonly name = 'script';
  readonly description = 'Custom script runner';

  async spawn(task: AgentTask, config?: Record<string, unknown>): Promise<AgentSession> {
    const scriptConfig: ScriptRunnerConfig = {
      scriptPath: config?.scriptPath as string,
      inputMode: (config?.inputMode as ScriptRunnerConfig['inputMode']) || 'stdin',
      workingDir: (config?.workingDir as string) || task.repoPath,
      timeout: (config?.timeout as number) || task.timeoutSeconds || 600,
      env: (config?.env as Record<string, string>) || {},
    };

    if (!scriptConfig.scriptPath) {
      throw new Error('Script path not configured. Set agent_runner_config.scriptPath in settings.');
    }

    return new Promise((resolve, reject) => {
      const fs = require('fs');
      const path = require('path');

      // Verify script exists
      if (!fs.existsSync(scriptConfig.scriptPath!)) {
        reject(new Error(`Script not found: ${scriptConfig.scriptPath}`));
        return;
      }

      // Prepare input based on mode
      let inputData: string | undefined;
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        ...scriptConfig.env,
        AUTOPILOT_APP_ID: task.appId,
        AUTOPILOT_APP_NAME: task.appName,
        AUTOPILOT_SESSION_ID: task.sessionId,
        AUTOPILOT_CRON_JOB_ID: task.cronJobId,
        AUTOPILOT_REPO_PATH: task.repoPath,
      };

      if (scriptConfig.inputMode === 'file') {
        const taskFile = `/tmp/autopilot-task-${task.sessionId}.md`;
        fs.writeFileSync(taskFile, task.message);
        env.AUTOPILOT_TASK_FILE = taskFile;
      } else if (scriptConfig.inputMode === 'stdin') {
        inputData = task.message;
      } else {
        env.AUTOPILOT_TASK_MESSAGE = task.message;
      }

      // Spawn the script
      const child = spawn(scriptConfig.scriptPath!, [], {
        cwd: scriptConfig.workingDir,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (d) => (stdout += d));
      child.stderr?.on('data', (d) => (stderr += d));

      if (inputData) {
        child.stdin?.write(inputData);
        child.stdin?.end();
      }

      // Set timeout
      const timeoutMs = (scriptConfig.timeout || 600) * 1000;
      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Script timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.on('close', (code) => {
        clearTimeout(timeoutId);

        // Clean up task file if used
        if (scriptConfig.inputMode === 'file') {
          try { fs.unlinkSync(env.AUTOPILOT_TASK_FILE!); } catch {}
        }

        // Script runner completes synchronously
        // Return session info for logging purposes
        resolve({
          sessionKey: task.sessionId,
          cronJobId: task.cronJobId,
        });
      });

      // Resolve early for async scripts
      setTimeout(() => {
        resolve({
          sessionKey: task.sessionId,
          cronJobId: task.cronJobId,
        });
      }, 1000);
    });
  }

  async getSessionHistory(
    sessionKey: string
  ): Promise<Array<{ role: string; content?: string; timestamp?: string }>> {
    // Script runner doesn't have built-in session history
    // Logs should be captured via file/stderr
    return [];
  }

  async checkCronJobExists(cronJobId: string): Promise<boolean> {
    // Script runner doesn't have a cron job system
    return true;
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    const config = await this.getConfig();
    
    if (!config.scriptPath) {
      return { valid: false, error: 'Script path not configured. Set agent_runner_config.scriptPath in settings.' };
    }

    const fs = require('fs');
    if (!fs.existsSync(config.scriptPath)) {
      return { valid: false, error: `Script not found: ${config.scriptPath}` };
    }

    // Check if script is executable
    try {
      fs.accessSync(config.scriptPath, fs.constants.X_OK);
    } catch {
      return { valid: false, error: `Script is not executable: ${config.scriptPath}` };
    }

    return { valid: true };
  }

  private async getConfig(): Promise<ScriptRunnerConfig> {
    // This would read from settings in a real implementation
    return {
      scriptPath: process.env.AUTOPILOT_SCRIPT_PATH || '',
    };
  }
}
