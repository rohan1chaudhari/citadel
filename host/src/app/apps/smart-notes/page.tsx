import { Shell } from '@/components/Shell';
import { dbExec, dbQuery } from '@/lib/db';
import { SmartNotesClient } from './SmartNotesClient';
import { ensureSmartNotesSchema } from '@/lib/smartNotesSchema';

export const runtime = 'nodejs';
const APP_ID = 'smart-notes';

function ensureSchema() {
  ensureSmartNotesSchema();
}

export default async function SmartNotesPage() {
  ensureSchema();
  const rows = dbQuery<any>(
    APP_ID,
    `SELECT id, title, body, tags, created_at, updated_at, pinned
     FROM notes
     WHERE deleted_at IS NULL
     ORDER BY pinned DESC, COALESCE(updated_at, created_at) DESC, id DESC
     LIMIT 50`
  );

  // Client Components require plain JSON-serializable objects.
  // node:sqlite may return objects with non-standard prototypes.
  const notes = rows.map((r: any) => ({
    id: Number(r.id),
    title: r.title ?? null,
    body: r.body ?? null,
    tags: r.tags ?? null,
    created_at: String(r.created_at),
    updated_at: r.updated_at ?? null,
    pinned: Number(r.pinned ?? 0)
  }));

  return (
    <Shell title="Smart Notes" hideBrand>
      <SmartNotesClient initialNotes={notes} />
    </Shell>
  );
}
