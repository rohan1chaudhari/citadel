/**
 * Citadel App Manifest Schema
 * 
 * Formal TypeScript type definitions for app.yaml manifests.
 * This file serves as both documentation and runtime validation.
 * 
 * @module @citadel/core/manifest-schema
 */

/**
 * Database permission scopes
 */
export type DbPermissions = {
  /** Allow SELECT queries */
  read?: boolean;
  /** Allow INSERT, UPDATE, DELETE */
  write?: boolean;
};

/**
 * Storage permission scopes
 */
export type StoragePermissions = {
  /** Allow reading files from app storage */
  read?: boolean;
  /** Allow writing files to app storage */
  write?: boolean;
};

/**
 * Intent definition - actions an app can handle or wants to invoke
 */
export type IntentConfig = {
  /** List of action URIs this app provides (e.g., ["gym.log-exercise", "notes.create"]) */
  provides?: string[];
  /** List of action URIs this app wants to invoke (e.g., ["citadel.search", "citadel.share-text"]) */
  uses?: string[];
};

/**
 * Full permission scopes an app can request
 */
export type PermissionScopes = {
  /** Database access permissions */
  db?: DbPermissions;
  /** File storage permissions */
  storage?: StoragePermissions;
  /** AI API access (transcription, vision, generation) */
  ai?: boolean;
  /** Allowed external domains for network calls. Supports wildcards like *.example.com */
  network?: string[];
  /** Agent runtime permissions */
  agent?: {
    /** Can trigger agent runs */
    run?: boolean;
    /** Can receive agent callbacks */
    callback?: boolean;
  };
  /** Intent permissions for cross-app communication */
  intents?: IntentConfig;
};

// ============================================================================
// App Contract v0 - Standalone/Containerized App Types
// ============================================================================

/**
 * Runtime entrypoint types for standalone apps
 */
export type EntryType = 'nextjs' | 'docker' | 'binary' | 'node' | 'python' | 'custom';

/**
 * Runtime entrypoint configuration (App Contract v0)
 * Defines how the host should run/launch the app
 */
export type EntryConfig = {
  /** Runtime type */
  type: EntryType;
  /** 
   * Command to start the app (required for binary, node, python, custom)
   * Example: "node server.js" or "./my-app"
   */
  command?: string;
  /** 
   * Port the app listens on (for docker, binary, custom types)
   * The host will proxy requests to this port
   */
  port?: number;
  /** Docker image reference (for docker type) */
  image?: string;
  /** Path to Dockerfile or build context (for docker type) */
  build?: string;
  /** Environment variables to set when running the app */
  env?: Record<string, string>;
  /** Working directory for the app process */
  workdir?: string;
};

/**
 * Health check configuration (App Contract v0)
 * REQUIRED: All standalone apps must expose GET /healthz
 */
export type HealthConfig = {
  /** 
   * Health check endpoint - MUST be /healthz
   * The host will call GET /healthz to check app health
   */
  endpoint: '/healthz';
  /** Health check interval in seconds (default: 30) */
  interval?: number;
  /** Health check timeout in seconds (default: 5) */
  timeout?: number;
  /** Initial delay before first health check in seconds (default: 5) */
  initialDelay?: number;
};

/**
 * Optional endpoint configuration (App Contract v0)
 */
export type EndpointConfig = {
  /** App metadata endpoint - GET /meta */
  meta?: {
    path: '/meta';
    methods?: ['GET'];
  };
  /** Event stream endpoint - GET/POST /events */
  events?: {
    path: '/events';
    methods?: ['GET', 'POST'];
  };
  /** Agent callback endpoint */
  agent?: {
    callback?: {
      path: '/agent/callback';
      methods?: ['POST'];
    };
  };
};

/**
 * Validated app manifest structure
 * This represents the canonical format for app.yaml files
 */
export type AppManifest = {
  /**
   * Allowed outbound domains (deny-by-default if omitted or empty)
   * Supports wildcards like *.openai.com
   */
  network?: string[];
  /** 
   * Unique app identifier 
   * Format: lowercase alphanumeric with hyphens, 1-64 chars
   * Pattern: ^[a-z][a-z0-9-]*[a-z0-9]$
   * Reserved: citadel, host, api, static
   */
  id: string;

  /** Human-readable display name */
  name: string;

  /** 
   * Semantic version 
   * Format: major.minor.patch (e.g., "1.0.0")
   */
  version: string;

  /** 
   * Short description of app purpose
   * Displayed on home grid and app listings
   */
  description?: string;

  /** 
   * Path to app icon, relative to package root
   * Default: "{appId}-logo.png" (resolved in host/public/app-logos/)
   */
  icon?: string;

  /** Author or organization name */
  author?: string;

  /** URL to project homepage or documentation */
  homepage?: string;

  /** 
   * Required permissions for the app to function
   * Users must grant these on first launch
   */
  permissions: PermissionScopes;

  /** 
   * Dependencies on host features or other apps
   * Reserved for future use
   */
  dependencies?: string[];

  /** 
   * If true, app is hidden from home grid
   * Useful for meta-apps like scrum-board
   */
  hidden?: boolean;

  /**
   * Manifest format version
   * Defaults to "1.0" if not specified
   */
  manifest_version?: string;

  /**
   * Intent system configuration
   * Allows apps to declare actions they handle and actions they want to invoke
   */
  intents?: IntentConfig;

  /**
   * If true, app provides a widget for the home screen
   * Widget data is fetched from GET /api/apps/<appId>/widget
   */
  widget?: boolean;
};

/**
 * App Manifest v0 (App Contract v0)
 * Extended manifest for standalone/containerized apps
 * Includes entrypoint, health check, and endpoint configuration
 */
export type AppManifestV0 = AppManifest & {
  /** Manifest version for v0 contract */
  manifest_version: '0.1.0';
  /** Runtime entrypoint configuration (REQUIRED) */
  entry: EntryConfig;
  /** Health check configuration (REQUIRED) */
  health: HealthConfig;
  /** Optional API endpoints */
  endpoints?: EndpointConfig;
};

/**
 * Union type for all manifest versions
 */
export type AnyAppManifest = AppManifest | AppManifestV0;

/**
 * Validation error structure
 */
export type ManifestValidationError = {
  /** Field path that failed validation */
  field: string;
  /** Human-readable error message */
  message: string;
};

/**
 * Validation result types
 */
export type ManifestValidationResult =
  | { valid: true; manifest: AppManifest }
  | { valid: false; errors: ManifestValidationError[] };

/**
 * Constants for manifest validation
 */
export const MANIFEST_CONSTRAINTS = {
  /** Minimum length for app ID */
  MIN_ID_LENGTH: 1,
  /** Maximum length for app ID */
  MAX_ID_LENGTH: 64,
  /** Reserved app IDs that cannot be used */
  RESERVED_IDS: ['citadel', 'host', 'api', 'static', 'core', 'internal'],
  /** Valid characters for app ID (regex pattern) */
  ID_PATTERN: /^[a-z][a-z0-9-]*[a-z0-9]$/,
  /** Default manifest version */
  DEFAULT_VERSION: '1.0',
  /** Required fields in manifest */
  REQUIRED_FIELDS: ['id', 'name', 'version', 'permissions'] as const,
  /** Required fields for v0 contract (standalone apps) */
  REQUIRED_FIELDS_V0: ['id', 'name', 'version', 'entry', 'health', 'permissions'] as const,
  /** Supported manifest versions */
  SUPPORTED_VERSIONS: ['1.0', '0.1.0'] as const,
  /** Supported entry types */
  ENTRY_TYPES: ['nextjs', 'docker', 'binary', 'node', 'python', 'custom'] as const,
} as const;

/**
 * JSON Schema representation for runtime validation
 * This can be used with libraries like Zod, Yup, or AJV
 */
export const MANIFEST_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['id', 'name', 'version', 'permissions'],
  properties: {
    id: {
      type: 'string',
      pattern: '^[a-z][a-z0-9-]*[a-z0-9]$',
      minLength: 1,
      maxLength: 64,
      description: 'Unique app identifier (lowercase alphanumeric with hyphens)',
    },
    name: {
      type: 'string',
      minLength: 1,
      description: 'Human-readable app name',
    },
    version: {
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+.*$',
      description: 'Semantic version (e.g., 1.0.0)',
    },
    description: {
      type: 'string',
      description: 'Short description of the app',
    },
    icon: {
      type: 'string',
      description: 'Path to app icon relative to package root',
    },
    author: {
      type: 'string',
      description: 'Author or organization name',
    },
    homepage: {
      type: 'string',
      format: 'uri',
      description: 'URL to project homepage',
    },
    network: {
      type: 'array',
      items: {
        type: 'string',
        pattern: '^[a-z0-9.*-]+$',
      },
      description: 'Allowed outbound domains (root-level policy, deny-by-default when omitted)',
    },
    permissions: {
      type: 'object',
      properties: {
        db: {
          type: 'object',
          properties: {
            read: { type: 'boolean' },
            write: { type: 'boolean' },
          },
        },
        storage: {
          type: 'object',
          properties: {
            read: { type: 'boolean' },
            write: { type: 'boolean' },
          },
        },
        ai: {
          type: 'boolean',
          description: 'Allow AI API access',
        },
        network: {
          type: 'array',
          items: {
            type: 'string',
            pattern: '^[a-z0-9.*-]+$',
          },
          description: 'Allowed external domains',
        },
        intents: {
          type: 'object',
          properties: {
            provides: {
              type: 'array',
              items: { type: 'string' },
              description: 'Action URIs this app provides',
            },
            uses: {
              type: 'array',
              items: { type: 'string' },
              description: 'Action URIs this app wants to invoke',
            },
          },
          description: 'Intent permissions for cross-app communication',
        },
      },
    },
    intents: {
      type: 'object',
      properties: {
        provides: {
          type: 'array',
          items: { type: 'string' },
          description: 'Action URIs this app provides (e.g., ["gym.log-exercise"])',
        },
        uses: {
          type: 'array',
          items: { type: 'string' },
          description: 'Action URIs this app wants to invoke (e.g., ["citadel.search"])',
        },
      },
      description: 'Intent system configuration for cross-app communication',
    },
    dependencies: {
      type: 'array',
      items: { type: 'string' },
      description: 'Required host features or other apps',
    },
    hidden: {
      type: 'boolean',
      description: 'Hide from home grid',
    },
    widget: {
      type: 'boolean',
      description: 'Enable home screen widget for this app',
    },
    manifest_version: {
      type: 'string',
      default: '1.0',
      description: 'Manifest format version',
    },
  },
} as const;

/**
 * Validates an app ID string
 * @param id - The app ID to validate
 * @returns Validation result with error message if invalid
 */
export function validateAppId(id: string): { valid: true } | { valid: false; error: string } {
  const { MIN_ID_LENGTH, MAX_ID_LENGTH, RESERVED_IDS, ID_PATTERN } = MANIFEST_CONSTRAINTS;

  if (!id || id.length < MIN_ID_LENGTH) {
    return { valid: false, error: `App ID must be at least ${MIN_ID_LENGTH} character` };
  }

  if (id.length > MAX_ID_LENGTH) {
    return { valid: false, error: `App ID must be at most ${MAX_ID_LENGTH} characters` };
  }

  if ((RESERVED_IDS as readonly string[]).includes(id)) {
    return { valid: false, error: `App ID "${id}" is reserved` };
  }

  if (id.includes('--')) {
    return { valid: false, error: 'App ID cannot contain consecutive hyphens' };
  }

  if (id.startsWith('-') || id.endsWith('-')) {
    return { valid: false, error: 'App ID cannot start or end with a hyphen' };
  }

  if (!ID_PATTERN.test(id)) {
    return { 
      valid: false, 
      error: 'App ID must be lowercase alphanumeric with hyphens, starting with a letter' 
    };
  }

  return { valid: true };
}

/**
 * Type guard for checking if a value is a valid AppManifest
 * @param value - The value to check
 * @returns Type predicate for AppManifest
 */
export function isAppManifest(value: unknown): value is AppManifest {
  if (!value || typeof value !== 'object') return false;
  
  const obj = value as Record<string, unknown>;
  
  // Check required fields
  if (typeof obj.id !== 'string') return false;
  if (typeof obj.name !== 'string') return false;
  if (typeof obj.version !== 'string') return false;
  if (!obj.permissions || typeof obj.permissions !== 'object') return false;
  
  // Validate app ID format
  const idCheck = validateAppId(obj.id);
  if (!idCheck.valid) return false;
  
  return true;
}

/**
 * Type guard for checking if a manifest is v0 format (standalone/containerized)
 * @param value - The value to check
 * @returns Type predicate for AppManifestV0
 */
export function isAppManifestV0(value: unknown): value is AppManifestV0 {
  if (!isAppManifest(value)) return false;
  
  const obj = value as Record<string, unknown>;
  
  // Check manifest version indicates v0
  if (obj.manifest_version !== '0.1.0') return false;
  
  // Check v0 required fields
  if (!obj.entry || typeof obj.entry !== 'object') return false;
  if (!obj.health || typeof obj.health !== 'object') return false;
  
  const entry = obj.entry as Record<string, unknown>;
  const health = obj.health as Record<string, unknown>;
  
  // Validate entry.type exists
  if (typeof entry.type !== 'string') return false;
  
  // Validate health.endpoint is /healthz
  if (health.endpoint !== '/healthz') return false;
  
  return true;
}

/**
 * Validate entry configuration for v0 manifests
 * @param entry - The entry config to validate
 * @returns Validation result
 */
export function validateEntryConfig(entry: unknown): { valid: true } | { valid: false; error: string } {
  if (!entry || typeof entry !== 'object') {
    return { valid: false, error: 'Entry must be an object' };
  }
  
  const e = entry as Record<string, unknown>;
  
  if (typeof e.type !== 'string') {
    return { valid: false, error: 'Entry type is required' };
  }
  
  const validTypes = MANIFEST_CONSTRAINTS.ENTRY_TYPES;
  if (!validTypes.includes(e.type as typeof validTypes[number])) {
    return { valid: false, error: `Invalid entry type: ${e.type}. Valid types: ${validTypes.join(', ')}` };
  }
  
  // Check required fields for specific types
  if (['binary', 'node', 'python', 'custom'].includes(e.type) && !e.command) {
    return { valid: false, error: `Entry type "${e.type}" requires a "command" field` };
  }
  
  if (e.type === 'docker' && !e.image) {
    return { valid: false, error: 'Entry type "docker" requires an "image" field' };
  }
  
  return { valid: true };
}

/**
 * Validate health configuration for v0 manifests
 * @param health - The health config to validate
 * @returns Validation result
 */
export function validateHealthConfig(health: unknown): { valid: true } | { valid: false; error: string } {
  if (!health || typeof health !== 'object') {
    return { valid: false, error: 'Health must be an object' };
  }
  
  const h = health as Record<string, unknown>;
  
  if (h.endpoint !== '/healthz') {
    return { valid: false, error: 'Health endpoint must be "/healthz"' };
  }
  
  // Validate numeric fields if present
  if (h.interval !== undefined && (typeof h.interval !== 'number' || h.interval < 5)) {
    return { valid: false, error: 'Health interval must be at least 5 seconds' };
  }
  
  if (h.timeout !== undefined && (typeof h.timeout !== 'number' || h.timeout < 1)) {
    return { valid: false, error: 'Health timeout must be at least 1 second' };
  }
  
  if (h.initialDelay !== undefined && (typeof h.initialDelay !== 'number' || h.initialDelay < 0)) {
    return { valid: false, error: 'Health initialDelay must be non-negative' };
  }
  
  return { valid: true };
}

/**
 * Comprehensive manifest validation
 * Validates both standard and v0 contract manifests
 * @param manifest - The manifest to validate
 * @returns Validation result with errors if invalid
 */
export function validateManifest(manifest: unknown): ManifestValidationResult {
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: [{ field: 'root', message: 'Manifest must be an object' }] };
  }
  
  const errors: ManifestValidationError[] = [];
  const obj = manifest as Record<string, unknown>;
  
  // Determine manifest version
  const manifestVersion = (obj.manifest_version as string) || MANIFEST_CONSTRAINTS.DEFAULT_VERSION;
  const isV0 = manifestVersion === '0.1.0';
  
  // Get required fields based on version
  const requiredFields = isV0 
    ? MANIFEST_CONSTRAINTS.REQUIRED_FIELDS_V0 
    : MANIFEST_CONSTRAINTS.REQUIRED_FIELDS;
  
  // Check required fields
  for (const field of requiredFields) {
    if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
      errors.push({ field, message: `Missing required field: ${field}` });
    }
  }
  
  // Validate app ID
  if (typeof obj.id === 'string') {
    const idCheck = validateAppId(obj.id);
    if (!idCheck.valid) {
      errors.push({ field: 'id', message: idCheck.error });
    }
  }
  
  // Validate v0-specific fields
  if (isV0) {
    if (obj.entry) {
      const entryCheck = validateEntryConfig(obj.entry);
      if (!entryCheck.valid) {
        errors.push({ field: 'entry', message: entryCheck.error });
      }
    }
    
    if (obj.health) {
      const healthCheck = validateHealthConfig(obj.health);
      if (!healthCheck.valid) {
        errors.push({ field: 'health', message: healthCheck.error });
      }
    }
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return { valid: true, manifest: manifest as AppManifest };
}
