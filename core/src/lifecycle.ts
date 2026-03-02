/**
 * Host lifecycle management
 * 
 * Handles startup health checks, graceful shutdown, and startup time logging.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { appsDir, appDataRoot, dataRoot } from './paths.js';
import { listApps, getAppManifest } from './registry.js';
import { audit } from './audit.js';

// Track startup time
let startupStartTime: number | null = null;
let isReady = false;

// Store for open database connections that need cleanup
interface DbConnection {
  appId: string;
  dbPath: string;
  close: () => void;
}

const openConnections: DbConnection[] = [];

/**
 * Record the process start time for startup duration logging.
 * Call this as early as possible in the host startup.
 */
export function recordStartupStart(): void {
  startupStartTime = Date.now();
}

/**
 * Get the startup duration in milliseconds.
 */
export function getStartupDurationMs(): number {
  if (!startupStartTime) return 0;
  return Date.now() - startupStartTime;
}

/**
 * Log the startup time when the host is ready to accept requests.
 */
export function logStartupComplete(): void {
  if (!startupStartTime) return;
  
  const durationMs = getStartupDurationMs();
  const durationSec = (durationMs / 1000).toFixed(2);
  
  isReady = true;
  
  console.log(`[lifecycle] Host ready in ${durationSec}s`);
  audit('citadel', 'host.startup_complete', { 
    duration_ms: durationMs,
    duration_sec: parseFloat(durationSec)
  });
}

/**
 * Check if all registered app databases are accessible.
 * Returns an array of any apps with inaccessible DBs.
 */
export async function verifyAppDatabases(): Promise<{ appId: string; error: string }[]> {
  const errors: { appId: string; error: string }[] = [];
  
  try {
    const apps = await listApps(true); // Include hidden apps
    
    for (const app of apps) {
      const appId = app.id;
      const dbPath = path.join(appDataRoot(appId), 'db.sqlite');
      
      try {
        // Check if DB file exists
        try {
          fs.accessSync(dbPath, fs.constants.R_OK);
        } catch (e) {
          // DB doesn't exist yet - this is OK for new apps
          const dataDir = appDataRoot(appId);
          try {
            fs.accessSync(dataDir, fs.constants.R_OK);
            // Directory exists but no DB yet - OK
            continue;
          } catch {
            // Neither directory nor DB exists - still OK, will be created on first use
            continue;
          }
        }
        
        // Try to open and query the DB
        const db = new DatabaseSync(dbPath);
        try {
          // Simple query to verify DB is readable
          db.prepare('SELECT 1').get();
        } finally {
          db.close();
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        errors.push({ appId, error: errorMsg });
        console.error(`[lifecycle] Database verification failed for ${appId}: ${errorMsg}`);
      }
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error('[lifecycle] Failed to list apps for DB verification:', errorMsg);
    // Return empty array - we'll continue startup but log the error
  }
  
  return errors;
}

/**
 * Perform startup health checks.
 * Throws an error if critical checks fail.
 */
export async function performStartupHealthCheck(): Promise<void> {
  console.log('[lifecycle] Performing startup health checks...');
  
  // Check 1: Verify data directory is accessible
  const dataDir = dataRoot();
  try {
    await fsp.access(dataDir, fs.constants.R_OK | fs.constants.W_OK);
  } catch (e) {
    const errorMsg = `Data directory is not accessible: ${dataDir}`;
    console.error(`[lifecycle] ${errorMsg}`);
    audit('citadel', 'host.startup_health_check_failed', { check: 'data_directory', error: errorMsg });
    throw new Error(errorMsg);
  }
  
  // Check 2: Verify apps directory is accessible
  const appsDirPath = appsDir();
  try {
    await fsp.access(appsDirPath, fs.constants.R_OK);
  } catch (e) {
    const errorMsg = `Apps directory is not accessible: ${appsDirPath}`;
    console.error(`[lifecycle] ${errorMsg}`);
    audit('citadel', 'host.startup_health_check_failed', { check: 'apps_directory', error: errorMsg });
    throw new Error(errorMsg);
  }
  
  // Check 3: Verify all app databases are accessible
  const dbErrors = await verifyAppDatabases();
  if (dbErrors.length > 0) {
    const errorDetails = dbErrors.map(e => `${e.appId}: ${e.error}`).join('; ');
    const errorMsg = `Some app databases are inaccessible: ${errorDetails}`;
    console.error(`[lifecycle] ${errorMsg}`);
    audit('citadel', 'host.startup_health_check_failed', { 
      check: 'app_databases', 
      errors: dbErrors 
    });
    throw new Error(errorMsg);
  }
  
  console.log('[lifecycle] Startup health checks passed');
  audit('citadel', 'host.startup_health_check_passed', { 
    apps_count: (await listApps(true)).length 
  });
}

/**
 * Register an open database connection for cleanup during shutdown.
 */
export function registerDbConnection(appId: string, dbPath: string, closeFn: () => void): void {
  openConnections.push({ appId, dbPath, close: closeFn });
}

/**
 * Close all registered database connections.
 */
function closeAllConnections(): void {
  if (openConnections.length === 0) return;
  
  console.log(`[lifecycle] Closing ${openConnections.length} database connections...`);
  
  for (const conn of openConnections) {
    try {
      conn.close();
      console.log(`[lifecycle] Closed connection for ${conn.appId}`);
    } catch (e) {
      console.error(`[lifecycle] Error closing connection for ${conn.appId}:`, e);
    }
  }
  
  openConnections.length = 0;
}

/**
 * Flush any pending audit log writes.
 * Since audit logs are written synchronously, this is mostly a no-op,
 * but provides a hook for future async buffering.
 */
function flushAuditLogs(): void {
  console.log('[lifecycle] Flushing audit logs...');
  audit('citadel', 'host.shutdown', { 
    uptime_ms: process.uptime() * 1000,
    graceful: true 
  });
  console.log('[lifecycle] Audit logs flushed');
}

/**
 * Perform graceful shutdown.
 */
export function gracefulShutdown(signal: string): void {
  console.log(`[lifecycle] Received ${signal}, starting graceful shutdown...`);
  
  try {
    // 1. Flush audit logs
    flushAuditLogs();
    
    // 2. Close all database connections
    closeAllConnections();
    
    console.log('[lifecycle] Graceful shutdown complete');
  } catch (e) {
    console.error('[lifecycle] Error during graceful shutdown:', e);
  }
}

/**
 * Install shutdown handlers for SIGTERM and SIGINT.
 * Call this once during host startup.
 */
export function installShutdownHandlers(): void {
  // Handle SIGTERM (Docker stop, systemd stop, etc.)
  process.on('SIGTERM', () => {
    gracefulShutdown('SIGTERM');
    // Give time for cleanup before exit
    setTimeout(() => {
      process.exit(0);
    }, 100);
  });
  
  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    gracefulShutdown('SIGINT');
    // Give time for cleanup before exit
    setTimeout(() => {
      process.exit(0);
    }, 100);
  });
  
  console.log('[lifecycle] Shutdown handlers installed');
}

/**
 * Invalidate the app registry cache.
 * Call this after installing, uninstalling, or updating an app.
 */
export async function invalidateRegistryCache(): Promise<void> {
  console.log('[lifecycle] Invalidating registry cache...');
  
  // The registry currently doesn't have a persistent cache,
  // but we clear any in-memory caches and verify the apps directory
  try {
    // Re-scan apps directory to pick up changes
    const apps = await listApps(true);
    
    audit('citadel', 'host.registry_cache_invalidated', { 
      apps_count: apps.length 
    });
    
    console.log(`[lifecycle] Registry cache invalidated, ${apps.length} apps available`);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error('[lifecycle] Error invalidating registry cache:', errorMsg);
    audit('citadel', 'host.registry_cache_invalidation_failed', { error: errorMsg });
  }
}

/**
 * Get the current host status.
 */
export function getHostStatus(): {
  ready: boolean;
  startupDurationMs: number;
  uptimeMs: number;
  openConnections: number;
} {
  return {
    ready: isReady,
    startupDurationMs: getStartupDurationMs(),
    uptimeMs: process.uptime() * 1000,
    openConnections: openConnections.length,
  };
}
