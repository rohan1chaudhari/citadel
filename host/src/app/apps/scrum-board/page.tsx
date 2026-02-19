import { Shell } from '@/components/Shell';
import ScrumBoardClient from './ScrumBoardClient';

export const runtime = 'nodejs';

export default function ScrumBoardPage() {
  return (
    <Shell title="Scrum Board" subtitle="Manage tasks and trigger agent runs per app">
      <ScrumBoardClient />
    </Shell>
  );
}
