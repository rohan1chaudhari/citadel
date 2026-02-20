import { ensureScrumBoardSchema } from '@/lib/scrumBoardSchema';
import SessionStreamClient from './SessionStreamClient';

export const runtime = 'nodejs';

export default async function SessionStreamPageWrapper({ params }: { params: Promise<{ sessionId: string }> }) {
  // Ensure schema is set up (for SSR)
  ensureScrumBoardSchema();
  
  return <SessionStreamClient params={params} />;
}
