import { Shell } from '@/components/Shell';
import { listApps } from '@/lib/registry';
import { externalProjects } from '@/lib/externalProjects';
import { ensureScrumBoardSchema } from '@/lib/scrumBoardSchema';
import { Suspense } from 'react';
import ScrumBoardClient from './ScrumBoardClient';

export const runtime = 'nodejs';

export default async function ScrumBoardPage() {
  ensureScrumBoardSchema();
  const apps = await listApps();
  const appIds = apps.map((a) => a.id);
  // Also include citadel (host) as a meta entity
  if (!appIds.includes('citadel')) {
    appIds.push('citadel');
  }
  // Include external projects
  const externalIds = externalProjects.map((p) => p.id);

  return (
    <Shell title="Scrum Board" subtitle="Manage tasks and trigger agent runs per app">
      <Suspense fallback={<div className="p-8 text-zinc-500">Loading board...</div>}>
        <ScrumBoardClient appIds={appIds} externalIds={externalIds} />
      </Suspense>
    </Shell>
  );
}
