import { listApps } from '@/lib/registry';

export const runtime = 'nodejs';

export default async function HomePage() {
  const apps = await listApps();

  return (
    <main>
      <h1>Citadel</h1>
      <p>Installed apps:</p>
      <ul>
        {apps.map((a) => (
          <li key={a.id}>
            <a href={`/apps/${a.id}`}>{a.name}</a> <small style={{ opacity: 0.7 }}>({a.id}{a.version ? ` v${a.version}` : ''})</small>
          </li>
        ))}
      </ul>
      <p style={{ opacity: 0.7 }}>
        Source: repo <code>apps/*/app.yaml</code>
      </p>
    </main>
  );
}
