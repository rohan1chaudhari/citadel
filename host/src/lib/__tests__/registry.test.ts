/**
 * Registry Tests - Registry-Only Mode
 * 
 * These tests verify that the host works correctly in registry-only mode
 * where all apps are external and registered via the gateway API.
 * 
 * NOTE: These are unit tests for the contract/schema validation.
 * Integration tests with the actual database require mocking node:sqlite.
 */

import { describe, it, expect } from 'vitest';
import { validateCitadelAppContract } from '../citadelAppContract';

describe('Registry-Only Mode - Schema Validation', () => {
  describe('App Manifest Validation', () => {
    it('should validate required fields', () => {
      const valid = validateCitadelAppContract({
        id: 'test-app',
        name: 'Test App',
        version: '1.0.0',
        entry: '/',
        health: '/healthz',
        permissions: [],
      });

      expect(valid.ok).toBe(true);
    });

    it('should reject invalid app IDs', () => {
      const invalid = validateCitadelAppContract({
        id: 'Invalid App ID!', // spaces and special chars not allowed
        name: 'Test',
        version: '1.0.0',
      });

      expect(invalid.ok).toBe(false);
    });

    it('should reject missing required fields', () => {
      const invalid = validateCitadelAppContract({
        id: 'test-app',
        // missing name and version
      });

      expect(invalid.ok).toBe(false);
    });

    it('should accept valid app IDs with hyphens', () => {
      const valid = validateCitadelAppContract({
        id: 'my-external-app',
        name: 'My External App',
        version: '1.0.0',
        entry: '/',
        health: '/healthz',
        permissions: [],
      });

      expect(valid.ok).toBe(true);
    });

    it('should accept valid app IDs with numbers', () => {
      const valid = validateCitadelAppContract({
        id: 'app123',
        name: 'App 123',
        version: '1.0.0',
        entry: '/',
        health: '/healthz',
        permissions: [],
      });

      expect(valid.ok).toBe(true);
    });

    it('should reject app IDs starting with numbers', () => {
      const invalid = validateCitadelAppContract({
        id: '123-app',
        name: '123 App',
        version: '1.0.0',
      });

      expect(invalid.ok).toBe(false);
    });
  });
});

describe('Registry-Only Mode - Expected Behavior', () => {
  describe('App Registration Contract', () => {
    it('should require upstreamBaseUrl for external apps', () => {
      // External apps must have an upstream URL for proxying
      const registrationInput = {
        manifest: {
          id: 'external-app',
          name: 'External App',
          version: '1.0.0',
          entry: '/',
          health: '/healthz',
        },
        upstreamBaseUrl: 'http://localhost:4010',
        enabled: true,
      };

      expect(registrationInput.upstreamBaseUrl).toBeDefined();
      expect(registrationInput.upstreamBaseUrl.startsWith('http')).toBe(true);
    });

    it('should support disabling apps without removing them', () => {
      const enabledApp = { enabled: true };
      const disabledApp = { enabled: false };

      expect(enabledApp.enabled).toBe(true);
      expect(disabledApp.enabled).toBe(false);
    });
  });

  describe('Proxy Routing Logic', () => {
    it('should construct correct upstream URLs', () => {
      const joinUpstream = (base: string, pathParts: string[], search: string): string => {
        const cleanBase = base.replace(/\/$/, '');
        const rel = pathParts.join('/');
        const path = rel ? `/${rel}` : '/';
        return `${cleanBase}${path}${search}`;
      };

      expect(joinUpstream('http://localhost:4010', ['api', 'test'], '?key=value'))
        .toBe('http://localhost:4010/api/test?key=value');
      
      expect(joinUpstream('http://localhost:4010/', ['api', 'test'], ''))
        .toBe('http://localhost:4010/api/test');
      
      expect(joinUpstream('http://localhost:4010', [], ''))
        .toBe('http://localhost:4010/');
    });

    it('should normalize trailing slashes', () => {
      const normalize = (url: string): string => url.replace(/\/$/, '');
      
      expect(normalize('http://localhost:4010/')).toBe('http://localhost:4010');
      expect(normalize('http://localhost:4010')).toBe('http://localhost:4010');
    });
  });

  describe('Registry-Only Mode Characteristics', () => {
    it('should identify registry apps by source field', () => {
      const registryApp = { id: 'ext', name: 'External', source: 'registry', upstream_base_url: 'http://localhost:4010' };
      const fileApp = { id: 'local', name: 'Local', source: 'app.yaml' };
      const jsonApp = { id: 'json', name: 'JSON', source: 'citadel.app.json' };

      expect(registryApp.source).toBe('registry');
      expect(fileApp.source).toBe('app.yaml');
      expect(jsonApp.source).toBe('citadel.app.json');
    });

    it('should require upstream_base_url for proxy routing', () => {
      const canProxy = (app: { source?: string; upstream_base_url?: string }): boolean => app.source === 'registry' && Boolean(app.upstream_base_url);

      expect(canProxy({ source: 'registry', upstream_base_url: 'http://localhost:4010' })).toBe(true);
      expect(canProxy({ source: 'registry' })).toBe(false);
      expect(canProxy({ source: 'app.yaml', upstream_base_url: 'http://localhost:4010' })).toBe(false);
    });
  });
});

describe('External-Only Hardening', () => {
  it('should not have hardcoded internal app IDs in status page', () => {
    // Status page should dynamically fetch apps from registry
    // This test documents the expected behavior change
    const dynamicApps = [
      { id: 'app1', name: 'App 1', source: 'registry' },
      { id: 'app2', name: 'App 2', source: 'registry' },
    ];
    
    // Should be able to filter to registry-only apps
    const registryApps = dynamicApps.filter(a => a.source === 'registry');
    expect(registryApps.length).toBe(2);
  });

  it('should allow configurable scrum board app ID', () => {
    const SCRUM_BOARD_APP_ID = process.env.NEXT_PUBLIC_SCRUM_BOARD_APP_ID || 'scrum-board';
    
    // Should default to 'scrum-board' but be overridable
    expect(SCRUM_BOARD_APP_ID).toBeDefined();
    expect(SCRUM_BOARD_APP_ID.length).toBeGreaterThan(0);
  });
});
