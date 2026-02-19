import { Shell } from '@/components/Shell';
import { ensureSmartNotesSchema } from '@/lib/smartNotesSchema';
import { dbExec } from '@/lib/db';
import { redirect } from 'next/navigation';

export const runtime = 'nodejs';
const APP_ID = 'smart-notes';

export default async function NewNotePage() {
  ensureSmartNotesSchema();
  
  // Create a new blank note and redirect to it
  const now = new Date().toISOString();
  dbExec(
    APP_ID,
    `INSERT INTO notes (title, body, tags, pinned, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['', '', '', 0, now, now]
  );
  
  const result = dbExec(APP_ID, 'SELECT last_insert_rowid() as id');
  const id = (result as any)?.lastInsertRowid || 1;
  
  redirect(`/apps/smart-notes/${id}`);
}
