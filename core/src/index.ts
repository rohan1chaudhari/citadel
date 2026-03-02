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
  isAppManifestV0,
  validateEntryConfig,
  validateHealthConfig,
  validateManifest,
  type DbPermissions,
  type StoragePermissions,
  type IntentConfig,
  // Note: PermissionScopes is exported from permissions.js above
  type AppManifest as AppManifestSchema,
  type AppManifestV0,
  type AnyAppManifest,
  type EntryConfig,
  type HealthConfig,
  type EndpointConfig,
  type ManifestValidationError,
  type ManifestValidationResult,
} from './manifest-schema.js';

// Migrations (app-level)
export {
  runMigrationsForApp,
  runAllMigrations,
  getMigrationStatus,
  rollbackMigrationsForApp,
  type MigrationResult,
  type RollbackResult,
} from './migrations.js';

// Host Migrations (host-level)
export {
  runHostMigrations,
  getHostMigrationStatus,
  areHostMigrationsCurrent,
  type HostMigrationResult,
} from './hostMigrations.js';

// Host Settings
export {
  getSetting,
  setSetting,
  isSetupComplete,
  completeSetup,
  getAllSettings,
  saveApiKeys,
  type HostSettings,
} from './settings.js';

// Quotas
export {
  getQuota,
  setQuota,
  removeQuota,
  getAllQuotas,
  getAppStorageUsage,
  checkQuota,
  checkWriteQuota,
  formatBytes,
  getQuotaStatus,
} from './quota.js';

// Auth
export {
  isAuthEnabled,
  getPassphraseHash,
  isAuthConfigured,
  hashPassphrase,
  verifyPassphrase,
  setPassphrase,
  generateSessionToken,
  createSession,
  validateSession,
  destroySession,
  getSessionCookie,
  getClearSessionCookie,
  extractSessionToken,
  isAuthenticated,
  getAuthStatus,
  type AuthSession,
} from './auth.js';

// Network Policy
export {
  extractHostname,
  matchesDomainPattern,
  getNetworkAllowlist,
  checkNetworkPolicy,
  logBlockedRequest,
  appFetch,
  isHostnameAllowed,
  type NetworkPolicyResult,
} from './network-policy.js';

// Intents
export {
  hasIntentConsent,
  grantIntentConsent,
  revokeIntentConsent,
  getAppIntentConsents,
  getAllIntentConsents,
  findIntentProvider,
  getAppProvidedIntents,
  getAppUsedIntents,
  canInvokeIntent,
  registerBuiltinIntent,
  isBuiltinIntent,
  registerDefaultBuiltinIntents,
  invokeIntent,
  getIntentCapabilities,
  type IntentConsent,
  type IntentInvokeRequest,
  type IntentInvokeResult,
} from './intents.js';

// Lifecycle (startup/shutdown management)
export {
  recordStartupStart,
  getStartupDurationMs,
  logStartupComplete,
  verifyAppDatabases,
  performStartupHealthCheck,
  registerDbConnection,
  gracefulShutdown,
  installShutdownHandlers,
  invalidateRegistryCache,
  getHostStatus,
} from './lifecycle.js';

// Workflows (cross-app automation)
export {
  createWorkflow,
  getWorkflow,
  listWorkflows,
  updateWorkflow,
  deleteWorkflow,
  toggleWorkflow,
  evaluateWorkflows,
  getWorkflowExecutions,
  getAllWorkflowExecutions,
  getWorkflowStats,
  type Workflow,
  type WorkflowTrigger,
  type WorkflowCondition,
  type WorkflowAction,
  type WorkflowExecution,
  type WorkflowActionResult,
} from './workflows.js';

