import { Shell } from '@/components/Shell';
import { listApps } from '@/lib/registry';
import { ensureScrumBoardSchema } from '@/lib/scrumBoardSchema';
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

  return (
    <Shell title="Scrum Board" subtitle="Manage tasks and trigger agent runs per app">
      <ScrumBoardClient appIds={appIds} />
    </Shell>
  );
}
