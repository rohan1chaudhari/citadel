// Script to add roadmap tasks to scrum-board app
// Usage: node scripts/add-roadmap-tasks.mjs

import { DatabaseSync } from 'node:sqlite';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'apps', 'scrum-board', 'db.sqlite');

const db = new DatabaseSync(DB_PATH);
const TARGET_APP_ID = 'scrum-board'; // The app we're creating tasks for

// Ensure schema is set up first
function ensureSchema() {
  db.exec(
    `CREATE TABLE IF NOT EXISTS boards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    )`
  );

  db.exec(
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
      validation_rounds INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(board_id) REFERENCES boards(id)
    )`
  );
}

function getOrCreateBoardId(appId) {
  const hit = db.prepare(`SELECT id FROM boards WHERE app_id = ? LIMIT 1`).get(appId);
  if (hit?.id) return Number(hit.id);

  db.prepare(`INSERT INTO boards (app_id, created_at) VALUES (?, ?)`).run(appId, new Date().toISOString());
  const row = db.prepare(`SELECT id FROM boards WHERE app_id = ? LIMIT 1`).get(appId);
  return Number(row.id);
}

function getNextPosition(boardId, status) {
  const row = db.prepare(
    `SELECT COALESCE(MAX(position), -1) as p FROM tasks WHERE board_id = ? AND status = ?`
  ).get(boardId, status);
  return Number(row?.p ?? -1) + 1;
}

function createTask(boardId, title, description, acceptanceCriteria, priority = 'medium', status = 'backlog') {
  const now = new Date().toISOString();
  const position = getNextPosition(boardId, status);
  
  db.prepare(
    `INSERT INTO tasks (
      board_id, title, description, acceptance_criteria, status, position, priority,
      attempt_count, max_attempts, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    boardId, title, description, acceptanceCriteria, status, position, priority,
    0, 3, now, now
  );

  return db.prepare(`SELECT last_insert_rowid() as id`).get()?.id;
}

function taskExists(boardId, title) {
  const row = db.prepare(`SELECT id FROM tasks WHERE board_id = ? AND title = ? LIMIT 1`).get(boardId, title);
  return !!row;
}

// Roadmap tasks from v0.2, v0.3, v0.4
const roadmapTasks = [
  // v0.2 - Observability
  {
    title: 'Session history view',
    description: 'Create a browsable list of past sessions showing status, duration, and task link. This helps users understand what the autopilot has been working on.',
    acceptanceCriteria: '- New "History" tab or page in scrum-board\n- List all sessions with: task title, status, start/end time, duration\n- Click to view session details\n- Filter by status (completed, failed, waiting)',
    priority: 'high'
  },
  {
    title: 'Session summary',
    description: 'Generate a structured summary after each autopilot run showing what changed, files touched, and the result.',
    acceptanceCriteria: '- Store structured summary in sessions table\n- Show summary on task card after completion\n- Include: files modified, lines changed, key decisions\n- Viewable in session detail view',
    priority: 'high'
  },
  {
    title: 'Autopilot dashboard',
    description: 'Build a stats dashboard showing autopilot performance metrics.',
    acceptanceCriteria: '- Tasks completed (last 7/30 days)\n- Success rate percentage\n- Average session duration\n- Current queue depth (tasks in todo)\n- Visual charts/graphs',
    priority: 'medium'
  },
  {
    title: 'Failure diagnostics',
    description: 'Parse session logs for errors and surface them on the task card for quick debugging.',
    acceptanceCriteria: '- Parse logs for error patterns\n- Extract last error message\n- Show error indicator on task card\n- One-click view of error details',
    priority: 'high'
  },

  // v0.2 - Board UX
  {
    title: 'Due date indicators',
    description: 'Add overdue highlighting and sort overdue tasks to the top of their column.',
    acceptanceCriteria: '- Visual indicator (red badge/background) for overdue tasks\n- Sort overdue tasks to top of column\n- Show days overdue on task card\n- Works in all columns',
    priority: 'medium'
  },
  {
    title: 'Input deadline enforcement',
    description: 'Show countdown on waiting tasks and auto-expire past deadline.',
    acceptanceCriteria: '- Countdown timer displayed on waiting tasks\n- Visual warning when deadline approaching\n- Auto-move to failed/expired status after deadline\n- Configurable default deadline duration',
    priority: 'medium'
  },
  {
    title: 'Bulk actions',
    description: 'Enable multi-select for status change, delete, and priority update.',
    acceptanceCriteria: '- Checkbox on each task card for selection\n- Select all/none options\n- Bulk actions: change status, delete, update priority\n- Confirmation modal for destructive actions',
    priority: 'low'
  },
  {
    title: 'Done column cleanup',
    description: 'Auto-archive old done tasks and make the done column collapsible.',
    acceptanceCriteria: '- Auto-archive tasks in done > 30 days\n- Collapsible done column\n- Show archive count\n- Option to view archived tasks',
    priority: 'low'
  },
  {
    title: 'Board keyboard shortcuts',
    description: 'Add keyboard navigation for power users.',
    acceptanceCriteria: '- n = create new task\n- j/k = navigate up/down\n- enter = open selected task\n- esc = close modal\n- Show shortcut hints in UI',
    priority: 'low'
  },

  // v0.2 - Code Quality
  {
    title: 'Split ScrumBoardClient component',
    description: 'Break the monolithic ScrumBoardClient into smaller, focused components.',
    acceptanceCriteria: '- Extract BoardColumn component\n- Extract TaskCard component\n- Extract TaskModal component\n- Extract DragDropContext wrapper\n- No functionality change, just code organization',
    priority: 'medium'
  },
  {
    title: 'Optimistic UI updates',
    description: 'Patch local state immediately on user actions, revert on error.',
    acceptanceCriteria: '- Optimistic updates for: drag-drop, status change, priority change\n- Immediate visual feedback\n- Rollback on API error\n- Loading state for in-flight requests',
    priority: 'medium'
  },

  // v0.3 - Task Graph
  {
    title: 'Task dependencies',
    description: 'Add blocked_by support so blocked tasks cannot be picked by autopilot.',
    acceptanceCriteria: '- New task_dependencies table\n- UI to set blocked_by relationships\n- Visual indicator for blocked tasks\n- Autopilot skips blocked tasks\n- Circular dependency detection',
    priority: 'high'
  },
  {
    title: 'Task chaining',
    description: 'Auto-queue newly unblocked tasks when their dependency completes.',
    acceptanceCriteria: '- When task moves to done, check for tasks blocked by it\n- Auto-move unblocked tasks from backlog to todo\n- Notification/indicator of auto-queued tasks',
    priority: 'medium'
  },
  {
    title: 'Subtask decomposition',
    description: 'Support splitting tasks into subtasks with parent resolution when children are done.',
    acceptanceCriteria: '- Subtasks stored as separate tasks with parent_id\n- Parent task shows progress (3/5 subtasks done)\n- Parent auto-resolves when all children done\n- Subtasks appear indented under parent',
    priority: 'medium'
  },

  // v0.3 - Agent Intelligence
  {
    title: 'Multi-round validation',
    description: 'Support rejecting work and sending back to in_progress with feedback for agent iteration.',
    acceptanceCriteria: '- Reject button in review stage\n- Feedback form for rejection reason\n- Task returns to in_progress with feedback\n- Agent sees rejection count and previous feedback\n- Max rejection limit before human takeover',
    priority: 'high'
  },
  {
    title: 'Acceptance criteria checks',
    description: 'Agent parses criteria into assertions and reports pass/fail.',
    acceptanceCriteria: '- Agent parses acceptance_criteria field\n- Generates pass/fail report\n- Shows which criteria passed/failed\n- Structured output in task comments',
    priority: 'high'
  },
  {
    title: 'Auto-plan generation',
    description: 'Generate a plan document when task moves to todo (if none exists).',
    acceptanceCriteria: '- Trigger on status change to todo\n- AI generates step-by-step plan\n- Store in plans table\n- Display plan in task modal\n- Editable by human before autopilot runs',
    priority: 'medium'
  },
  {
    title: 'Agent memory',
    description: 'Persist context summary between sessions for the same app.',
    acceptanceCriteria: '- Store context summary per app after each session\n- Include in prompt for new sessions on same app\n- Configurable max context length\n- Option to clear/reset context',
    priority: 'low'
  },

  // v0.3 - Configuration
  {
    title: 'Configurable autopilot strategy',
    description: 'Allow customization of max tasks per cycle, selection policy, and retry policy.',
    acceptanceCriteria: '- Settings UI for autopilot config\n- Max tasks per cycle setting\n- Selection policy: oldest first, priority first, random\n- Retry policy: immediate, backoff, manual\n- Stored in settings table',
    priority: 'medium'
  },
  {
    title: 'Token usage tracking',
    description: 'Log tokens per session and show cumulative cost.',
    acceptanceCriteria: '- Track input/output tokens per session\n- Store in sessions table\n- Show cost estimate on dashboard\n- Monthly usage summary',
    priority: 'low'
  },

  // v0.4 - Onboarding
  {
    title: 'Comprehensive README with screenshots',
    description: 'Create user-friendly documentation with visual guides.',
    acceptanceCriteria: '- Screenshots of all major features\n- Setup guide with step-by-step instructions\n- Configuration reference\n- Troubleshooting section\n- GIFs for interactive features',
    priority: 'medium'
  },
  {
    title: 'First-launch setup wizard',
    description: 'Guide new users through API key and agent runner configuration.',
    acceptanceCriteria: '- Welcome modal on first visit\n- Step-by-step setup flow\n- API key input with validation\n- Agent runner selection\n- Test connection button',
    priority: 'medium'
  },

  // v0.4 - UI
  {
    title: 'Theme support',
    description: 'Respect host dark/light theme, remove hardcoded colors.',
    acceptanceCriteria: '- Use CSS variables for all colors\n- Auto-detect system theme preference\n- Manual theme toggle\n- All components respect theme\n- No hardcoded hex colors in components',
    priority: 'medium'
  },
  {
    title: 'Board filters and search',
    description: 'Filter by assignee, priority, date with full-text search.',
    acceptanceCriteria: '- Filter dropdowns: assignee, priority, status\n- Date range filter\n- Full-text search in title/description\n- Clear all filters button\n- URL-synced filter state',
    priority: 'medium'
  },
  {
    title: 'Activity timeline',
    description: 'Chronological view of all state changes per task.',
    acceptanceCriteria: '- New "Activity" tab in task modal\n- Shows: status changes, comments, assignments\n- Timestamp for each event\n- Who/what triggered each change',
    priority: 'low'
  },
  {
    title: 'Comment attribution styling',
    description: 'Distinct styling for human vs autopilot vs system comments.',
    acceptanceCriteria: '- Human: standard bubble style\n- Autopilot: distinct color/icon\n- System: muted/grey style\n- Author type stored with comment',
    priority: 'low'
  },

  // v0.4 - Data
  {
    title: 'Task templates',
    description: 'Save reusable task structures for bug fix, new feature, refactor.',
    acceptanceCriteria: '- Template storage (localStorage or DB)\n- Pre-built templates: Bug, Feature, Refactor\n- Create task from template\n- Save current task as template\n- Template management UI',
    priority: 'low'
  },
  {
    title: 'Export/import board',
    description: 'Export and import boards as JSON/CSV.',
    acceptanceCriteria: '- Export to JSON (full data)\n- Export to CSV (tasks only)\n- Import from JSON\n- Validation on import\n- Merge or replace option',
    priority: 'low'
  },

  // v0.4 - Resilience & Integration
  {
    title: 'Offline resilience',
    description: 'Board works without AI when no API key is configured.',
    acceptanceCriteria: '- Graceful degradation when AI unavailable\n- Clear messaging about missing config\n- Manual task management still works\n- Prompt to configure when trying AI features',
    priority: 'medium'
  },
  {
    title: 'Notification hooks',
    description: 'Emit events on state changes for webhook integration.',
    acceptanceCriteria: '- Event types: task.created, task.updated, task.done, etc.\n- Webhook URL configuration\n- Retry logic for failed webhooks\n- Event payload schema documented\n- Local event log for debugging',
    priority: 'low'
  }
];

// Main execution
console.log('Adding roadmap tasks to scrum-board...\n');

ensureSchema();
const boardId = getOrCreateBoardId(TARGET_APP_ID);
console.log(`Using board_id: ${boardId} for app: ${TARGET_APP_ID}\n`);

let added = 0;
let skipped = 0;

for (const task of roadmapTasks) {
  // Check if task with same title already exists
  if (taskExists(boardId, task.title)) {
    console.log(`  ⚠️  Skipped (exists): ${task.title}`);
    skipped++;
    continue;
  }

  const id = createTask(
    boardId,
    task.title,
    task.description,
    task.acceptanceCriteria,
    task.priority,
    'backlog'
  );
  console.log(`  ✅ Added [${task.priority}]: ${task.title}`);
  added++;
}

console.log(`\nDone! Added: ${added}, Skipped: ${skipped}, Total: ${roadmapTasks.length}`);
db.close();
