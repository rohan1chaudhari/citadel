import { notFound, redirect } from 'next/navigation';
import { listApps } from '@/lib/registry';

export const runtime = 'nodejs';

// Legacy internal apps that have been removed without external equivalents
const removedApps: Record<string, { redirectTo: string; message?: string }> = {
  'friend-tracker': { redirectTo: '/', message: 'Friend Tracker has been removed' },
  'promo-kit': { redirectTo: '/', message: 'Promo Kit has been removed' },
  'soumil-mood-tracker': { redirectTo: '/', message: 'Mood Tracker has been removed' },
};

export default async function AppCatchAllPage({
  params,
  searchParams,
}: {
  params: Promise<{ appId: string; path?: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { appId, path = [] } = await params;
  const qs = (await searchParams) ?? {};

  // Check if this is a removed legacy app
  if (removedApps[appId]) {
    const { redirectTo } = removedApps[appId];
    redirect(`${redirectTo}?legacyApp=${appId}`);
  }

  // Handle legacy *-external aliases
  const aliasMap: Record<string, string> = {
    'french-translator-external': 'french-translator',
    'gym-tracker-external': 'gym-tracker',
    'smart-notes-external': 'smart-notes',
    'scrum-board-external': 'scrum-board',
  };
  const canonicalId = aliasMap[appId] ?? appId;

  // Redirect to canonical ID if needed (preserving path and query)
  if (canonicalId !== appId) {
    const pass = new URLSearchParams();
    for (const [k, v] of Object.entries(qs)) {
      if (typeof v === 'string') pass.set(k, v);
      else if (Array.isArray(v)) for (const item of v) if (item != null) pass.append(k, item);
    }
    const subPath = path.length > 0 ? `/${path.join('/')}` : '';
    const suffix = pass.toString();
    redirect(`/apps/${canonicalId}${subPath}${suffix ? `?${suffix}` : ''}`);
  }

  const apps = await listApps();
  const app = apps.find((a) => a.id === canonicalId);
  if (!app) return notFound();

  const isExternal = app.source === 'registry' && Boolean(app.upstream_base_url);

  if (isExternal) {
    // Build proxy URL with sub-path
    const subPath = path.length > 0 ? `/${path.join('/')}` : '';
    const proxyRoot = `/api/gateway/apps/${app.id}/proxy${subPath}`;

    const passthrough = new URLSearchParams();
    for (const [k, v] of Object.entries(qs)) {
      if (k === 'fullscreen') continue;
      if (typeof v === 'string') passthrough.set(k, v);
      else if (Array.isArray(v)) for (const item of v) if (item != null) passthrough.append(k, item);
    }
    const query = passthrough.toString();
    const iframeSrc = query ? `${proxyRoot}?${query}` : proxyRoot;

    if (qs.fullscreen === '1') {
      return (
        <main style={{ padding: 0 }}>
          <iframe
            src={iframeSrc}
            title={`${app.name} (${app.id})`}
            style={{ width: '100%', height: '100vh', border: 0 }}
          />
        </main>
      );
    }

    return (
      <main style={{ padding: 0 }}>
        <iframe
          src={iframeSrc}
          title={`${app.name} (${app.id})`}
          style={{ width: '100%', height: 'calc(100vh - 56px)', border: 0, display: 'block' }}
        />
      </main>
    );
  }

  // For internal apps with sub-paths, redirect to main page
  if (path.length > 0) {
    redirect(`/apps/${canonicalId}`);
  }

  // Internal app root page
  return (
    <main>
      <h1>{app.name}</h1>
      <p style={{ opacity: 0.7 }}>appId: {app.id}</p>
      <p>
        <a href={`/api/apps/${app.id}/health`} target="_blank" rel="noreferrer">health</a>
        {' | '}
        <a href={`/api/apps/${app.id}/selftest`} target="_blank" rel="noreferrer">selftest (db + storage)</a>
      </p>
      <p>This is the generic shell. Prefer per-app pages under <code>/apps/{app.id}</code> when present.</p>
    </main>
  );
}
