/**
 * Citadel Intent System
 * 
 * Cross-app communication via intents - similar to Android intents.
 * Apps declare actions they can handle (intents.provides) and actions they want to invoke (intents.uses).
 * 
 * Built-in intents:
 * - citadel.search: Search across all apps
 * - citadel.share-text: Share text to another app
 * - citadel.create-note: Create a note in the default notes app
 * 
 * @module @citadel/core/intents
 */

import { DatabaseSync } from 'node:sqlite';
import { appDbPath } from './paths.js';
import { getAppManifest, listApps } from './registry.js';
import type { IntentConfig } from './manifest-schema.js';

const CITADEL_APP_ID = 'citadel';

// Raw DB access to avoid circular dependencies
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
 * Intent consent record
 */
export type IntentConsent = {
  appId: string;
  actionUri: string;
  targetAppId: string;
  grantedAt: string;
};

/**
 * Intent invocation request
 */
export type IntentInvokeRequest = {
  /** The action URI to invoke (e.g., "gym.log-exercise", "citadel.search") */
  action: string;
  /** Payload data for the intent (app-specific) */
  payload?: Record<string, unknown>;
};

/**
 * Intent invocation result
 */
export type IntentInvokeResult =
  | { ok: true; result: unknown }
  | { ok: false; error: string; code: 'NO_PROVIDER' | 'CONSENT_REQUIRED' | 'INVOKE_FAILED' | 'BUILTIN_FAILED' };

/**
 * Built-in intent handler
 */
type BuiltinIntentHandler = (payload: Record<string, unknown> | undefined) => Promise<unknown>;

// Ensure the intent_consent table exists
function ensureIntentConsentTable(): void {
  const db = getCitadelDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS intent_consent (
      app_id TEXT NOT NULL,
      action_uri TEXT NOT NULL,
      target_app_id TEXT NOT NULL,
      granted_at TEXT NOT NULL,
      PRIMARY KEY (app_id, action_uri)
    )
  `);
}

/**
 * Check if an app has consent to invoke an intent action
 */
export function hasIntentConsent(appId: string, actionUri: string): boolean {
  // Citadel host app has full intent access
  if (appId === CITADEL_APP_ID) return true;
  
  ensureIntentConsentTable();
  const db = getCitadelDb();
  const stmt = db.prepare(
    'SELECT 1 FROM intent_consent WHERE app_id = ? AND action_uri = ? LIMIT 1'
  );
  const row = stmt.get(appId, actionUri) as { 1: number } | undefined;
  return row !== undefined;
}

/**
 * Grant consent for an app to invoke an intent action
 */
export function grantIntentConsent(appId: string, actionUri: string, targetAppId: string): void {
  ensureIntentConsentTable();
  const db = getCitadelDb();
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO intent_consent (app_id, action_uri, target_app_id, granted_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(app_id, action_uri) DO UPDATE SET
      target_app_id = excluded.target_app_id,
      granted_at = excluded.granted_at
  `);
  stmt.run(appId, actionUri, targetAppId, now);
}

/**
 * Revoke consent for an app to invoke an intent action
 */
export function revokeIntentConsent(appId: string, actionUri: string): void {
  ensureIntentConsentTable();
  const db = getCitadelDb();
  const stmt = db.prepare(
    'DELETE FROM intent_consent WHERE app_id = ? AND action_uri = ?'
  );
  stmt.run(appId, actionUri);
}

/**
 * Get all intent consents for an app
 */
export function getAppIntentConsents(appId: string): IntentConsent[] {
  ensureIntentConsentTable();
  const db = getCitadelDb();
  const stmt = db.prepare(
    'SELECT app_id, action_uri, target_app_id, granted_at FROM intent_consent WHERE app_id = ? ORDER BY granted_at DESC'
  );
  const rows = stmt.all(appId) as { app_id: string; action_uri: string; target_app_id: string; granted_at: string }[];
  
  return rows.map((row) => ({
    appId: row.app_id,
    actionUri: row.action_uri,
    targetAppId: row.target_app_id,
    grantedAt: row.granted_at,
  }));
}

/**
 * Get all intent consents across all apps
 */
export function getAllIntentConsents(): IntentConsent[] {
  ensureIntentConsentTable();
  const db = getCitadelDb();
  const stmt = db.prepare(
    'SELECT app_id, action_uri, target_app_id, granted_at FROM intent_consent ORDER BY granted_at DESC'
  );
  const rows = stmt.all() as { app_id: string; action_uri: string; target_app_id: string; granted_at: string }[];
  
  return rows.map((row) => ({
    appId: row.app_id,
    actionUri: row.action_uri,
    targetAppId: row.target_app_id,
    grantedAt: row.granted_at,
  }));
}

/**
 * Find the app that provides a given intent action
 */
export async function findIntentProvider(actionUri: string): Promise<string | null> {
  // Handle built-in intents
  if (actionUri.startsWith('citadel.')) {
    return CITADEL_APP_ID;
  }
  
  const apps = await listApps(true);
  
  for (const app of apps) {
    if (app.intents?.provides?.includes(actionUri)) {
      return app.id;
    }
  }
  
  return null;
}

/**
 * Get all intent actions provided by an app
 */
export async function getAppProvidedIntents(appId: string): Promise<string[]> {
  const manifest = await getAppManifest(appId);
  if (!manifest) return [];
  return manifest.intents?.provides ?? [];
}

/**
 * Get all intent actions an app wants to use
 */
export async function getAppUsedIntents(appId: string): Promise<string[]> {
  const manifest = await getAppManifest(appId);
  if (!manifest) return [];
  return manifest.intents?.uses ?? [];
}

/**
 * Check if an app can invoke a specific intent action
 * Returns true if consent is granted, false if consent is needed
 */
export async function canInvokeIntent(appId: string, actionUri: string): Promise<boolean> {
  // Citadel host app can always invoke
  if (appId === CITADEL_APP_ID) return true;
  
  // Check if consent already granted
  if (hasIntentConsent(appId, actionUri)) return true;
  
  return false;
}

/**
 * Built-in intent handlers
 */
const builtinIntents: Map<string, BuiltinIntentHandler> = new Map();

/**
 * Register a built-in intent handler
 */
export function registerBuiltinIntent(actionUri: string, handler: BuiltinIntentHandler): void {
  builtinIntents.set(actionUri, handler);
}

/**
 * Check if an action is a built-in intent
 */
export function isBuiltinIntent(actionUri: string): boolean {
  return actionUri.startsWith('citadel.') && builtinIntents.has(actionUri);
}

/**
 * Register default built-in intents
 */
export function registerDefaultBuiltinIntents(): void {
  // citadel.search: Search across all apps
  registerBuiltinIntent('citadel.search', async (payload) => {
    const query = payload?.query as string | undefined;
    if (!query) {
      throw new Error('Search query is required');
    }
    
    // Search app names and descriptions from registry
    const apps = await listApps(true);
    const results = apps
      .filter((app) => {
        const searchable = `${app.name} ${app.description ?? ''}`.toLowerCase();
        return searchable.includes(query.toLowerCase());
      })
      .map((app) => ({
        type: 'app',
        id: app.id,
        name: app.name,
        description: app.description,
      }));
    
    return {
      query,
      results,
      count: results.length,
    };
  });
  
  // citadel.share-text: Share text (returns the shared text for the target app to handle)
  registerBuiltinIntent('citadel.share-text', async (payload) => {
    const text = payload?.text as string | undefined;
    const title = payload?.title as string | undefined;
    
    if (!text) {
      throw new Error('Text is required for share-text intent');
    }
    
    return {
      text,
      title,
      sharedAt: new Date().toISOString(),
    };
  });
  
  // citadel.create-note: Create a note (placeholder - requires smart-notes app to handle)
  registerBuiltinIntent('citadel.create-note', async (payload) => {
    const content = payload?.content as string | undefined;
    const title = payload?.title as string | undefined;
    
    if (!content && !title) {
      throw new Error('Content or title is required for create-note intent');
    }
    
    // This returns the note data - the actual creation would be handled
    // by the smart-notes app if it provides this intent
    return {
      title: title ?? 'Untitled Note',
      content: content ?? '',
      createdAt: new Date().toISOString(),
    };
  });
}

/**
 * Invoke a built-in intent
 */
async function invokeBuiltinIntent(actionUri: string, payload: Record<string, unknown> | undefined): Promise<unknown> {
  const handler = builtinIntents.get(actionUri);
  if (!handler) {
    throw new Error(`Unknown built-in intent: ${actionUri}`);
  }
  return handler(payload);
}

/**
 * Invoke an intent action
 * 
 * This is the main entry point for the intent system.
 * It resolves the action to an app, checks consent, and forwards the invocation.
 */
export async function invokeIntent(
  sourceAppId: string,
  request: IntentInvokeRequest
): Promise<IntentInvokeResult> {
  const { action, payload } = request;
  
  // Find the provider for this action
  const targetAppId = await findIntentProvider(action);
  
  if (!targetAppId) {
    return {
      ok: false,
      error: `No app provides the intent action: ${action}`,
      code: 'NO_PROVIDER',
    };
  }
  
  // Check consent
  if (!hasIntentConsent(sourceAppId, action)) {
    return {
      ok: false,
      error: `Consent required to invoke intent: ${action}. Target app: ${targetAppId}`,
      code: 'CONSENT_REQUIRED',
    };
  }
  
  try {
    // Handle built-in intents
    if (isBuiltinIntent(action)) {
      const result = await invokeBuiltinIntent(action, payload);
      return { ok: true, result };
    }
    
    // For app-provided intents, forward to the app's intent handler
    // This would typically involve calling the app's API endpoint
    // For now, we return a placeholder indicating success
    // The actual implementation would call the target app's registered handler
    
    // TODO: Implement forwarding to app-specific intent handlers
    // This requires the app to expose an endpoint or handler for intents
    return {
      ok: true,
      result: {
        forwardedTo: targetAppId,
        action,
        payload,
        message: 'Intent forwarded to target app (app-specific handling not yet implemented)',
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: `Failed to invoke intent: ${(err as Error).message}`,
      code: isBuiltinIntent(action) ? 'BUILTIN_FAILED' : 'INVOKE_FAILED',
    };
  }
}

// Register default built-in intents on module load
registerDefaultBuiltinIntents();

/**
 * Get intent capabilities for the current system
 * Returns a list of all available intent actions and their providers
 */
export async function getIntentCapabilities(): Promise<{
  builtin: string[];
  apps: Array<{ appId: string; provides: string[] }>;
}> {
  const builtin = Array.from(builtinIntents.keys());
  
  const apps: Array<{ appId: string; provides: string[] }> = [];
  const allApps = await listApps(true);
  
  for (const app of allApps) {
    if (app.intents?.provides && app.intents.provides.length > 0) {
      apps.push({
        appId: app.id,
        provides: app.intents.provides,
      });
    }
  }
  
  return { builtin, apps };
}
