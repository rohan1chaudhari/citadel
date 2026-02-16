import { Card, LinkA, Shell } from '@/components/Shell';
import { listApps } from '@/lib/registry';

export const runtime = 'nodejs';

export default async function HomePage() {
  const apps = await listApps();

  return (
    <Shell title="Home" subtitle="Your local-first app hub">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Installed apps</h2>
            <p className="mt-1 text-sm text-zinc-600">Discovered from <code className="rounded bg-zinc-100 px-1 py-0.5">apps/*/app.yaml</code></p>
          </div>
          <div className="text-xs text-zinc-500">{apps.length} app{apps.length === 1 ? '' : 's'}</div>
        </div>

        <div className="mt-4 grid gap-3">
          {apps.map((a) => (
            <a
              key={a.id}
              href={`/apps/${a.id}`}
              className="group rounded-lg border border-zinc-200 bg-white p-3 hover:bg-zinc-50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-zinc-900 group-hover:underline">{a.name}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {a.id}{a.version ? ` · v${a.version}` : ''}
                  </div>
                </div>
                <div className="text-xs text-zinc-500">Open →</div>
              </div>
            </a>
          ))}
        </div>

        <div className="mt-4 flex gap-3">
          <LinkA href="/api/apps/smart-notes/health" target="_blank" rel="noreferrer">API health (smart-notes)</LinkA>
          <LinkA href="/api/apps/gym-tracker/health" target="_blank" rel="noreferrer">API health (gym-tracker)</LinkA>
        </div>
      </Card>
    </Shell>
  );
}
