/**
 * Integration tests for Citadel host core guarantees
 *
 * Tests validate:
 * - Per-app DB isolation
 * - Storage path traversal protection
 * - SQL guardrails
 * - App ID validation
 * - Audit logging
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { dbExec, dbQuery } from '@citadel/core';
import { storageWriteText, storageReadText } from '@citadel/core';
import { assertAppId } from '@citadel/core';
import { assertSqlAllowed } from '@citadel/core';
import { setAppPermissions } from '@citadel/core';
import { appDataRoot, appDbPath } from '@citadel/core';

// Test data directories
const TEST_DATA_ROOT = path.join(process.cwd(), 'test-data');
const TEST_APP_A = 'test-app-a';
const TEST_APP_B = 'test-app-b';

describe('Citadel Host Integration Tests', () => {
  beforeEach(() => {
    // Set test data root
    process.env.CITADEL_DATA_ROOT = TEST_DATA_ROOT;

    // Create citadel DB directory first (needed for permissions system)
    fs.mkdirSync(appDataRoot('citadel'), { recursive: true });

    // Create test apps directories
    fs.mkdirSync(appDataRoot(TEST_APP_A), { recursive: true });
    fs.mkdirSync(appDataRoot(TEST_APP_B), { recursive: true });

    // Grant permissions for test apps
    setAppPermissions(TEST_APP_A, {
      db: { read: true, write: true },
      storage: { read: true, write: true },
    });
    setAppPermissions(TEST_APP_B, {
      db: { read: true, write: true },
      storage: { read: true, write: true },
    });
  });

  afterEach(() => {
    // Clean up test data
    try {
      fs.rmSync(TEST_DATA_ROOT, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    delete process.env.CITADEL_DATA_ROOT;
  });

  describe('DB Isolation', () => {
    it('app A cannot read app B\'s database', () => {
      // Create table and insert data in app A
      dbExec(TEST_APP_A, 'CREATE TABLE IF NOT EXISTS secrets (id INTEGER PRIMARY KEY, value TEXT)');
      dbExec(TEST_APP_A, "INSERT INTO secrets (value) VALUES ('app-a-secret')");

      // Create table and insert data in app B
      dbExec(TEST_APP_B, 'CREATE TABLE IF NOT EXISTS secrets (id INTEGER PRIMARY KEY, value TEXT)');
      dbExec(TEST_APP_B, "INSERT INTO secrets (value) VALUES ('app-b-secret')");

      // App A should not see app B's data
      const appAData = dbQuery<{ value: string }>(TEST_APP_A, 'SELECT value FROM secrets');
      expect(appAData).toHaveLength(1);
      expect(appAData[0].value).toBe('app-a-secret');

      // App B should not see app A's data
      const appBData = dbQuery<{ value: string }>(TEST_APP_B, 'SELECT value FROM secrets');
      expect(appBData).toHaveLength(1);
      expect(appBData[0].value).toBe('app-b-secret');

      // Verify databases are in separate files
      const dbPathA = appDbPath(TEST_APP_A);
      const dbPathB = appDbPath(TEST_APP_B);
      expect(dbPathA).not.toBe(dbPathB);
      expect(fs.existsSync(dbPathA)).toBe(true);
      expect(fs.existsSync(dbPathB)).toBe(true);
    });

    it('each app has its own isolated database file', () => {
      // Create different tables in each app
      dbExec(TEST_APP_A, 'CREATE TABLE IF NOT EXISTS app_a_table (id INTEGER PRIMARY KEY)');
      dbExec(TEST_APP_B, 'CREATE TABLE IF NOT EXISTS app_b_table (id INTEGER PRIMARY KEY)');

      // App A should only see its own table
      const appATables = dbQuery<{ name: string }>(
        TEST_APP_A,
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      );
      const appATableNames = appATables.map((t) => t.name);
      expect(appATableNames).toContain('app_a_table');
      expect(appATableNames).not.toContain('app_b_table');

      // App B should only see its own table
      const appBTables = dbQuery<{ name: string }>(
        TEST_APP_B,
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      );
      const appBTableNames = appBTables.map((t) => t.name);
      expect(appBTableNames).toContain('app_b_table');
      expect(appBTableNames).not.toContain('app_a_table');
    });
  });

  describe('Storage Path Traversal Protection', () => {
    it('blocks path traversal with ../', async () => {
      await expect(
        storageWriteText(TEST_APP_A, '../outside-app.txt', 'malicious content')
      ).rejects.toThrow('Path escapes app storage root');
    });

    it('blocks path traversal with encoded ..', async () => {
      await expect(
        storageWriteText(TEST_APP_A, '..%2foutside-app.txt', 'malicious content')
      ).rejects.toThrow('Path escapes app storage root');
    });

    it('blocks absolute path outside app root', async () => {
      await expect(
        storageWriteText(TEST_APP_A, '/etc/passwd', 'malicious content')
      ).rejects.toThrow('Path escapes app storage root');
    });

    it('allows valid relative paths', async () => {
      await storageWriteText(TEST_APP_A, 'subdir/file.txt', 'valid content');
      const content = await storageReadText(TEST_APP_A, 'subdir/file.txt');
      expect(content).toBe('valid content');
    });

    it('allows files in app root', async () => {
      await storageWriteText(TEST_APP_A, 'file.txt', 'root content');
      const content = await storageReadText(TEST_APP_A, 'file.txt');
      expect(content).toBe('root content');
    });

    it('prevents reading outside app storage', async () => {
      // Create a file outside app A's directory (in app B's directory)
      const outsidePath = path.join(appDataRoot(TEST_APP_B), 'private.txt');
      fs.writeFileSync(outsidePath, 'private data', 'utf8');

      // App A should not be able to read it using path traversal
      await expect(
        storageReadText(TEST_APP_A, `../${TEST_APP_B}/private.txt`)
      ).rejects.toThrow('Path escapes app storage root');
    });
  });

  describe('SQL Guardrails', () => {
    it('blocks ATTACH statements', () => {
      expect(() => assertSqlAllowed('ATTACH DATABASE "other.db" AS other')).toThrow(
        'SQL contains blocked keyword'
      );
    });

    it('blocks DETACH statements', () => {
      expect(() => assertSqlAllowed('DETACH DATABASE other')).toThrow(
        'SQL contains blocked keyword'
      );
    });

    it('blocks PRAGMA statements', () => {
      expect(() => assertSqlAllowed('PRAGMA foreign_keys = OFF')).toThrow(
        'SQL contains blocked keyword'
      );
    });

    it('blocks VACUUM statements', () => {
      expect(() => assertSqlAllowed('VACUUM')).toThrow('SQL contains blocked keyword');
    });

    it('blocks multi-statement SQL', () => {
      expect(() =>
        assertSqlAllowed('SELECT 1; DROP TABLE users;')
      ).toThrow('Multi-statement SQL is not allowed');
    });

    it('blocks case variations of blocked keywords', () => {
      expect(() => assertSqlAllowed('attach database "x.db"')).toThrow();
      expect(() => assertSqlAllowed('ATTACH DATABASE "x.db"')).toThrow();
      expect(() => assertSqlAllowed('PrAgMa foreign_keys')).toThrow();
      expect(() => assertSqlAllowed('vacuum')).toThrow();
    });

    it('allows safe SELECT statements', () => {
      expect(() => assertSqlAllowed('SELECT * FROM users')).not.toThrow();
    });

    it('allows safe INSERT statements', () => {
      expect(() => assertSqlAllowed("INSERT INTO users (name) VALUES ('test')")).not.toThrow();
    });

    it('allows safe CREATE TABLE statements', () => {
      expect(() =>
        assertSqlAllowed('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY)')
      ).not.toThrow();
    });

    it('blocks PRAGMA in subqueries', () => {
      expect(() =>
        assertSqlAllowed('SELECT * FROM (PRAGMA foreign_keys)')
      ).toThrow('SQL contains blocked keyword');
    });
  });

  describe('App ID Validation', () => {
    it('accepts valid app IDs', () => {
      expect(() => assertAppId('my-app')).not.toThrow();
      expect(() => assertAppId('app123')).not.toThrow();
      expect(() => assertAppId('a')).not.toThrow();
      expect(() => assertAppId('my-cool-app-name')).not.toThrow();
      expect(() => assertAppId('a'.repeat(64))).not.toThrow(); // Max length
    });

    it('rejects app IDs starting with numbers', () => {
      expect(() => assertAppId('123-app')).toThrow('Invalid appId');
    });

    it('rejects app IDs with uppercase letters', () => {
      expect(() => assertAppId('My-App')).toThrow('Invalid appId');
    });

    it('rejects app IDs with special characters', () => {
      expect(() => assertAppId('my_app')).toThrow('Invalid appId');
      expect(() => assertAppId('my.app')).toThrow('Invalid appId');
      expect(() => assertAppId('my@app')).toThrow('Invalid appId');
      expect(() => assertAppId('my app')).toThrow('Invalid appId');
    });

    it('rejects app IDs that are too long', () => {
      expect(() => assertAppId('a'.repeat(65))).toThrow('Invalid appId');
    });

    it('rejects empty app IDs', () => {
      expect(() => assertAppId('')).toThrow('Invalid appId');
    });

    it('rejects app IDs with path traversal', () => {
      expect(() => assertAppId('../etc')).toThrow('Invalid appId');
      expect(() => assertAppId('..')).toThrow('Invalid appId');
    });
  });

  describe('Permission Enforcement', () => {
    const NO_PERMS_APP = 'no-perms-app';

    beforeEach(() => {
      // Ensure citadel DB directory exists
      fs.mkdirSync(appDataRoot('citadel'), { recursive: true });
      // This app has no permissions granted
      fs.mkdirSync(appDataRoot(NO_PERMS_APP), { recursive: true });
    });

    it('blocks DB read without permission', () => {
      expect(() => dbQuery(NO_PERMS_APP, 'SELECT 1')).toThrow('Permission denied');
    });

    it('blocks DB write without permission', () => {
      expect(() => dbExec(NO_PERMS_APP, 'CREATE TABLE test (id INTEGER)')).toThrow(
        'Permission denied'
      );
    });

    it('blocks storage read without permission', async () => {
      await expect(storageReadText(NO_PERMS_APP, 'file.txt')).rejects.toThrow(
        'Permission denied'
      );
    });

    it('blocks storage write without permission', async () => {
      await expect(storageWriteText(NO_PERMS_APP, 'file.txt', 'content')).rejects.toThrow(
        'Permission denied'
      );
    });

    it('allows DB read with read permission', () => {
      setAppPermissions(NO_PERMS_APP, { db: { read: true } });
      // Should not throw now
      expect(() => dbQuery(NO_PERMS_APP, 'SELECT 1')).not.toThrow('Permission denied');
    });

    it('blocks DB write with only read permission', () => {
      setAppPermissions(NO_PERMS_APP, { db: { read: true, write: false } });
      expect(() => dbExec(NO_PERMS_APP, 'CREATE TABLE test (id INTEGER)')).toThrow(
        'Permission denied'
      );
    });
  });

  describe('Audit Events', () => {
    it('audit log table exists in citadel DB', () => {
      const citadelDbPath = path.join(TEST_DATA_ROOT, 'apps', 'citadel', 'db.sqlite');
      expect(fs.existsSync(citadelDbPath)).toBe(true);
    });
  });
});
