import { Card, LinkA, Shell } from '@/components/Shell';

export const runtime = 'nodejs';

const apps = [
  { id: 'smart-notes', name: 'Smart Notes' },
  { id: 'gym-tracker', name: 'Gym Tracker' },
  { id: 'scrum-board', name: 'Scrum Board' },
  { id: 'soumil-mood-tracker', name: 'Soumil Mood Tracker' },
];

export default function StatusPage() {
  return (
    <Shell title="System Status" subtitle="Health checks and diagnostics">
      <div className="grid gap-4">
        <Card>
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">API Health Checks</h2>
          <div className="grid gap-2">
            {apps.map((app) => (
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
            <LinkA href="/api/apps/scrum-board/health" target="_blank" rel="noreferrer">
              Scrum Board API
            </LinkA>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">Quick Links</h2>
          <div className="flex flex-wrap gap-3">
            <LinkA href="/apps/scrum-board">Scrum Board</LinkA>
            <LinkA href="/apps/soumil-mood-tracker">Soumil Mood Tracker</LinkA>
          </div>
        </Card>
      </div>
    </Shell>
  );
}
