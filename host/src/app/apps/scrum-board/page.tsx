import { Shell } from '@/components/Shell';
import { listApps } from '@/lib/registry';
import { ensureScrumBoardSchema } from '@/lib/scrumBoardSchema';
import { ScrumBoardClient } from './ScrumBoardClient';

export const runtime = 'nodejs';

export default async function ScrumBoardPage() {
  ensureScrumBoardSchema();
  const apps = await listApps();
  const appIds = apps.map((a) => a.id).filter((id) => id !== 'scrum-board');

  return (
    <Shell title="Scrum Board" subtitle="One board per app · Step 1+2+3: priority + assignee + due date enabled">
      <ScrumBoardClient appIds={appIds} />
    </Shell>
  );
}
