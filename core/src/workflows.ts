/**
 * Citadel Workflow Automation System
 * 
 * Lightweight if-this-then-that automation for cross-app workflows.
 * Workflows listen to audit events and trigger intent actions.
 * 
 * @module @citadel/core/workflows
 */

import { DatabaseSync } from 'node:sqlite';
import { appDbPath } from './paths.js';
import { invokeIntent, hasIntentConsent, grantIntentConsent } from './intents.js';
import { audit } from './audit.js';

const CITADEL_APP_ID = 'citadel';
const MAX_CHAINED_ACTIONS = 3;

let citadelDb: DatabaseSync | null = null;

function getCitadelDb(): DatabaseSync {
  if (!citadelDb) {
    citadelDb = new DatabaseSync(appDbPath(CITADEL_APP_ID));
    citadelDb.exec('PRAGMA journal_mode = WAL');
    citadelDb.exec('PRAGMA foreign_keys = ON');
  }
  return citadelDb;
}

/**
 * Workflow trigger configuration
 */
export type WorkflowTrigger = {
  /** Event pattern to match (e.g., "smart-notes.note.created") */
  event: string;
  /** Optional source app ID filter */
  appId?: string;
};

/**
 * Workflow condition configuration
 */
export type WorkflowCondition = {
  /** Path to check in the event payload (e.g., "note.title") */
  path: string;
  /** Operator: eq, ne, contains, gt, lt */
  operator: 'eq' | 'ne' | 'contains' | 'gt' | 'lt';
  /** Value to compare against */
  value: unknown;
};

/**
 * Workflow action configuration
 */
export type WorkflowAction = {
  /** Intent action to invoke */
  action: string;
  /** Payload to pass to the intent (can use template variables) */
  payload?: Record<string, unknown>;
};

/**
 * Workflow definition
 */
export type Workflow = {
  id: number;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  createdAt: string;
  updatedAt: string;
  runCount: number;
  lastRunAt?: string;
  createdBy?: string;
};

/**
 * Workflow execution log entry
 */
export type WorkflowExecution = {
  id: number;
  workflowId: number;
  triggeredBy: string;
  triggerEvent: string;
  triggerPayload: Record<string, unknown>;
  actionsExecuted: number;
  results: WorkflowActionResult[];
  startedAt: string;
  completedAt: string;
  success: boolean;
  error?: string;
};

export type WorkflowActionResult = {
  actionIndex: number;
  action: string;
  success: boolean;
  result?: unknown;
  error?: string;
};

// Ensure the workflows table exists
function ensureWorkflowsTable(): void {
  const db = getCitadelDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      enabled BOOLEAN NOT NULL DEFAULT 1,
      trigger_event TEXT NOT NULL,
      trigger_app_id TEXT,
      conditions TEXT NOT NULL DEFAULT '[]',
      actions TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      run_count INTEGER NOT NULL DEFAULT 0,
      last_run_at TEXT,
      created_by TEXT
    )
  `);
}

// Ensure the workflow executions log table exists
function ensureWorkflowExecutionsTable(): void {
  const db = getCitadelDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id INTEGER NOT NULL,
      triggered_by TEXT NOT NULL,
      trigger_event TEXT NOT NULL,
      trigger_payload TEXT NOT NULL,
      actions_executed INTEGER NOT NULL DEFAULT 0,
      results TEXT NOT NULL DEFAULT '[]',
      started_at TEXT NOT NULL,
      completed_at TEXT,
      success BOOLEAN NOT NULL DEFAULT 0,
      error TEXT,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
    )
  `);
}

/**
 * Create a new workflow
 */
export function createWorkflow(
  name: string,
  trigger: WorkflowTrigger,
  actions: WorkflowAction[],
  options?: {
    description?: string;
    conditions?: WorkflowCondition[];
    enabled?: boolean;
    createdBy?: string;
  }
): Workflow {
  ensureWorkflowsTable();
  const db = getCitadelDb();
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO workflows 
    (name, description, enabled, trigger_event, trigger_app_id, conditions, actions, created_at, updated_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    name,
    options?.description ?? null,
    (options?.enabled ?? true) ? 1 : 0,
    trigger.event,
    trigger.appId ?? null,
    JSON.stringify(options?.conditions ?? []),
    JSON.stringify(actions),
    now,
    now,
    options?.createdBy ?? null
  );
  
  const id = result.lastInsertRowid as number;
  
  return {
    id,
    name,
    description: options?.description,
    enabled: options?.enabled ?? true,
    trigger,
    conditions: options?.conditions ?? [],
    actions,
    createdAt: now,
    updatedAt: now,
    runCount: 0,
    createdBy: options?.createdBy,
  };
}

/**
 * Get a workflow by ID
 */
export function getWorkflow(id: number): Workflow | null {
  ensureWorkflowsTable();
  const db = getCitadelDb();
  const stmt = db.prepare('SELECT * FROM workflows WHERE id = ?');
  const row = stmt.get(id) as {
    id: number;
    name: string;
    description?: string;
    enabled: number;
    trigger_event: string;
    trigger_app_id?: string;
    conditions: string;
    actions: string;
    created_at: string;
    updated_at: string;
    run_count: number;
    last_run_at?: string;
    created_by?: string;
  } | undefined;
  
  if (!row) return null;
  
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    enabled: Boolean(row.enabled),
    trigger: {
      event: row.trigger_event,
      appId: row.trigger_app_id,
    },
    conditions: JSON.parse(row.conditions),
    actions: JSON.parse(row.actions),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    runCount: row.run_count,
    lastRunAt: row.last_run_at,
    createdBy: row.created_by,
  };
}

/**
 * List all workflows
 */
export function listWorkflows(): Workflow[] {
  ensureWorkflowsTable();
  const db = getCitadelDb();
  const stmt = db.prepare('SELECT * FROM workflows ORDER BY created_at DESC');
  const rows = stmt.all() as Array<{
    id: number;
    name: string;
    description?: string;
    enabled: number;
    trigger_event: string;
    trigger_app_id?: string;
    conditions: string;
    actions: string;
    created_at: string;
    updated_at: string;
    run_count: number;
    last_run_at?: string;
    created_by?: string;
  }>;
  
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    enabled: Boolean(row.enabled),
    trigger: {
      event: row.trigger_event,
      appId: row.trigger_app_id,
    },
    conditions: JSON.parse(row.conditions),
    actions: JSON.parse(row.actions),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    runCount: row.run_count,
    lastRunAt: row.last_run_at,
    createdBy: row.created_by,
  }));
}

/**
 * Update a workflow
 */
export function updateWorkflow(
  id: number,
  updates: Partial<{
    name: string;
    description: string;
    enabled: boolean;
    trigger: WorkflowTrigger;
    conditions: WorkflowCondition[];
    actions: WorkflowAction[];
  }>
): Workflow | null {
  ensureWorkflowsTable();
  const db = getCitadelDb();
  const now = new Date().toISOString();
  
  const current = getWorkflow(id);
  if (!current) return null;
  
  const stmt = db.prepare(`
    UPDATE workflows SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      enabled = COALESCE(?, enabled),
      trigger_event = COALESCE(?, trigger_event),
      trigger_app_id = COALESCE(?, trigger_app_id),
      conditions = COALESCE(?, conditions),
      actions = COALESCE(?, actions),
      updated_at = ?
    WHERE id = ?
  `);
  
  stmt.run(
    updates.name ?? null,
    updates.description ?? null,
    updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : null,
    updates.trigger?.event ?? null,
    updates.trigger?.appId ?? null,
    updates.conditions !== undefined ? JSON.stringify(updates.conditions) : null,
    updates.actions !== undefined ? JSON.stringify(updates.actions) : null,
    now,
    id
  );
  
  return getWorkflow(id);
}

/**
 * Delete a workflow
 */
export function deleteWorkflow(id: number): boolean {
  ensureWorkflowsTable();
  const db = getCitadelDb();
  const stmt = db.prepare('DELETE FROM workflows WHERE id = ?');
  const result = stmt.run(id);
  return result.changes ? result.changes > 0 : false;
}

/**
 * Evaluate if an event matches a trigger
 */
function matchesTrigger(
  event: string,
  appId: string,
  trigger: WorkflowTrigger
): boolean {
  // Check app filter if specified
  if (trigger.appId && trigger.appId !== appId) {
    return false;
  }
  
  // Check event pattern (supports wildcards)
  if (trigger.event.includes('*')) {
    const pattern = trigger.event.replace(/\*/g, '.*');
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(event);
  }
  
  return trigger.event === event;
}

/**
 * Get a value from an object by path (e.g., "note.title")
 */
function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  
  return current;
}

/**
 * Evaluate a condition
 */
function evaluateCondition(
  payload: Record<string, unknown>,
  condition: WorkflowCondition
): boolean {
  const value = getValueByPath(payload, condition.path);
  
  switch (condition.operator) {
    case 'eq':
      return value === condition.value;
    case 'ne':
      return value !== condition.value;
    case 'contains':
      if (typeof value === 'string' && typeof condition.value === 'string') {
        return value.includes(condition.value);
      }
      return false;
    case 'gt':
      return typeof value === 'number' && typeof condition.value === 'number' 
        ? value > condition.value 
        : false;
    case 'lt':
      return typeof value === 'number' && typeof condition.value === 'number'
        ? value < condition.value
        : false;
    default:
      return false;
  }
}

/**
 * Evaluate if all conditions are met
 */
function evaluateConditions(
  payload: Record<string, unknown>,
  conditions: WorkflowCondition[]
): boolean {
  if (conditions.length === 0) return true;
  return conditions.every((c) => evaluateCondition(payload, c));
}

/**
 * Substitute template variables in payload
 * Supports: {{event.appId}}, {{event.event}}, {{payload.path}}
 */
function substituteTemplateVars(
  template: Record<string, unknown>,
  context: {
    appId: string;
    event: string;
    payload: Record<string, unknown>;
  }
): Record<string, unknown> {
  const str = JSON.stringify(template);
  const substituted = str
    .replace(/\{\{\s*event\.appId\s*\}\}/g, context.appId)
    .replace(/\{\{\s*event\.event\s*\}\}/g, context.event)
    .replace(/\{\{\s*payload\.([^}]+)\s*\}\}/g, (_, path) => {
      const value = getValueByPath(context.payload, path);
      return value !== undefined ? JSON.stringify(value) : 'null';
    });
  
  return JSON.parse(substituted);
}

/**
 * Execute a workflow's actions
 */
async function executeWorkflowActions(
  workflow: Workflow,
  context: {
    appId: string;
    event: string;
    payload: Record<string, unknown>;
  }
): Promise<{ success: boolean; results: WorkflowActionResult[]; error?: string }> {
  const results: WorkflowActionResult[] = [];
  
  // Limit to max 3 chained actions
  const actions = workflow.actions.slice(0, MAX_CHAINED_ACTIONS);
  
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    
    // Substitute template variables in payload
    const payload = action.payload 
      ? substituteTemplateVars(action.payload, context)
      : undefined;
    
    // Ensure consent is granted for citadel host
    if (!hasIntentConsent(CITADEL_APP_ID, action.action)) {
      // Find target app and grant consent
      grantIntentConsent(CITADEL_APP_ID, action.action, CITADEL_APP_ID);
    }
    
    try {
      const result = await invokeIntent(CITADEL_APP_ID, {
        action: action.action,
        payload,
      });
      
      if (result.ok) {
        results.push({
          actionIndex: i,
          action: action.action,
          success: true,
          result: result.result,
        });
      } else {
        results.push({
          actionIndex: i,
          action: action.action,
          success: false,
          error: result.error,
        });
        // Stop chain on failure
        return {
          success: false,
          results,
          error: `Action ${i + 1} failed: ${result.error}`,
        };
      }
    } catch (err) {
      results.push({
        actionIndex: i,
        action: action.action,
        success: false,
        error: (err as Error).message,
      });
      return {
        success: false,
        results,
        error: `Action ${i + 1} threw: ${(err as Error).message}`,
      };
    }
  }
  
  return { success: true, results };
}

/**
 * Log a workflow execution
 */
function logWorkflowExecution(
  workflowId: number,
  context: {
    appId: string;
    event: string;
    payload: Record<string, unknown>;
  },
  execution: { success: boolean; results: WorkflowActionResult[]; error?: string }
): void {
  ensureWorkflowExecutionsTable();
  const db = getCitadelDb();
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO workflow_executions
    (workflow_id, triggered_by, trigger_event, trigger_payload, actions_executed, results, started_at, completed_at, success, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    workflowId,
    context.appId,
    context.event,
    JSON.stringify(context.payload),
    execution.results.length,
    JSON.stringify(execution.results),
    now,
    now,
    execution.success ? 1 : 0,
    execution.error ?? null
  );
}

/**
 * Update workflow run statistics
 */
function updateWorkflowStats(workflowId: number): void {
  ensureWorkflowsTable();
  const db = getCitadelDb();
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    UPDATE workflows SET
      run_count = run_count + 1,
      last_run_at = ?,
      updated_at = ?
    WHERE id = ?
  `);
  
  stmt.run(now, now, workflowId);
}

/**
 * Evaluate all workflows against an audit event
 * This is called by the audit system when events are logged
 */
export async function evaluateWorkflows(
  appId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const workflows = listWorkflows();
  
  for (const workflow of workflows) {
    // Skip disabled workflows
    if (!workflow.enabled) continue;
    
    // Check if trigger matches
    if (!matchesTrigger(event, appId, workflow.trigger)) continue;
    
    // Check if conditions are met
    if (!evaluateConditions(payload, workflow.conditions)) continue;
    
    // Execute the workflow
    const context = { appId, event, payload };
    
    try {
      const execution = await executeWorkflowActions(workflow, context);
      
      // Log the execution
      logWorkflowExecution(workflow.id, context, execution);
      
      // Update stats
      updateWorkflowStats(workflow.id);
      
      // Audit the workflow execution
      audit(CITADEL_APP_ID, 'workflow.executed', {
        workflowId: workflow.id,
        workflowName: workflow.name,
        triggeredBy: appId,
        triggerEvent: event,
        success: execution.success,
        actionsExecuted: execution.results.length,
      });
    } catch (err) {
      // Log failed execution
      logWorkflowExecution(workflow.id, context, {
        success: false,
        results: [],
        error: (err as Error).message,
      });
      
      audit(CITADEL_APP_ID, 'workflow.failed', {
        workflowId: workflow.id,
        workflowName: workflow.name,
        triggeredBy: appId,
        triggerEvent: event,
        error: (err as Error).message,
      });
    }
  }
}

/**
 * Get execution history for a workflow
 */
export function getWorkflowExecutions(workflowId: number, limit = 50): WorkflowExecution[] {
  ensureWorkflowExecutionsTable();
  const db = getCitadelDb();
  const stmt = db.prepare(
    'SELECT * FROM workflow_executions WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?'
  );
  const rows = stmt.all(workflowId, limit) as Array<{
    id: number;
    workflow_id: number;
    triggered_by: string;
    trigger_event: string;
    trigger_payload: string;
    actions_executed: number;
    results: string;
    started_at: string;
    completed_at: string;
    success: number;
    error?: string;
  }>;
  
  return rows.map((row) => ({
    id: row.id,
    workflowId: row.workflow_id,
    triggeredBy: row.triggered_by,
    triggerEvent: row.trigger_event,
    triggerPayload: JSON.parse(row.trigger_payload),
    actionsExecuted: row.actions_executed,
    results: JSON.parse(row.results),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    success: Boolean(row.success),
    error: row.error,
  }));
}

/**
 * Get all workflow executions (system-wide)
 */
export function getAllWorkflowExecutions(limit = 100): WorkflowExecution[] {
  ensureWorkflowExecutionsTable();
  const db = getCitadelDb();
  const stmt = db.prepare(
    'SELECT * FROM workflow_executions ORDER BY started_at DESC LIMIT ?'
  );
  const rows = stmt.all(limit) as Array<{
    id: number;
    workflow_id: number;
    triggered_by: string;
    trigger_event: string;
    trigger_payload: string;
    actions_executed: number;
    results: string;
    started_at: string;
    completed_at: string;
    success: number;
    error?: string;
  }>;
  
  return rows.map((row) => ({
    id: row.id,
    workflowId: row.workflow_id,
    triggeredBy: row.triggered_by,
    triggerEvent: row.trigger_event,
    triggerPayload: JSON.parse(row.trigger_payload),
    actionsExecuted: row.actions_executed,
    results: JSON.parse(row.results),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    success: Boolean(row.success),
    error: row.error,
  }));
}

/**
 * Toggle workflow enabled state
 */
export function toggleWorkflow(id: number, enabled: boolean): Workflow | null {
  return updateWorkflow(id, { enabled });
}

/**
 * Get workflow statistics
 */
export function getWorkflowStats(): {
  total: number;
  enabled: number;
  disabled: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
} {
  ensureWorkflowsTable();
  ensureWorkflowExecutionsTable();
  const db = getCitadelDb();
  
  const workflowsStmt = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as enabled,
      SUM(CASE WHEN enabled = 0 THEN 1 ELSE 0 END) as disabled
    FROM workflows
  `);
  const workflowStats = workflowsStmt.get() as { total: number; enabled: number; disabled: number };
  
  const execStmt = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed
    FROM workflow_executions
  `);
  const execStats = execStmt.get() as { total: number; successful: number; failed: number };
  
  return {
    total: workflowStats.total,
    enabled: workflowStats.enabled,
    disabled: workflowStats.disabled,
    totalExecutions: execStats.total,
    successfulExecutions: execStats.successful,
    failedExecutions: execStats.failed,
  };
}
