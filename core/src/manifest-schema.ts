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
};

/**
 * Validated app manifest structure
 * This represents the canonical format for app.yaml files
 */
export type AppManifest = {
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
};

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
      },
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
