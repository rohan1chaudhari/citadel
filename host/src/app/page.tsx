import { Card, LinkA, Shell } from '@/components/Shell';
import { listApps } from '@/lib/registry';
import { AppGrid } from './AppGrid';

export const runtime = 'nodejs';

export default async function HomePage() {
  const apps = await listApps(false); // exclude hidden apps

  return (
    <Shell title="Citadel" subtitle="Your local-first app hub">
      <AppGrid apps={apps} />

      <Card className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-zinc-600">
            {apps.length} app{apps.length === 1 ? '' : 's'} installed
          </div>
          <LinkA href="/status">View System Status →</LinkA>
        </div>
      </Card>
    </Shell>
  );
}
