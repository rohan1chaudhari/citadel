import { Shell } from '@/components/Shell';
import { listApps } from '@citadel/core';
import { externalProjects } from '@/lib/externalProjects';
import { ensureScrumBoardSchema } from '@/lib/scrumBoardSchema';
import { requirePermissionConsent } from '@/lib/requirePermissionConsent';
import { Suspense } from 'react';
import ScrumBoardClient from './ScrumBoardClient';

export const runtime = 'nodejs';
const APP_ID = 'scrum-board';

export default async function ScrumBoardPage() {
  // Check and require permission consent on first visit
  await requirePermissionConsent(APP_ID);
  
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
