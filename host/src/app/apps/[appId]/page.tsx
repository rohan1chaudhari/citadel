import { notFound } from 'next/navigation';
import { listApps } from '@/lib/registry';

export const runtime = 'nodejs';

export default async function AppPage({
  params,
  searchParams,
}: {
  params: Promise<{ appId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { appId } = await params;
  const qs = (await searchParams) ?? {};

  const apps = await listApps();
  const app = apps.find((a) => a.id === appId);
  if (!app) return notFound();

  const isExternal = app.source === 'registry' && Boolean(app.upstream_base_url);

  if (isExternal) {
    const proxyRoot = `/api/gateway/apps/${app.id}/proxy`;

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
