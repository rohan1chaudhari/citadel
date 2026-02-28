import { notFound } from 'next/navigation';
import { listApps } from '@/lib/registry';

export const runtime = 'nodejs';

export default async function AppPage({
  params,
  searchParams,
}: {
  params: Promise<{ appId: string }>;
  searchParams?: Promise<{ fullscreen?: string }>;
}) {
  const { appId } = await params;
  const qs = (await searchParams) ?? {};

  const apps = await listApps();
  const app = apps.find((a) => a.id === appId);
  if (!app) return notFound();

  const isExternal = app.source === 'registry' && Boolean(app.upstream_base_url);

  if (isExternal) {
    const proxyRoot = `/api/gateway/apps/${app.id}/proxy`;
    const openFull = `${proxyRoot}`;

    if (qs.fullscreen === '1') {
      return (
        <main style={{ padding: 0 }}>
          <iframe
            src={proxyRoot}
            title={`${app.name} (${app.id})`}
            style={{ width: '100%', height: '100vh', border: 0 }}
          />
        </main>
      );
    }

    return (
      <main style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0 }}>{app.name}</h1>
            <p style={{ opacity: 0.7, margin: '4px 0 0 0', fontSize: 13 }}>appId: {app.id}</p>
          </div>
          <a
            href={openFull}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 13, textDecoration: 'none', padding: '6px 10px', border: '1px solid #ddd', borderRadius: 8 }}
          >
            Open full screen
          </a>
        </div>
        <iframe
          src={proxyRoot}
          title={`${app.name} (${app.id})`}
          style={{ width: '100%', minHeight: '82vh', border: '1px solid #ddd', borderRadius: 10, background: '#fff' }}
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
