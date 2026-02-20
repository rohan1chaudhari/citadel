import { dbExec, dbQuery } from '@/lib/db';

const APP_ID = 'scrum-board';

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'needs_input' | 'blocked' | 'done' | 'failed';
export type TaskPriority = 'low' | 'medium' | 'high';

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
