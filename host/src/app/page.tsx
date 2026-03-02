import { Card, LinkA, Shell } from '@/components/Shell';
import { listApps, isSetupComplete } from '@citadel/core';
import { AppGrid } from './AppGrid';
import { WidgetSection } from './WidgetSection';
import { GlobalSearch } from './GlobalSearch';
import { redirect } from 'next/navigation';

export const runtime = 'nodejs';

export default async function HomePage() {
  // Redirect to setup if not completed
  if (!isSetupComplete()) {
    redirect('/setup');
  }

  const apps = await listApps(false); // exclude hidden apps

  return (
    <Shell title="Citadel" subtitle="Your local-first app hub">
      <div className="flex justify-end">
        <GlobalSearch apps={apps} />
      </div>

      <AppGrid apps={apps} />

      <WidgetSection apps={apps} />

      <Card className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-zinc-600">
            {apps.length} app{apps.length === 1 ? '' : 's'} installed
          </div>
          <div className="flex items-center gap-4">
            <LinkA href="/browse">Browse Apps →</LinkA>
            <LinkA href="/permissions">Permissions</LinkA>
            <LinkA href="/status">View System Status →</LinkA>
          </div>
        </div>
      </Card>
    </Shell>
  );
}
