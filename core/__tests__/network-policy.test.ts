import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  extractHostname,
  matchesDomainPattern,
  isHostnameAllowed,
} from '../src/network-policy.js';

describe('network-policy', () => {
  describe('extractHostname', () => {
    it('extracts hostname from full URL', () => {
      expect(extractHostname('https://api.openai.com/v1/chat/completions')).toBe('api.openai.com');
    });

    it('extracts hostname from URL with query params', () => {
      expect(extractHostname('https://api.example.com/path?query=1')).toBe('api.example.com');
    });

    it('handles just hostname without protocol', () => {
      expect(extractHostname('api.openai.com')).toBe('api.openai.com');
    });

    it('handles hostname with port', () => {
      expect(extractHostname('https://localhost:3000/path')).toBe('localhost');
    });

    it('returns null for invalid URL', () => {
      expect(extractHostname('not a valid url')).toBeNull();
    });

    it('normalizes to lowercase', () => {
      expect(extractHostname('HTTPS://API.EXAMPLE.COM')).toBe('api.example.com');
    });
  });

  describe('matchesDomainPattern', () => {
    it('matches exact domain', () => {
      expect(matchesDomainPattern('api.openai.com', 'api.openai.com')).toBe(true);
    });

    it('rejects non-matching exact domain', () => {
      expect(matchesDomainPattern('api.openai.com', 'api.anthropic.com')).toBe(false);
    });

    it('matches wildcard subdomain pattern', () => {
      expect(matchesDomainPattern('api.openai.com', '*.openai.com')).toBe(true);
    });

    it('matches different subdomains with wildcard', () => {
      expect(matchesDomainPattern('beta.openai.com', '*.openai.com')).toBe(true);
      expect(matchesDomainPattern('v1.api.openai.com', '*.openai.com')).toBe(true); // any subdomain depth
    });

    it('does not match base domain with wildcard pattern', () => {
      expect(matchesDomainPattern('openai.com', '*.openai.com')).toBe(false);
    });

    it('is case insensitive', () => {
      expect(matchesDomainPattern('API.OPENAI.COM', '*.openai.com')).toBe(true);
      expect(matchesDomainPattern('api.openai.com', '*.OPENAI.COM')).toBe(true);
    });

    it('handles edge cases', () => {
      expect(matchesDomainPattern('api.openai.com', '*')).toBe(false);
      expect(matchesDomainPattern('api.openai.com', '.*')).toBe(false);
    });
  });

  describe('isHostnameAllowed', () => {
    it('allows hostname in allowlist', () => {
      expect(isHostnameAllowed('api.openai.com', ['api.openai.com'])).toBe(true);
    });

    it('allows hostname matching wildcard', () => {
      expect(isHostnameAllowed('api.openai.com', ['*.openai.com'])).toBe(true);
    });

    it('denies hostname not in allowlist', () => {
      expect(isHostnameAllowed('api.evil.com', ['api.openai.com'])).toBe(false);
    });

    it('denies all with empty allowlist', () => {
      expect(isHostnameAllowed('api.openai.com', [])).toBe(false);
    });

    it('checks multiple patterns', () => {
      const allowlist = ['*.openai.com', '*.anthropic.com', 'api.stripe.com'];
      expect(isHostnameAllowed('api.openai.com', allowlist)).toBe(true);
      expect(isHostnameAllowed('api.anthropic.com', allowlist)).toBe(true);
      expect(isHostnameAllowed('api.stripe.com', allowlist)).toBe(true);
      expect(isHostnameAllowed('api.google.com', allowlist)).toBe(false);
    });
  });
});
