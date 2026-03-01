/**
 * Agent Runner Factory
 * 
 * Creates the appropriate runner based on configuration.
 */

import { AgentRunner, AgentRunnerConfig } from '../agentRunner';
import { OpenClawRunner } from './openclawRunner';
import { ClaudeCodeRunner } from './claudeCodeRunner';
import { ScriptRunner } from './scriptRunner';

// Registry of available runners
const runnerRegistry = new Map<string, new () => AgentRunner>([
  ['openclaw', OpenClawRunner],
  ['claude-code', ClaudeCodeRunner],
  ['script', ScriptRunner],
]);

/**
 * Register a custom runner class.
 */
export function registerRunner(name: string, runnerClass: new () => AgentRunner): void {
  runnerRegistry.set(name, runnerClass);
}

/**
 * Get a runner instance by name.
 */
export function getRunner(name: string): AgentRunner {
  const RunnerClass = runnerRegistry.get(name);
  if (!RunnerClass) {
    throw new Error(`Unknown agent runner: "${name}". Available: ${Array.from(runnerRegistry.keys()).join(', ')}`);
  }
  return new RunnerClass();
}

/**
 * Get the default runner (openclaw).
 */
export function getDefaultRunner(): AgentRunner {
  return new OpenClawRunner();
}

/**
 * List all available runner names and descriptions.
 */
export function listRunners(): Array<{ name: string; description: string }> {
  return Array.from(runnerRegistry.entries()).map(([name, RunnerClass]) => {
    const instance = new RunnerClass();
    return { name, description: instance.description };
  });
}

/**
 * Validate a runner configuration.
 */
export async function validateRunner(config: AgentRunnerConfig): Promise<{ valid: boolean; error?: string }> {
  try {
    const runner = getRunner(config.runner);
    return await runner.validateConfig();
  } catch (err) {
    return { valid: false, error: String(err) };
  }
}

export { OpenClawRunner, ClaudeCodeRunner, ScriptRunner };
export type { AgentRunner, AgentRunnerConfig };
