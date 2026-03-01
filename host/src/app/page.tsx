import { Card, LinkA, Shell } from '@/components/Shell';
import { listApps } from '@citadel/core';
import { AppGrid } from './AppGrid';
import { GlobalSearch } from './GlobalSearch';

export const runtime = 'nodejs';

export default async function HomePage() {
  const apps = await listApps(false); // exclude hidden apps

  return (
    <Shell title="Citadel" subtitle="Your local-first app hub">
      <div className="flex justify-end">
        <GlobalSearch apps={apps} />
      </div>

      <AppGrid apps={apps} />

      <Card className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-zinc-600">
            {apps.length} app{apps.length === 1 ? '' : 's'} installed
          </div>
          <div className="flex items-center gap-4">
            <LinkA href="/permissions">Permissions</LinkA>
            <LinkA href="/status">View System Status →</LinkA>
          </div>
        </div>
      </Card>
    </Shell>
  );
}
