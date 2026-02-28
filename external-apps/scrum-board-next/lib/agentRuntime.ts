export type SessionMessage = { role: string; content?: string; timestamp?: string };

export interface ScheduleOneShotInput {
  name: string;
  runAt: string;
  message: string;
  thinking?: 'low' | 'medium' | 'high';
  timeoutSeconds?: number;
  model?: string;
}

export interface ScheduleOneShotResult {
  ok: boolean;
  jobId?: string;
  sessionKey?: string;
  error?: string;
}

export interface CronRunEntry {
  ts?: number;
  action?: string;
  status?: string;
  summary?: string;
  sessionId?: string;
  sessionKey?: string;
  runAtMs?: number;
  durationMs?: number;
}

export interface AgentRuntime {
  id(): string;
  scheduleOneShot(input: ScheduleOneShotInput): Promise<ScheduleOneShotResult>;
  sessionHistory(sessionKey: string): Promise<{ ok: boolean; messages?: SessionMessage[]; error?: string }>;
  listCronJobs(): Promise<{ ok: boolean; ids?: string[]; error?: string }>;
  listCronRuns(jobId: string, limit?: number): Promise<{ ok: boolean; entries?: CronRunEntry[]; error?: string }>;
}
