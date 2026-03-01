/**
 * Agent Runner Interface
 * 
 * Abstraction layer for different agent implementations.
 * Allows swapping between OpenClaw, Claude Code, custom scripts, etc.
 */

export interface AgentTask {
  message: string;
  appId: string;
  appName: string;
  cronJobId: string;
  sessionId: string;
  repoPath: string;
  runAt: string;
  timeoutSeconds?: number;
  thinking?: 'low' | 'medium' | 'high';
}

export interface AgentSession {
  sessionKey: string;
  cronJobId: string;
}

export interface AgentRunner {
  readonly name: string;
  readonly description: string;
  
  /**
   * Spawn an agent session with the given task.
   * Returns the session key for polling/monitoring.
   */
  spawn(task: AgentTask, config?: Record<string, unknown>): Promise<AgentSession>;
  
  /**
   * Get session history/messages.
   */
  getSessionHistory(sessionKey: string): Promise<Array<{ role: string; content?: string; timestamp?: string }>>;
  
  /**
   * Check if a cron job still exists (for detecting completion).
   */
  checkCronJobExists(cronJobId: string): Promise<boolean>;
  
  /**
   * Validate that this runner is properly configured.
   */
  validateConfig(): Promise<{ valid: boolean; error?: string }>;
}

/**
 * Configuration for agent runners from settings.
 */
export interface AgentRunnerConfig {
  runner: 'openclaw' | 'claude-code' | 'script' | string;
  /**
   * Provider-specific settings (e.g., API keys, paths).
   * Stored as JSON string in settings.
   */
  config?: Record<string, unknown>;
}
