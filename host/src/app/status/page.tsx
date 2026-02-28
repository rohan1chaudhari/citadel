import { Card, LinkA, Shell } from '@/components/Shell';
import { listApps, getRegisteredApp } from '@/lib/registry';

export const runtime = 'nodejs';

// Apps that should always appear in status (host system apps)
const SYSTEM_APPS = [
  { id: 'citadel', name: 'Citadel Host' },
];

export default async function StatusPage() {
  // Dynamically fetch all registered apps from registry
  const apps = await listApps(true); // include hidden
  const registeredApps = apps.filter(app => app.source === 'registry' && app.upstream_base_url);

  return (
    <Shell title="System Status" subtitle="Health checks and diagnostics">
      <div className="grid gap-4">
        <Card>
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">External Apps (Registry)</h2>
          <div className="grid gap-2">
            {registeredApps.length === 0 ? (
              <div className="text-sm text-zinc-500 italic p-3">
                No external apps registered. Apps will appear here when registered via the gateway.
              </div>
            ) : (
              registeredApps.map((app) => (
                <a
                  key={app.id}
                  href={`/api/apps/${app.id}/health`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors"
                >
                  <span className="text-sm font-medium text-zinc-900">{app.name}</span>
                  <span className="text-xs text-zinc-500">/api/apps/{app.id}/health →</span>
                </a>
              ))
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">System Health Checks</h2>
          <div className="grid gap-2">
            {SYSTEM_APPS.map((app) => (
              <a
                key={app.id}
                href={`/api/apps/${app.id}/health`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors"
              >
                <span className="text-sm font-medium text-zinc-900">{app.name}</span>
                <span className="text-xs text-zinc-500">/api/apps/{app.id}/health →</span>
              </a>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">Diagnostics</h2>
          <div className="flex flex-wrap gap-3">
            <LinkA href="/api/health" target="_blank" rel="noreferrer">
              Host Health
            </LinkA>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">Quick Links</h2>
          <div className="flex flex-wrap gap-3">
            {registeredApps.slice(0, 4).map((app) => (
              <LinkA key={app.id} href={`/apps/${app.id}`}>{app.name}</LinkA>
            ))}
          </div>
        </Card>
      </div>
    </Shell>
  );
}
