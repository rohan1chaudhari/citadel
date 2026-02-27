export type SessionMessage = { role: string; content?: string; timestamp?: string };

export interface ScheduleOneShotInput {
  name: string;
  runAt: string;
  message: string;
  thinking?: 'low' | 'medium' | 'high';
  timeoutSeconds?: number;
}

export interface ScheduleOneShotResult {
  ok: boolean;
  jobId?: string;
  sessionKey?: string;
  error?: string;
}

export interface AgentRuntime {
  id(): string;
  scheduleOneShot(input: ScheduleOneShotInput): Promise<ScheduleOneShotResult>;
  sessionHistory(sessionKey: string): Promise<{ ok: boolean; messages?: SessionMessage[]; error?: string }>;
  listCronJobs(): Promise<{ ok: boolean; ids?: string[]; error?: string }>;
}
