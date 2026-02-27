import { NextResponse } from 'next/server';
import { getRegisteredApp } from '@/lib/registry';
import { getPermissionOverrides, isPermissionGranted } from '@/lib/permissionBroker';
import type { AppPermission } from '@/lib/citadelAppContract';

export const runtime = 'nodejs';

function joinUpstream(base: string, pathParts: string[], search: string): string {
  const cleanBase = base.replace(/\/$/, '');
  const rel = pathParts.join('/');
  const path = rel ? `/${rel}` : '/';
  return `${cleanBase}${path}${search}`;
}

function copyHeaders(req: Request): Headers {
  const out = new Headers();
  req.headers.forEach((v, k) => {
    const key = k.toLowerCase();
    if (key === 'host' || key === 'connection' || key === 'content-length') return;
    out.set(k, v);
  });
  return out;
}

function requiredPermissionForRequest(method: string, pathParts: string[]): AppPermission | null {
  const path = `/${pathParts.join('/')}`.toLowerCase();
  const m = method.toUpperCase();

  // Heuristic capability mapping for external apps.
  if (path.includes('transcribe') || path.includes('microphone') || path.includes('voice')) return 'microphone';
  if (path.includes('camera') || path.includes('photo/capture')) return 'camera';
  if (path.includes('gallery') || path.includes('photos')) return 'gallery';
  if (path.includes('upload') || path.includes('files')) return 'filesystem';
  if (path.includes('notify') || path.includes('notification')) return 'notifications';
  if ((path.includes('agent') || path.includes('autopilot') || path.includes('trigger')) && m !== 'GET') return 'agent:run';

  return null;
}

async function proxy(req: Request, appId: string, pathParts: string[]) {
  const app = getRegisteredApp(appId);
  if (!app || !app.upstream_base_url || app.enabled === false) {
    return NextResponse.json({ ok: false, error: 'app not registered or disabled' }, { status: 404 });
  }

  const requiredPermission = requiredPermissionForRequest(req.method, pathParts);
  if (requiredPermission) {
    const overrides = getPermissionOverrides(appId);
    const allowed = isPermissionGranted(app.permissions, overrides, requiredPermission);
    if (!allowed.allowed) {
      return NextResponse.json(
        { ok: false, error: 'permission denied', permission: requiredPermission, details: allowed.reason },
        { status: 403 }
      );
    }
  }

  const url = new URL(req.url);
  const upstreamUrl = joinUpstream(app.upstream_base_url, pathParts, url.search);

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      method: req.method,
      headers: copyHeaders(req),
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer(),
      redirect: 'manual'
    });

    const respHeaders = new Headers(upstreamRes.headers);
    respHeaders.delete('content-encoding');
    respHeaders.delete('content-length');

    if (req.method === 'HEAD') {
      return new NextResponse(null, { status: upstreamRes.status, headers: respHeaders });
    }

    const contentType = (upstreamRes.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('text/html')) {
      const proxyPrefix = `/api/gateway/apps/${appId}/proxy`;
      let html = await upstreamRes.text();
      // Rewrite root-absolute asset URLs so standalone apps work behind proxy prefixes.
      html = html
        .replaceAll('"/_next/', `"${proxyPrefix}/_next/`)
        .replaceAll("'/_next/", `'${proxyPrefix}/_next/`)
        .replaceAll('"/favicon', `"${proxyPrefix}/favicon`)
        .replaceAll("'/favicon", `'${proxyPrefix}/favicon`);

      return new NextResponse(html, {
        status: upstreamRes.status,
        headers: respHeaders
      });
    }

    const body = await upstreamRes.arrayBuffer();
    return new NextResponse(body, { status: upstreamRes.status, headers: respHeaders });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: 'upstream unavailable', details: String(e?.message ?? e) },
      { status: 502 }
    );
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ appId: string; path: string[] }> }) {
  const { appId, path } = await ctx.params;
  return proxy(req, appId, path ?? []);
}

export async function POST(req: Request, ctx: { params: Promise<{ appId: string; path: string[] }> }) {
  const { appId, path } = await ctx.params;
  return proxy(req, appId, path ?? []);
}

export async function PUT(req: Request, ctx: { params: Promise<{ appId: string; path: string[] }> }) {
  const { appId, path } = await ctx.params;
  return proxy(req, appId, path ?? []);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ appId: string; path: string[] }> }) {
  const { appId, path } = await ctx.params;
  return proxy(req, appId, path ?? []);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ appId: string; path: string[] }> }) {
  const { appId, path } = await ctx.params;
  return proxy(req, appId, path ?? []);
}
