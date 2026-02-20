/**
 * Autopilot API Client
 * 
 * REST API wrapper for scrum-board operations.
 * Use these helpers instead of direct SQL to ensure proper lock management
 * and business logic enforcement.
 */

const BASE_URL = process.env.CITADEL_HOST_URL || 'http://localhost:3000';
const API_PREFIX = '/api/apps/scrum-board';

export interface Task {
  id: number;
  board_id: number;
  title: string;
  description: string | null;
  acceptance_criteria: string | null;
  status: TaskStatus;
  position: number;
  priority: TaskPriority;
  assignee: string | null;
  due_at: string | null;
  session_id: string | null;
  attempt_count: number;
  max_attempts: number;
  claimed_by: string | null;
  claimed_at: string | null;
  last_error: string | null;
  last_run_at: string | null;
  needs_input_questions: string | null;
  input_deadline_at: string | null;
  created_at: string;
  updated_at: string | null;
  completed_at: string | null;
  validation_rounds: number;
  comment_count: number;
}

export type TaskStatus = 
  | 'backlog' 
  | 'todo' 
  | 'in_progress' 
  | 'validating' 
  | 'needs_input' 
  | 'blocked' 
  | 'done' 
  | 'failed';

export type TaskPriority = 'low' | 'medium' | 'high';

export interface TasksResponse {
  ok: boolean;
  appId: string;
  boardId: number;
  tasks: Task[];
  error?: string;
}

export interface TaskUpdateResponse {
  ok: boolean;
  error?: string;
}

export interface CommentResponse {
  ok: boolean;
  id?: number;
  error?: string;
}

export interface LockStatusResponse {
  ok: boolean;
  locked: boolean;
  lock: {
    locked_at: string;
    task_id: number;
    session_id: string;
    expires_at: string;
  } | null;
}

// Helper to construct full URL
function apiUrl(path: string): string {
  return `${BASE_URL}${API_PREFIX}${path}`;
}

/**
 * Fetch all tasks for a specific app.
 * Returns tasks sorted by status and priority.
 */
export async function fetchTasks(appId: string): Promise<TasksResponse> {
  const response = await fetch(apiUrl(`/tasks?app=${encodeURIComponent(appId)}`), {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    return { ok: false, appId, boardId: 0, tasks: [], error: `HTTP ${response.status}: ${text}` };
  }

  return response.json();
}

/**
 * Fetch eligible tasks (todo status with attempts remaining) for an app.
 * Sorted by priority (high → medium → low) and creation date.
 */
export async function fetchEligibleTasks(appId: string): Promise<Task[]> {
  const result = await fetchTasks(appId);
  if (!result.ok) return [];
  
  return result.tasks.filter(
    t => t.status === 'todo' && t.attempt_count < t.max_attempts
  );
}

/**
 * Get the highest priority eligible task for an app.
 * Returns null if no eligible tasks exist.
 */
export async function getHighestPriorityTask(appId: string): Promise<Task | null> {
  const eligible = await fetchEligibleTasks(appId);
  if (eligible.length === 0) return null;
  
  // Already sorted by priority and date from API
  return eligible[0];
}

/**
 * Update a task. Use this for status changes, claiming, and completion.
 * Automatically releases agent lock when moving to terminal states.
 */
export async function updateTask(
  taskId: number,
  updates: Partial<{
    title: string;
    description: string;
    acceptance_criteria: string;
    status: TaskStatus;
    priority: TaskPriority;
    assignee: string;
    due_at: string;
    session_id: string;
    attempt_count: number;
    max_attempts: number;
    claimed_by: string;
    claimed_at: string;
    last_error: string;
    last_run_at: string;
    needs_input_questions: string;
    input_deadline_at: string;
    validation_rounds: number;
    comment: string; // Add a comment alongside the update
  }>
): Promise<TaskUpdateResponse> {
  const response = await fetch(apiUrl('/tasks'), {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ id: taskId, ...updates }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    return { ok: false, error: `HTTP ${response.status}: ${text}` };
  }

  return response.json();
}

/**
 * Claim a task for autopilot processing.
 * Sets status to 'in_progress' and records claim metadata.
 */
export async function claimTask(
  taskId: number,
  sessionId: string
): Promise<TaskUpdateResponse> {
  return updateTask(taskId, {
    status: 'in_progress',
    claimed_by: 'autopilot',
    claimed_at: new Date().toISOString(),
    last_run_at: new Date().toISOString(),
    session_id: sessionId,
  });
}

/**
 * Mark a task as completed.
 * Automatically releases agent lock via API.
 */
export async function completeTask(
  taskId: number,
  comment: string
): Promise<TaskUpdateResponse> {
  return updateTask(taskId, {
    status: 'done',
    comment,
  });
}

/**
 * Mark a task as failed.
 * Automatically releases agent lock via API.
 */
export async function failTask(
  taskId: number,
  error: string,
  comment: string
): Promise<TaskUpdateResponse> {
  return updateTask(taskId, {
    status: 'failed',
    last_error: error,
    comment,
  });
}

/**
 * Move task to needs_input status (awaiting human decision).
 * Automatically releases agent lock via API.
 */
export async function requestInput(
  taskId: number,
  questions: string,
  comment: string
): Promise<TaskUpdateResponse> {
  return updateTask(taskId, {
    status: 'needs_input',
    needs_input_questions: questions,
    comment,
  });
}

/**
 * Move task to blocked status (external dependency).
 * Automatically releases agent lock via API.
 */
export async function blockTask(
  taskId: number,
  reason: string,
  comment: string
): Promise<TaskUpdateResponse> {
  return updateTask(taskId, {
    status: 'blocked',
    comment: `${comment}\n\nBlock reason: ${reason}`,
  });
}

/**
 * Increment attempt count and return to todo for retry.
 */
export async function retryTask(
  taskId: number,
  attemptCount: number,
  error: string,
  comment: string
): Promise<TaskUpdateResponse> {
  return updateTask(taskId, {
    status: 'todo',
    attempt_count: attemptCount + 1,
    last_error: error,
    comment,
  });
}

/**
 * Add a comment to a task.
 */
export async function addComment(
  taskId: number,
  body: string
): Promise<CommentResponse> {
  const response = await fetch(apiUrl('/comments'), {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ taskId, body }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    return { ok: false, error: `HTTP ${response.status}: ${text}` };
  }

  return response.json();
}

/**
 * Check current agent lock status.
 */
export async function getLockStatus(): Promise<LockStatusResponse> {
  const response = await fetch(apiUrl('/lock'), {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    return { ok: false, locked: false, lock: null };
  }

  return response.json();
}

/**
 * Check if agent is currently locked.
 */
export async function isAgentLocked(): Promise<boolean> {
  const status = await getLockStatus();
  return status.ok && status.locked;
}
