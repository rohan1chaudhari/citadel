import { NextResponse } from 'next/server';
import { getAppManifest } from '@citadel/core';
import { 
  getAppPermissions, 
  getAllAppPermissions, 
  setAppPermissions, 
  revokeAppPermissions,
  needsPermissionConsent,
  type PermissionScopes 
} from '@citadel/core';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const appId = url.searchParams.get('app');
  
  if (appId) {
    const manifest = await getAppManifest(appId);
    if (!manifest) {
      return NextResponse.json({ ok: false, error: 'App not found' }, { status: 404 });
    }
    
    const granted = getAppPermissions(appId);
    const needsConsent = needsPermissionConsent(appId, manifest.permissions ?? {});
    
    return NextResponse.json({
      ok: true,
      appId,
      appName: manifest.name,
      requested: manifest.permissions ?? {},
      granted: granted?.scopes ?? null,
      needsConsent,
    });
  }
  
  // Return all permissions
  const all = getAllAppPermissions();
  return NextResponse.json({ ok: true, permissions: all });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const appId = String(body?.appId ?? '').trim();
  const scopes: PermissionScopes = body?.scopes ?? {};
  
  if (!appId) {
    return NextResponse.json({ ok: false, error: 'appId required' }, { status: 400 });
  }
  
  const manifest = await getAppManifest(appId);
  if (!manifest) {
    return NextResponse.json({ ok: false, error: 'App not found' }, { status: 404 });
  }
  
  setAppPermissions(appId, scopes);
  
  return NextResponse.json({ ok: true, appId, scopes });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const appId = url.searchParams.get('app');
  
  if (!appId) {
    return NextResponse.json({ ok: false, error: 'app required' }, { status: 400 });
  }
  
  revokeAppPermissions(appId);
  
  return NextResponse.json({ ok: true, appId });
}
