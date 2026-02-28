import { NextResponse } from 'next/server';
import { listApps, registerApp, getRegisteredApp } from '@/lib/registry';
import { validateCitadelAppContract, type CitadelAppContractV0 } from '@/lib/citadelAppContract';
import fs from 'node:fs/promises';

export const runtime = 'nodejs';

async function checkAppHealth(appId: string, upstreamBaseUrl: string, healthPath: string): Promise<{ status: 'healthy' | 'unhealthy' | 'unknown'; statusCode?: number; error?: string }> {
  try {
    const target = `${upstreamBaseUrl.replace(/\/$/, '')}${healthPath}`;
    const res = await fetch(target, { method: 'GET', signal: AbortSignal.timeout(5000) });
    return {
      status: res.ok ? 'healthy' : 'unhealthy',
      statusCode: res.status
    };
  } catch (e: any) {
    return {
      status: 'unknown',
      error: String(e?.message ?? e)
    };
  }
}

async function fetchManifestFromUrl(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) {
    throw new Error(`Failed to fetch manifest: HTTP ${res.status}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  // Try parsing as JSON even if content-type doesn't match
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Manifest from URL is not valid JSON');
  }
}

async function loadManifestFromFile(filePath: string): Promise<unknown> {
  // Security: only allow paths within the repo
  const repoRoot = process.cwd();
  const resolvedPath = new URL(filePath, `file://${repoRoot}/`).pathname;
  if (!resolvedPath.startsWith(repoRoot)) {
    throw new Error('File path must be within the repository');
  }
  const raw = await fs.readFile(resolvedPath, 'utf8');
  return JSON.parse(raw);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const includeHidden = url.searchParams.get('includeHidden') === 'true';
  const includeHealth = url.searchParams.get('health') !== 'false'; // default true

  const apps = await listApps(includeHidden);
  
  // Enrich with health status if requested
  const enrichedApps = await Promise.all(
    apps.map(async (app) => {
      const registered = getRegisteredApp(app.id);
      if (includeHealth && registered?.upstream_base_url && registered.health) {
        const health = await checkAppHealth(app.id, registered.upstream_base_url, registered.health);
        return { ...app, health };
      }
      return { ...app, health: { status: 'unknown' as const } };
    })
  );
  
  return NextResponse.json({ ok: true, apps: enrichedApps });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));

  // Support multiple manifest sources: inline, URL, or file path
  let manifest: unknown;
  let manifestSource: string;

  if (body?.manifestUrl) {
    // Fetch manifest from URL
    try {
      manifest = await fetchManifestFromUrl(body.manifestUrl);
      manifestSource = `url:${body.manifestUrl}`;
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch manifest from URL', details: String(e?.message ?? e) },
        { status: 400 }
      );
    }
  } else if (body?.manifestFile) {
    // Load manifest from file path
    try {
      manifest = await loadManifestFromFile(body.manifestFile);
      manifestSource = `file:${body.manifestFile}`;
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: 'Failed to load manifest from file', details: String(e?.message ?? e) },
        { status: 400 }
      );
    }
  } else if (body?.manifest) {
    // Inline manifest
    manifest = body.manifest;
    manifestSource = 'inline';
  } else {
    return NextResponse.json(
      { ok: false, error: 'manifest, manifestUrl, or manifestFile required' },
      { status: 400 }
    );
  }

  const validated = validateCitadelAppContract(manifest);
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: 'invalid manifest', details: validated.errors, source: manifestSource },
      { status: 400 }
    );
  }

  const upstreamBaseUrl = String(body?.upstreamBaseUrl ?? '').trim();
  if (!upstreamBaseUrl) {
    return NextResponse.json({ ok: false, error: 'upstreamBaseUrl required' }, { status: 400 });
  }

  try {
    const result = registerApp({
      manifest: validated.value,
      upstreamBaseUrl,
      enabled: body?.enabled
    });
    return NextResponse.json({ ok: true, ...result, manifestSource });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 400 });
  }
}
