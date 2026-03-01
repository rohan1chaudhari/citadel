// Token bucket rate limiter keyed by app ID
// In-memory only - resets on host restart

export interface RateLimitConfig {
  // Requests per minute (default: 120)
  requestsPerMinute: number;
  // Burst capacity (default: same as requestsPerMinute)
  burstCapacity: number;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

// Default config: 120 requests per minute with burst of 120
const DEFAULT_CONFIG: RateLimitConfig = {
  requestsPerMinute: 120,
  burstCapacity: 120,
};

// Special apps that get higher limits or are exempt
const SPECIAL_LIMITS: Record<string, RateLimitConfig> = {
  'scrum-board': { requestsPerMinute: 600, burstCapacity: 600 }, // Higher limit for scrum-board
  'autopilot': { requestsPerMinute: 600, burstCapacity: 600 },   // Higher limit for autopilot
};

// In-memory store for token buckets
const buckets = new Map<string, Bucket>();

/**
 * Get the rate limit config for an app
 */
export function getRateLimitConfig(appId: string): RateLimitConfig {
  return SPECIAL_LIMITS[appId] ?? DEFAULT_CONFIG;
}

/**
 * Check if a request is allowed under rate limiting
 * @returns Object with allowed status and retry after seconds if rate limited
 */
export function checkRateLimit(appId: string): { allowed: boolean; retryAfter: number; remaining: number } {
  const config = getRateLimitConfig(appId);
  const now = Date.now();
  const refillRate = config.requestsPerMinute / 60; // tokens per second
  
  let bucket = buckets.get(appId);
  
  if (!bucket) {
    // New bucket with full tokens
    bucket = {
      tokens: config.burstCapacity - 1, // consume one for this request
      lastRefill: now,
    };
    buckets.set(appId, bucket);
    return { allowed: true, retryAfter: 0, remaining: bucket.tokens };
  }
  
  // Refill tokens based on time elapsed
  const elapsedMs = now - bucket.lastRefill;
  const tokensToAdd = (elapsedMs / 1000) * refillRate;
  
  bucket.tokens = Math.min(config.burstCapacity, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;
  
  // Check if we can consume a token
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, retryAfter: 0, remaining: Math.floor(bucket.tokens) };
  }
  
  // Rate limited - calculate retry after
  const tokensNeeded = 1 - bucket.tokens;
  const retryAfterMs = (tokensNeeded / refillRate) * 1000;
  const retryAfter = Math.ceil(retryAfterMs / 1000);
  
  return { allowed: false, retryAfter, remaining: 0 };
}

/**
 * Get current rate limit status for an app (for headers)
 */
export function getRateLimitStatus(appId: string): { limit: number; remaining: number; reset: number } {
  const config = getRateLimitConfig(appId);
  const bucket = buckets.get(appId);
  
  if (!bucket) {
    return { limit: config.burstCapacity, remaining: config.burstCapacity, reset: 0 };
  }
  
  const now = Date.now();
  const refillRate = config.requestsPerMinute / 60;
  const elapsedMs = now - bucket.lastRefill;
  const tokensToAdd = (elapsedMs / 1000) * refillRate;
  const currentTokens = Math.min(config.burstCapacity, bucket.tokens + tokensToAdd);
  
  // Calculate when bucket will be full
  const tokensToFull = config.burstCapacity - currentTokens;
  const resetSeconds = Math.ceil(tokensToFull / refillRate);
  
  return {
    limit: config.burstCapacity,
    remaining: Math.floor(currentTokens),
    reset: resetSeconds,
  };
}

/**
 * Reset rate limit for an app (useful for testing)
 */
export function resetRateLimit(appId: string): void {
  buckets.delete(appId);
}
