/**
 * Auth utilities for optional passphrase-based authentication
 * 
 * Auth is controlled by:
 * - CITADEL_AUTH_ENABLED env var (default: false)
 * - passphrase_hash stored in auth_config table
 * 
 * When auth is disabled (default), all requests pass through.
 * When enabled, users must login via /login to get a session cookie.
 */

import { dbQuery, dbExec } from './db.js';

const AUTH_ENABLED = process.env.CITADEL_AUTH_ENABLED === 'true';
const SESSION_COOKIE_NAME = 'citadel_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export interface AuthSession {
  authenticated: boolean;
  expiresAt?: number;
}

/**
 * Check if authentication is enabled
 */
export function isAuthEnabled(): boolean {
  return AUTH_ENABLED;
}

/**
 * Get the stored passphrase hash from DB
 */
export function getPassphraseHash(): string | null {
  if (!AUTH_ENABLED) return null;
  
  try {
    const result = dbQuery<{ value: string }>('citadel', 
      'SELECT value FROM auth_config WHERE key = ?',
      ['passphrase_hash']
    );
    return result.length > 0 ? result[0].value : null;
  } catch {
    return null;
  }
}

/**
 * Check if a passphrase hash is set (auth is configured)
 */
export function isAuthConfigured(): boolean {
  return getPassphraseHash() !== null;
}

/**
 * Hash a passphrase using simple PBKDF2-like approach
 * (Using crypto module since argon2 may not be available in all environments)
 */
export async function hashPassphrase(passphrase: string): Promise<string> {
  const crypto = await import('crypto');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a passphrase against a stored hash
 */
export async function verifyPassphrase(passphrase: string, storedHash: string): Promise<boolean> {
  const crypto = await import('crypto');
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  
  const computed = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256').toString('hex');
  return computed === hash;
}

/**
 * Set the passphrase hash (first-time setup)
 */
export async function setPassphrase(passphrase: string): Promise<void> {
  const hash = await hashPassphrase(passphrase);
  const now = new Date().toISOString();
  
  dbExec('citadel',
    'INSERT OR REPLACE INTO auth_config (key, value, updated_at) VALUES (?, ?, ?)',
    ['passphrase_hash', hash, now]
  );
}

/**
 * Generate a session token
 */
export function generateSessionToken(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new session and return the token
 */
export function createSession(): string {
  const token = generateSessionToken();
  const expiresAt = Date.now() + (SESSION_MAX_AGE * 1000);
  const now = new Date().toISOString();
  
  dbExec('citadel',
    'INSERT OR REPLACE INTO auth_config (key, value, updated_at) VALUES (?, ?, ?)',
    [`session_${token}`, expiresAt.toString(), now]
  );
  
  return token;
}

/**
 * Validate a session token
 */
export function validateSession(token: string): AuthSession {
  if (!token) return { authenticated: false };
  
  try {
    const result = dbQuery<{ value: string }>('citadel',
      'SELECT value FROM auth_config WHERE key = ?',
      [`session_${token}`]
    );
    
    if (result.length === 0) {
      return { authenticated: false };
    }
    
    const expiresAt = parseInt(result[0].value, 10);
    if (Date.now() > expiresAt) {
      // Session expired, clean it up
      dbExec('citadel',
        'DELETE FROM auth_config WHERE key = ?',
        [`session_${token}`]
      );
      return { authenticated: false };
    }
    
    return { authenticated: true, expiresAt };
  } catch {
    return { authenticated: false };
  }
}

/**
 * Destroy a session
 */
export function destroySession(token: string): void {
  dbExec('citadel',
    'DELETE FROM auth_config WHERE key = ?',
    [`session_${token}`]
  );
}

/**
 * Get session cookie settings
 */
export function getSessionCookie(token: string, maxAge: number = SESSION_MAX_AGE): string {
  const isDev = process.env.NODE_ENV === 'development';
  const secure = !isDev; // Secure in production
  const sameSite = 'Strict';
  const httpOnly = true;
  
  let cookie = `${SESSION_COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAge}; SameSite=${sameSite}`;
  if (httpOnly) cookie += '; HttpOnly';
  if (secure) cookie += '; Secure';
  
  return cookie;
}

/**
 * Get clear session cookie (for logout)
 */
export function getClearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Strict; HttpOnly`;
}

/**
 * Extract session token from cookie header
 */
export function extractSessionToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === SESSION_COOKIE_NAME) {
      return value;
    }
  }
  return null;
}

/**
 * Check if request is authenticated (for middleware)
 */
export function isAuthenticated(cookieHeader: string | null): boolean {
  if (!AUTH_ENABLED) return true; // Auth disabled = always authenticated
  if (!isAuthConfigured()) return true; // No passphrase set = first-time setup allowed
  
  const token = extractSessionToken(cookieHeader);
  if (!token) return false;
  
  const session = validateSession(token);
  return session.authenticated;
}

/**
 * Get auth status for a request
 */
export function getAuthStatus(cookieHeader: string | null): {
  enabled: boolean;
  authenticated: boolean;
  needsSetup: boolean;
} {
  const enabled = AUTH_ENABLED;
  const needsSetup = enabled && !isAuthConfigured();
  
  if (!enabled) {
    return { enabled: false, authenticated: true, needsSetup: false };
  }
  
  const token = extractSessionToken(cookieHeader);
  const session = token ? validateSession(token) : { authenticated: false };
  
  return {
    enabled: true,
    authenticated: session.authenticated,
    needsSetup
  };
}
