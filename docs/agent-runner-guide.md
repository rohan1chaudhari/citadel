# Agent Runner Implementation Guide

This document explains how to implement custom agent runners for Citadel's autopilot system.

## Overview

Citadel supports pluggable agent runners that determine how autopilot tasks are executed. The default runner uses OpenClaw, but you can implement custom runners to use other agents like Claude Code or custom scripts.

## Available Runners

| Runner | Description | Configuration |
|--------|-------------|---------------|
| `openclaw` | OpenClaw CLI (default) | No config required |
| `claude-code` | Anthropic's Claude Code | Requires `ANTHROPIC_API_KEY` env var |
| `script` | Custom executable script | Requires `agent_runner_config.scriptPath` |

## Configuration

Set the active runner in the scrum-board settings:

```bash
# Via SQL
sqlite3 data/apps/scrum-board/db.sqlite \
  "INSERT INTO settings (key, value, updated_at) VALUES ('agent_runner', 'claude-code', datetime('now'));"
```

Or via the settings UI when available.

### Runner-Specific Config

For runners that need additional configuration, use `agent_runner_config`:

```json
{
  "scriptPath": "/path/to/custom-runner.sh",
  "inputMode": "stdin",
  "workingDir": "/home/user/citadel",
  "timeout": 600
}
```

## Implementing a Custom Runner

To create a custom runner:

### 1. Create the Runner Class

Create a new file in `host/src/lib/agentRunners/myRunner.ts`:

```typescript
import { spawn } from 'child_process';
import { AgentRunner, AgentTask, AgentSession } from '../agentRunner';

export class MyRunner implements AgentRunner {
  readonly name = 'my-runner';
  readonly description = 'My Custom Runner';

  async spawn(task: AgentTask, config?: Record<string, unknown>): Promise<AgentSession> {
    // Implement your agent spawning logic here
    // Return a session key for polling
    return {
      sessionKey: `my-${task.sessionId}`,
      cronJobId: task.cronJobId,
    };
  }

  async getSessionHistory(sessionKey: string): Promise<Array<{ role: string; content?: string; timestamp?: string }>> {
    // Return message history for the session
    return [];
  }

  async checkCronJobExists(cronJobId: string): Promise<boolean> {
    // Return true if job is still running
    return true;
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    // Validate that the runner is properly configured
    return { valid: true };
  }
}
```

### 2. Register the Runner

Add your runner to `host/src/lib/agentRunners/index.ts`:

```typescript
import { MyRunner } from './myRunner';

const runnerRegistry = new Map<string, new () => AgentRunner>([
  ['openclaw', OpenClawRunner],
  ['claude-code', ClaudeCodeRunner],
  ['script', ScriptRunner],
  ['my-runner', MyRunner],  // Add your runner here
]);
```

### 3. Rebuild

```bash
cd host && npm run build
```

### 4. Configure

Set your runner as active:

```bash
sqlite3 data/apps/scrum-board/db.sqlite \
  "UPDATE settings SET value = 'my-runner' WHERE key = 'agent_runner';"
```

## The AgentTask Interface

```typescript
interface AgentTask {
  message: string;        // The full task message/prompt
  appId: string;          // Target app ID
  appName: string;        // Target app name
  cronJobId: string;      // Unique job ID
  sessionId: string;      // Session tracking ID
  repoPath: string;       // Repository path
  runAt: string;          // Scheduled run time (ISO)
  timeoutSeconds?: number; // Max execution time
  thinking?: 'low' | 'medium' | 'high'; // Reasoning level
}
```

## The AgentSession Interface

```typescript
interface AgentSession {
  sessionKey: string;     // Key for polling/monitoring
  cronJobId: string;      // Job ID for completion detection
}
```

## Best Practices

1. **Validate Early**: Check configuration in `validateConfig()` before spawning
2. **Handle Timeouts**: Implement timeout logic to prevent runaway processes
3. **Stream Logs**: When possible, stream output to session_logs for debugging
4. **Error Handling**: Return clear error messages for configuration issues
5. **Environment Variables**: Pass necessary env vars (API keys, paths) to the spawned process

## Example: HTTP API Runner

Here's a complete example that sends tasks to an HTTP endpoint:

```typescript
import { AgentRunner, AgentTask, AgentSession } from '../agentRunner';

export class HttpRunner implements AgentRunner {
  readonly name = 'http';
  readonly description = 'HTTP API Runner';

  async spawn(task: AgentTask, config?: Record<string, unknown>): Promise<AgentSession> {
    const endpoint = config?.endpoint as string;
    const apiKey = config?.apiKey as string || process.env.RUNNER_API_KEY;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        message: task.message,
        appId: task.appId,
        sessionId: task.sessionId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return {
      sessionKey: data.sessionId || task.sessionId,
      cronJobId: task.cronJobId,
    };
  }

  async getSessionHistory(sessionKey: string): Promise<Array<{ role: string; content?: string }>> {
    // Poll your API for messages
    return [];
  }

  async checkCronJobExists(cronJobId: string): Promise<boolean> {
    // Check with your API
    return true;
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    if (!process.env.RUNNER_API_KEY) {
      return { valid: false, error: 'RUNNER_API_KEY not set' };
    }
    return { valid: true };
  }
}
```
