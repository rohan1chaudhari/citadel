import { notFound } from 'next/navigation';
import { listApps } from '@/lib/registry';

export const runtime = 'nodejs';

export default async function AppPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params;
  const apps = await listApps();
  const app = apps.find((a) => a.id === appId);
  if (!app) return notFound();

  const isExternal = app.source === 'registry' && Boolean(app.upstream_base_url);

  if (isExternal) {
    const proxyRoot = `/api/gateway/apps/${app.id}/proxy/`;
    return (
      <main style={{ display: 'grid', gap: 12 }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>{app.name}</h1>
          <p style={{ opacity: 0.7, margin: 0 }}>
            External app via Citadel Gateway proxy · appId: {app.id}
          </p>
        </div>
        <iframe
          src={proxyRoot}
          title={`${app.name} (${app.id})`}
          style={{ width: '100%', minHeight: '80vh', border: '1px solid #2a2a2a', borderRadius: 8 }}
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
