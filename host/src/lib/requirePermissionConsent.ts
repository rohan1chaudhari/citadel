import { getAppManifest } from '@citadel/core';
import { needsPermissionConsent } from '@citadel/core';
import { redirect } from 'next/navigation';

/**
 * Check if an app needs permission consent and redirect to consent page if so.
 * Call this at the start of app pages to enforce permission consent on first visit.
 */
export async function requirePermissionConsent(appId: string): Promise<void> {
  const manifest = await getAppManifest(appId);
  if (!manifest) return; // App not found, let the page handle 404
  
  const requested = manifest.permissions ?? {};
  const needsConsent = needsPermissionConsent(appId, requested);
  
  if (needsConsent) {
    redirect(`/apps/${appId}/consent?returnTo=${encodeURIComponent(`/apps/${appId}`)}`);
  }
}
