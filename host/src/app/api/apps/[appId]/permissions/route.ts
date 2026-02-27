import { NextResponse } from 'next/server';
import { listApps } from '@/lib/registry';
import { getPermissionOverrides, resolveEffectivePermissions, setPermissionOverride } from '@/lib/permissionBroker';
import type { AppPermission } from '@/lib/citadelAppContract';

export const runtime = 'nodejs';

const ALLOWED = new Set<AppPermission>([
  'notifications',
  'camera',
  'microphone',
  'gallery',
  'filesystem',
  'agent:run',
]);

export async function GET(_req: Request, ctx: { params: Promise<{ appId: string }> }) {
  const { appId } = await ctx.params;
  const apps = await listApps(true);
  const app = apps.find((a) => a.id === appId);
  if (!app) return NextResponse.json({ ok: false, error: 'app not found' }, { status: 404 });

  const declared = app.permissions ?? [];
  const overrides = getPermissionOverrides(appId);
  const effective = resolveEffectivePermissions(declared, overrides);

  return NextResponse.json({ ok: true, appId, permissions: effective });
}

export async function POST(req: Request, ctx: { params: Promise<{ appId: string }> }) {
  const { appId } = await ctx.params;
  const body = await req.json().catch(() => ({} as any));
  const permission = String(body?.permission ?? '') as AppPermission;
  const granted = Boolean(body?.granted);

  if (!ALLOWED.has(permission)) {
    return NextResponse.json({ ok: false, error: 'invalid permission' }, { status: 400 });
  }

  const apps = await listApps(true);
  const app = apps.find((a) => a.id === appId);
  if (!app) return NextResponse.json({ ok: false, error: 'app not found' }, { status: 404 });
  if (!(app.permissions ?? []).includes(permission)) {
    return NextResponse.json({ ok: false, error: 'permission not declared by app' }, { status: 400 });
  }

  setPermissionOverride(appId, permission, granted);
  return NextResponse.json({ ok: true, appId, permission, granted });
}
