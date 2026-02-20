import { NextResponse } from 'next/server';
import { dbExec } from '@/lib/db';

export const runtime = 'nodejs';
const APP_ID = 'friend-tracker';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const meetingId = Number(id);
  
  if (!Number.isFinite(meetingId)) {
    return NextResponse.json({ ok: false, error: 'Invalid id' }, { status: 400 });
  }
  
  dbExec(APP_ID, `DELETE FROM meetings WHERE id = ?`, [meetingId]);
  
  return NextResponse.json({ ok: true });
}
