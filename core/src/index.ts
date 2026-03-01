// Core platform primitives for Citadel

// Database
export { dbExec, dbQuery, __clearDbCache } from './db.js';

// Audit logging
export { audit, cleanupOldAuditLogs, __clearAuditDb } from './audit.js';

// Storage
export { storageWriteText, storageWriteBuffer, storageReadText } from './storage.js';

// SQL Guardrails
export { assertSqlAllowed } from './sqlGuardrails.js';

// Paths
export { repoRoot, dataRoot, appDataRoot, appDbPath } from './paths.js';

// App IDs
export { assertAppId } from './appIds.js';

// Permissions
export {
  getAppPermissions,
  getAllAppPermissions,
  setAppPermissions,
  revokeAppPermissions,
  hasDbPermission,
  hasStoragePermission,
  hasAiPermission,
  hasNetworkPermission,
  needsPermissionConsent,
  type PermissionScopes,
  type AppPermissions,
} from './permissions.js';

// Registry
export {
  getAppManifest,
  listApps,
  listHiddenApps,
  getHiddenApps,
  type AppManifest,
} from './registry.js';

// Manifest Schema (formal types for app.yaml)
export {
  MANIFEST_CONSTRAINTS,
  MANIFEST_JSON_SCHEMA,
  validateAppId,
  isAppManifest,
  type DbPermissions,
  type StoragePermissions,
  // Note: PermissionScopes is exported from permissions.js above
  type AppManifest as AppManifestSchema,
  type ManifestValidationError,
  type ManifestValidationResult,
} from './manifest-schema.js';

// Migrations
export {
  runMigrationsForApp,
  runAllMigrations,
  getMigrationStatus,
  rollbackMigrationsForApp,
  type MigrationResult,
  type RollbackResult,
} from './migrations.js';
