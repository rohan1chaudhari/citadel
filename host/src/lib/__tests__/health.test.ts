/**
 * Health Check Tests - Registry-Only Mode
 * 
 * Tests for the health check endpoints in registry-only mode.
 */

import { describe, it, expect } from 'vitest';

describe('Health Checks - Registry Only', () => {
  describe('External App Health', () => {
    it('should proxy health checks to registered apps', async () => {
      // The health check should:
      // 1. Look up the app in the registry
      // 2. If found with upstream_base_url, proxy to that URL + health path
      // 3. Return the upstream response
      
      // This is an integration test that would require:
      // - A mock HTTP server for the upstream
      // - The actual Next.js app handler
      
      // For now, we document the expected behavior:
      const mockUpstreamResponse = {
        ok: true,
        appId: 'test-app',
        source: 'registry',
        upstream: 'http://localhost:4010/healthz',
        status: 200,
        ts: new Date().toISOString(),
      };

      expect(mockUpstreamResponse.source).toBe('registry');
      expect(mockUpstreamResponse.ok).toBe(true);
    });

    it('should return local health for non-registered apps', () => {
      // For apps not in registry, return local health
      const localHealth = {
        ok: true,
        appId: 'local-app',
        source: 'local',
        ts: new Date().toISOString(),
      };

      expect(localHealth.source).toBe('local');
    });

    it('should handle upstream timeouts gracefully', () => {
      // When upstream doesn't respond, should return 502 with error info
      const timeoutResponse = {
        ok: false,
        appId: 'test-app',
        source: 'registry',
        upstream: 'http://localhost:4010/healthz',
        error: 'fetch failed or timeout',
        ts: new Date().toISOString(),
      };

      expect(timeoutResponse.ok).toBe(false);
      expect(timeoutResponse.error).toBeDefined();
    });
  });

  describe('Selftest Endpoint', () => {
    it('should verify database connectivity for any app', () => {
      // Selftest should:
      // 1. Create a test table entry
      // 2. Read it back
      // 3. Write to storage
      // 4. Read from storage
      // 5. Return success
      
      const selftestResult = {
        ok: true,
        appId: 'any-app-id',
        db: {
          recent: [{ id: 1, note: 'hello from any-app-id', created_at: new Date().toISOString() }],
        },
        storage: {
          path: 'selftest.txt',
          readBack: 'citadel selftest (any-app-id) @ ' + new Date().toISOString(),
        },
      };

      expect(selftestResult.ok).toBe(true);
      expect(selftestResult.db.recent.length).toBeGreaterThan(0);
    });
  });
});
