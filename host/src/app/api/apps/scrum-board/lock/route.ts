import { NextResponse } from 'next/server';
import { ensureScrumBoardSchema, getActiveLock, reconcileAgentLock } from '@/lib/scrumBoardSchema';

export const runtime = 'nodejs';

export async function GET() {
  ensureScrumBoardSchema();
  reconcileAgentLock();
  const lock = getActiveLock();
  
  return NextResponse.json({
    ok: true,
    locked: lock !== null,
    lock: lock ? {
      locked_at: lock.locked_at,
      task_id: lock.task_id,
      session_id: lock.session_id,
      expires_at: lock.expires_at,
    } : null,
  });
}
