import { dbExec, dbQuery } from '@/lib/db';

const APP_ID = 'scrum-board';

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'validating' | 'needs_input' | 'blocked' | 'done' | 'failed';
export type TaskPriority = 'low' | 'medium' | 'high';
export type SessionStatus = 'running' | 'completed' | 'failed' | 'blocked' | 'needs_input' | 'validating' | 'archived';

export function ensureScrumBoardSchema() {
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS boards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    )`
  );

  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      acceptance_criteria TEXT,
      status TEXT NOT NULL DEFAULT 'backlog',
      position INTEGER NOT NULL DEFAULT 0,
      priority TEXT NOT NULL DEFAULT 'medium',
      assignee TEXT,
      due_at TEXT,
      session_id TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      claimed_by TEXT,
      claimed_at TEXT,
      last_error TEXT,
      last_run_at TEXT,
      needs_input_questions TEXT,
      input_deadline_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      completed_at TEXT,
      FOREIGN KEY(board_id) REFERENCES boards(id)
    )`
  );

  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(task_id) REFERENCES tasks(id)
    )`
  );

  const cols = new Set(
    dbQuery<{ name: string }>(APP_ID, `SELECT name FROM pragma_table_info('tasks')`).map((c) => c.name)
  );

  if (!cols.has('position')) dbExec(APP_ID, `ALTER TABLE tasks ADD COLUMN position INTEGER NOT NULL DEFAULT 0`);
  if (!cols.has('assignee')) dbExec(APP_ID, `ALTER TABLE tasks ADD COLUMN assignee TEXT`);
  if (!cols.has('due_at')) dbExec(APP_ID, `ALTER TABLE tasks ADD COLUMN due_at TEXT`);
  if (!cols.has('acceptance_criteria')) dbExec(APP_ID, `ALTER TABLE tasks ADD COLUMN acceptance_criteria TEXT`);
  if (!cols.has('attempt_count')) dbExec(APP_ID, `ALTER TABLE tasks ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0`);
  if (!cols.has('max_attempts')) dbExec(APP_ID, `ALTER TABLE tasks ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3`);
  if (!cols.has('claimed_by')) dbExec(APP_ID, `ALTER TABLE tasks ADD COLUMN claimed_by TEXT`);
  if (!cols.has('claimed_at')) dbExec(APP_ID, `ALTER TABLE tasks ADD COLUMN claimed_at TEXT`);
  if (!cols.has('last_error')) dbExec(APP_ID, `ALTER TABLE tasks ADD COLUMN last_error TEXT`);
  if (!cols.has('last_run_at')) dbExec(APP_ID, `ALTER TABLE tasks ADD COLUMN last_run_at TEXT`);
  if (!cols.has('needs_input_questions')) dbExec(APP_ID, `ALTER TABLE tasks ADD COLUMN needs_input_questions TEXT`);
  if (!cols.has('input_deadline_at')) dbExec(APP_ID, `ALTER TABLE tasks ADD COLUMN input_deadline_at TEXT`);
  if (!cols.has('validation_rounds')) dbExec(APP_ID, `ALTER TABLE tasks ADD COLUMN validation_rounds INTEGER NOT NULL DEFAULT 0`);

  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_boards_app_id ON boards(app_id)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_tasks_board_status ON tasks(board_id, status)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_tasks_board_status_position ON tasks(board_id, status, position)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks(due_at)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_tasks_attempts ON tasks(attempt_count, max_attempts)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_comments_task_id ON comments(task_id)`);

  // Settings table for autopilot toggle and other config
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  );

  // Sessions table for agent run history
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      task_id INTEGER NOT NULL,
      cron_job_id TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      logs_url TEXT,
      final_output TEXT,
      created_at TEXT NOT NULL,
      archived_at TEXT,
      FOREIGN KEY(task_id) REFERENCES tasks(id)
    )`
  );
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_sessions_task_id ON sessions(task_id)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_sessions_archived_at ON sessions(archived_at)`);

  // Session logs table for streaming output
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS session_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      chunk TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )`
  );
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_session_logs_session_id ON session_logs(session_id)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_session_logs_created_at ON session_logs(created_at)`);

  // Agent lock table to ensure only one agent runs at a time
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS agent_locks (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      locked_at TEXT NOT NULL,
      task_id INTEGER,
      session_id TEXT,
      expires_at TEXT NOT NULL,
      FOREIGN KEY(task_id) REFERENCES tasks(id)
    )`
  );
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_agent_locks_expires ON agent_locks(expires_at)`);

  // Default autopilot enabled = true
  const autopilotEnabled = dbQuery<{ count: number }>(
    APP_ID,
    `SELECT COUNT(*) as count FROM settings WHERE key = 'autopilot_enabled'`
  )[0]?.count ?? 0;
  if (autopilotEnabled === 0) {
    dbExec(
      APP_ID,
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)`,
      ['autopilot_enabled', 'true', new Date().toISOString()]
    );
  }
}

export function getOrCreateBoardId(targetAppId: string): number {
  const appId = String(targetAppId || '').trim().slice(0, 64);
  if (!appId) throw new Error('appId required');

  const hit = dbQuery<{ id: number }>(APP_ID, `SELECT id FROM boards WHERE app_id = ? LIMIT 1`, [appId])[0];
  if (hit?.id) return Number(hit.id);

  dbExec(APP_ID, `INSERT INTO boards (app_id, created_at) VALUES (?, ?)`, [appId, new Date().toISOString()]);
  const row = dbQuery<{ id: number }>(APP_ID, `SELECT id FROM boards WHERE app_id = ? LIMIT 1`, [appId])[0];
  if (!row?.id) throw new Error('failed to create board');
  return Number(row.id);
}

export function normalizeStatus(v: unknown): TaskStatus {
  const x = String(v ?? '').trim().toLowerCase();
  if (
    x === 'backlog' ||
    x === 'todo' ||
    x === 'in_progress' ||
    x === 'validating' ||
    x === 'needs_input' ||
    x === 'blocked' ||
    x === 'done' ||
    x === 'failed'
  ) return x;
  return 'backlog';
}

export function normalizePriority(v: unknown): TaskPriority {
  const x = String(v ?? '').trim().toLowerCase();
  if (x === 'low' || x === 'medium' || x === 'high') return x;
  return 'medium';
}

export function getSetting(key: string): string | null {
  const row = dbQuery<{ value: string }>(
    APP_ID,
    `SELECT value FROM settings WHERE key = ? LIMIT 1`,
    [key]
  )[0];
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const now = new Date().toISOString();
  dbExec(
    APP_ID,
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, now]
  );
}

// Agent lock functions
export interface AgentLock {
  id: number;
  locked_at: string;
  task_id: number | null;
  session_id: string | null;
  expires_at: string;
}

/**
 * Get the current active lock if any.
 */
export function getActiveLock(): AgentLock | null {
  const now = new Date().toISOString();
  const row = dbQuery<AgentLock>(
    APP_ID,
    `SELECT * FROM agent_locks WHERE id = 1 AND expires_at > ? LIMIT 1`,
    [now]
  )[0];
  return row || null;
}

/**
 * Check if the agent is currently locked (busy).
 */
export function isAgentLocked(): boolean {
  return getActiveLock() !== null;
}

/**
 * Acquire an agent lock for a task.
 * @returns true if lock acquired, false if already locked
 */
export function acquireAgentLock(taskId: number, sessionId: string): boolean {
  const now = new Date().toISOString();
  // Lock expires after 30 minutes
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  // Check if there's already an active lock
  if (isAgentLocked()) {
    return false;
  }

  // Try to acquire lock
  try {
    dbExec(
      APP_ID,
      `INSERT INTO agent_locks (id, locked_at, task_id, session_id, expires_at) 
       VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE 
       SET locked_at = excluded.locked_at, 
           task_id = excluded.task_id, 
           session_id = excluded.session_id, 
           expires_at = excluded.expires_at`,
      [now, taskId, sessionId, expiresAt]
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Release the agent lock.
 */
export function releaseAgentLock(): void {
  dbExec(APP_ID, `DELETE FROM agent_locks WHERE id = 1`);
}

/**
 * Get task info for the currently locked task.
 */
export function getLockedTaskInfo(): { taskId: number; sessionId: string } | null {
  const lock = getActiveLock();
  if (!lock || !lock.task_id || !lock.session_id) return null;
  return { taskId: lock.task_id, sessionId: lock.session_id };
}

// Session functions
export interface Session {
  id: string;
  task_id: number;
  cron_job_id: string | null;
  started_at: string;
  ended_at: string | null;
  status: SessionStatus;
  logs_url: string | null;
  final_output: string | null;
  created_at: string;
  archived_at: string | null;
}

/**
 * Create a new session for a task.
 */
export function createSession(sessionId: string, taskId: number, cronJobId?: string): Session {
  const now = new Date().toISOString();
  dbExec(
    APP_ID,
    `INSERT INTO sessions (id, task_id, cron_job_id, started_at, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, taskId, cronJobId || null, now, 'running', now]
  );
  return {
    id: sessionId,
    task_id: taskId,
    cron_job_id: cronJobId || null,
    started_at: now,
    ended_at: null,
    status: 'running',
    logs_url: null,
    final_output: null,
    created_at: now,
    archived_at: null,
  };
}

/**
 * Get a session by ID.
 */
export function getSession(sessionId: string): Session | null {
  const row = dbQuery<Session>(
    APP_ID,
    `SELECT * FROM sessions WHERE id = ? LIMIT 1`,
    [sessionId]
  )[0];
  return row || null;
}

/**
 * Get all sessions for a task.
 */
export function getSessionsForTask(taskId: number): Session[] {
  return dbQuery<Session>(
    APP_ID,
    `SELECT * FROM sessions WHERE task_id = ? ORDER BY started_at DESC`,
    [taskId]
  );
}

/**
 * Update session status.
 */
export function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
  finalOutput?: string
): void {
  const now = new Date().toISOString();
  const isTerminal = ['completed', 'failed', 'blocked', 'needs_input', 'validating', 'archived'].includes(status);
  const endedAt = isTerminal ? now : null;

  dbExec(
    APP_ID,
    `UPDATE sessions
     SET status = ?, ended_at = COALESCE(?, ended_at), final_output = COALESCE(?, final_output), archived_at = ?
     WHERE id = ?`,
    [status, endedAt, finalOutput || null, status === 'archived' ? now : null, sessionId]
  );
}

/**
 * Archive sessions older than 30 days.
 */
export function archiveOldSessions(): number {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const result = dbExec(
    APP_ID,
    `UPDATE sessions
     SET status = 'archived', archived_at = ?
     WHERE status != 'archived' AND created_at < ?`,
    [new Date().toISOString(), thirtyDaysAgo]
  );
  // SQLite doesn't return affected rows directly, query for count
  const count = dbQuery<{ n: number }>(
    APP_ID,
    `SELECT COUNT(*) as n FROM sessions WHERE status = 'archived' AND archived_at > ?`,
    [new Date(Date.now() - 60 * 1000).toISOString()]
  )[0]?.n ?? 0;
  return count;
}

/**
 * Get recent sessions (non-archived).
 */
export function getRecentSessions(limit = 50): Session[] {
  return dbQuery<Session>(
    APP_ID,
    `SELECT * FROM sessions
     WHERE status != 'archived'
     ORDER BY started_at DESC
     LIMIT ?`,
    [limit]
  );
}
