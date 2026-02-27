import { NextResponse } from 'next/server';
import { getRegisteredApp } from '@/lib/registry';

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

async function proxy(req: Request, appId: string, pathParts: string[]) {
  const app = getRegisteredApp(appId);
  if (!app || !app.upstream_base_url || app.enabled === false) {
    return NextResponse.json({ ok: false, error: 'app not registered or disabled' }, { status: 404 });
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

    const body = req.method === 'HEAD' ? null : await upstreamRes.arrayBuffer();
    const respHeaders = new Headers(upstreamRes.headers);
    respHeaders.delete('content-encoding');
    respHeaders.delete('content-length');

    return new NextResponse(body, {
      status: upstreamRes.status,
      headers: respHeaders
    });
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
