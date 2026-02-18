import { dbExec, dbQuery } from '@/lib/db';

const APP_ID = 'scrum-board';

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done';
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
      status TEXT NOT NULL DEFAULT 'backlog',
      priority TEXT NOT NULL DEFAULT 'medium',
      assignee TEXT,
      session_id TEXT,
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
  if (!cols.has('assignee')) dbExec(APP_ID, `ALTER TABLE tasks ADD COLUMN assignee TEXT`);

  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_boards_app_id ON boards(app_id)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_tasks_board_status ON tasks(board_id, status)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_comments_task_id ON comments(task_id)`);
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
  if (x === 'backlog' || x === 'todo' || x === 'in_progress' || x === 'done') return x;
  return 'backlog';
}

export function normalizePriority(v: unknown): TaskPriority {
  const x = String(v ?? '').trim().toLowerCase();
  if (x === 'low' || x === 'medium' || x === 'high') return x;
  return 'medium';
}
