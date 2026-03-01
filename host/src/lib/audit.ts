import { dbExec } from '@/lib/db';

const CITADEL_APP_ID = 'citadel';

function ensureAuditLogTable() {
  try {
    dbExec(CITADEL_APP_ID, `
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        app_id TEXT NOT NULL,
        event TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
    
    // Create index for efficient querying
    dbExec(CITADEL_APP_ID, `
      CREATE INDEX IF NOT EXISTS idx_audit_app_ts ON audit_log(app_id, ts)
    `);
  } catch {
    // Table may already exist or DB not available
  }
}

export function audit(appId: string, event: string, payload: Record<string, unknown> = {}) {
  const ts = new Date().toISOString();
  const rec = { ts, appId, event, payload };
  
  // Always log to stdout
  console.log(JSON.stringify(rec));
  
  // Also persist to DB
  try {
    ensureAuditLogTable();
    dbExec(
      CITADEL_APP_ID,
      `INSERT INTO audit_log (ts, app_id, event, payload, created_at) VALUES (?, ?, ?, ?, ?)`,
      [ts, appId, event, JSON.stringify(payload), ts]
    );
  } catch (e) {
    // Fail silently - don't break app functionality if audit logging fails
    console.error('Audit DB write failed:', e);
  }
}
