import { Shell } from '@/components/Shell';
import { ensureSmartNotesSchema } from '@/lib/smartNotesSchema';
import { dbExec, dbQuery } from '@/lib/db';
import { redirect } from 'next/navigation';

export const runtime = 'nodejs';
const APP_ID = 'smart-notes';

export default async function NewNotePage() {
  ensureSmartNotesSchema();
  
  // Check for recent empty note (within last 5 minutes, empty title+body)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const recentEmpty = dbQuery<{ id: number }>(
    APP_ID,
    `SELECT id FROM notes 
     WHERE title = '' 
       AND body = '' 
       AND created_at > ? 
       AND deleted_at IS NULL
     ORDER BY created_at DESC 
     LIMIT 1`,
    [fiveMinutesAgo]
  )[0];

  // Reuse recent empty note instead of creating another
  if (recentEmpty?.id) {
    redirect(`/apps/smart-notes/${recentEmpty.id}`);
  }
  
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
