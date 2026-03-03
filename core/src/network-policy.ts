/**
 * Network Policy Enforcement
 * 
 * Enforces per-app network access controls based on app.yaml permissions.
 * Supports wildcard domain matching and audit logging for blocked requests.
 * 
 * @module @citadel/core/network-policy
 */

import { audit } from './audit.js';
import { getAppManifest } from './registry.js';

/**
 * Network policy check result
 */
export type NetworkPolicyResult = 
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Parse a URL and extract the hostname
 * @param url - The URL to parse (can be full URL or just hostname)
 * @returns The hostname or null if invalid
 */
export function extractHostname(url: string): string | null {
  try {
    // If it's just a hostname without protocol, add one for parsing
    let urlToParse = url;
    if (!url.includes('://')) {
      urlToParse = `https://${url}`;
    }
    const parsed = new URL(urlToParse);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Check if a hostname matches a domain pattern with wildcard support
 * @param hostname - The hostname to check (e.g., "api.openai.com")
 * @param pattern - The domain pattern (e.g., "*.openai.com" or "api.openai.com")
 * @returns true if the hostname matches the pattern
 */
export function matchesDomainPattern(hostname: string, pattern: string): boolean {
  const normalizedHostname = hostname.toLowerCase();
  const normalizedPattern = pattern.toLowerCase().trim();
  
  // Exact match
  if (normalizedHostname === normalizedPattern) {
    return true;
  }
  
  // Wildcard match: *.example.com matches any subdomain depth of example.com
  if (normalizedPattern.startsWith('*.')) {
    const baseDomain = normalizedPattern.slice(2); // Remove "*."

    // Must be a true subdomain (base domain itself should not match)
    return normalizedHostname.endsWith(`.${baseDomain}`);
  }
  
  return false;
}

/**
 * Get the network allowlist for an app from its manifest
 * @param appId - The app ID to check
 * @returns Array of allowed domain patterns, or null if network permissions not set
 */
export async function getNetworkAllowlist(appId: string): Promise<string[] | null> {
  const manifest = await getAppManifest(appId);
  if (!manifest) {
    return null;
  }
  
  // Prefer root-level `network` (P4-07), fall back to legacy `permissions.network`
  const network = manifest.network ?? manifest.permissions?.network;
  if (!network) {
    return null;
  }

  // Empty array means no outbound access (deny-by-default)
  return network;
}

/**
 * Check if a URL is allowed for a specific app
 * @param appId - The app making the request
 * @param url - The URL to check
 * @returns NetworkPolicyResult indicating if the request is allowed
 */
export async function checkNetworkPolicy(
  appId: string, 
  url: string
): Promise<NetworkPolicyResult> {
  const allowlist = await getNetworkAllowlist(appId);
  
  // If no network permissions defined, deny by default
  if (allowlist === null) {
    return { 
      allowed: false, 
      reason: 'No network permissions defined in app.yaml (deny-by-default)' 
    };
  }
  
  // Empty allowlist means no outbound access
  if (allowlist.length === 0) {
    return { 
      allowed: false, 
      reason: 'Network access explicitly disabled (empty allowlist)' 
    };
  }
  
  const hostname = extractHostname(url);
  if (!hostname) {
    return { allowed: false, reason: 'Invalid URL format' };
  }
  
  // Check against allowlist patterns
  for (const pattern of allowlist) {
    if (matchesDomainPattern(hostname, pattern)) {
      return { allowed: true };
    }
  }
  
  return { 
    allowed: false, 
    reason: `Domain "${hostname}" not in allowlist` 
  };
}

/**
 * Log a blocked network request to audit
 * @param appId - The app that made the request
 * @param url - The URL that was blocked
 * @param reason - Why the request was blocked
 */
export function logBlockedRequest(appId: string, url: string, reason: string): void {
  const targetDomain = extractHostname(url);
  audit(appId, 'network_request_blocked', {
    url,
    target_domain: targetDomain,
    reason,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Wrapped fetch that enforces network policy for an app
 * @param appId - The app making the request
 * @param url - The URL to fetch
 * @param init - Fetch init options
 * @returns Fetch response
 * @throws Error if the request violates network policy
 */
export async function appFetch(
  appId: string,
  url: string | URL | Request,
  init?: RequestInit
): Promise<Response> {
  const urlString = url.toString();
  
  const policyCheck = await checkNetworkPolicy(appId, urlString);
  
  if (!policyCheck.allowed) {
    const reason = (policyCheck as { allowed: false; reason: string }).reason;
    logBlockedRequest(appId, urlString, reason);
    throw new Error(
      `Network request blocked for app "${appId}": ${reason}`
    );
  }
  
  return fetch(url, init);
}

/**
 * Synchronous check if a URL is allowed (for use when async is not possible)
 * Requires pre-loaded allowlist from manifest
 * @param hostname - The hostname to check
 * @param allowlist - The list of allowed domain patterns
 * @returns true if the hostname is in the allowlist
 */
export function isHostnameAllowed(hostname: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) {
    return false;
  }
  
  for (const pattern of allowlist) {
    if (matchesDomainPattern(hostname, pattern)) {
      return true;
    }
  }
  
  return false;
}
